import { z } from "zod";
import { careEventResultSchema } from "./care-events";
import { anatomyKeySchema, anatomyStateSchema } from "./profile";
import { recommendationClassSchema } from "./recommendations";
import { isoDateSchema } from "./shared";

const jsonPrimitiveSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
export type JsonPrimitive = z.infer<typeof jsonPrimitiveSchema>;

export const numericComparatorSchema = z.enum(["lt", "lte", "eq", "gte", "gt"]);
export type NumericComparator = z.infer<typeof numericComparatorSchema>;

export const durationSchema = z.object({
  unit: z.enum(["days", "weeks", "months", "years"]),
  value: z.number().int().positive().max(200),
});
export type Duration = z.infer<typeof durationSchema>;

const conditionStatusSchema = z.enum(["active", "resolved", "history"]);
const allowedProfileFieldSchema = z.enum(["countryCode", "sexAssignedAtBirth", "carePlanMode"]);

type ExpressionValue =
  | { op: "all"; children: ExpressionValue[] }
  | { op: "any"; children: ExpressionValue[] }
  | { op: "not"; child: ExpressionValue }
  | {
      op: "age_between";
      min?: number | undefined;
      max?: number | undefined;
      includeMin?: boolean | undefined;
      includeMax?: boolean | undefined;
    }
  | {
      op: "anatomy_is";
      key: z.infer<typeof anatomyKeySchema>;
      state: z.infer<typeof anatomyStateSchema>;
    }
  | { op: "sex_assigned_at_birth_is"; value: string }
  | { op: "risk_equals"; type: string; path: string; value: JsonPrimitive }
  | {
      op: "risk_number_compare";
      type: string;
      path: string;
      comparator: NumericComparator;
      value: number;
    }
  | {
      op: "condition_present";
      code: string;
      statuses?: z.infer<typeof conditionStatusSchema>[] | undefined;
    }
  | { op: "condition_absent"; code: string }
  | {
      op: "family_history_present";
      conditionCode: string;
      relationships?: string[] | undefined;
      maxAgeAtDiagnosis?: number | undefined;
    }
  | { op: "surgery_present"; code: string }
  | { op: "medication_class_present"; classCode: string }
  | {
      op: "prior_event_exists";
      serviceId: string;
      methodIds?: string[] | undefined;
      resultIn?: string[] | undefined;
    }
  | { op: "prior_event_absent"; serviceId: string }
  | {
      op: "time_since_event_compare";
      serviceId: string;
      comparator: NumericComparator;
      duration: Duration;
    }
  | {
      op: "profile_field_equals";
      field: z.infer<typeof allowedProfileFieldSchema>;
      value: JsonPrimitive;
    }
  | { op: "constant"; value: boolean };

const allowedRiskPath = z.string().regex(/^[a-zA-Z][a-zA-Z0-9_.]{0,79}$/);

export const expressionSchema: z.ZodType<ExpressionValue> = z.lazy(() =>
  z.discriminatedUnion("op", [
    z.object({ op: z.literal("all"), children: z.array(expressionSchema).min(1) }),
    z.object({ op: z.literal("any"), children: z.array(expressionSchema).min(1) }),
    z.object({ op: z.literal("not"), child: expressionSchema }),
    z.object({
      op: z.literal("age_between"),
      min: z.number().int().min(0).max(130).optional(),
      max: z.number().int().min(0).max(130).optional(),
      includeMin: z.boolean().optional(),
      includeMax: z.boolean().optional(),
    }),
    z.object({ op: z.literal("anatomy_is"), key: anatomyKeySchema, state: anatomyStateSchema }),
    z.object({ op: z.literal("sex_assigned_at_birth_is"), value: z.string().min(1).max(40) }),
    z.object({
      op: z.literal("risk_equals"),
      type: z.string().min(1).max(80),
      path: allowedRiskPath,
      value: jsonPrimitiveSchema,
    }),
    z.object({
      op: z.literal("risk_number_compare"),
      type: z.string().min(1).max(80),
      path: allowedRiskPath,
      comparator: numericComparatorSchema,
      value: z.number(),
    }),
    z.object({
      op: z.literal("condition_present"),
      code: z.string().min(1).max(80),
      statuses: z.array(conditionStatusSchema).optional(),
    }),
    z.object({ op: z.literal("condition_absent"), code: z.string().min(1).max(80) }),
    z.object({
      op: z.literal("family_history_present"),
      conditionCode: z.string().min(1).max(80),
      relationships: z.array(z.string().min(1).max(50)).optional(),
      maxAgeAtDiagnosis: z.number().int().min(0).max(130).optional(),
    }),
    z.object({ op: z.literal("surgery_present"), code: z.string().min(1).max(80) }),
    z.object({ op: z.literal("medication_class_present"), classCode: z.string().min(1).max(80) }),
    z.object({
      op: z.literal("prior_event_exists"),
      serviceId: z.string().min(1),
      methodIds: z.array(z.string().min(1)).optional(),
      resultIn: z.array(careEventResultSchema).optional(),
    }),
    z.object({ op: z.literal("prior_event_absent"), serviceId: z.string().min(1) }),
    z.object({
      op: z.literal("time_since_event_compare"),
      serviceId: z.string().min(1),
      comparator: numericComparatorSchema,
      duration: durationSchema,
    }),
    z.object({
      op: z.literal("profile_field_equals"),
      field: allowedProfileFieldSchema,
      value: jsonPrimitiveSchema,
    }),
    z.object({ op: z.literal("constant"), value: z.boolean() }),
  ]),
);
export type Expression = z.infer<typeof expressionSchema>;

export const scheduleSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("age_based"),
    startAge: z.number().int().min(0).max(130).optional(),
    stopAge: z.number().int().min(0).max(130).optional(),
    interval: durationSchema.optional(),
    initialDue: z.enum(["on_eligibility", "calendar_year"]).optional(),
  }),
  z.object({
    kind: z.literal("interval"),
    interval: durationSchema,
    anchor: z.enum(["last_qualifying_event", "eligibility_date"]),
  }),
  z.object({ kind: z.literal("one_time"), dueOnEligibility: z.boolean() }),
  z.object({
    kind: z.literal("seasonal"),
    seasonStartMonth: z.number().int().min(1).max(12),
    seasonEndMonth: z.number().int().min(1).max(12),
    repeatsAnnually: z.boolean(),
  }),
  z.object({
    kind: z.literal("method_dependent"),
    defaultMethodPrompt: z.boolean(),
    methods: z
      .array(
        z.object({
          methodId: z.string().min(1),
          interval: durationSchema,
          qualifyingResults: z.array(careEventResultSchema).min(1),
        }),
      )
      .min(1),
  }),
  z.object({
    kind: z.literal("dose_series"),
    seriesKey: z.string().min(1),
    doses: z
      .array(
        z.object({
          ordinal: z.number().int().positive(),
          minimumIntervalFromPrior: durationSchema.optional(),
          recommendedIntervalFromPrior: durationSchema.optional(),
        }),
      )
      .min(1),
    boosters: z.object({ interval: durationSchema }).optional(),
  }),
  z.object({
    kind: z.literal("shared_decision"),
    startAge: z.number().int().min(0).max(130).optional(),
    stopAge: z.number().int().min(0).max(130).optional(),
    repeatConversationAfter: durationSchema.optional(),
  }),
  z.object({ kind: z.literal("custom"), requiresUserOrClinicianCadence: z.literal(true) }),
]);
export type Schedule = z.infer<typeof scheduleSchema>;

export const guidelineRuleDefinitionSchema = z.object({
  stableKey: z.string().regex(/^[a-z0-9-]+$/),
  version: z.number().int().positive(),
  serviceSlug: z.string().regex(/^[a-z0-9-]+$/),
  variantId: z.string().min(1).max(100),
  conflictGroup: z.string().max(100).nullable(),
  baseline: z.boolean().default(false),
  sourceSlug: z.string().regex(/^[a-z0-9-]+$/),
  jurisdiction: z.string().length(2).default("US"),
  evidenceGrade: z.string().max(40).nullable(),
  recommendationClass: recommendationClassSchema,
  appliesWhen: expressionSchema,
  excludesWhen: expressionSchema.nullable(),
  stopWhen: expressionSchema.nullable(),
  schedule: scheduleSchema,
  completionEventTypes: z.array(z.string().min(1)).min(1),
  allowedMethods: z.array(z.string().min(1)).nullable(),
  outcomeModifiers: z.array(z.string().min(1)),
  consumerSummary: z.string().min(1),
  whyItMatters: z.string().min(1),
  questionsForClinician: z.array(z.string().min(1)),
  limitations: z.array(z.string().min(1)),
  effectiveFrom: isoDateSchema,
  effectiveTo: isoDateSchema.nullable(),
  reviewStatus: z.enum(["draft", "reviewed", "active", "retired"]),
  reviewedBy: z.string().min(1),
  reviewedAt: isoDateSchema,
  scenarioIds: z.array(z.string().min(1)).min(1),
});
export type GuidelineRuleDefinition = z.infer<typeof guidelineRuleDefinitionSchema>;
