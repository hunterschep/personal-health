import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizeDateRange } from "@/domain/dates";
import { ValidationError } from "@/domain/shared/errors";
import { assertSameOrigin } from "@/server/auth/csrf";
import { requireProfileAccess } from "@/server/authorization/profile";
import { prisma } from "@/server/db/client";
import { dateOnly, optionalText, routeError } from "@/server/http";
import { rebuildRecommendations } from "@/server/recommendations";

const medicationSchema = z.object({
  name: z.string().trim().min(1).max(160),
  dose: z.string().max(120).optional().default(""),
  frequency: z.string().max(120).optional().default(""),
  prescriber: z.string().max(160).optional().default(""),
  reason: z.string().max(500).optional().default(""),
  status: z.enum(["active", "paused", "ended"]).default("active"),
  startedDate: z.string().trim().max(10).optional().default(""),
  startedPrecision: z.enum(["day", "month", "year", "unknown"]).default("unknown"),
  endedDate: z.string().trim().max(10).optional().default(""),
  endedPrecision: z.enum(["day", "month", "year", "unknown"]).default("unknown"),
  monitoring: z.string().max(2_000).optional().default(""),
  notes: z.string().max(2_000).optional().default(""),
  classCodes: z
    .array(
      z
        .string()
        .trim()
        .regex(/^[a-z0-9][a-z0-9_:-]*$/)
        .max(80),
    )
    .max(20)
    .optional()
    .default([]),
  nextReview: z
    .union([z.literal(""), z.iso.date()])
    .optional()
    .default(""),
});

function responseMedication(medication: {
  id: string;
  name: string;
  dose: string | null;
  frequency: string | null;
  prescriber: string | null;
  reason: string | null;
  status: "active" | "paused" | "ended";
  monitoringInstructions: string | null;
  nextReviewDate: Date | null;
  startedStart: Date | null;
  startedDatePrecision: "day" | "month" | "year" | "unknown";
  endedStart: Date | null;
  endedDatePrecision: "day" | "month" | "year" | "unknown" | null;
  notes: string | null;
  classCodesJson: unknown;
  documentLinks?: {
    document: { id: string; safeFilename: string; mimeType: string };
  }[];
}) {
  const timingValue = (
    value: Date | null,
    precision: "day" | "month" | "year" | "unknown" | null,
  ): string => {
    if (value === null || precision === null || precision === "unknown") return "";
    const iso = value.toISOString().slice(0, 10);
    return precision === "day" ? iso : precision === "month" ? iso.slice(0, 7) : iso.slice(0, 4);
  };
  return {
    id: medication.id,
    name: medication.name,
    dose: medication.dose ?? "",
    frequency: medication.frequency ?? "",
    prescriber: medication.prescriber ?? "",
    reason: medication.reason ?? "",
    status: medication.status,
    monitoring: medication.monitoringInstructions ?? "",
    nextReview: medication.nextReviewDate?.toISOString().slice(0, 10) ?? "",
    startedDate: timingValue(medication.startedStart, medication.startedDatePrecision),
    startedPrecision: medication.startedDatePrecision,
    endedDate: timingValue(medication.endedStart, medication.endedDatePrecision),
    endedPrecision: medication.endedDatePrecision ?? "unknown",
    notes: medication.notes ?? "",
    classCodes: Array.isArray(medication.classCodesJson)
      ? medication.classCodesJson.filter((value): value is string => typeof value === "string")
      : [],
    documents: (medication.documentLinks ?? []).map(({ document }) => ({
      id: document.id,
      filename: document.safeFilename,
      mimeType: document.mimeType,
    })),
  };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ profileId: string }> },
) {
  try {
    const { profileId } = await params;
    const { profile } = await requireProfileAccess(profileId, "view");
    const medications = await prisma.medication.findMany({
      where: { profileId: profile.id, deletedAt: null },
      include: {
        documentLinks: {
          where: { document: { deletedAt: null } },
          include: { document: true },
        },
      },
      orderBy: [{ status: "asc" }, { name: "asc" }],
    });
    return NextResponse.json(medications.map(responseMedication), {
      headers: { "Cache-Control": "private, no-store" },
    });
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
    const input = medicationSchema.parse(await request.json());
    const started = normalizeDateRange(input.startedDate || null, input.startedPrecision);
    const ended =
      input.status === "ended"
        ? normalizeDateRange(input.endedDate || null, input.endedPrecision)
        : { start: null, end: null, precision: "unknown" as const };
    if (started.start !== null && ended.end !== null && started.start > ended.end) {
      throw new ValidationError("Medication end timing cannot be before start timing.");
    }
    const medication = await prisma.$transaction(async (database) => {
      const created = await database.medication.create({
        data: {
          profileId: profile.id,
          name: input.name,
          dose: optionalText(input.dose),
          frequency: optionalText(input.frequency),
          prescriber: optionalText(input.prescriber),
          reason: optionalText(input.reason),
          startedStart: dateOnly(started.start),
          startedEnd: dateOnly(started.end),
          startedDatePrecision: started.precision,
          endedStart: dateOnly(ended.start),
          endedEnd: dateOnly(ended.end),
          endedDatePrecision: input.status === "ended" ? ended.precision : null,
          status: input.status,
          monitoringInstructions: optionalText(input.monitoring),
          nextReviewDate: dateOnly(input.nextReview),
          notes: optionalText(input.notes),
          classCodesJson: [...new Set(input.classCodes)].sort(),
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
          action: "medication.created",
          entityType: "Medication",
          entityId: created.id,
          metadataJson: {},
        },
      });
      return created;
    });
    return NextResponse.json(responseMedication(medication), { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
