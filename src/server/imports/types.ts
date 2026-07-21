import type { CareEventResult, CareEventSource, DatePrecision } from "@/generated/prisma/client";

export const CSV_HEADERS = [
  "service",
  "method",
  "date",
  "date_precision",
  "result",
  "provider",
  "location",
  "source",
  "notes",
] as const;

export type NormalizedImportRow = {
  rowNumber: number;
  service: string;
  method: string | null;
  date: string | null;
  datePrecision: DatePrecision;
  result: CareEventResult;
  provider: string | null;
  location: string | null;
  source: CareEventSource;
  notes: string | null;
  performedStart: string | null;
  performedEnd: string | null;
  serviceId: string | null;
  methodId: string | null;
  errors: string[];
  warnings: string[];
  possibleDuplicateIds: string[];
};

export type SignedImportPayload = {
  batchId: string;
  profileId: string;
  userId: string;
  rows: NormalizedImportRow[];
};

export const MAX_CSV_BYTES = 2 * 1024 * 1024;
export const MAX_CSV_ROWS = 1_000;
export const MAX_CSV_TOKEN_BYTES = 3 * 1024 * 1024;
