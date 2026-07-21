import { z } from "zod";

import type { VisitPrepDraft } from "@/components/documents/visit-prep-types";

export const visitPrepPreferenceInputSchema = z.object({
  mode: z.enum(["concise", "extended"]),
  sections: z.object({
    appointments: z.boolean(),
    medications: z.boolean(),
    conditions: z.boolean(),
    attention: z.boolean(),
    thisYear: z.boolean(),
    unknown: z.boolean(),
    discussion: z.boolean(),
    clinician: z.boolean(),
    recentEvents: z.boolean(),
    personalNotes: z.boolean(),
  }),
  questions: z.array(z.string().trim().min(1).max(240)).max(30),
  personalNotes: z.string().max(4_000),
});

export function storedVisitPrepDraft(
  record: {
    mode: string;
    sectionsJson: unknown;
    questionsJson: unknown;
    personalNotes: string | null;
  } | null,
): VisitPrepDraft | null {
  if (record === null) return null;
  const parsed = visitPrepPreferenceInputSchema.safeParse({
    mode: record.mode,
    sections: record.sectionsJson,
    questions: record.questionsJson,
    personalNotes: record.personalNotes ?? "",
  });
  return parsed.success ? parsed.data : null;
}
