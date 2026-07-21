import { NextResponse } from "next/server";
import { z } from "zod";
import { dateInTimeZone, normalizeDateRange } from "@/domain/dates";
import { ConflictError, NotFoundError, ValidationError } from "@/domain/shared/errors";
import { assertSameOrigin } from "@/server/auth/csrf";
import { requireProfileAccess } from "@/server/authorization/profile";
import { prisma } from "@/server/db/client";
import { dateOnly, optionalText, routeError } from "@/server/http";
import { careEventFingerprint } from "@/server/repositories/care-event";
import { rebuildRecommendations } from "@/server/recommendations";
import { deleteDocumentBlobs } from "@/server/storage";

const updateSchema = z.object({
  methodId: z.uuid().nullable().optional(),
  performedDate: z.string().trim().max(10).nullable(),
  datePrecision: z.enum(["day", "month", "year", "unknown"]),
  result: z.enum(["normal", "abnormal", "inconclusive", "unknown", "not_applicable"]),
  providerName: z.string().max(120).nullable().optional(),
  locationName: z.string().max(160).nullable().optional(),
  notes: z.string().max(2_000).nullable().optional(),
  source: z.enum(["user_memory", "medical_record", "clinician", "pharmacy", "csv_import"]),
});

type Context = { params: Promise<{ profileId: string; eventId: string }> };

export async function PATCH(request: Request, { params }: Context) {
  try {
    assertSameOrigin(request);
    const { profileId, eventId } = await params;
    const { session, profile } = await requireProfileAccess(profileId, "edit");
    const existing = await prisma.careEvent.findFirst({
      where: { id: eventId, profileId: profile.id, deletedAt: null },
    });
    if (existing === null) throw new NotFoundError();
    const input = updateSchema.parse(await request.json());
    if (input.methodId !== undefined && input.methodId !== null) {
      const method = await prisma.serviceMethod.findFirst({
        where: { id: input.methodId, serviceId: existing.serviceId, active: true },
      });
      if (method === null) throw new NotFoundError();
    }
    const range = normalizeDateRange(input.performedDate, input.datePrecision);
    if (range.start !== null && range.start > dateInTimeZone(new Date(), profile.timezone)) {
      throw new ValidationError("Completed care dates cannot be in the future.");
    }
    const record = {
      profileId: profile.id,
      serviceId: existing.serviceId,
      methodId: input.methodId ?? null,
      performedStart: dateOnly(range.start),
      performedEnd: dateOnly(range.end),
      datePrecision: input.datePrecision,
      result: input.result,
      providerName: optionalText(input.providerName),
      locationName: optionalText(input.locationName),
      notes: optionalText(input.notes),
      source: input.source,
      importBatchId: existing.importBatchId,
      createdByUserId: existing.createdByUserId,
    } as const;
    const updated = await prisma.$transaction(async (database) => {
      const event = await database.careEvent.update({
        where: { id: eventId },
        data: { ...record, duplicateFingerprint: careEventFingerprint(record) },
      });
      await rebuildRecommendations(database, profile.id, undefined, {
        actorUserId: session.user.id,
        reason: "care_event_edited",
      });
      await database.auditLog.create({
        data: {
          householdId: profile.householdId,
          profileId: profile.id,
          actorUserId: session.user.id,
          action: "care_event.updated",
          entityType: "CareEvent",
          entityId: event.id,
          metadataJson: {},
        },
      });
      return event;
    });
    return NextResponse.json({ ok: true, eventId: updated.id });
  } catch (error) {
    return routeError(error);
  }
}

export async function DELETE(request: Request, { params }: Context) {
  try {
    assertSameOrigin(request);
    const { profileId, eventId } = await params;
    const { session, profile } = await requireProfileAccess(profileId, "edit");
    const documents = await prisma.$transaction(async (database) => {
      const existing = await database.careEvent.findFirst({
        where: { id: eventId, profileId: profile.id, deletedAt: null },
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
      const changed = await database.careEvent.updateMany({
        where: { id: eventId, profileId: profile.id, deletedAt: null },
        data: { deletedAt: new Date() },
      });
      if (changed.count !== 1) throw new NotFoundError();
      if (linkedDocuments.length > 0) {
        await database.document.updateMany({
          where: { id: { in: linkedDocuments.map(({ id }) => id) }, deletedAt: null },
          data: { deletedAt: new Date() },
        });
      }
      await rebuildRecommendations(database, profile.id, undefined, {
        actorUserId: session.user.id,
        reason: "care_event_deleted",
      });
      await database.auditLog.create({
        data: {
          householdId: profile.householdId,
          profileId: profile.id,
          actorUserId: session.user.id,
          action: "care_event.deleted",
          entityType: "CareEvent",
          entityId: eventId,
          metadataJson: { documentCount: linkedDocuments.length },
        },
      });
      return linkedDocuments;
    });
    const cleanup = await deleteDocumentBlobs(documents);
    return NextResponse.json({
      ok: true,
      restorable: documents.length === 0,
      cleanupPending: cleanup.failedIds.length > 0,
    });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request, { params }: Context) {
  try {
    assertSameOrigin(request);
    const { profileId, eventId } = await params;
    const { session, profile } = await requireProfileAccess(profileId, "edit");
    await prisma.$transaction(async (database) => {
      const removedAttachmentCount = await database.documentLink.count({
        where: {
          careEventId: eventId,
          document: { profileId: profile.id, deletedAt: { not: null } },
        },
      });
      if (removedAttachmentCount > 0) {
        throw new ConflictError(
          "This record cannot be restored because its private attachments were permanently removed.",
        );
      }
      const changed = await database.careEvent.updateMany({
        where: { id: eventId, profileId: profile.id, deletedAt: { not: null } },
        data: { deletedAt: null },
      });
      if (changed.count !== 1) throw new NotFoundError();
      await rebuildRecommendations(database, profile.id, undefined, {
        actorUserId: session.user.id,
        reason: "care_event_edited",
      });
      await database.auditLog.create({
        data: {
          householdId: profile.householdId,
          profileId: profile.id,
          actorUserId: session.user.id,
          action: "care_event.restored",
          entityType: "CareEvent",
          entityId: eventId,
          metadataJson: {},
        },
      });
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return routeError(error);
  }
}
