import { NextResponse } from "next/server";
import { z } from "zod";

import {
  anatomyKeySchema,
  anatomyStateSchema,
  sexAssignedAtBirthSchema,
} from "@/contracts/profile";
import { ageOnDate, dateInTimeZone } from "@/domain/dates";
import { ValidationError } from "@/domain/shared/errors";
import { assertSameOrigin } from "@/server/auth/csrf";
import { requireProfileAccess } from "@/server/authorization/profile";
import { prisma } from "@/server/db/client";
import { optionalText, routeError } from "@/server/http";
import {
  normalizeProfileHealthContext,
  profileHealthContextInputSchema,
  synchronizeProfileHealthContext,
} from "@/server/profiles";
import { loadProfileSettingsContext } from "@/server/read-models";
import { rebuildRecommendations, recommendationChangeCounts } from "@/server/recommendations";

const anatomySchema = z
  .array(
    z.strictObject({
      key: anatomyKeySchema,
      state: anatomyStateSchema,
    }),
  )
  .length(5)
  .refine((items) => new Set(items.map(({ key }) => key)).size === 5, {
    message: "Each anatomy field must appear exactly once.",
  });

const schema = z.strictObject({
  displayName: z.string().trim().min(1).max(80),
  relationshipLabel: z.string().trim().min(1).max(50),
  dateOfBirth: z.iso.date(),
  sexAssignedAtBirth: sexAssignedAtBirthSchema,
  genderIdentity: z.string().trim().max(120).nullable(),
  timezone: z.string().trim().min(1).max(80),
  carePlanMode: z.enum(["evidence_based", "extra_attentive", "clinician_plan"]),
  anatomy: anatomySchema,
  healthContext: profileHealthContextInputSchema,
});

function assertTimezone(value: string): void {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
  } catch {
    throw new ValidationError("Choose a valid IANA timezone.");
  }
}

type RouteContext = { params: Promise<{ profileId: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { profileId } = await params;
    const { profile, capabilities } = await requireProfileAccess(profileId, "view");
    const settings = await loadProfileSettingsContext(profile.id);
    return NextResponse.json(
      {
        profile: {
          id: profile.id,
          displayName: profile.displayName,
          relationshipLabel: profile.relationshipLabel,
          dateOfBirth: profile.dateOfBirth,
          sexAssignedAtBirth: profile.sexAssignedAtBirth,
          genderIdentity: profile.genderIdentity,
          countryCode: profile.countryCode,
          timezone: profile.timezone,
          carePlanMode: profile.carePlanMode,
          visibility: profile.visibility,
          claimedAt: profile.claimedAt,
          createdAt: profile.createdAt,
          updatedAt: profile.updatedAt,
        },
        anatomy: settings.anatomy,
        healthContext: settings.healthContext,
        capabilities,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return routeError(error);
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    assertSameOrigin(request);
    const { profileId } = await params;
    const { session, profile } = await requireProfileAccess(profileId, "edit");
    const input = schema.parse(await request.json());
    assertTimezone(input.timezone);
    const today = dateInTimeZone(new Date(), input.timezone);
    const age = ageOnDate(input.dateOfBirth, today);
    if (age < 18) {
      throw new ValidationError("CareCadence currently supports adults age 18 and older.");
    }
    if (age > 130) throw new ValidationError("Check the date of birth and try again.");
    const healthContext = normalizeProfileHealthContext(input.healthContext, {
      dateOfBirth: input.dateOfBirth,
      measuredOn: today,
    });

    const planChanges = await prisma.$transaction(async (database) => {
      await database.profile.update({
        where: { id: profile.id },
        data: {
          displayName: input.displayName,
          relationshipLabel: input.relationshipLabel,
          dateOfBirth: new Date(`${input.dateOfBirth}T00:00:00.000Z`),
          sexAssignedAtBirth: input.sexAssignedAtBirth,
          genderIdentity: optionalText(input.genderIdentity),
          timezone: input.timezone,
          carePlanMode: input.carePlanMode,
        },
      });
      for (const anatomy of input.anatomy) {
        await database.profileAnatomy.upsert({
          where: {
            profileId_anatomyKey: { profileId: profile.id, anatomyKey: anatomy.key },
          },
          create: {
            profileId: profile.id,
            anatomyKey: anatomy.key,
            state:
              healthContext.anatomyUpdate?.key === anatomy.key
                ? healthContext.anatomyUpdate.state
                : anatomy.state,
          },
          update: {
            state:
              healthContext.anatomyUpdate?.key === anatomy.key
                ? healthContext.anatomyUpdate.state
                : anatomy.state,
          },
        });
      }
      const counts = await synchronizeProfileHealthContext(database, profile.id, healthContext);
      const rebuilt = await rebuildRecommendations(database, profile.id, today, {
        actorUserId: session.user.id,
        reason: "profile_edited",
      });
      await database.auditLog.create({
        data: {
          householdId: profile.householdId,
          profileId: profile.id,
          actorUserId: session.user.id,
          action: "profile.updated",
          entityType: "Profile",
          entityId: profile.id,
          metadataJson: {
            categories: ["profile", "anatomy", "risk_context", "health_history"],
            counts: {
              anatomy: input.anatomy.length,
              riskFactors: counts.riskFactorCount,
              conditions: counts.conditionCount,
              narrativeContexts: counts.narrativeContextCount,
            },
          },
        },
      });
      return recommendationChangeCounts(rebuilt.changes);
    });
    return NextResponse.json({ ok: true, planChanges });
  } catch (error) {
    return routeError(error);
  }
}
