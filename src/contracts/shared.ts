import { isMatch } from "date-fns";
import { z } from "zod";

export const datePrecisionSchema = z.enum(["day", "month", "year", "unknown"]);
export type DatePrecision = z.infer<typeof datePrecisionSchema>;

export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use an ISO date in YYYY-MM-DD format.")
  .refine((value) => isMatch(value, "yyyy-MM-dd"), "Use a valid calendar date.");

export const dateRangeSchema = z
  .object({
    start: isoDateSchema.nullable(),
    end: isoDateSchema.nullable(),
    precision: datePrecisionSchema,
  })
  .superRefine((range, context) => {
    if (range.precision === "unknown") {
      if (range.start !== null || range.end !== null) {
        context.addIssue({
          code: "custom",
          message: "Unknown dates cannot include a start or end date.",
        });
      }
      return;
    }

    if (range.start === null || range.end === null) {
      context.addIssue({
        code: "custom",
        message: "Known date ranges require both a start and end date.",
      });
      return;
    }

    if (range.start > range.end) {
      context.addIssue({ code: "custom", message: "Start date cannot be after end date." });
    }

    if (range.precision === "day" && range.start !== range.end) {
      context.addIssue({ code: "custom", message: "Exact dates must have matching bounds." });
    }
  });

export type DateRange = z.infer<typeof dateRangeSchema>;

export type ActionResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      formError?: string;
      fieldErrors?: Record<string, string[]>;
    };

export type PaginatedResult<T> = {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

export type Authorized<T> = { ok: true; value: T };
export type Denied = { ok: false; reason: "not_found" | "forbidden" };
export type AuthorizationResult<T> = Authorized<T> | Denied;

export const uuidSchema = z.uuid();

export const textSchema = (label: string, max: number) =>
  z.string().trim().min(1, `${label} is required.`).max(max, `${label} is too long.`);

export function success<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function failure(
  formError: string,
  fieldErrors?: Record<string, string[]>,
): ActionResult<never> {
  return fieldErrors === undefined
    ? { ok: false, formError }
    : { ok: false, formError, fieldErrors };
}
