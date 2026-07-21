import { z } from "zod";

import { ageOnDate, dateInTimeZone, normalizeDateRange } from "@/domain/dates";
import { ValidationError } from "@/domain/shared/errors";
import {
  FIXED_CONDITIONS,
  MAX_HEIGHT_INCHES,
  MAX_WEIGHT_POUNDS,
  MIN_HEIGHT_INCHES,
  MIN_WEIGHT_POUNDS,
  normalizeProfileHealthContext,
} from "./health-context";

const relationshipSchema = z.enum([
  "Self",
  "Parent",
  "Spouse or partner",
  "Adult family member",
  "Other adult",
]);
const sexAssignedAtBirthSchema = z.enum([
  "female",
  "male",
  "intersex",
  "unknown",
  "prefer_not_to_answer",
]);
const anatomyStateSchema = z.enum(["present", "absent", "unknown", "prefer_not_to_answer"]);
const tobaccoStatusSchema = z.enum([
  "never",
  "current",
  "former",
  "unknown",
  "prefer_not_to_answer",
]);

function boundedNumberText(minimum: number, maximum: number, integer = false) {
  return z
    .string()
    .trim()
    .max(24)
    .refine((value) => value === "" || Number.isFinite(Number(value)), "Enter a valid number.")
    .refine(
      (value) => value === "" || !integer || Number.isInteger(Number(value)),
      "Enter a whole number.",
    )
    .refine(
      (value) => value === "" || (Number(value) >= minimum && Number(value) <= maximum),
      `Enter a value from ${Math.ceil(minimum * 10) / 10} to ${Math.floor(maximum * 10) / 10}.`,
    );
}

const optionalDateText = z.union([z.literal(""), z.iso.date()]);
const anatomyFields = {
  anatomy_cervix: anatomyStateSchema.optional(),
  anatomy_breast_tissue: anatomyStateSchema.optional(),
  anatomy_prostate: anatomyStateSchema.optional(),
  anatomy_uterus: anatomyStateSchema.optional(),
  anatomy_ovaries: anatomyStateSchema.optional(),
};
const conditionFields = Object.fromEntries(
  FIXED_CONDITIONS.map(({ label }) => [`condition_${label}`, z.boolean().optional()]),
) as Record<`condition_${(typeof FIXED_CONDITIONS)[number]["label"]}`, z.ZodOptional<z.ZodBoolean>>;

const draftShape = {
  displayName: z.string().trim().max(80).optional(),
  relationshipLabel: relationshipSchema.optional(),
  dateOfBirth: optionalDateText.optional(),
  sexAssignedAtBirth: sexAssignedAtBirthSchema.optional(),
  genderIdentity: z.string().trim().max(120).optional(),
  countryCode: z.literal("US").optional(),
  timezone: z.string().trim().max(80).optional(),
  visibility: z.enum(["owner_only", "selected_members", "household"]).optional(),
  ownership: z.enum(["self", "unclaimed"]).optional(),
  ...anatomyFields,
  tobaccoStatus: tobaccoStatusSchema.optional(),
  smokingStartYear: boundedNumberText(1900, 2200, true).optional(),
  smokingEndYear: boundedNumberText(1900, 2200, true).optional(),
  packsPerDay: boundedNumberText(0, 20).optional(),
  heightInches: boundedNumberText(MIN_HEIGHT_INCHES, MAX_HEIGHT_INCHES).optional(),
  weightPounds: boundedNumberText(MIN_WEIGHT_POUNDS, MAX_WEIGHT_POUNDS).optional(),
  pregnancyStatus: z
    .enum(["pregnant", "not_pregnant", "unknown", "prefer_not_to_answer"])
    .optional(),
  immunocompromised: z.enum(["yes", "no", "unknown"]).optional(),
  alcoholAssessmentPreference: z.enum(["yes", "no", "unknown"]).optional(),
  fallConcern: z.enum(["yes", "no", "unknown"]).optional(),
  sexualHealthRisk: z.enum(["present", "absent", "unknown"]).optional(),
  ...conditionFields,
  familyHistory: z.string().trim().max(1000).optional(),
  surgeries: z.string().trim().max(1000).optional(),
  surgeryAnatomyKey: z
    .enum(["cervix", "breast_tissue", "prostate", "uterus", "ovaries"])
    .or(z.literal(""))
    .optional(),
  surgeryAnatomyState: anatomyStateSchema.or(z.literal("")).optional(),
  confirmSurgeryAnatomy: z.boolean().optional(),
  medicationName: z.string().trim().max(160).optional(),
  medicationDose: z.string().trim().max(120).optional(),
  medicationFrequency: z.string().trim().max(120).optional(),
  medicationPrescriber: z.string().trim().max(160).optional(),
  medicationReason: z.string().trim().max(500).optional(),
  medicationStartedDate: z.string().trim().max(10).optional(),
  medicationStartedPrecision: z.enum(["day", "month", "year", "unknown"]).optional(),
  monitoringInstructions: z.string().trim().max(2000).optional(),
  nextMedicationReview: optionalDateText.optional(),
};

export const onboardingDraftDataSchema = z.strictObject(draftShape);
export type OnboardingDraftData = z.infer<typeof onboardingDraftDataSchema>;
const storedDraftDataSchema = z.object(draftShape);

export function readStoredOnboardingDraftData(value: unknown): OnboardingDraftData {
  const result = storedDraftDataSchema.safeParse(value);
  return result.success ? result.data : {};
}

const completeDataSchema = z.strictObject({
  ...draftShape,
  displayName: z.string().trim().min(1).max(80),
  relationshipLabel: relationshipSchema,
  dateOfBirth: z.iso.date(),
  sexAssignedAtBirth: sexAssignedAtBirthSchema,
  genderIdentity: z.string().trim().max(120).default(""),
  countryCode: z.literal("US").default("US"),
  timezone: z.string().trim().min(1).max(80),
  visibility: z.enum(["owner_only", "selected_members", "household"]),
  ownership: z.enum(["self", "unclaimed"]).default("self"),
  anatomy_cervix: anatomyStateSchema.default("unknown"),
  anatomy_breast_tissue: anatomyStateSchema.default("unknown"),
  anatomy_prostate: anatomyStateSchema.default("unknown"),
  anatomy_uterus: anatomyStateSchema.default("unknown"),
  anatomy_ovaries: anatomyStateSchema.default("unknown"),
});

const medicationSchema = z
  .object({
    name: z.string().trim().max(160).default(""),
    dose: z.string().trim().max(120).default(""),
    frequency: z.string().trim().max(120).default(""),
    prescriber: z.string().trim().max(160).default(""),
    reason: z.string().trim().max(500).default(""),
    startedDate: z.string().trim().max(10).default(""),
    startedPrecision: z.enum(["day", "month", "year", "unknown"]).default("unknown"),
    monitoringInstructions: z.string().trim().max(2000).default(""),
    nextReview: optionalDateText.default(""),
  })
  .superRefine((input, context) => {
    if (
      input.name === "" &&
      [
        input.dose,
        input.frequency,
        input.prescriber,
        input.reason,
        input.startedDate,
        input.monitoringInstructions,
        input.nextReview,
      ].some((value) => value !== "")
    ) {
      context.addIssue({
        code: "custom",
        path: ["name"],
        message: "Add a medication name or clear the medication details.",
      });
    }
    try {
      normalizeDateRange(input.startedDate || null, input.startedPrecision);
    } catch {
      context.addIssue({
        code: "custom",
        path: ["startedDate"],
        message: "Enter the medication start timing at the selected precision.",
      });
    }
  });

function assertTimezone(value: string): void {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
  } catch {
    throw new ValidationError("Choose a valid IANA timezone.");
  }
}

function validateAdultBasics(data: { dateOfBirth: string; timezone: string }, now: Date): string {
  assertTimezone(data.timezone);
  const today = dateInTimeZone(now, data.timezone);
  const age = ageOnDate(data.dateOfBirth, today);
  if (age < 18) {
    throw new ValidationError("CareCadence currently supports adults age 18 and older.");
  }
  if (age > 130) {
    throw new ValidationError("Check the date of birth and try again.");
  }
  return today;
}

function healthContextInput(data: OnboardingDraftData) {
  return {
    tobaccoStatus: data.tobaccoStatus ?? "unknown",
    smokingStartYear: data.smokingStartYear ?? "",
    smokingEndYear: data.smokingEndYear ?? "",
    packsPerDay: data.packsPerDay ?? "",
    heightInches: data.heightInches ?? "",
    weightPounds: data.weightPounds ?? "",
    pregnancyStatus: data.pregnancyStatus ?? "unknown",
    immunocompromised: data.immunocompromised ?? "unknown",
    alcoholAssessmentPreference: data.alcoholAssessmentPreference ?? "unknown",
    fallConcern: data.fallConcern ?? "unknown",
    sexualHealthRisk: data.sexualHealthRisk ?? "unknown",
    conditions: Object.fromEntries(
      FIXED_CONDITIONS.map(({ key, label }) => [key, data[`condition_${label}`] ?? false]),
    ),
    familyHistoryNote: data.familyHistory ?? "",
    surgeryNote: data.surgeries ?? "",
    surgeryAnatomyKey: data.surgeryAnatomyKey ?? "",
    surgeryAnatomyState: data.surgeryAnatomyState ?? "",
    confirmSurgeryAnatomy: data.confirmSurgeryAnatomy ?? false,
  };
}

function medicationInput(data: OnboardingDraftData) {
  return {
    name: data.medicationName ?? "",
    dose: data.medicationDose ?? "",
    frequency: data.medicationFrequency ?? "",
    prescriber: data.medicationPrescriber ?? "",
    reason: data.medicationReason ?? "",
    startedDate: data.medicationStartedDate ?? "",
    startedPrecision: data.medicationStartedPrecision ?? "unknown",
    monitoringInstructions: data.monitoringInstructions ?? "",
    nextReview: data.nextMedicationReview ?? "",
  };
}

function validatedMedicationInput(data: OnboardingDraftData) {
  const medication = medicationSchema.parse(medicationInput(data));
  return {
    ...medication,
    started: normalizeDateRange(medication.startedDate || null, medication.startedPrecision),
  };
}

export function validateOnboardingStep(rawData: unknown, step: number, now = new Date()) {
  const data = onboardingDraftDataSchema.parse(rawData);
  if (step === 0) {
    const basics = z
      .object({
        displayName: z.string().trim().min(1).max(80),
        relationshipLabel: relationshipSchema,
        dateOfBirth: z.iso.date(),
        sexAssignedAtBirth: sexAssignedAtBirthSchema,
        timezone: z.string().trim().min(1).max(80),
        visibility: z.enum(["owner_only", "selected_members", "household"]),
        ownership: z.enum(["self", "unclaimed"]),
      })
      .parse(data);
    validateAdultBasics(basics, now);
  } else if (step === 1) {
    z.object({
      anatomy_cervix: anatomyStateSchema,
      anatomy_breast_tissue: anatomyStateSchema,
      anatomy_prostate: anatomyStateSchema,
      anatomy_uterus: anatomyStateSchema,
      anatomy_ovaries: anatomyStateSchema,
    }).parse(data);
  } else if (step === 2) {
    const basics = z
      .object({ dateOfBirth: z.iso.date(), timezone: z.string().trim().min(1) })
      .parse(data);
    const today = validateAdultBasics(basics, now);
    normalizeProfileHealthContext(healthContextInput(data), {
      dateOfBirth: basics.dateOfBirth,
      measuredOn: today,
    });
  } else if (step === 3) {
    const basics = z
      .object({ dateOfBirth: z.iso.date(), timezone: z.string().trim().min(1) })
      .parse(data);
    const today = validateAdultBasics(basics, now);
    normalizeProfileHealthContext(healthContextInput(data), {
      dateOfBirth: basics.dateOfBirth,
      measuredOn: today,
    });
  } else if (step === 4) {
    validatedMedicationInput(data);
  }
  return data;
}

export function validateCompleteOnboarding(rawData: unknown, now = new Date()) {
  const data = completeDataSchema.parse(rawData);
  const today = validateAdultBasics(data, now);
  const healthContext = normalizeProfileHealthContext(healthContextInput(data), {
    dateOfBirth: data.dateOfBirth,
    measuredOn: today,
  });
  const medication = validatedMedicationInput(data);
  return { data, today, healthContext, medication };
}
