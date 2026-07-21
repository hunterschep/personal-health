import { NextResponse } from "next/server";
import { z } from "zod";
import { clinicianOverrideInputSchema } from "@/contracts";
import { ValidationError } from "@/domain/shared/errors";
import { Prisma } from "@/generated/prisma/client";
import { assertSameOrigin } from "@/server/auth/csrf";
import { requireProfileAccess } from "@/server/authorization/profile";
import { prisma } from "@/server/db/client";
import { dateOnly, optionalText, routeError } from "@/server/http";
import { rebuildRecommendations } from "@/server/recommendations";

async function resolveService(profileId: string, value: string) {
  const recommendation = await prisma.recommendationInstance.findFirst({
    where: { id: value, profileId, retiredAt: null },
    select: { ruleId: true, service: true },
  });
  if (recommendation !== null) {
    return { service: recommendation.service, originatingRuleId: recommendation.ruleId };
  }
  const isUuid = z.uuid().safeParse(value).success;
  const service = await prisma.serviceCatalog.findFirst({
    where: isUuid
      ? { active: true, OR: [{ id: value }, { slug: value }] }
      : { active: true, slug: value },
  });
  return service === null ? null : { service, originatingRuleId: null };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ profileId: string }> },
) {
  try {
    const { profileId } = await params;
    const { profile } = await requireProfileAccess(profileId, "view");
    const overrides = await prisma.clinicianOverride.findMany({
      where: { profileId: profile.id, active: true },
      include: { service: true, method: true },
      orderBy: [{ reviewDate: "asc" }, { createdAt: "desc" }],
    });
    return NextResponse.json(overrides, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ profileId: string }> },
) {
  try {
    assertSameOrigin(request);
    const { profileId } = await params;
    const { session, profile } = await requireProfileAccess(profileId, "edit");
    const input = clinicianOverrideInputSchema.parse(await request.json());
    const resolvedService = await resolveService(profile.id, input.serviceId);
    if (resolvedService === null)
      throw new ValidationError("Choose a service from the active care plan.");
    const { service, originatingRuleId } = resolvedService;
    if (input.type === "exact_next_date" && input.nextDueStart === "") {
      throw new ValidationError("Enter the next date from the clinician instruction.");
    }
    if (
      input.nextDueStart !== "" &&
      input.nextDueEnd !== "" &&
      input.nextDueStart > input.nextDueEnd
    ) {
      throw new ValidationError("The instruction end date cannot be before its start date.");
    }
    if (
      input.type === "recurring_interval" &&
      (input.intervalValue === undefined || input.intervalUnit === undefined)
    ) {
      throw new ValidationError("Enter a complete recurring interval.");
    }

    const created = await prisma.$transaction(async (database) => {
      if (input.replacesGeneralGuideline) {
        await database.clinicianOverride.updateMany({
          where: {
            profileId: profile.id,
            serviceId: service.id,
            active: true,
            replacesGeneralGuideline: true,
          },
          data: { active: false },
        });
      }
      const override = await database.clinicianOverride.create({
        data: {
          profileId: profile.id,
          serviceId: service.id,
          overrideType: input.type,
          nextDueStart: input.type === "exact_next_date" ? dateOnly(input.nextDueStart) : null,
          nextDueEnd:
            input.type === "exact_next_date"
              ? dateOnly(input.nextDueEnd || input.nextDueStart)
              : null,
          intervalJson:
            input.type === "recurring_interval"
              ? { value: input.intervalValue as number, unit: input.intervalUnit as string }
              : Prisma.DbNull,
          replacesGeneralGuideline: input.replacesGeneralGuideline,
          clinicianName: optionalText(input.clinicianName),
          practiceName: optionalText(input.practiceName),
          instructionReceivedDate: dateOnly(input.instructionReceivedDate) as Date,
          reason: optionalText(input.reason),
          reviewDate: dateOnly(input.reviewDate),
          active: true,
          createdByUserId: session.user.id,
        },
      });
      await rebuildRecommendations(database, profile.id, undefined, {
        actorUserId: session.user.id,
        reason: "clinician_override_changed",
      });
      await database.auditLog.create({
        data: {
          householdId: profile.householdId,
          profileId: profile.id,
          actorUserId: session.user.id,
          action: "clinician_override.created",
          entityType: "ClinicianOverride",
          entityId: override.id,
          metadataJson: {},
        },
      });
      const activeRecommendation = await database.recommendationInstance.findFirst({
        where: {
          profileId: profile.id,
          serviceId: service.id,
          retiredAt: null,
          ...(originatingRuleId === null ? {} : { ruleId: originatingRuleId }),
        },
        select: { id: true },
        orderBy: { createdAt: "desc" },
      });
      return { override, activeRecommendation };
    });
    return NextResponse.json(
      {
        ok: true,
        overrideId: created.override.id,
        activeRecommendationId: created.activeRecommendation?.id,
      },
      { status: 201 },
    );
  } catch (error) {
    return routeError(error);
  }
}
