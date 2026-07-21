import { Readable } from "node:stream";

import { hash } from "argon2";

import { Prisma } from "@/generated/prisma/client";
import { SYNTHETIC_DEMO_USER_ID, SYNTHETIC_PRIVATE_USER_ID } from "@/config/demo";
import type { DatabaseClient } from "@/server/db";
import { rebuildRecommendations } from "@/server/recommendations";
import { careEventFingerprint, type CareEventRecord } from "@/server/repositories/care-event";
import { normalizeEmail } from "@/server/repositories/normalize";
import { privateStorage } from "@/server/storage";

const DEMO_USER_ID = SYNTHETIC_DEMO_USER_ID;
const PRIVATE_USER_ID = SYNTHETIC_PRIVATE_USER_ID;
const DEMO_HOUSEHOLD_ID = "20000000-0000-4000-8000-000000000001";
const DEMO_CREATED_AT = new Date("2026-01-15T12:00:00.000Z");
const DEMO_AS_OF_DATE = "2026-07-21";

const PROFILE_SEEDS = [
  {
    id: "30000000-0000-4000-8000-000000000001",
    ownerUserId: DEMO_USER_ID,
    displayName: "Alex Example",
    relationshipLabel: "Self",
    dateOfBirth: new Date("1969-03-12T00:00:00.000Z"),
    sexAssignedAtBirth: "male" as const,
    visibility: "household" as const,
    anatomy: [
      { anatomyKey: "prostate" as const, state: "present" as const },
      { anatomyKey: "cervix" as const, state: "absent" as const },
    ],
  },
  {
    id: "30000000-0000-4000-8000-000000000002",
    ownerUserId: DEMO_USER_ID,
    displayName: "Blair Example",
    relationshipLabel: "Family member",
    dateOfBirth: new Date("1964-04-21T00:00:00.000Z"),
    sexAssignedAtBirth: "female" as const,
    visibility: "household" as const,
    anatomy: [
      { anatomyKey: "breast_tissue" as const, state: "present" as const },
      { anatomyKey: "cervix" as const, state: "present" as const },
    ],
  },
  {
    id: "30000000-0000-4000-8000-000000000003",
    ownerUserId: DEMO_USER_ID,
    displayName: "Casey Example",
    relationshipLabel: "Family member",
    dateOfBirth: new Date("1981-02-14T00:00:00.000Z"),
    sexAssignedAtBirth: "unknown" as const,
    visibility: "household" as const,
    anatomy: [
      { anatomyKey: "prostate" as const, state: "unknown" as const },
      { anatomyKey: "cervix" as const, state: "unknown" as const },
    ],
  },
  {
    id: "30000000-0000-4000-8000-000000000004",
    ownerUserId: PRIVATE_USER_ID,
    displayName: "Drew Example",
    relationshipLabel: "Adult family member",
    dateOfBirth: new Date("1987-09-08T00:00:00.000Z"),
    sexAssignedAtBirth: "prefer_not_to_answer" as const,
    visibility: "owner_only" as const,
    anatomy: [
      {
        anatomyKey: "prostate" as const,
        state: "prefer_not_to_answer" as const,
      },
      {
        anatomyKey: "cervix" as const,
        state: "prefer_not_to_answer" as const,
      },
    ],
  },
] as const;

type SeedService = Awaited<ReturnType<DatabaseClient["serviceCatalog"]["findUnique"]>>;

function privateDemoEmail(demoEmail: string): string {
  const separator = demoEmail.lastIndexOf("@");
  if (separator < 1) {
    throw new Error("DEMO_USER_EMAIL must be a valid email address.");
  }
  return `${demoEmail.slice(0, separator)}+private${demoEmail.slice(separator)}`;
}

function dateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function syntheticPdf(): Buffer {
  const stream =
    "BT\n/F1 16 Tf\n72 720 Td\n(Synthetic CareCadence demo document) Tj\n0 -28 Td\n/F1 11 Tf\n(Placeholder only - no personal health information.) Tj\nET\n";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}endstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let body = "%PDF-1.4\n";
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(body));
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(body);
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  body += offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
    .join("");
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(body, "ascii");
}

async function seedMembership(
  database: DatabaseClient,
  id: string,
  userId: string,
  role: "owner" | "member",
): Promise<void> {
  const existing = await database.householdMember.findFirst({
    where: { householdId: DEMO_HOUSEHOLD_ID, userId },
    orderBy: { joinedAt: "desc" },
  });
  if (existing === null) {
    await database.householdMember.create({
      data: {
        id,
        householdId: DEMO_HOUSEHOLD_ID,
        userId,
        role,
        joinedAt: DEMO_CREATED_AT,
      },
    });
  } else if (existing.role !== role || existing.removedAt !== null) {
    await database.householdMember.update({
      where: { id: existing.id },
      data: { role, removedAt: null, joinedAt: DEMO_CREATED_AT },
    });
  }
}

async function serviceBySlug(
  database: DatabaseClient,
  slug: string,
): Promise<NonNullable<SeedService>> {
  const service = await database.serviceCatalog.findUnique({ where: { slug } });
  if (service === null) throw new Error(`Demo service ${slug} was not seeded.`);
  return service;
}

async function methodBySlug(database: DatabaseClient, serviceId: string, slug: string) {
  const method = await database.serviceMethod.findUnique({
    where: { serviceId_slug: { serviceId, slug } },
  });
  if (method === null) throw new Error(`Demo method ${slug} was not seeded.`);
  return method;
}

async function upsertCareEvent(
  database: DatabaseClient,
  input: CareEventRecord & { id: string; createdAt: Date },
) {
  const { id, createdAt, ...record } = input;
  const data = { ...record, duplicateFingerprint: careEventFingerprint(record), deletedAt: null };
  return database.careEvent.upsert({
    where: { id },
    create: { id, ...data, createdAt },
    update: data,
  });
}

async function ensureSyntheticDocument(
  database: DatabaseClient,
  profileId: string,
  careEventId: string,
): Promise<void> {
  const documentId = "70000000-0000-4000-8000-000000000001";
  const bytes = syntheticPdf();
  let document = await database.document.findUnique({ where: { id: documentId } });
  let stored: Awaited<ReturnType<typeof privateStorage.put>> | null = null;

  if (document !== null) {
    try {
      const existing = await privateStorage.get(document.storageKey);
      if (existing.stream instanceof Readable) existing.stream.destroy();
      document = await database.document.update({
        where: { id: document.id },
        data: { deletedAt: null, blobDeletedAt: null },
      });
    } catch {
      stored = await privateStorage.put({
        stream: Readable.from(bytes),
        contentType: "application/pdf",
        size: bytes.length,
      });
      document = await database.document.update({
        where: { id: document.id },
        data: {
          storageKey: stored.storageKey,
          sha256: stored.sha256,
          sizeBytes: BigInt(bytes.length),
          deletedAt: null,
          blobDeletedAt: null,
        },
      });
    }
  } else {
    stored = await privateStorage.put({
      stream: Readable.from(bytes),
      contentType: "application/pdf",
      size: bytes.length,
    });
    try {
      document = await database.document.create({
        data: {
          id: documentId,
          householdId: DEMO_HOUSEHOLD_ID,
          profileId,
          storageKey: stored.storageKey,
          originalFilename: "synthetic-vaccine-record.pdf",
          safeFilename: "synthetic-vaccine-record.pdf",
          mimeType: "application/pdf",
          sizeBytes: BigInt(bytes.length),
          sha256: stored.sha256,
          uploadedByUserId: DEMO_USER_ID,
          createdAt: new Date("2026-02-20T15:00:00.000Z"),
        },
      });
    } catch (error) {
      await privateStorage.delete(stored.storageKey).catch(() => undefined);
      throw error;
    }
  }

  const existingLink = await database.documentLink.findFirst({
    where: { documentId: document.id, careEventId },
  });
  if (existingLink === null) {
    await database.documentLink.create({
      data: {
        id: "71000000-0000-4000-8000-000000000001",
        documentId: document.id,
        careEventId,
        label: "Synthetic vaccine record",
        createdAt: new Date("2026-02-20T15:00:00.000Z"),
      },
    });
  }
}

async function seedScenarioData(database: DatabaseClient): Promise<void> {
  const [
    colorectal,
    tetanus,
    breast,
    cervical,
    influenza,
    eyeExam,
    depression,
    zoster,
    hepatitisC,
    medicationReview,
    primaryCare,
    dentalCare,
  ] = await Promise.all([
    serviceBySlug(database, "colorectal-cancer-screening"),
    serviceBySlug(database, "tdap-td-vaccine"),
    serviceBySlug(database, "breast-cancer-screening"),
    serviceBySlug(database, "cervical-cancer-screening"),
    serviceBySlug(database, "influenza-vaccine"),
    serviceBySlug(database, "eye-exam"),
    serviceBySlug(database, "depression-screening"),
    serviceBySlug(database, "zoster-vaccine"),
    serviceBySlug(database, "hepatitis-c-screening"),
    serviceBySlug(database, "medication-reconciliation"),
    serviceBySlug(database, "primary-care-check-in"),
    serviceBySlug(database, "dental-care"),
  ]);
  const [
    colonoscopy,
    unspecifiedTetanusDose,
    mammography,
    cervicalCotest,
    influenzaDose,
    depressionQuestionnaire,
    zosterDose,
    hepatitisCBloodTest,
  ] = await Promise.all([
    methodBySlug(database, colorectal.id, "colonoscopy"),
    methodBySlug(database, tetanus.id, "dose-record"),
    methodBySlug(database, breast.id, "mammography"),
    methodBySlug(database, cervical.id, "co-testing"),
    methodBySlug(database, influenza.id, "dose-record"),
    methodBySlug(database, depression.id, "questionnaire"),
    methodBySlug(database, zoster.id, "recombinant-zoster"),
    methodBySlug(database, hepatitisC.id, "blood-test"),
  ]);

  const eventDefaults = {
    result: "normal" as const,
    providerName: "Demo Care Team",
    locationName: "Synthetic Clinic",
    notes: "Synthetic demonstration record.",
    source: "medical_record" as const,
    importBatchId: null,
    createdByUserId: DEMO_USER_ID,
  };
  await upsertCareEvent(database, {
    ...eventDefaults,
    id: "40000000-0000-4000-8000-000000000001",
    profileId: PROFILE_SEEDS[0].id,
    serviceId: colorectal.id,
    methodId: colonoscopy.id,
    performedStart: dateOnly("2021-06-15"),
    performedEnd: dateOnly("2021-06-15"),
    datePrecision: "day",
    createdAt: new Date("2021-06-16T14:00:00.000Z"),
  });
  await upsertCareEvent(database, {
    ...eventDefaults,
    id: "40000000-0000-4000-8000-000000000002",
    profileId: PROFILE_SEEDS[0].id,
    serviceId: tetanus.id,
    methodId: unspecifiedTetanusDose.id,
    performedStart: dateOnly("2018-01-01"),
    performedEnd: dateOnly("2018-12-31"),
    datePrecision: "year",
    source: "user_memory",
    createdAt: new Date("2026-01-15T12:30:00.000Z"),
  });
  await upsertCareEvent(database, {
    ...eventDefaults,
    id: "40000000-0000-4000-8000-000000000003",
    profileId: PROFILE_SEEDS[1].id,
    serviceId: breast.id,
    methodId: mammography.id,
    performedStart: dateOnly("2025-01-01"),
    performedEnd: dateOnly("2025-12-31"),
    datePrecision: "year",
    source: "user_memory",
    createdAt: new Date("2026-01-15T12:35:00.000Z"),
  });
  await upsertCareEvent(database, {
    ...eventDefaults,
    id: "40000000-0000-4000-8000-000000000004",
    profileId: PROFILE_SEEDS[1].id,
    serviceId: cervical.id,
    methodId: cervicalCotest.id,
    performedStart: dateOnly("2022-03-01"),
    performedEnd: dateOnly("2022-03-31"),
    datePrecision: "month",
    createdAt: new Date("2022-04-05T16:00:00.000Z"),
  });
  const caseyVaccine = await upsertCareEvent(database, {
    ...eventDefaults,
    id: "40000000-0000-4000-8000-000000000005",
    profileId: PROFILE_SEEDS[2].id,
    serviceId: influenza.id,
    methodId: influenzaDose.id,
    performedStart: dateOnly("2025-10-12"),
    performedEnd: dateOnly("2025-10-12"),
    datePrecision: "day",
    source: "pharmacy",
    createdAt: new Date("2025-10-12T18:00:00.000Z"),
  });
  await upsertCareEvent(database, {
    ...eventDefaults,
    id: "40000000-0000-4000-8000-000000000006",
    profileId: PROFILE_SEEDS[2].id,
    serviceId: eyeExam.id,
    methodId: null,
    performedStart: null,
    performedEnd: null,
    datePrecision: "unknown",
    source: "user_memory",
    createdAt: new Date("2026-02-20T15:00:00.000Z"),
  });
  await upsertCareEvent(database, {
    ...eventDefaults,
    id: "40000000-0000-4000-8000-000000000007",
    profileId: PROFILE_SEEDS[3].id,
    serviceId: depression.id,
    methodId: depressionQuestionnaire.id,
    performedStart: dateOnly("2026-04-11"),
    performedEnd: dateOnly("2026-04-11"),
    datePrecision: "day",
    createdByUserId: PRIVATE_USER_ID,
    createdAt: new Date("2026-04-11T19:00:00.000Z"),
  });
  await upsertCareEvent(database, {
    ...eventDefaults,
    id: "40000000-0000-4000-8000-000000000008",
    profileId: PROFILE_SEEDS[0].id,
    serviceId: zoster.id,
    methodId: zosterDose.id,
    performedStart: dateOnly("2021-05-04"),
    performedEnd: dateOnly("2021-05-04"),
    datePrecision: "day",
    source: "pharmacy",
    createdAt: new Date("2021-05-04T18:00:00.000Z"),
  });
  await upsertCareEvent(database, {
    ...eventDefaults,
    id: "40000000-0000-4000-8000-000000000009",
    profileId: PROFILE_SEEDS[0].id,
    serviceId: zoster.id,
    methodId: zosterDose.id,
    performedStart: dateOnly("2021-07-13"),
    performedEnd: dateOnly("2021-07-13"),
    datePrecision: "day",
    source: "pharmacy",
    createdAt: new Date("2021-07-13T18:00:00.000Z"),
  });
  await upsertCareEvent(database, {
    ...eventDefaults,
    id: "40000000-0000-4000-8000-000000000010",
    profileId: PROFILE_SEEDS[2].id,
    serviceId: hepatitisC.id,
    methodId: hepatitisCBloodTest.id,
    performedStart: dateOnly("2024-09-16"),
    performedEnd: dateOnly("2024-09-16"),
    datePrecision: "day",
    createdAt: new Date("2024-09-17T16:00:00.000Z"),
  });

  await database.familyHistory.upsert({
    where: { id: "42000000-0000-4000-8000-000000000001" },
    create: {
      id: "42000000-0000-4000-8000-000000000001",
      profileId: PROFILE_SEEDS[1].id,
      relationship: "First-degree relative",
      conditionCode: "breast_cancer",
      conditionDisplay: "Breast cancer",
      note: "Synthetic family-history example; no genetic syndrome is recorded.",
      createdAt: DEMO_CREATED_AT,
    },
    update: { deletedAt: null },
  });
  await database.medication.upsert({
    where: { id: "43000000-0000-4000-8000-000000000001" },
    create: {
      id: "43000000-0000-4000-8000-000000000001",
      profileId: PROFILE_SEEDS[3].id,
      name: "Synthetic daily medicine",
      dose: "Demo dose",
      frequency: "Once daily",
      reason: "Synthetic medication list example",
      startedStart: dateOnly("2025-01-01"),
      startedEnd: dateOnly("2025-12-31"),
      startedDatePrecision: "year",
      status: "active",
      monitoringInstructions: "Follow the private demo care plan; no monitoring is inferred.",
      nextReviewDate: dateOnly("2026-11-01"),
      createdAt: DEMO_CREATED_AT,
    },
    update: { status: "active", deletedAt: null },
  });

  await database.profileGuidelineSelection.upsert({
    where: {
      profileId_conflictGroup: {
        profileId: PROFILE_SEEDS[1].id,
        conflictGroup: "breast-screening-guideline",
      },
    },
    create: {
      id: "44000000-0000-4000-8000-000000000001",
      profileId: PROFILE_SEEDS[1].id,
      conflictGroup: "breast-screening-guideline",
      variantId: "uspstf_2024",
      selectedByUserId: DEMO_USER_ID,
      selectedAt: new Date("2026-01-15T13:00:00.000Z"),
    },
    update: { variantId: "uspstf_2024", selectedByUserId: DEMO_USER_ID },
  });

  const overrides = [
    {
      id: "45000000-0000-4000-8000-000000000001",
      profileId: PROFILE_SEEDS[0].id,
      serviceId: medicationReview.id,
      overrideType: "exact_next_date" as const,
      nextDueStart: dateOnly("2026-10-15"),
      nextDueEnd: dateOnly("2026-10-15"),
      intervalJson: Prisma.DbNull,
      replacesGeneralGuideline: true,
      clinicianName: "Demo Care Team",
      practiceName: "Synthetic Clinic",
      instructionReceivedDate: dateOnly("2026-06-01"),
      reason: "Synthetic medication review instruction.",
      reviewDate: dateOnly("2026-10-15"),
      createdByUserId: DEMO_USER_ID,
    },
    {
      id: "45000000-0000-4000-8000-000000000003",
      profileId: PROFILE_SEEDS[3].id,
      serviceId: depression.id,
      overrideType: "clinician_managed" as const,
      nextDueStart: null,
      nextDueEnd: null,
      intervalJson: Prisma.DbNull,
      replacesGeneralGuideline: true,
      clinicianName: "Demo Care Team",
      practiceName: "Synthetic Clinic",
      instructionReceivedDate: dateOnly("2026-04-11"),
      reason: "Timing remains with the private demo care team.",
      reviewDate: dateOnly("2027-04-11"),
      createdByUserId: PRIVATE_USER_ID,
    },
  ];
  for (const override of overrides) {
    await database.clinicianOverride.upsert({
      where: { id: override.id },
      create: { ...override, methodId: null, active: true, createdAt: DEMO_CREATED_AT },
      update: { ...override, methodId: null, active: true },
    });
  }

  // Earlier pre-release demo seeds represented this as a supplemental
  // clinician override. Keep reruns deterministic while demonstrating the
  // dedicated, clearly labeled custom-maintenance workflow instead.
  await database.clinicianOverride.updateMany({
    where: { id: "45000000-0000-4000-8000-000000000002" },
    data: { active: false },
  });
  await database.customMaintenance.upsert({
    where: {
      profileId_templateServiceId: {
        profileId: PROFILE_SEEDS[2].id,
        templateServiceId: dentalCare.id,
      },
    },
    create: {
      id: "47000000-0000-4000-8000-000000000001",
      profileId: PROFILE_SEEDS[2].id,
      templateServiceId: dentalCare.id,
      title: "Synthetic dental care cadence",
      category: "Dental",
      purpose: "A personal six-month routine selected for the synthetic demo.",
      kind: "routine",
      source: "app_template",
      cadenceValue: 6,
      cadenceUnit: "months",
      startDate: dateOnly("2026-02-01"),
      nextDate: dateOnly("2026-08-01"),
      reminderEnabled: false,
      visibility: "profile_access",
      notes: "Synthetic custom-maintenance example; this is not a federal recommendation.",
      status: "active",
      createdByUserId: DEMO_USER_ID,
      createdAt: DEMO_CREATED_AT,
    },
    update: {
      title: "Synthetic dental care cadence",
      category: "Dental",
      purpose: "A personal six-month routine selected for the synthetic demo.",
      kind: "routine",
      source: "app_template",
      clinicianName: null,
      practiceName: null,
      cadenceValue: 6,
      cadenceUnit: "months",
      startDate: dateOnly("2026-02-01"),
      stopDate: null,
      nextDate: dateOnly("2026-08-01"),
      reminderEnabled: false,
      reminderDaysBefore: null,
      visibility: "profile_access",
      notes: "Synthetic custom-maintenance example; this is not a federal recommendation.",
      status: "active",
      disabledAt: null,
      createdByUserId: DEMO_USER_ID,
    },
  });

  const plannedActions = [
    {
      id: "46000000-0000-4000-8000-000000000001",
      profileId: PROFILE_SEEDS[0].id,
      serviceId: primaryCare.id,
      title: "Synthetic annual primary-care visit",
      plannedMonth: dateOnly("2026-10-01"),
      appointmentStart: null,
      appointmentEnd: null,
      timezone: "America/New_York",
      location: null,
      notes: "Synthetic planning example; this does not change medical timing.",
      status: "planned" as const,
      createdByUserId: DEMO_USER_ID,
    },
    {
      id: "46000000-0000-4000-8000-000000000002",
      profileId: PROFILE_SEEDS[1].id,
      serviceId: breast.id,
      title: "Synthetic preventive appointment",
      plannedMonth: dateOnly("2026-09-01"),
      appointmentStart: new Date("2026-09-03T14:00:00.000Z"),
      appointmentEnd: new Date("2026-09-03T14:30:00.000Z"),
      timezone: "America/New_York",
      location: "Synthetic Clinic",
      notes: "Synthetic appointment example.",
      status: "scheduled" as const,
      createdByUserId: DEMO_USER_ID,
    },
  ];
  for (const action of plannedActions) {
    await database.plannedAction.upsert({
      where: { id: action.id },
      create: { ...action, recommendationInstanceId: null, createdAt: DEMO_CREATED_AT },
      update: { ...action, recommendationInstanceId: null },
    });
  }

  await ensureSyntheticDocument(database, PROFILE_SEEDS[2].id, caseyVaccine.id);

  const audits: Array<Prisma.AuditLogUncheckedCreateInput & { id: string }> = PROFILE_SEEDS.flatMap(
    (profile, index) => [
      {
        id: `48000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
        householdId: DEMO_HOUSEHOLD_ID,
        profileId: profile.id,
        actorUserId: profile.ownerUserId,
        action: "profile.created",
        entityType: "Profile",
        entityId: profile.id,
        metadataJson: { synthetic: true },
        createdAt: new Date(DEMO_CREATED_AT.getTime() + index * 60_000),
      },
    ],
  );
  audits.push({
    id: "48000000-0000-4000-8000-000000000010",
    householdId: DEMO_HOUSEHOLD_ID,
    profileId: PROFILE_SEEDS[3].id,
    actorUserId: PRIVATE_USER_ID,
    action: "profile.claimed",
    entityType: "Profile",
    entityId: PROFILE_SEEDS[3].id,
    metadataJson: { synthetic: true },
    createdAt: new Date("2026-01-15T13:15:00.000Z"),
  });
  audits.push({
    id: "48000000-0000-4000-8000-000000000011",
    householdId: DEMO_HOUSEHOLD_ID,
    profileId: PROFILE_SEEDS[1].id,
    actorUserId: DEMO_USER_ID,
    action: "guideline_rule.updated",
    entityType: "GuidelineRule",
    entityId: "synthetic-rule-update-2026",
    metadataJson: { synthetic: true, version: 1 },
    createdAt: new Date("2026-06-15T14:00:00.000Z"),
  });
  for (const audit of audits) {
    await database.auditLog.upsert({
      where: { id: audit.id },
      create: audit,
      update: { metadataJson: audit.metadataJson },
    });
  }

  for (const profile of PROFILE_SEEDS) {
    await rebuildRecommendations(database, profile.id, DEMO_AS_OF_DATE);
  }
}

export async function seedDemo(
  database: DatabaseClient,
): Promise<{ users: number; profiles: number }> {
  const demoEmail = normalizeEmail(process.env.DEMO_USER_EMAIL ?? "demo@carecadence.local");
  const demoPassword = process.env.DEMO_USER_PASSWORD ?? "carecadence-demo-only";
  const privateEmail = normalizeEmail(privateDemoEmail(demoEmail));
  const [demoPasswordHash, privatePasswordHash] = await Promise.all([
    hash(demoPassword),
    hash(demoPassword),
  ]);

  const conflictingUsers = await database.user.findMany({
    where: {
      emailNormalized: { in: [demoEmail, privateEmail] },
      id: { notIn: [DEMO_USER_ID, PRIVATE_USER_ID] },
    },
    select: { id: true },
  });
  if (conflictingUsers.length > 0) {
    throw new Error(
      "DEMO_USER_EMAIL conflicts with an existing non-demo account. Choose another synthetic demo email.",
    );
  }

  await database.user.upsert({
    where: { id: DEMO_USER_ID },
    create: {
      id: DEMO_USER_ID,
      email: demoEmail,
      emailNormalized: demoEmail,
      passwordHash: demoPasswordHash,
      name: "Demo Organizer",
      createdAt: DEMO_CREATED_AT,
    },
    update: {
      email: demoEmail,
      emailNormalized: demoEmail,
      passwordHash: demoPasswordHash,
      name: "Demo Organizer",
      deletedAt: null,
    },
  });
  await database.user.upsert({
    where: { id: PRIVATE_USER_ID },
    create: {
      id: PRIVATE_USER_ID,
      email: privateEmail,
      emailNormalized: privateEmail,
      passwordHash: privatePasswordHash,
      name: "Demo Private Adult",
      createdAt: DEMO_CREATED_AT,
    },
    update: {
      email: privateEmail,
      emailNormalized: privateEmail,
      passwordHash: privatePasswordHash,
      name: "Demo Private Adult",
      deletedAt: null,
    },
  });

  await database.household.upsert({
    where: { id: DEMO_HOUSEHOLD_ID },
    create: {
      id: DEMO_HOUSEHOLD_ID,
      name: "Demo Family",
      ownerUserId: DEMO_USER_ID,
      timezone: process.env.DEFAULT_TIMEZONE ?? "America/New_York",
      countryCode: "US",
      createdAt: DEMO_CREATED_AT,
    },
    update: {
      name: "Demo Family",
      ownerUserId: DEMO_USER_ID,
      timezone: process.env.DEFAULT_TIMEZONE ?? "America/New_York",
      deletedAt: null,
    },
  });
  await seedMembership(database, "21000000-0000-4000-8000-000000000001", DEMO_USER_ID, "owner");
  await seedMembership(database, "21000000-0000-4000-8000-000000000002", PRIVATE_USER_ID, "member");

  for (const profile of PROFILE_SEEDS) {
    await database.profile.upsert({
      where: { id: profile.id },
      create: {
        id: profile.id,
        householdId: DEMO_HOUSEHOLD_ID,
        ownerUserId: profile.ownerUserId,
        createdByUserId: DEMO_USER_ID,
        displayName: profile.displayName,
        relationshipLabel: profile.relationshipLabel,
        dateOfBirth: profile.dateOfBirth,
        sexAssignedAtBirth: profile.sexAssignedAtBirth,
        countryCode: "US",
        timezone: process.env.DEFAULT_TIMEZONE ?? "America/New_York",
        carePlanMode: "evidence_based",
        visibility: profile.visibility,
        claimedAt: DEMO_CREATED_AT,
        createdAt: DEMO_CREATED_AT,
      },
      update: {
        ownerUserId: profile.ownerUserId,
        displayName: profile.displayName,
        relationshipLabel: profile.relationshipLabel,
        dateOfBirth: profile.dateOfBirth,
        sexAssignedAtBirth: profile.sexAssignedAtBirth,
        visibility: profile.visibility,
        claimedAt: DEMO_CREATED_AT,
        deletedAt: null,
      },
    });

    for (const anatomy of profile.anatomy) {
      await database.profileAnatomy.upsert({
        where: {
          profileId_anatomyKey: {
            profileId: profile.id,
            anatomyKey: anatomy.anatomyKey,
          },
        },
        create: { profileId: profile.id, ...anatomy, effectiveDate: null, note: null },
        update: { state: anatomy.state },
      });
    }
  }

  await seedScenarioData(database);
  return { users: 2, profiles: PROFILE_SEEDS.length };
}
