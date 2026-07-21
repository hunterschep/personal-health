import Papa from "papaparse";
import { z } from "zod";

import { normalizeDateRange } from "@/domain/dates";

import { CSV_HEADERS, MAX_CSV_ROWS, type NormalizedImportRow } from "./types";

const precisionSchema = z.enum(["day", "month", "year", "unknown"]);
const resultSchema = z.enum(["normal", "abnormal", "inconclusive", "unknown", "not_applicable"]);
const sourceSchema = z.enum([
  "user_memory",
  "medical_record",
  "clinician",
  "pharmacy",
  "csv_import",
]);

const FORMULA_PATTERN = /^\s*[=+\-@]/;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

function nullable(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function rowError(message: string, errors: string[]): void {
  if (!errors.includes(message)) errors.push(message);
}

function validateCellSafety(values: readonly string[], errors: string[]): void {
  for (const value of values) {
    if (FORMULA_PATTERN.test(value)) {
      rowError("Formula-like cell content is not accepted.", errors);
    }
    if (CONTROL_CHARACTER_PATTERN.test(value)) {
      rowError("Unsupported control characters were found.", errors);
    }
  }
}

export function decodeCsv(bytes: Uint8Array): string {
  if ((bytes[0] === 0xff && bytes[1] === 0xfe) || (bytes[0] === 0xfe && bytes[1] === 0xff)) {
    throw new RangeError("Use a UTF-8 encoded CSV file. UTF-16 files are not supported.");
  }

  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new RangeError("Use a valid UTF-8 encoded CSV file.");
  }
}

export function parseCsv(text: string, today: string): NormalizedImportRow[] {
  const result = Papa.parse<string[]>(text, {
    header: false,
    skipEmptyLines: "greedy",
    dynamicTyping: false,
    transform: (value) => value,
  });

  if (result.errors.length > 0) {
    const first = result.errors[0];
    throw new RangeError(
      `The CSV could not be parsed${first?.row === undefined ? "" : ` near row ${first.row + 1}`}.`,
    );
  }
  if (result.data.length === 0) throw new RangeError("The CSV file is empty.");

  const header = result.data[0]?.map((value, index) =>
    index === 0 ? value.replace(/^\uFEFF/, "").trim() : value.trim(),
  );
  if (
    header === undefined ||
    header.length !== CSV_HEADERS.length ||
    header.some((value, index) => value !== CSV_HEADERS[index])
  ) {
    throw new RangeError(`Use these CSV headers in order: ${CSV_HEADERS.join(",")}.`);
  }

  const dataRows = result.data.slice(1);
  if (dataRows.length > MAX_CSV_ROWS) {
    throw new RangeError(
      `CSV imports are limited to ${MAX_CSV_ROWS.toLocaleString("en-US")} rows.`,
    );
  }

  return dataRows.map((cells, index) => {
    const errors: string[] = [];
    validateCellSafety(cells, errors);
    if (cells.length !== CSV_HEADERS.length) {
      rowError(`Expected ${CSV_HEADERS.length} columns but found ${cells.length}.`, errors);
    }

    const value = (column: number): string => cells[column] ?? "";
    const service = value(0).trim();
    const method = nullable(value(1));
    const date = nullable(value(2));
    const precisionResult = precisionSchema.safeParse(value(3).trim());
    const eventResult = resultSchema.safeParse(value(4).trim() || "unknown");
    const source = sourceSchema.safeParse(value(7).trim() || "csv_import");

    if (service === "") rowError("Service is required.", errors);
    if (service.length > 160) rowError("Service must be 160 characters or fewer.", errors);
    if ((method?.length ?? 0) > 160) rowError("Method must be 160 characters or fewer.", errors);
    if ((nullable(value(5))?.length ?? 0) > 120)
      rowError("Provider must be 120 characters or fewer.", errors);
    if ((nullable(value(6))?.length ?? 0) > 160)
      rowError("Location must be 160 characters or fewer.", errors);
    if ((nullable(value(8))?.length ?? 0) > 2_000)
      rowError("Notes must be 2,000 characters or fewer.", errors);
    if (!precisionResult.success)
      rowError("Date precision must be day, month, year, or unknown.", errors);
    if (!eventResult.success) rowError("Result is not an accepted value.", errors);
    if (!source.success) rowError("Source is not an accepted value.", errors);

    let performedStart: string | null = null;
    let performedEnd: string | null = null;
    if (precisionResult.success) {
      try {
        const range = normalizeDateRange(date, precisionResult.data);
        performedStart = range.start;
        performedEnd = range.end;
        if (performedStart !== null && performedStart > today) {
          rowError("Completed care dates cannot be in the future.", errors);
        }
      } catch (error) {
        rowError(error instanceof Error ? error.message : "Date is not valid.", errors);
      }
    }

    return {
      rowNumber: index + 2,
      service,
      method,
      date,
      datePrecision: precisionResult.success ? precisionResult.data : "unknown",
      result: eventResult.success ? eventResult.data : "unknown",
      provider: nullable(value(5)),
      location: nullable(value(6)),
      source: source.success ? source.data : "csv_import",
      notes: nullable(value(8)),
      performedStart,
      performedEnd,
      serviceId: null,
      methodId: null,
      errors,
      warnings: [],
      possibleDuplicateIds: [],
    };
  });
}

export function csvTemplate(): string {
  return [
    CSV_HEADERS.join(","),
    "colorectal-screening,fit,2025-03,month,normal,Example Clinic,,medical_record,Example row - remove before importing",
  ].join("\r\n");
}
