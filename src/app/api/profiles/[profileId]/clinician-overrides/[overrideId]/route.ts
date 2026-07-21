import { NextResponse } from "next/server";
import { z } from "zod";
import { clinicianOverrideInputSchema } from "@/contracts";
import { NotFoundError } from "@/domain/shared/errors";
import { Prisma } from "@/generated/prisma/client";
import { assertSameOrigin } from "@/server/auth/csrf";
import { requireProfileAccess } from "@/server/authorization/profile";
import { prisma } from "@/server/db/client";
import { dateOnly, optionalText, routeError } from "@/server/http";
import { rebuildRecommendations } from "@/server/recommendations";

const patchSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("pause") }),
  z.object({ action: z.literal("resume") }),
  z.object({ action: z.literal("replace"), input: clinicianOverrideInputSchema }),
]);

type RouteContext = { params: Promise<{ profileId: string; overrideId: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    assertSameOrigin(request);
    const { profileId, overrideId } = await params;
    const input = patchSchema.parse(await request.json());
    const { session, profile } = await requireProfileAccess(profileId, "edit");

    const result = await prisma.$transaction(async (database) => {
      const existing = await database.clinicianOverride.findFirst({
        where: { id: overrideId, profileId: profile.id, active: true },
      });
      if (existing === null) throw new NotFoundError();

      let resultingOverrideId = existing.id;
      let action: string;
      if (input.action === "pause" || input.action === "resume") {
        if (input.action === "resume" && existing.replacesGeneralGuideline) {
          await database.clinicianOverride.updateMany({
            where: {
              profileId: profile.id,
              serviceId: existing.serviceId,
              id: { not: existing.id },
              active: true,
              pausedAt: null,
              replacesGeneralGuideline: true,
            },
            data: { pausedAt: new Date() },
          });
        }
        await database.clinicianOverride.update({
          where: { id: existing.id },
          data: { pausedAt: input.action === "pause" ? new Date() : null },
        });
        action = `clinician_override.${input.action}d`;
      } else {
        const replacementInput = input.input;
        if (replacementInput.serviceId !== existing.serviceId) throw new NotFoundError();
        await database.clinicianOverride.update({
          where: { id: existing.id },
          data: { active: false },
        });
        if (replacementInput.replacesGeneralGuideline) {
          await database.clinicianOverride.updateMany({
            where: {
              profileId: profile.id,
              serviceId: existing.serviceId,
              id: { not: existing.id },
              active: true,
              replacesGeneralGuideline: true,
            },
            data: { active: false },
          });
        }
        const replacement = await database.clinicianOverride.create({
          data: {
            profileId: profile.id,
            serviceId: existing.serviceId,
            methodId: existing.methodId,
            overrideType: replacementInput.type,
            nextDueStart:
              replacementInput.type === "exact_next_date"
                ? dateOnly(replacementInput.nextDueStart)
                : null,
            nextDueEnd:
              replacementInput.type === "exact_next_date"
                ? dateOnly(replacementInput.nextDueEnd || replacementInput.nextDueStart)
                : null,
            intervalJson:
              replacementInput.type === "recurring_interval"
                ? {
                    value: replacementInput.intervalValue as number,
                    unit: replacementInput.intervalUnit as string,
                  }
                : Prisma.DbNull,
            replacesGeneralGuideline: replacementInput.replacesGeneralGuideline,
            clinicianName: optionalText(replacementInput.clinicianName),
            practiceName: optionalText(replacementInput.practiceName),
            instructionReceivedDate: dateOnly(replacementInput.instructionReceivedDate) as Date,
            reason: optionalText(replacementInput.reason),
            reviewDate: dateOnly(replacementInput.reviewDate),
            active: true,
            pausedAt: null,
            createdByUserId: session.user.id,
          },
        });
        resultingOverrideId = replacement.id;
        action = "clinician_override.edited";
      }

      await rebuildRecommendations(database, profile.id, undefined, {
        actorUserId: session.user.id,
        reason: "clinician_override_changed",
      });
      await database.auditLog.create({
        data: {
          householdId: profile.householdId,
          profileId: profile.id,
          actorUserId: session.user.id,
          action,
          entityType: "ClinicianOverride",
          entityId: resultingOverrideId,
          metadataJson: {},
        },
      });
      const recommendation = await database.recommendationInstance.findFirst({
        where: { profileId: profile.id, serviceId: existing.serviceId, retiredAt: null },
        select: { id: true },
        orderBy: { createdAt: "desc" },
      });
      return { resultingOverrideId, recommendation };
    });

    return NextResponse.json({
      ok: true,
      overrideId: result.resultingOverrideId,
      activeRecommendationId: result.recommendation?.id,
    });
  } catch (error) {
    return routeError(error);
  }
}

export async function DELETE(request: Request, { params }: RouteContext) {
  try {
    assertSameOrigin(request);
    const { profileId, overrideId } = await params;
    const requestedRecommendationId = new URL(request.url).searchParams.get("recommendationId");
    const { session, profile } = await requireProfileAccess(profileId, "edit");
    const activeRecommendation = await prisma.$transaction(async (database) => {
      const override = await database.clinicianOverride.findFirst({
        where: { id: overrideId, profileId: profile.id, active: true },
        select: { serviceId: true },
      });
      if (override === null) throw new NotFoundError();
      const originatingRecommendation =
        requestedRecommendationId === null
          ? null
          : await database.recommendationInstance.findFirst({
              where: {
                id: requestedRecommendationId,
                profileId: profile.id,
                serviceId: override.serviceId,
                retiredAt: null,
              },
              select: { ruleId: true },
            });
      const result = await database.clinicianOverride.updateMany({
        where: { id: overrideId, profileId: profile.id, active: true },
        data: { active: false },
      });
      if (result.count !== 1) throw new NotFoundError();
      await rebuildRecommendations(database, profile.id, undefined, {
        actorUserId: session.user.id,
        reason: "clinician_override_changed",
      });
      await database.auditLog.create({
        data: {
          householdId: profile.householdId,
          profileId: profile.id,
          actorUserId: session.user.id,
          action: "clinician_override.ended",
          entityType: "ClinicianOverride",
          entityId: overrideId,
          metadataJson: {},
        },
      });
      return database.recommendationInstance.findFirst({
        where: {
          profileId: profile.id,
          serviceId: override.serviceId,
          retiredAt: null,
          ...(originatingRecommendation === null
            ? {}
            : { ruleId: originatingRecommendation.ruleId }),
        },
        select: { id: true },
        orderBy: { createdAt: "desc" },
      });
    });
    return NextResponse.json({ ok: true, activeRecommendationId: activeRecommendation?.id });
  } catch (error) {
    return routeError(error);
  }
}
