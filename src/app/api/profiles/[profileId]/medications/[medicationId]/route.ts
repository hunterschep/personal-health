import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizeDateRange } from "@/domain/dates";
import { NotFoundError, ValidationError } from "@/domain/shared/errors";
import { assertSameOrigin } from "@/server/auth/csrf";
import { requireProfileAccess } from "@/server/authorization/profile";
import { prisma } from "@/server/db/client";
import { dateOnly, optionalText, routeError } from "@/server/http";
import { rebuildRecommendations } from "@/server/recommendations";
import { deleteDocumentBlobs } from "@/server/storage";

const updateSchema = z.object({
  name: z.string().trim().min(1).max(160),
  dose: z.string().max(120).nullable().optional(),
  frequency: z.string().max(120).nullable().optional(),
  prescriber: z.string().max(160).nullable().optional(),
  reason: z.string().max(500).nullable().optional(),
  status: z.enum(["active", "paused", "ended"]),
  startedDate: z.string().trim().max(10).nullable().optional(),
  startedPrecision: z.enum(["day", "month", "year", "unknown"]).optional(),
  endedDate: z.string().trim().max(10).nullable().optional(),
  endedPrecision: z.enum(["day", "month", "year", "unknown"]).optional(),
  monitoringInstructions: z.string().max(2_000).nullable().optional(),
  notes: z.string().max(2_000).nullable().optional(),
  classCodes: z
    .array(
      z
        .string()
        .trim()
        .regex(/^[a-z0-9][a-z0-9_:-]*$/)
        .max(80),
    )
    .max(20)
    .optional(),
  nextReviewDate: z
    .union([z.literal(""), z.iso.date()])
    .nullable()
    .optional(),
});

type Context = { params: Promise<{ profileId: string; medicationId: string }> };

export async function PATCH(request: Request, { params }: Context) {
  try {
    assertSameOrigin(request);
    const { profileId, medicationId } = await params;
    const { session, profile } = await requireProfileAccess(profileId, "edit");
    const input = updateSchema.parse(await request.json());
    if ((input.startedDate === undefined) !== (input.startedPrecision === undefined)) {
      throw new ValidationError("Provide both medication start timing fields.");
    }
    if ((input.endedDate === undefined) !== (input.endedPrecision === undefined)) {
      throw new ValidationError("Provide both medication end timing fields.");
    }
    const started =
      input.startedPrecision === undefined
        ? null
        : normalizeDateRange(input.startedDate || null, input.startedPrecision);
    const ended =
      input.endedPrecision === undefined
        ? null
        : input.status === "ended"
          ? normalizeDateRange(input.endedDate || null, input.endedPrecision)
          : { start: null, end: null, precision: "unknown" as const };
    const updated = await prisma.$transaction(async (database) => {
      const existing = await database.medication.findFirst({
        where: { id: medicationId, profileId: profile.id, deletedAt: null },
      });
      if (existing === null) throw new NotFoundError();
      const effectiveStarted =
        started?.start ?? existing.startedStart?.toISOString().slice(0, 10) ?? null;
      const effectiveEnded =
        ended?.end ??
        (input.status === "ended" ? existing.endedEnd?.toISOString().slice(0, 10) : null) ??
        null;
      if (
        effectiveStarted !== null &&
        effectiveEnded !== null &&
        effectiveStarted > effectiveEnded
      ) {
        throw new ValidationError("Medication end timing cannot be before start timing.");
      }
      const medication = await database.medication.update({
        where: { id: existing.id },
        data: {
          name: input.name,
          status: input.status,
          ...(input.dose === undefined ? {} : { dose: optionalText(input.dose) }),
          ...(input.frequency === undefined ? {} : { frequency: optionalText(input.frequency) }),
          ...(input.prescriber === undefined ? {} : { prescriber: optionalText(input.prescriber) }),
          ...(input.reason === undefined ? {} : { reason: optionalText(input.reason) }),
          ...(input.monitoringInstructions === undefined
            ? {}
            : { monitoringInstructions: optionalText(input.monitoringInstructions) }),
          ...(input.notes === undefined ? {} : { notes: optionalText(input.notes) }),
          ...(input.classCodes === undefined
            ? {}
            : { classCodesJson: [...new Set(input.classCodes)].sort() }),
          ...(input.nextReviewDate === undefined
            ? {}
            : { nextReviewDate: dateOnly(input.nextReviewDate) }),
          ...(started === null
            ? {}
            : {
                startedStart: dateOnly(started.start),
                startedEnd: dateOnly(started.end),
                startedDatePrecision: started.precision,
              }),
          ...(ended === null
            ? {
                endedStart:
                  input.status !== "ended"
                    ? null
                    : existing.endedStart === null
                      ? new Date()
                      : existing.endedStart,
                endedEnd:
                  input.status !== "ended"
                    ? null
                    : existing.endedEnd === null
                      ? new Date()
                      : existing.endedEnd,
                endedDatePrecision:
                  input.status !== "ended"
                    ? null
                    : existing.endedDatePrecision === null
                      ? "day"
                      : existing.endedDatePrecision,
              }
            : {
                endedStart: dateOnly(ended.start),
                endedEnd: dateOnly(ended.end),
                endedDatePrecision: input.status === "ended" ? ended.precision : null,
              }),
        },
      });
      await rebuildRecommendations(database, profile.id, undefined, {
        actorUserId: session.user.id,
        reason: "medication_class_changed",
      });
      await database.auditLog.create({
        data: {
          householdId: profile.householdId,
          profileId: profile.id,
          actorUserId: session.user.id,
          action: "medication.updated",
          entityType: "Medication",
          entityId: medication.id,
          metadataJson: {},
        },
      });
      return medication;
    });
    return NextResponse.json({ ok: true, medicationId: updated.id });
  } catch (error) {
    return routeError(error);
  }
}

export async function DELETE(request: Request, { params }: Context) {
  try {
    assertSameOrigin(request);
    const { profileId, medicationId } = await params;
    const { session, profile } = await requireProfileAccess(profileId, "edit");
    const documents = await prisma.$transaction(async (database) => {
      const existing = await database.medication.findFirst({
        where: { id: medicationId, profileId: profile.id, deletedAt: null },
        select: {
          documentLinks: {
            where: { document: { deletedAt: null } },
            select: {
              document: {
                select: { id: true, storageKey: true, householdId: true, profileId: true },
              },
            },
          },
        },
      });
      if (existing === null) throw new NotFoundError();
      const linkedDocuments = existing.documentLinks.map(({ document }) => document);
      const result = await database.medication.updateMany({
        where: { id: medicationId, profileId: profile.id, deletedAt: null },
        data: { deletedAt: new Date() },
      });
      if (result.count !== 1) throw new NotFoundError();
      if (linkedDocuments.length > 0) {
        await database.document.updateMany({
          where: { id: { in: linkedDocuments.map(({ id }) => id) }, deletedAt: null },
          data: { deletedAt: new Date() },
        });
      }
      await rebuildRecommendations(database, profile.id, undefined, {
        actorUserId: session.user.id,
        reason: "medication_class_changed",
      });
      await database.auditLog.create({
        data: {
          householdId: profile.householdId,
          profileId: profile.id,
          actorUserId: session.user.id,
          action: "medication.deleted",
          entityType: "Medication",
          entityId: medicationId,
          metadataJson: { documentCount: linkedDocuments.length },
        },
      });
      return linkedDocuments;
    });
    const cleanup = await deleteDocumentBlobs(documents);
    return NextResponse.json({ ok: true, cleanupPending: cleanup.failedIds.length > 0 });
  } catch (error) {
    return routeError(error);
  }
}
