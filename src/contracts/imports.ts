import { z } from "zod";
import { careEventResultSchema, careEventSourceSchema } from "./care-events";
import { datePrecisionSchema } from "./shared";

export const importRowSchema = z.object({
  rowNumber: z.number().int().positive(),
  service: z.string().trim().min(1).max(160),
  method: z.string().trim().max(160).nullable(),
  date: z.string().trim().max(10).nullable(),
  datePrecision: datePrecisionSchema,
  result: careEventResultSchema,
  provider: z.string().trim().max(120).nullable(),
  location: z.string().trim().max(160).nullable(),
  source: careEventSourceSchema,
  notes: z.string().trim().max(2_000).nullable(),
});

export type ImportRow = z.infer<typeof importRowSchema>;

export type ImportPreviewRow = ImportRow & {
  normalizedServiceId: string | null;
  normalizedMethodId: string | null;
  errors: string[];
  warnings: string[];
  possibleDuplicateIds: string[];
};

export type ImportPreview = {
  batchToken: string;
  rows: ImportPreviewRow[];
  validCount: number;
  warningCount: number;
  errorCount: number;
};
