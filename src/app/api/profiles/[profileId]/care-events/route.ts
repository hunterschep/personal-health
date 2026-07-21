import { NextResponse } from "next/server";
import { z } from "zod";
import { dateInTimeZone, normalizeDateRange } from "@/domain/dates";
import { NotFoundError, ValidationError } from "@/domain/shared/errors";
import { assertSameOrigin } from "@/server/auth/csrf";
import { requireProfileAccess } from "@/server/authorization/profile";
import { prisma } from "@/server/db/client";
import { dateOnly, optionalText, routeError } from "@/server/http";
import { appUrl } from "@/server/http/app-url";
import { careEventFingerprint } from "@/server/repositories/care-event";
import { rebuildRecommendations } from "@/server/recommendations";
import { privateStorage, storeValidatedDocument, type StoredUpload } from "@/server/storage";

const eventFormSchema = z.object({
  service: z.string().trim().min(1).max(120),
  method: z.string().trim().max(120).default(""),
  performedPrecision: z.enum(["day", "month", "year", "unknown"]),
  performedDate: z.string().trim().max(10).default(""),
  result: z.enum(["normal", "abnormal", "inconclusive", "unknown", "not_applicable"]),
  provider: z.string().max(120).default(""),
  location: z.string().max(160).default(""),
  notes: z.string().max(2_000).default(""),
  source: z.enum(["user_memory", "medical_record", "clinician", "pharmacy"]),
});

function uuid(value: string): boolean {
  return z.uuid().safeParse(value).success;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ profileId: string }> },
) {
  try {
    const { profileId } = await params;
    const { profile } = await requireProfileAccess(profileId, "view");
    const events = await prisma.careEvent.findMany({
      where: { profileId: profile.id, deletedAt: null },
      select: {
        id: true,
        performedStart: true,
        performedEnd: true,
        datePrecision: true,
        result: true,
        providerName: true,
        locationName: true,
        notes: true,
        source: true,
        createdAt: true,
        updatedAt: true,
        service: { select: { id: true, slug: true, name: true, category: true } },
        method: { select: { id: true, slug: true, name: true } },
        documentLinks: {
          select: {
            id: true,
            label: true,
            document: {
              select: {
                id: true,
                safeFilename: true,
                mimeType: true,
                sizeBytes: true,
                createdAt: true,
                deletedAt: true,
              },
            },
          },
        },
      },
      orderBy: [{ performedEnd: "desc" }, { createdAt: "desc" }],
    });
    const response = events.map((event) => ({
      ...event,
      documentLinks: event.documentLinks
        .filter(({ document }) => document.deletedAt === null)
        .map(({ document, ...link }) => ({
          ...link,
          document: {
            id: document.id,
            filename: document.safeFilename,
            mimeType: document.mimeType,
            sizeBytes: Number(document.sizeBytes),
            createdAt: document.createdAt,
          },
        })),
    }));
    return NextResponse.json(response, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ profileId: string }> },
) {
  let upload: StoredUpload | null = null;
  try {
    assertSameOrigin(request);
    const { profileId } = await params;
    const { session, profile } = await requireProfileAccess(profileId, "edit");
    const form = await request.formData();
    const input = eventFormSchema.parse(Object.fromEntries(form.entries()));
    const service = await prisma.serviceCatalog.findFirst({
      where: uuid(input.service)
        ? { active: true, OR: [{ id: input.service }, { slug: input.service }] }
        : { active: true, slug: input.service },
    });
    if (service === null) throw new NotFoundError("Choose a service from the care catalog.");
    const method =
      input.method === ""
        ? null
        : await prisma.serviceMethod.findFirst({
            where: uuid(input.method)
              ? {
                  serviceId: service.id,
                  active: true,
                  OR: [{ id: input.method }, { slug: input.method }],
                }
              : { serviceId: service.id, active: true, slug: input.method },
          });
    if (input.method !== "" && method === null) {
      throw new NotFoundError("Choose a method available for this service.");
    }

    const range = normalizeDateRange(input.performedDate || null, input.performedPrecision);
    if (range.start !== null && range.start > dateInTimeZone(new Date(), profile.timezone)) {
      throw new ValidationError("Completed care dates cannot be in the future.");
    }
    const record = {
      profileId: profile.id,
      serviceId: service.id,
      methodId: method?.id ?? null,
      performedStart: dateOnly(range.start),
      performedEnd: dateOnly(range.end),
      datePrecision: range.precision,
      result: input.result,
      providerName: optionalText(input.provider),
      locationName: optionalText(input.location),
      notes: optionalText(input.notes),
      source: input.source,
      importBatchId: null,
      createdByUserId: session.user.id,
    } as const;

    const attachment = form.get("attachment");
    if (attachment instanceof File && attachment.size > 0) {
      upload = await storeValidatedDocument(attachment);
    }

    const created = await prisma.$transaction(async (database) => {
      const event = await database.careEvent.create({
        data: { ...record, duplicateFingerprint: careEventFingerprint(record) },
      });
      if (upload !== null) {
        const document = await database.document.create({
          data: {
            householdId: profile.householdId,
            profileId: profile.id,
            storageKey: upload.storageKey,
            originalFilename: upload.originalFilename,
            safeFilename: upload.safeFilename,
            mimeType: upload.mimeType,
            sizeBytes: BigInt(upload.sizeBytes),
            sha256: upload.sha256,
            uploadedByUserId: session.user.id,
          },
        });
        await database.documentLink.create({
          data: {
            documentId: document.id,
            careEventId: event.id,
            label: "Care record attachment",
          },
        });
      }
      await rebuildRecommendations(database, profile.id, undefined, {
        actorUserId: session.user.id,
        reason: "care_event_created",
      });
      await database.auditLog.create({
        data: {
          householdId: profile.householdId,
          profileId: profile.id,
          actorUserId: session.user.id,
          action: "care_event.created",
          entityType: "CareEvent",
          entityId: event.id,
          metadataJson: {},
        },
      });
      return event;
    });
    upload = null;

    if (request.headers.get("accept")?.includes("application/json") === true) {
      return NextResponse.json({ ok: true, eventId: created.id }, { status: 201 });
    }
    return NextResponse.redirect(appUrl(`/app/profile/${profile.id}/records`, request.url), 303);
  } catch (error) {
    if (upload !== null) await privateStorage.delete(upload.storageKey).catch(() => undefined);
    return routeError(error);
  }
}
