import { NextResponse } from "next/server";
import { z } from "zod";

import { Prisma } from "@/generated/prisma/client";
import { assertSameOrigin } from "@/server/auth/csrf";
import { requireSession } from "@/server/auth/session";
import { prisma } from "@/server/db/client";
import { dateOnly, routeError } from "@/server/http";
import {
  onboardingDraftDataSchema,
  readStoredOnboardingDraftData,
  synchronizeProfileHealthContext,
  validateCompleteOnboarding,
  validateOnboardingStep,
} from "@/server/profiles";
import { rebuildRecommendations } from "@/server/recommendations";

const draftRequestSchema = z.object({
  status: z.literal("draft"),
  step: z.number().int().min(0).max(5),
  intent: z.enum(["save_exit", "continue"]),
  data: onboardingDraftDataSchema,
});
const completeRequestSchema = z.object({
  status: z.literal("complete"),
  step: z.literal(5),
  data: onboardingDraftDataSchema,
});
const requestSchema = z.discriminatedUnion("status", [draftRequestSchema, completeRequestSchema]);

const anatomyKeys = ["cervix", "breast_tissue", "prostate", "uterus", "ovaries"] as const;

function optionalText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

export async function GET() {
  try {
    const session = await requireSession();
    const draft = await prisma.onboardingDraft.findUnique({ where: { userId: session.user.id } });
    const data = readStoredOnboardingDraftData(draft?.dataJson);
    return NextResponse.json(draft === null ? { step: 0, data: {} } : { step: draft.step, data }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await requireSession();
    const input = requestSchema.parse(await request.json());
    if (input.status === "draft") {
      if (input.intent === "continue") {
        validateOnboardingStep(input.data, input.step);
      }
      const resumeStep = input.intent === "continue" ? Math.min(5, input.step + 1) : input.step;
      await prisma.onboardingDraft.upsert({
        where: { userId: session.user.id },
        create: {
          userId: session.user.id,
          step: resumeStep,
          dataJson: input.data as Prisma.InputJsonObject,
        },
        update: { step: resumeStep, dataJson: input.data as Prisma.InputJsonObject },
      });
      return NextResponse.json({ ok: true, step: resumeStep });
    }

    const validated = validateCompleteOnboarding(input.data);
    const { data: profileInput, healthContext, medication, today } = validated;
    const profile = await prisma.$transaction(async (database) => {
      const membership = await database.householdMember.findFirst({
        where: { userId: session.user.id, removedAt: null, household: { deletedAt: null } },
        orderBy: { joinedAt: "asc" },
      });
      const household =
        membership === null
          ? await database.household.create({
              data: {
                name: `${profileInput.displayName}'s household`,
                ownerUserId: session.user.id,
                timezone: profileInput.timezone,
                countryCode: profileInput.countryCode,
                members: { create: { userId: session.user.id, role: "owner" } },
              },
            })
          : await database.household.findUniqueOrThrow({ where: { id: membership.householdId } });

      const created = await database.profile.create({
        data: {
          householdId: household.id,
          ownerUserId: profileInput.ownership === "self" ? session.user.id : null,
          createdByUserId: session.user.id,
          displayName: profileInput.displayName,
          relationshipLabel: profileInput.relationshipLabel,
          dateOfBirth: new Date(`${profileInput.dateOfBirth}T00:00:00.000Z`),
          sexAssignedAtBirth: profileInput.sexAssignedAtBirth,
          genderIdentity: optionalText(profileInput.genderIdentity),
          countryCode: profileInput.countryCode,
          timezone: profileInput.timezone,
          carePlanMode: "evidence_based",
          visibility: profileInput.visibility,
          claimedAt: profileInput.ownership === "self" ? new Date() : null,
        },
      });

      await database.profileAnatomy.createMany({
        data: anatomyKeys.map((key) => ({
          profileId: created.id,
          anatomyKey: key,
          state:
            healthContext.anatomyUpdate?.key === key
              ? healthContext.anatomyUpdate.state
              : profileInput[`anatomy_${key}`],
        })),
      });
      const contextCounts = await synchronizeProfileHealthContext(
        database,
        created.id,
        healthContext,
      );
      const hasMedication = medication.name !== "";
      if (hasMedication) {
        await database.medication.create({
          data: {
            profileId: created.id,
            name: medication.name,
            dose: optionalText(medication.dose),
            frequency: optionalText(medication.frequency),
            prescriber: optionalText(medication.prescriber),
            reason: optionalText(medication.reason),
            startedStart: dateOnly(medication.started.start),
            startedEnd: dateOnly(medication.started.end),
            startedDatePrecision: medication.started.precision,
            monitoringInstructions: optionalText(medication.monitoringInstructions),
            nextReviewDate:
              medication.nextReview === ""
                ? null
                : new Date(`${medication.nextReview}T00:00:00.000Z`),
            status: "active",
          },
        });
      }

      await rebuildRecommendations(database, created.id, today, {
        actorUserId: session.user.id,
        reason: "profile_created",
      });
      await database.onboardingDraft.deleteMany({ where: { userId: session.user.id } });
      await database.auditLog.create({
        data: {
          householdId: household.id,
          profileId: created.id,
          actorUserId: session.user.id,
          action: "profile.created",
          entityType: "Profile",
          entityId: created.id,
          metadataJson: {
            categories: ["profile", "anatomy", "risk_context", "health_history", "medications"],
            counts: {
              anatomy: anatomyKeys.length,
              riskFactors: contextCounts.riskFactorCount,
              conditions: contextCounts.conditionCount,
              narrativeContexts: contextCounts.narrativeContextCount,
              medications: hasMedication ? 1 : 0,
            },
          },
        },
      });
      return created;
    });

    return NextResponse.json(
      {
        ok: true,
        profileId: profile.id,
        handoffUrl: `/app/profile/${profile.id}/plan-ready`,
      },
      { status: 201 },
    );
  } catch (error) {
    return routeError(error);
  }
}
