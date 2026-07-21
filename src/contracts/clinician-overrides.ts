import { z } from "zod";

export const clinicianOverrideInputSchema = z
  .object({
    serviceId: z.string().trim().min(1).max(160),
    type: z.enum([
      "exact_next_date",
      "recurring_interval",
      "no_longer_needed",
      "clinician_managed",
    ]),
    nextDueStart: z
      .union([z.literal(""), z.iso.date()])
      .optional()
      .default(""),
    nextDueEnd: z
      .union([z.literal(""), z.iso.date()])
      .optional()
      .default(""),
    intervalValue: z.coerce.number().int().min(1).max(200).optional(),
    intervalUnit: z.enum(["days", "weeks", "months", "years"]).optional(),
    instructionReceivedDate: z.iso.date(),
    clinicianName: z.string().max(160).optional().default(""),
    practiceName: z.string().max(160).optional().default(""),
    reason: z.string().max(1_000).optional().default(""),
    reviewDate: z
      .union([z.literal(""), z.iso.date()])
      .optional()
      .default(""),
    replacesGeneralGuideline: z.boolean(),
  })
  .superRefine((input, context) => {
    if (input.type === "exact_next_date" && input.nextDueStart === "") {
      context.addIssue({
        code: "custom",
        path: ["nextDueStart"],
        message: "Enter the next date from the clinician instruction.",
      });
    }
    if (
      input.nextDueStart !== "" &&
      input.nextDueEnd !== "" &&
      input.nextDueStart > input.nextDueEnd
    ) {
      context.addIssue({
        code: "custom",
        path: ["nextDueEnd"],
        message: "The instruction end date cannot be before its start date.",
      });
    }
    if (
      input.type === "recurring_interval" &&
      (input.intervalValue === undefined || input.intervalUnit === undefined)
    ) {
      context.addIssue({
        code: "custom",
        path: ["intervalValue"],
        message: "Enter a complete recurring interval.",
      });
    }
  });

export type ClinicianOverrideInput = z.infer<typeof clinicianOverrideInputSchema>;
