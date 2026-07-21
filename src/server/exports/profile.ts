import JSZip from "jszip";

import { prisma } from "@/server/db/client";
import { privateStorage } from "@/server/storage";

import { createCsv } from "./csv";

const MAX_EXPORT_DOCUMENTS = 100;
const MAX_EXPORT_BYTES = 100 * 1024 * 1024;

type ExportFolder = JSZip;

function dateOnly(value: Date | null): string | null {
  return value === null ? null : value.toISOString().slice(0, 10);
}

function safeDocumentName(value: string): string {
  const safe = value
    .replaceAll("\\", "-")
    .replaceAll("/", "-")
    .replace(/\.{2,}/g, ".")
    .trim();
  return (safe === "" ? "document" : safe).slice(0, 180);
}

async function streamBuffer(stream: NodeJS.ReadableStream, expectedSize: number): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of stream as AsyncIterable<Buffer | string | Uint8Array>) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += bytes.length;
    if (total > expectedSize || total > MAX_EXPORT_BYTES) {
      throw new RangeError("A document changed while the export was being prepared.");
    }
    chunks.push(bytes);
  }
  if (total !== expectedSize)
    throw new RangeError("A document changed while the export was being prepared.");
  return Buffer.concat(chunks);
}

export async function addProfileExportFiles(
  folder: ExportFolder,
  profileId: string,
  generatedAt: Date,
): Promise<string[]> {
  const profile = await prisma.profile.findFirst({
    where: { id: profileId, deletedAt: null },
    include: {
      anatomy: true,
      riskFactors: { where: { deletedAt: null } },
      conditions: { where: { deletedAt: null } },
      familyHistory: { where: { deletedAt: null } },
      surgeries: { where: { deletedAt: null } },
      serviceHistoryStates: true,
      careEvents: {
        where: { deletedAt: null },
        include: { service: true, method: true },
        orderBy: [{ performedEnd: "desc" }, { createdAt: "desc" }],
      },
      medications: { where: { deletedAt: null }, orderBy: { createdAt: "asc" } },
      clinicianOverrides: {
        include: { service: true, method: true },
        orderBy: { createdAt: "asc" },
      },
      plannedActions: { include: { service: true }, orderBy: { createdAt: "asc" } },
      recommendations: {
        where: { retiredAt: null },
        include: { service: true, rule: { include: { source: true } } },
        orderBy: [{ service: { sortOrder: "asc" } }, { createdAt: "asc" }],
      },
      documents: { where: { deletedAt: null }, orderBy: { createdAt: "asc" } },
    },
  });
  if (profile === null) throw new RangeError("The profile is no longer available.");
  if (profile.documents.length > MAX_EXPORT_DOCUMENTS) {
    throw new RangeError(`Profile exports are limited to ${MAX_EXPORT_DOCUMENTS} documents.`);
  }
  const totalDocumentBytes = profile.documents.reduce(
    (total, document) => total + Number(document.sizeBytes),
    0,
  );
  if (!Number.isSafeInteger(totalDocumentBytes) || totalDocumentBytes > MAX_EXPORT_BYTES) {
    throw new RangeError("Profile documents exceed the 100 MB export limit.");
  }

  const sourceMap = new Map(
    profile.recommendations.map((recommendation) => [
      recommendation.rule.source.id,
      recommendation.rule.source,
    ]),
  );
  const profileJson = {
    schemaVersion: "1.0",
    generatedAt: generatedAt.toISOString(),
    profile: {
      id: profile.id,
      householdId: profile.householdId,
      displayName: profile.displayName,
      relationshipLabel: profile.relationshipLabel,
      dateOfBirth: dateOnly(profile.dateOfBirth),
      sexAssignedAtBirth: profile.sexAssignedAtBirth,
      genderIdentity: profile.genderIdentity,
      countryCode: profile.countryCode,
      timezone: profile.timezone,
      carePlanMode: profile.carePlanMode,
      visibility: profile.visibility,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    },
    anatomy: profile.anatomy,
    riskFactors: profile.riskFactors,
    conditions: profile.conditions,
    familyHistory: profile.familyHistory,
    surgeries: profile.surgeries,
    serviceHistoryStates: profile.serviceHistoryStates,
    recommendations: profile.recommendations.map((recommendation) => ({
      id: recommendation.id,
      serviceSlug: recommendation.service.slug,
      serviceName: recommendation.service.name,
      ruleStableKey: recommendation.rule.stableKey,
      ruleVersion: recommendation.ruleVersion,
      variantId: recommendation.variantId,
      status: recommendation.status,
      recommendationClass: recommendation.recommendationClass,
      dueStart: dateOnly(recommendation.dueStart),
      dueEnd: dateOnly(recommendation.dueEnd),
      evaluatedAsOf: dateOnly(recommendation.evaluatedAsOf),
      explanation: recommendation.explanationJson,
    })),
    documents: profile.documents.map((document) => ({
      id: document.id,
      filename: document.safeFilename,
      mimeType: document.mimeType,
      sizeBytes: document.sizeBytes.toString(),
      sha256: document.sha256,
      createdAt: document.createdAt,
    })),
  };

  const files = [
    "profile.json",
    "care-events.csv",
    "medications.csv",
    "clinician-overrides.csv",
    "planned-actions.csv",
    "sources.csv",
    "README.txt",
  ];
  folder.file("profile.json", JSON.stringify(profileJson, null, 2));
  folder.file(
    "care-events.csv",
    createCsv(
      [
        "id",
        "service",
        "method",
        "performed_start",
        "performed_end",
        "date_precision",
        "result",
        "provider",
        "location",
        "source",
        "notes",
        "created_at",
      ],
      profile.careEvents.map((event) => [
        event.id,
        event.service.slug,
        event.method?.slug,
        dateOnly(event.performedStart),
        dateOnly(event.performedEnd),
        event.datePrecision,
        event.result,
        event.providerName,
        event.locationName,
        event.source,
        event.notes,
        event.createdAt,
      ]),
    ),
  );
  folder.file(
    "medications.csv",
    createCsv(
      [
        "id",
        "name",
        "dose",
        "frequency",
        "prescriber",
        "reason",
        "status",
        "started_start",
        "started_end",
        "started_date_precision",
        "next_review_date",
      ],
      profile.medications.map((medication) => [
        medication.id,
        medication.name,
        medication.dose,
        medication.frequency,
        medication.prescriber,
        medication.reason,
        medication.status,
        dateOnly(medication.startedStart),
        dateOnly(medication.startedEnd),
        medication.startedDatePrecision,
        dateOnly(medication.nextReviewDate),
      ]),
    ),
  );
  folder.file(
    "clinician-overrides.csv",
    createCsv(
      [
        "id",
        "service",
        "method",
        "override_type",
        "next_due_start",
        "next_due_end",
        "instruction_received_date",
        "review_date",
        "active",
        "clinician",
        "practice",
        "reason",
      ],
      profile.clinicianOverrides.map((override) => [
        override.id,
        override.service.slug,
        override.method?.slug,
        override.overrideType,
        dateOnly(override.nextDueStart),
        dateOnly(override.nextDueEnd),
        dateOnly(override.instructionReceivedDate),
        dateOnly(override.reviewDate),
        override.active,
        override.clinicianName,
        override.practiceName,
        override.reason,
      ]),
    ),
  );
  folder.file(
    "planned-actions.csv",
    createCsv(
      [
        "id",
        "service",
        "title",
        "planned_month",
        "appointment_start",
        "appointment_end",
        "timezone",
        "location",
        "notes",
        "status",
      ],
      profile.plannedActions.map((action) => [
        action.id,
        action.service.slug,
        action.title,
        dateOnly(action.plannedMonth),
        action.appointmentStart,
        action.appointmentEnd,
        action.timezone,
        action.location,
        action.notes,
        action.status,
      ]),
    ),
  );
  folder.file(
    "sources.csv",
    createCsv(
      [
        "slug",
        "organization",
        "title",
        "canonical_url",
        "published_at",
        "effective_at",
        "last_verified_at",
      ],
      [...sourceMap.values()].map((source) => [
        source.slug,
        source.organization,
        source.title,
        source.canonicalUrl,
        dateOnly(source.publishedAt),
        dateOnly(source.effectiveAt),
        dateOnly(source.lastVerifiedAt),
      ]),
    ),
  );
  folder.file(
    "README.txt",
    [
      "CareCadence profile export",
      "",
      `Schema version: 1.0`,
      `Generated: ${generatedAt.toISOString()}`,
      "",
      "This archive contains private health information. Store and share it carefully.",
      "Dates retain their recorded precision in care-events.csv.",
      "CareCadence organizes preventive care and does not provide medical advice.",
    ].join("\r\n"),
  );

  for (const [index, document] of profile.documents.entries()) {
    const stored = await privateStorage.get(document.storageKey);
    if (stored.size !== Number(document.sizeBytes)) {
      throw new RangeError("A document changed while the export was being prepared.");
    }
    const name = `documents/${String(index + 1).padStart(3, "0")}-${safeDocumentName(document.safeFilename)}`;
    folder.file(name, await streamBuffer(stored.stream, stored.size), { binary: true });
    files.push(name);
  }
  return files;
}

export async function createProfileExport(
  profileId: string,
  generatedAt = new Date(),
): Promise<Buffer> {
  const zip = new JSZip();
  await addProfileExportFiles(zip, profileId, generatedAt);
  return zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
}
