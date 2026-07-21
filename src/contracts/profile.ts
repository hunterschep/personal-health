import { z } from "zod";
import { carePlanModeSchema } from "./recommendations";
import { isoDateSchema, textSchema, uuidSchema } from "./shared";

export const anatomyKeySchema = z.enum([
  "cervix",
  "breast_tissue",
  "prostate",
  "uterus",
  "ovaries",
]);
export type AnatomyKey = z.infer<typeof anatomyKeySchema>;

export const anatomyStateSchema = z.enum(["present", "absent", "unknown", "prefer_not_to_answer"]);
export type AnatomyState = z.infer<typeof anatomyStateSchema>;

export const sexAssignedAtBirthSchema = z.enum([
  "female",
  "male",
  "intersex",
  "unknown",
  "prefer_not_to_answer",
]);
export type SexAssignedAtBirth = z.infer<typeof sexAssignedAtBirthSchema>;

export const profileVisibilitySchema = z.enum(["owner_only", "selected_members", "household"]);
export type ProfileVisibility = z.infer<typeof profileVisibilitySchema>;

export const profilePermissionSchema = z.enum(["view", "edit", "manage"]);
export type ProfilePermission = z.infer<typeof profilePermissionSchema>;

export const profileBasicsSchema = z.object({
  displayName: textSchema("Display name", 80),
  relationshipLabel: textSchema("Relationship", 50),
  dateOfBirth: isoDateSchema,
  sexAssignedAtBirth: sexAssignedAtBirthSchema,
  genderIdentity: z.string().trim().max(120).nullable().optional(),
  countryCode: z
    .string()
    .trim()
    .length(2)
    .transform((value) => value.toUpperCase()),
  timezone: z.string().trim().min(1).max(80),
  visibility: profileVisibilitySchema,
  carePlanMode: carePlanModeSchema.default("evidence_based"),
});
export type ProfileBasicsInput = z.input<typeof profileBasicsSchema>;

export const profileAnatomyInputSchema = z.object({
  profileId: uuidSchema,
  anatomy: z.array(
    z.object({
      key: anatomyKeySchema,
      state: anatomyStateSchema,
      effectiveDate: isoDateSchema.nullable().optional(),
      note: z.string().trim().max(500).nullable().optional(),
    }),
  ),
});

export const normalizedProfileSchema = profileBasicsSchema.extend({
  id: z.string(),
  householdId: z.string(),
  ownerUserId: z.string().nullable(),
});
export type NormalizedProfile = z.infer<typeof normalizedProfileSchema>;

export const tobaccoRiskSchema = z.object({
  status: z.enum(["never", "current", "former", "unknown", "prefer_not_to_answer"]),
  periods: z.array(
    z.object({
      started: isoDateSchema.nullable(),
      ended: isoDateSchema.nullable(),
      startedYear: z.number().int().min(1900).max(2200).nullable(),
      endedYear: z.number().int().min(1900).max(2200).nullable(),
      packsPerDay: z.number().min(0).max(20).nullable(),
    }),
  ),
});

export const heightWeightRiskSchema = z.object({
  measuredOn: isoDateSchema,
  heightCentimeters: z.number().min(60).max(280).nullable(),
  weightKilograms: z.number().min(20).max(600).nullable(),
});

export const riskFactorPayloadSchemas = {
  tobacco_use: tobaccoRiskSchema,
  height_weight: heightWeightRiskSchema,
  pregnancy_status: z.object({
    value: z.enum(["pregnant", "not_pregnant", "unknown", "prefer_not_to_answer"]),
  }),
  immunocompromised: z.object({ value: z.enum(["yes", "no", "unknown"]) }),
  alcohol_use: z.object({
    assessmentPreferred: z.boolean().nullable(),
    riskLevel: z.string().max(50).nullable(),
  }),
  fall_risk: z.object({ concern: z.enum(["yes", "no", "unknown"]) }),
  sexual_health_risk: z.object({ value: z.enum(["present", "absent", "unknown"]) }),
  occupational_exposure: z.object({ value: z.enum(["present", "absent", "unknown"]) }),
} as const;
