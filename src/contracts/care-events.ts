import { z } from "zod";
import { datePrecisionSchema, isoDateSchema, textSchema, uuidSchema } from "./shared";

export const careEventResultSchema = z.enum([
  "normal",
  "abnormal",
  "inconclusive",
  "unknown",
  "not_applicable",
]);
export type CareEventResult = z.infer<typeof careEventResultSchema>;

export const careEventSourceSchema = z.enum([
  "user_memory",
  "medical_record",
  "clinician",
  "pharmacy",
  "csv_import",
]);
export type CareEventSource = z.infer<typeof careEventSourceSchema>;

export const historyAssertionSchema = z.enum([
  "no_record",
  "never_completed",
  "completed_exact",
  "completed_month",
  "completed_year",
  "completed_date_unknown",
  "unsure",
  "declined",
  "not_applicable_claim",
]);
export type HistoryAssertion = z.infer<typeof historyAssertionSchema>;

export const careEventInputSchema = z
  .object({
    profileId: uuidSchema,
    serviceId: uuidSchema,
    methodId: uuidSchema.nullable().optional(),
    performedStart: isoDateSchema.nullable(),
    performedEnd: isoDateSchema.nullable(),
    datePrecision: datePrecisionSchema,
    result: careEventResultSchema,
    providerName: z.string().trim().max(120).nullable().optional(),
    locationName: z.string().trim().max(160).nullable().optional(),
    notes: z.string().trim().max(2_000).nullable().optional(),
    source: careEventSourceSchema,
  })
  .superRefine((event, context) => {
    if (event.datePrecision === "unknown") {
      if (event.performedStart !== null || event.performedEnd !== null) {
        context.addIssue({ code: "custom", message: "Unknown dates cannot include date bounds." });
      }
      return;
    }
    if (event.performedStart === null || event.performedEnd === null) {
      context.addIssue({ code: "custom", message: "Known dates require start and end bounds." });
    } else if (event.performedStart > event.performedEnd) {
      context.addIssue({ code: "custom", message: "Start date cannot be after end date." });
    }
  });
export type CareEventInput = z.infer<typeof careEventInputSchema>;

export const backfillAnswerSchema = z
  .object({
    profileId: uuidSchema,
    serviceId: uuidSchema,
    answer: z.enum([
      "exact",
      "month",
      "year",
      "completed_unknown",
      "never",
      "unsure",
      "not_applicable",
      "skip",
    ]),
    date: z.string().trim().max(10).nullable(),
    methodId: uuidSchema.nullable(),
    result: careEventResultSchema.nullable(),
    providerName: z.string().trim().max(120).nullable(),
    note: z.string().trim().max(2000).nullable().default(null),
    reason: z.string().trim().max(500).nullable().default(null),
  })
  .superRefine((input, context) => {
    if (input.answer === "not_applicable" && (input.reason ?? "").trim() === "") {
      context.addIssue({
        code: "custom",
        path: ["reason"],
        message: "Explain why this item does not apply.",
      });
    }
  });

export const serviceInputSchema = z.object({
  slug: textSchema("Service slug", 120).regex(/^[a-z0-9-]+$/),
  name: textSchema("Service name", 160),
});
