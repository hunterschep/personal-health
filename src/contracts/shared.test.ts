import { describe, expect, it } from "vitest";
import { dateRangeSchema, failure, success } from "./shared";

describe("shared contracts", () => {
  it("accepts exact and approximate date ranges without inventing precision", () => {
    expect(
      dateRangeSchema.parse({ start: "2025-01-01", end: "2025-12-31", precision: "year" }),
    ).toEqual({ start: "2025-01-01", end: "2025-12-31", precision: "year" });
    expect(dateRangeSchema.parse({ start: null, end: null, precision: "unknown" })).toEqual({
      start: null,
      end: null,
      precision: "unknown",
    });
  });

  it("rejects invalid exact-date bounds", () => {
    expect(() =>
      dateRangeSchema.parse({ start: "2025-01-01", end: "2025-01-02", precision: "day" }),
    ).toThrow();
    expect(() =>
      dateRangeSchema.parse({ start: "2025-02-30", end: "2025-02-30", precision: "day" }),
    ).toThrow("Use a valid calendar date");
  });

  it("preserves typed action results", () => {
    expect(success({ id: "record" })).toEqual({ ok: true, data: { id: "record" } });
    expect(failure("Invalid", { email: ["Use a valid email."] })).toEqual({
      ok: false,
      formError: "Invalid",
      fieldErrors: { email: ["Use a valid email."] },
    });
  });
});
