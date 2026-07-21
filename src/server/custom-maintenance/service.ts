import { z } from "zod";

import {
  CUSTOM_LAB_WARNING,
  CUSTOM_MAINTENANCE_CATEGORIES,
  CUSTOM_MAINTENANCE_SOURCE_LABELS,
} from "@/domain/custom-maintenance/constants";
import { NotFoundError, ValidationError } from "@/domain/shared/errors";
import type { DatabaseClient } from "@/server/db/transactions";

export { CUSTOM_LAB_WARNING, CUSTOM_MAINTENANCE_CATEGORIES, CUSTOM_MAINTENANCE_SOURCE_LABELS };

export const MAINTENANCE_TEMPLATE_DEFINITIONS = [
  {
    slug: "primary-care-check-in",
    category: "Primary care",
    purpose: "Keep a personal cadence for a general primary-care check-in.",
    kind: "routine",
  },
  {
    slug: "dental-care",
    category: "Dental",
    purpose: "Keep a personal cadence for preventive or problem-focused dental care.",
    kind: "routine",
  },
  {
    slug: "eye-exam",
    category: "Vision",
    purpose: "Keep a personal or clinician-defined eye-care cadence.",
    kind: "routine",
  },
  {
    slug: "hearing-care",
    category: "Hearing",
    purpose: "Keep a personal or clinician-defined hearing-care cadence.",
    kind: "routine",
  },
  {
    slug: "skin-care",
    category: "Skin care",
    purpose: "Keep a personal or clinician-defined skin-care cadence.",
    kind: "routine",
  },
  {
    slug: "medication-reconciliation",
    category: "Medication support",
    purpose: "Plan a review of active medicines and their instructions.",
    kind: "routine",
  },
  {
    slug: "advance-care-planning",
    category: "Planning",
    purpose: "Keep an optional cadence for advance-care planning conversations.",
    kind: "routine",
  },
  {
    slug: "fall-prevention-home-safety",
    category: "Planning",
    purpose: "Keep a personal cadence for reviewing fall prevention and home safety.",
    kind: "routine",
  },
  {
    slug: "specialist-follow-up",
    category: "Specialist follow-up",
    purpose: "Record the follow-up cadence supplied by a specialist.",
    kind: "routine",
  },
  {
    slug: "prescription-renewal",
    category: "Medication support",
    purpose: "Plan prescription-renewal timing without inferring medication monitoring.",
    kind: "routine",
  },
  {
    slug: "custom-lab-bundle",
    category: "Labs",
    purpose: "Group individual lab entries in a personal or clinician-defined plan.",
    kind: "lab_bundle",
  },
] as const;

export const MAINTENANCE_TEMPLATE_SLUGS = MAINTENANCE_TEMPLATE_DEFINITIONS.map(({ slug }) => slug);

const optionalDateSchema = z.preprocess(
  (value) => (value === "" || value === undefined ? null : value),
  z.iso.date().nullable(),
);

function optionalIntegerSchema(minimum: number, maximum: number) {
  return z.preprocess(
    (value) => (value === "" || value === undefined ? null : value),
    z.coerce.number().int().min(minimum).max(maximum).nullable(),
  );
}

const optionalTextSchema = (maximum: number) =>
  z.preprocess(
    (value) => (value === "" || value === undefined ? null : value),
    z.string().trim().min(1).max(maximum).nullable(),
  );

export const customLabEntrySchema = z.object({
  name: z.string().trim().min(1).max(160),
  note: optionalTextSchema(500),
});

const scheduleFields = {
  cadenceValue: optionalIntegerSchema(1, 3650),
  cadenceUnit: z.preprocess(
    (value) => (value === "" || value === undefined ? null : value),
    z.enum(["days", "weeks", "months", "years"]).nullable(),
  ),
  startDate: optionalDateSchema,
  stopDate: optionalDateSchema,
  nextDate: optionalDateSchema,
  reminderEnabled: z.boolean().default(false),
  reminderDaysBefore: optionalIntegerSchema(0, 365),
};

type ScheduleInput = {
  cadenceValue: number | null;
  cadenceUnit: "days" | "weeks" | "months" | "years" | null;
  startDate: string | null;
  stopDate: string | null;
  nextDate: string | null;
  reminderEnabled: boolean;
  reminderDaysBefore: number | null;
  kind: "routine" | "lab_bundle";
  labEntries: Array<{ name: string; note: string | null }>;
};

function validateTiming(input: ScheduleInput, context: z.RefinementCtx): void {
  if ((input.cadenceValue === null) !== (input.cadenceUnit === null)) {
    context.addIssue({
      code: "custom",
      path: ["cadenceValue"],
      message: "Enter both a cadence number and unit.",
    });
  }

  if (input.cadenceValue !== null && input.cadenceUnit !== null) {
    const maximumByUnit = { days: 3650, weeks: 520, months: 120, years: 100 } as const;
    if (input.cadenceValue > maximumByUnit[input.cadenceUnit]) {
      context.addIssue({
        code: "custom",
        path: ["cadenceValue"],
        message: `Cadence is too large for ${input.cadenceUnit}.`,
      });
    }
  }

  if (input.startDate !== null && input.stopDate !== null && input.stopDate < input.startDate) {
    context.addIssue({
      code: "custom",
      path: ["stopDate"],
      message: "Stop date must be on or after the start date.",
    });
  }

  if (input.stopDate !== null && input.nextDate !== null && input.nextDate > input.stopDate) {
    context.addIssue({
      code: "custom",
      path: ["nextDate"],
      message: "Next date must be on or before the stop date.",
    });
  }

  if (input.startDate !== null && input.nextDate !== null && input.nextDate < input.startDate) {
    context.addIssue({
      code: "custom",
      path: ["nextDate"],
      message: "Next date must be on or after the start date.",
    });
  }

  if (input.reminderEnabled && input.nextDate === null) {
    context.addIssue({
      code: "custom",
      path: ["nextDate"],
      message: "Choose a next date before enabling a reminder.",
    });
  }

  if (input.reminderEnabled && input.reminderDaysBefore === null) {
    context.addIssue({
      code: "custom",
      path: ["reminderDaysBefore"],
      message: "Choose when the reminder should appear.",
    });
  }

  if (!input.reminderEnabled && input.reminderDaysBefore !== null) {
    context.addIssue({
      code: "custom",
      path: ["reminderDaysBefore"],
      message: "Reminder timing must be empty when reminders are off.",
    });
  }
}

function validateLabEntries(
  input: Pick<ScheduleInput, "kind" | "labEntries">,
  context: z.RefinementCtx,
): void {
  if (input.kind === "lab_bundle" && input.labEntries.length === 0) {
    context.addIssue({
      code: "custom",
      path: ["labEntries"],
      message: "Add at least one individual lab entry.",
    });
  }

  if (input.kind === "routine" && input.labEntries.length > 0) {
    context.addIssue({
      code: "custom",
      path: ["labEntries"],
      message: "Lab entries are available only for a custom lab bundle.",
    });
  }

  validateLabUniqueness(input.labEntries, context);
}

function validateLabUniqueness(
  labEntries: ScheduleInput["labEntries"],
  context: z.RefinementCtx,
): void {
  const seenLabs = new Set<string>();
  for (const [index, entry] of labEntries.entries()) {
    const key = entry.name.toLocaleLowerCase("en-US");
    if (seenLabs.has(key)) {
      context.addIssue({
        code: "custom",
        path: ["labEntries", index, "name"],
        message: "Each lab entry must have a distinct name.",
      });
    }
    seenLabs.add(key);
  }
}

function validateSchedule(input: ScheduleInput, context: z.RefinementCtx): void {
  validateTiming(input, context);
  validateLabEntries(input, context);
}

export const customMaintenanceInputSchema = z
  .object({
    title: z.string().trim().min(1).max(160),
    category: z.string().trim().min(1).max(100),
    purpose: optionalTextSchema(1000),
    kind: z.enum(["routine", "lab_bundle"]).default("routine"),
    source: z.enum(["personal", "clinician"]),
    clinicianName: optionalTextSchema(160),
    practiceName: optionalTextSchema(160),
    ...scheduleFields,
    visibility: z.enum(["profile_access", "owner_only"]).default("profile_access"),
    notes: optionalTextSchema(2000),
    labEntries: z.array(customLabEntrySchema).max(30).default([]),
  })
  .superRefine(validateSchedule);

export const maintenanceTemplateAdoptionSchema = z
  .object({
    choice: z.enum(["cadence", "ask_clinician", "disabled"]),
    source: z.enum(["app_template", "clinician"]).default("app_template"),
    clinicianName: optionalTextSchema(160),
    practiceName: optionalTextSchema(160),
    ...scheduleFields,
    visibility: z.enum(["profile_access", "owner_only"]).default("profile_access"),
    notes: optionalTextSchema(2000),
    labEntries: z.array(customLabEntrySchema).max(30).default([]),
  })
  .superRefine((input, context) => {
    validateTiming({ ...input, kind: "lab_bundle" }, context);
    validateLabUniqueness(input.labEntries, context);
    if (input.choice !== "cadence") return;
    if (input.cadenceValue === null || input.cadenceUnit === null) {
      context.addIssue({
        code: "custom",
        path: ["cadenceValue"],
        message: "Choose a cadence before adding this template to the plan.",
      });
    }
  });

export type CustomMaintenanceInput = z.infer<typeof customMaintenanceInputSchema>;
export type MaintenanceTemplateAdoptionInput = z.infer<typeof maintenanceTemplateAdoptionSchema>;

export type CustomMaintenanceTimingState =
  "disabled" | "cadence_needed" | "cadence_set" | "scheduled" | "timing_review";

export function customMaintenanceTimingState(
  item: {
    status: "active" | "ask_clinician" | "disabled";
    cadenceValue: number | null;
    cadenceUnit: "days" | "weeks" | "months" | "years" | null;
    nextDate: Date | string | null;
  },
  today = new Date(),
): CustomMaintenanceTimingState {
  if (item.status === "disabled") return "disabled";
  if (item.status === "ask_clinician") return "cadence_needed";
  if (item.nextDate !== null) {
    const nextDate =
      typeof item.nextDate === "string" ? item.nextDate : item.nextDate.toISOString().slice(0, 10);
    const todayKey = today.toISOString().slice(0, 10);
    return nextDate < todayKey ? "timing_review" : "scheduled";
  }
  return item.cadenceValue === null || item.cadenceUnit === null ? "cadence_needed" : "cadence_set";
}

export function formatCadence(value: number | null, unit: string | null): string | null {
  if (value === null || unit === null) return null;
  const singular = unit.endsWith("s") ? unit.slice(0, -1) : unit;
  return `Every ${value} ${value === 1 ? singular : unit}`;
}

type OwnershipContext = {
  ownerUserId: string | null;
  createdByUserId: string;
  claimedAt: Date | null;
  household: { members: Array<{ userId: string; role: "owner" | "admin" | "member" }> };
};

export function isProfileOwnerOrOrganizer(profile: OwnershipContext, userId: string): boolean {
  if (profile.ownerUserId === userId) return true;
  if (profile.claimedAt !== null) return false;
  if (profile.createdByUserId === userId) return true;
  return profile.household.members.some(
    (membership) => membership.userId === userId && membership.role === "owner",
  );
}

type MaintenanceRecord = {
  id: string;
  templateServiceId: string | null;
  title: string;
  category: string;
  purpose: string | null;
  kind: "routine" | "lab_bundle";
  source: "personal" | "clinician" | "app_template";
  clinicianName: string | null;
  practiceName: string | null;
  cadenceValue: number | null;
  cadenceUnit: "days" | "weeks" | "months" | "years" | null;
  startDate: Date | null;
  stopDate: Date | null;
  nextDate: Date | null;
  reminderEnabled: boolean;
  reminderDaysBefore: number | null;
  visibility: "profile_access" | "owner_only";
  notes: string | null;
  status: "active" | "ask_clinician" | "disabled";
  labEntries: Array<{ id: string; name: string; note: string | null; sortOrder: number }>;
};

function dateKey(date: Date | null): string | null {
  return date?.toISOString().slice(0, 10) ?? null;
}

export function serializeCustomMaintenance(item: MaintenanceRecord, today = new Date()) {
  return {
    id: item.id,
    templateServiceId: item.templateServiceId,
    title: item.title,
    category: item.category,
    purpose: item.purpose,
    kind: item.kind,
    source: item.source,
    sourceLabel: CUSTOM_MAINTENANCE_SOURCE_LABELS[item.source],
    clinicianName: item.clinicianName,
    practiceName: item.practiceName,
    cadenceValue: item.cadenceValue,
    cadenceUnit: item.cadenceUnit,
    cadenceLabel: formatCadence(item.cadenceValue, item.cadenceUnit),
    startDate: dateKey(item.startDate),
    stopDate: dateKey(item.stopDate),
    nextDate: dateKey(item.nextDate),
    timingState: customMaintenanceTimingState(item, today),
    reminderEnabled: item.reminderEnabled,
    reminderDaysBefore: item.reminderDaysBefore,
    visibility: item.visibility,
    visibilityLabel:
      item.visibility === "owner_only" ? "Only the profile owner" : "People with profile access",
    notes: item.notes,
    status: item.status,
    warning: item.kind === "lab_bundle" ? CUSTOM_LAB_WARNING : null,
    labEntries: item.labEntries
      .toSorted((left, right) => left.sortOrder - right.sortOrder)
      .map(({ id, name, note }) => ({ id, name, note })),
  };
}

export type CustomMaintenanceView = ReturnType<typeof serializeCustomMaintenance>;

type MutationContext = {
  database: DatabaseClient;
  profileId: string;
  householdId: string;
  actorUserId: string;
  canAccessOwnerOnly: boolean;
  now?: Date;
};

export function customMaintenanceVisibilityWhere(canAccessOwnerOnly: boolean) {
  return canAccessOwnerOnly ? {} : { visibility: "profile_access" as const };
}

function inputData(input: CustomMaintenanceInput) {
  return {
    title: input.title,
    category: input.category,
    purpose: input.purpose,
    kind: input.kind,
    source: input.source,
    clinicianName: input.source === "clinician" ? input.clinicianName : null,
    practiceName: input.source === "clinician" ? input.practiceName : null,
    cadenceValue: input.cadenceValue,
    cadenceUnit: input.cadenceUnit,
    startDate: input.startDate === null ? null : new Date(`${input.startDate}T00:00:00.000Z`),
    stopDate: input.stopDate === null ? null : new Date(`${input.stopDate}T00:00:00.000Z`),
    nextDate: input.nextDate === null ? null : new Date(`${input.nextDate}T00:00:00.000Z`),
    reminderEnabled: input.reminderEnabled,
    reminderDaysBefore: input.reminderEnabled ? input.reminderDaysBefore : null,
    visibility: input.visibility,
    notes: input.notes,
  };
}

function labEntryData(input: CustomMaintenanceInput | MaintenanceTemplateAdoptionInput) {
  return input.labEntries.map((entry, sortOrder) => ({
    name: entry.name,
    note: entry.note,
    sortOrder,
  }));
}

export async function listCustomMaintenance(
  database: DatabaseClient,
  profileId: string,
  canAccessOwnerOnly: boolean,
  today = new Date(),
): Promise<CustomMaintenanceView[]> {
  const records = await database.customMaintenance.findMany({
    where: { profileId, ...customMaintenanceVisibilityWhere(canAccessOwnerOnly) },
    include: { labEntries: { orderBy: { sortOrder: "asc" } } },
    orderBy: [{ status: "asc" }, { nextDate: "asc" }, { title: "asc" }],
  });
  return records.map((record) => serializeCustomMaintenance(record, today));
}

export async function listMaintenanceTemplates(
  database: DatabaseClient,
  profileId: string,
  canAccessOwnerOnly: boolean,
) {
  const [services, adoptions] = await Promise.all([
    database.serviceCatalog.findMany({
      where: { slug: { in: MAINTENANCE_TEMPLATE_SLUGS }, active: true },
      select: { id: true, slug: true, name: true, description: true },
    }),
    database.customMaintenance.findMany({
      where: {
        profileId,
        templateServiceId: { not: null },
        ...customMaintenanceVisibilityWhere(canAccessOwnerOnly),
      },
      select: { id: true, templateServiceId: true, status: true },
    }),
  ]);
  const servicesBySlug = new Map(services.map((service) => [service.slug, service]));
  const adoptionByServiceId = new Map(
    adoptions.map((adoption) => [adoption.templateServiceId, adoption]),
  );

  return MAINTENANCE_TEMPLATE_DEFINITIONS.flatMap((definition) => {
    const service = servicesBySlug.get(definition.slug);
    if (service === undefined) return [];
    const adoption = adoptionByServiceId.get(service.id);
    return [
      {
        ...service,
        category: definition.category,
        purpose: definition.purpose,
        kind: definition.kind,
        warning: definition.kind === "lab_bundle" ? CUSTOM_LAB_WARNING : null,
        adoption: adoption === undefined ? null : { id: adoption.id, status: adoption.status },
      },
    ];
  });
}

export async function createCustomMaintenance(
  context: MutationContext,
  input: CustomMaintenanceInput,
): Promise<CustomMaintenanceView> {
  if (input.visibility === "owner_only" && !context.canAccessOwnerOnly) throw new NotFoundError();
  const record = await context.database.customMaintenance.create({
    data: {
      profileId: context.profileId,
      ...inputData(input),
      status: "active",
      createdByUserId: context.actorUserId,
      labEntries: { create: labEntryData(input) },
    },
    include: { labEntries: { orderBy: { sortOrder: "asc" } } },
  });
  await context.database.auditLog.create({
    data: {
      householdId: context.householdId,
      profileId: context.profileId,
      actorUserId: context.actorUserId,
      action: "custom_maintenance.created",
      entityType: "CustomMaintenance",
      entityId: record.id,
      metadataJson: { labEntryCount: record.labEntries.length },
    },
  });
  return serializeCustomMaintenance(record, context.now);
}

export async function updateCustomMaintenance(
  context: MutationContext,
  itemId: string,
  input: CustomMaintenanceInput,
): Promise<CustomMaintenanceView> {
  if (input.visibility === "owner_only" && !context.canAccessOwnerOnly) throw new NotFoundError();
  const existing = await context.database.customMaintenance.findFirst({
    where: {
      id: itemId,
      profileId: context.profileId,
      ...customMaintenanceVisibilityWhere(context.canAccessOwnerOnly),
    },
    select: { id: true, templateServiceId: true },
  });
  if (existing === null) throw new NotFoundError();
  if (existing.templateServiceId !== null) {
    throw new ValidationError("Review the template choice to update this item.");
  }

  const record = await context.database.customMaintenance.update({
    where: { id: existing.id },
    data: {
      ...inputData(input),
      status: "active",
      disabledAt: null,
      labEntries: { deleteMany: {}, create: labEntryData(input) },
    },
    include: { labEntries: { orderBy: { sortOrder: "asc" } } },
  });
  await context.database.auditLog.create({
    data: {
      householdId: context.householdId,
      profileId: context.profileId,
      actorUserId: context.actorUserId,
      action: "custom_maintenance.updated",
      entityType: "CustomMaintenance",
      entityId: record.id,
      metadataJson: { labEntryCount: record.labEntries.length },
    },
  });
  return serializeCustomMaintenance(record, context.now);
}

export async function disableCustomMaintenance(
  context: MutationContext,
  itemId: string,
): Promise<void> {
  const existing = await context.database.customMaintenance.findFirst({
    where: {
      id: itemId,
      profileId: context.profileId,
      ...customMaintenanceVisibilityWhere(context.canAccessOwnerOnly),
    },
    select: { id: true },
  });
  if (existing === null) throw new NotFoundError();
  await context.database.customMaintenance.update({
    where: { id: existing.id },
    data: {
      status: "disabled",
      disabledAt: context.now ?? new Date(),
      reminderEnabled: false,
      reminderDaysBefore: null,
    },
  });
  await context.database.auditLog.create({
    data: {
      householdId: context.householdId,
      profileId: context.profileId,
      actorUserId: context.actorUserId,
      action: "custom_maintenance.disabled",
      entityType: "CustomMaintenance",
      entityId: existing.id,
      metadataJson: {},
    },
  });
}

export async function adoptMaintenanceTemplate(
  context: MutationContext,
  templateSlug: string,
  input: MaintenanceTemplateAdoptionInput,
): Promise<CustomMaintenanceView> {
  if (input.visibility === "owner_only" && !context.canAccessOwnerOnly) throw new NotFoundError();
  const definition = MAINTENANCE_TEMPLATE_DEFINITIONS.find(({ slug }) => slug === templateSlug);
  if (definition === undefined) throw new NotFoundError();
  const template = await context.database.serviceCatalog.findFirst({
    where: { slug: templateSlug, active: true },
    select: { id: true, name: true },
  });
  if (template === null) throw new NotFoundError();
  if (!context.canAccessOwnerOnly) {
    const existing = await context.database.customMaintenance.findUnique({
      where: {
        profileId_templateServiceId: {
          profileId: context.profileId,
          templateServiceId: template.id,
        },
      },
      select: { visibility: true },
    });
    if (existing?.visibility === "owner_only") throw new NotFoundError();
  }

  const cadenceSelected = input.choice === "cadence";
  const labEntries = cadenceSelected ? labEntryData(input) : [];
  if (cadenceSelected && definition.kind === "lab_bundle" && labEntries.length === 0) {
    throw new z.ZodError([
      {
        code: "custom",
        path: ["labEntries"],
        message: "Add at least one individual lab entry.",
        input: input.labEntries,
      },
    ]);
  }
  if (definition.kind === "routine" && labEntries.length > 0) {
    throw new ValidationError("Lab entries are available only for a custom lab bundle.");
  }
  const startDate =
    cadenceSelected && input.startDate !== null
      ? new Date(`${input.startDate}T00:00:00.000Z`)
      : null;
  const stopDate =
    cadenceSelected && input.stopDate !== null ? new Date(`${input.stopDate}T00:00:00.000Z`) : null;
  const nextDate =
    cadenceSelected && input.nextDate !== null ? new Date(`${input.nextDate}T00:00:00.000Z`) : null;
  const status =
    input.choice === "ask_clinician"
      ? ("ask_clinician" as const)
      : input.choice === "disabled"
        ? ("disabled" as const)
        : ("active" as const);
  const now = context.now ?? new Date();
  const sharedData = {
    title: template.name,
    category: definition.category,
    purpose: definition.purpose,
    kind: definition.kind,
    source: cadenceSelected ? input.source : ("app_template" as const),
    clinicianName: cadenceSelected && input.source === "clinician" ? input.clinicianName : null,
    practiceName: cadenceSelected && input.source === "clinician" ? input.practiceName : null,
    cadenceValue: cadenceSelected ? input.cadenceValue : null,
    cadenceUnit: cadenceSelected ? input.cadenceUnit : null,
    startDate,
    stopDate,
    nextDate,
    reminderEnabled: cadenceSelected ? input.reminderEnabled : false,
    reminderDaysBefore: cadenceSelected && input.reminderEnabled ? input.reminderDaysBefore : null,
    visibility: input.visibility,
    notes: input.notes,
    status,
    disabledAt: status === "disabled" ? now : null,
  };
  const record = await context.database.customMaintenance.upsert({
    where: {
      profileId_templateServiceId: {
        profileId: context.profileId,
        templateServiceId: template.id,
      },
    },
    create: {
      profileId: context.profileId,
      templateServiceId: template.id,
      createdByUserId: context.actorUserId,
      ...sharedData,
      labEntries: { create: labEntries },
    },
    update: {
      ...sharedData,
      labEntries: { deleteMany: {}, create: labEntries },
    },
    include: { labEntries: { orderBy: { sortOrder: "asc" } } },
  });
  await context.database.auditLog.create({
    data: {
      householdId: context.householdId,
      profileId: context.profileId,
      actorUserId: context.actorUserId,
      action: "custom_maintenance.template_adopted",
      entityType: "CustomMaintenance",
      entityId: record.id,
      metadataJson: { labEntryCount: record.labEntries.length },
    },
  });
  return serializeCustomMaintenance(record, context.now);
}
