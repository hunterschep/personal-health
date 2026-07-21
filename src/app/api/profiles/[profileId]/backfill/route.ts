import { NextResponse } from "next/server";
import { z } from "zod";
import { dateInTimeZone, normalizeDateRange } from "@/domain/dates";
import { NotFoundError, ValidationError } from "@/domain/shared/errors";
import { assertSameOrigin } from "@/server/auth/csrf";
import { requireProfileAccess } from "@/server/authorization/profile";
import { prisma } from "@/server/db/client";
import { dateOnly, optionalText, routeError } from "@/server/http";
import { careEventFingerprint } from "@/server/repositories/care-event";
import { rebuildRecommendations } from "@/server/recommendations";

const schema = z
  .object({
    serviceId: z.uuid(),
    eventId: z.uuid().nullable().optional(),
    answer: z.enum(["completed", "never", "unsure", "not_applicable", "skip"]),
    methodId: z.uuid().nullable(),
    precision: z.enum(["day", "month", "year", "unknown"]),
    date: z.string().max(10).nullable(),
    result: z.enum(["normal", "abnormal", "inconclusive", "unknown", "not_applicable"]),
    providerName: z.string().trim().max(120).nullable().optional(),
    note: z.string().trim().max(2000).nullable().optional(),
    reason: z.string().trim().max(500).nullable().optional(),
  })
  .superRefine((input, context) => {
    if (input.answer === "not_applicable" && optionalText(input.reason) === null) {
      context.addIssue({
        code: "custom",
        path: ["reason"],
        message: "Explain why this item does not apply to you.",
      });
    }
  });

export async function POST(
  request: Request,
  { params }: { params: Promise<{ profileId: string }> },
) {
  try {
    assertSameOrigin(request);
    const { profileId } = await params;
    const { session, profile } = await requireProfileAccess(profileId, "edit");
    const input = schema.parse(await request.json());
    const service = await prisma.serviceCatalog.findFirst({
      where: { id: input.serviceId, active: true },
    });
    if (service === null) throw new NotFoundError();
    if (input.methodId !== null) {
      const method = await prisma.serviceMethod.findFirst({
        where: { id: input.methodId, serviceId: service.id, active: true },
      });
      if (method === null) throw new NotFoundError();
    }
    await prisma.$transaction(async (database) => {
      if (input.answer === "completed") {
        const range = normalizeDateRange(input.date, input.precision);
        if (range.start !== null && range.start > dateInTimeZone(new Date(), profile.timezone)) {
          throw new ValidationError("Completed care dates cannot be in the future.");
        }
        const existing =
          input.eventId === null || input.eventId === undefined
            ? null
            : await database.careEvent.findFirst({
                where: {
                  id: input.eventId,
                  profileId: profile.id,
                  serviceId: service.id,
                  deletedAt: null,
                },
              });
        if (input.eventId !== null && input.eventId !== undefined && existing === null) {
          throw new NotFoundError();
        }
        const record = {
          profileId: profile.id,
          serviceId: service.id,
          methodId: input.methodId,
          performedStart: dateOnly(range.start),
          performedEnd: dateOnly(range.end),
          datePrecision: input.precision,
          result: input.result,
          providerName: optionalText(input.providerName),
          locationName: existing?.locationName ?? null,
          notes: optionalText(input.note),
          source: existing?.source ?? ("user_memory" as const),
          importBatchId: existing?.importBatchId ?? null,
          createdByUserId: existing?.createdByUserId ?? session.user.id,
        };
        const duplicateFingerprint = careEventFingerprint(record);
        if (existing !== null) {
          await database.careEvent.update({
            where: { id: existing.id },
            data: { ...record, duplicateFingerprint },
          });
        } else {
          const duplicate = await database.careEvent.findFirst({
            where: { profileId: profile.id, duplicateFingerprint, deletedAt: null },
            select: { id: true },
          });
          if (duplicate === null) {
            await database.careEvent.create({ data: { ...record, duplicateFingerprint } });
          }
        }
        await database.profileServiceHistoryState.upsert({
          where: { profileId_serviceId: { profileId: profile.id, serviceId: service.id } },
          create: {
            profileId: profile.id,
            serviceId: service.id,
            state:
              input.precision === "unknown"
                ? "completed_date_unknown"
                : input.precision === "day"
                  ? "completed_exact"
                  : input.precision === "month"
                    ? "completed_month"
                    : "completed_year",
            recordedAt: new Date(),
            recordedByUserId: session.user.id,
            reason: null,
          },
          update: {
            state:
              input.precision === "unknown"
                ? "completed_date_unknown"
                : input.precision === "day"
                  ? "completed_exact"
                  : input.precision === "month"
                    ? "completed_month"
                    : "completed_year",
            recordedAt: new Date(),
            recordedByUserId: session.user.id,
            reason: null,
          },
        });
      } else {
        const state =
          input.answer === "never"
            ? "never_completed"
            : input.answer === "unsure"
              ? "unsure"
              : input.answer === "not_applicable"
                ? "not_applicable_claim"
                : "no_record";
        const reason = input.answer === "not_applicable" ? optionalText(input.reason) : null;
        await database.profileServiceHistoryState.upsert({
          where: { profileId_serviceId: { profileId: profile.id, serviceId: service.id } },
          create: {
            profileId: profile.id,
            serviceId: service.id,
            state,
            reason,
            recordedAt: new Date(),
            recordedByUserId: session.user.id,
          },
          update: {
            state,
            reason,
            recordedAt: new Date(),
            recordedByUserId: session.user.id,
          },
        });
      }
      await rebuildRecommendations(database, profile.id, undefined, {
        actorUserId: session.user.id,
        reason: "care_event_edited",
      });
      await database.auditLog.create({
        data: {
          householdId: profile.householdId,
          profileId: profile.id,
          actorUserId: session.user.id,
          action: "care_history.backfill_answered",
          entityType: "ServiceCatalog",
          entityId: service.id,
          metadataJson: {},
        },
      });
    });
    return NextResponse.json({ ok: true, skipped: input.answer === "skip" });
  } catch (error) {
    return routeError(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ profileId: string }> },
) {
  try {
    assertSameOrigin(request);
    const { profileId } = await params;
    const { session, profile } = await requireProfileAccess(profileId, "edit");
    const serviceIdValue = new URL(request.url).searchParams.get("serviceId");
    const serviceId = serviceIdValue === null ? null : z.uuid().parse(serviceIdValue);
    const count = await prisma.$transaction(async (database) => {
      const removed = await database.profileServiceHistoryState.deleteMany({
        where:
          serviceId === null
            ? { profileId: profile.id, state: "no_record" }
            : {
                profileId: profile.id,
                serviceId,
                state: { in: ["never_completed", "unsure", "not_applicable_claim"] },
              },
      });
      if (removed.count > 0) {
        await rebuildRecommendations(database, profile.id, undefined, {
          actorUserId: session.user.id,
          reason: "care_event_edited",
        });
        await database.auditLog.create({
          data: {
            householdId: profile.householdId,
            profileId: profile.id,
            actorUserId: session.user.id,
            action:
              serviceId === null ? "care_history.skips_reset" : "care_history.assertion_reset",
            entityType: serviceId === null ? "Profile" : "ServiceCatalog",
            entityId: serviceId ?? profile.id,
            metadataJson: { count: removed.count },
          },
        });
      }
      return removed.count;
    });
    return NextResponse.json({ ok: true, count });
  } catch (error) {
    return routeError(error);
  }
}
