import { z } from "zod";
import { dateRangeSchema, isoDateSchema } from "./shared";

export const recommendationStatusSchema = z.enum([
  "future",
  "up_to_date",
  "due_this_year",
  "due_soon",
  "due_now",
  "overdue",
  "unknown_history",
  "needs_date_confirmation",
  "discuss_with_clinician",
  "clinician_managed",
  "not_routinely_recommended",
  "not_applicable",
  "completed_once",
]);
export type RecommendationStatus = z.infer<typeof recommendationStatusSchema>;

export const recommendationClassSchema = z.enum([
  "routine",
  "shared-decision",
  "selective",
  "insufficient-evidence",
  "not-recommended",
  "custom-maintenance",
]);
export type RecommendationClass = z.infer<typeof recommendationClassSchema>;

export const carePlanModeSchema = z.enum(["evidence_based", "extra_attentive", "clinician_plan"]);
export type CarePlanMode = z.infer<typeof carePlanModeSchema>;

export const explanationTokenSchema = z.object({
  code: z.string().trim().min(1).max(80),
  label: z.string().trim().min(1).max(160),
  value: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
  sourceFact: z.string().trim().max(240).optional(),
});
export type ExplanationToken = z.infer<typeof explanationTokenSchema>;

export const evaluatedRecommendationSchema = z.object({
  stableKey: z.string(),
  serviceId: z.string(),
  serviceSlug: z.string(),
  serviceName: z.string(),
  category: z.string(),
  ruleId: z.string(),
  ruleVersion: z.number().int().positive(),
  variantId: z.string(),
  conflictGroup: z.string().nullable(),
  sourceId: z.string(),
  sourceOrganization: z.string(),
  status: recommendationStatusSchema,
  recommendationClass: recommendationClassSchema,
  dueRange: dateRangeSchema.nullable(),
  lastQualifyingEventId: z.string().nullable(),
  activeOverrideId: z.string().nullable(),
  evaluatedAsOf: isoDateSchema,
  explanationTokens: z.array(explanationTokenSchema),
  matchingFacts: z.array(explanationTokenSchema),
  limitations: z.array(z.string()),
  calculationHash: z.string(),
});
export type EvaluatedRecommendation = z.infer<typeof evaluatedRecommendationSchema>;

export const statusLabels: Record<RecommendationStatus, string> = {
  future: "Coming later",
  up_to_date: "Up to date",
  due_this_year: "Recommended this year",
  due_soon: "Due soon",
  due_now: "Due now",
  overdue: "Past the recommended window",
  unknown_history: "History needed",
  needs_date_confirmation: "Date needs confirmation",
  discuss_with_clinician: "Discuss with a clinician",
  clinician_managed: "Follow personal clinician plan",
  not_routinely_recommended: "Not routinely recommended",
  not_applicable: "Not applicable",
  completed_once: "Completed",
};

export const statusPriority: Record<RecommendationStatus, number> = {
  not_applicable: 0,
  not_routinely_recommended: 1,
  clinician_managed: 2,
  completed_once: 3,
  discuss_with_clinician: 4,
  unknown_history: 5,
  needs_date_confirmation: 6,
  overdue: 7,
  due_now: 8,
  due_soon: 9,
  due_this_year: 10,
  up_to_date: 11,
  future: 12,
};
