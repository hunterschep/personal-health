import { describe, expect, it } from "vitest";
import {
  addCalendarMonths,
  addCalendarYears,
  addDurationToRange,
  ageOnDate,
  dateAtAge,
  dateInTimeZone,
  normalizeDateRange,
  parseIsoDate,
} from ".";

describe("date-range normalization", () => {
  it.each([
    ["2026-07-21", "day", { start: "2026-07-21", end: "2026-07-21", precision: "day" }],
    ["2024-02", "month", { start: "2024-02-01", end: "2024-02-29", precision: "month" }],
    ["2026", "year", { start: "2026-01-01", end: "2026-12-31", precision: "year" }],
    [null, "unknown", { start: null, end: null, precision: "unknown" }],
  ] as const)("normalizes %s with %s precision", (value, precision, expected) => {
    expect(normalizeDateRange(value, precision)).toEqual(expected);
  });

  it.each(["2025-02-29", "2026-13-01", "2026-04-31", "not-a-date"])(
    "rejects invalid ISO date %s",
    (value) => expect(() => parseIsoDate(value)).toThrow(RangeError),
  );

  it("never invents bounds for an unknown date", () => {
    expect(() => normalizeDateRange("2026", "unknown")).toThrow(RangeError);
  });
});

describe("calendar arithmetic", () => {
  it.each([
    ["2025-01-31", 1, "2025-02-28"],
    ["2024-01-31", 1, "2024-02-29"],
    ["2025-02-28", 1, "2025-03-31"],
    ["2025-03-31", -1, "2025-02-28"],
  ])("adds %i month(s) to %s", (value, months, expected) => {
    expect(addCalendarMonths(value, months)).toBe(expected);
  });

  it("uses February 28 when adding a year to leap day", () => {
    expect(addCalendarYears("2024-02-29", 1)).toBe("2025-02-28");
  });

  it("propagates year-only uncertainty through a ten-year interval", () => {
    expect(
      addDurationToRange(normalizeDateRange("2018", "year"), { unit: "years", value: 10 }),
    ).toEqual({ start: "2028-01-01", end: "2028-12-31", precision: "year" });
  });
});

describe("age boundaries", () => {
  it.each([
    ["1980-07-22", "2025-07-21", 44],
    ["1980-07-21", "2025-07-21", 45],
    ["1980-07-20", "2025-07-21", 45],
  ])("calculates age for birth %s as of %s", (birth, asOf, expected) => {
    expect(ageOnDate(birth, asOf)).toBe(expected);
  });

  it("documents the February 28 anniversary convention for leap-day births", () => {
    expect(dateAtAge("2000-02-29", 25)).toBe("2025-02-28");
    expect(ageOnDate("2000-02-29", "2025-02-27")).toBe(24);
    expect(ageOnDate("2000-02-29", "2025-02-28")).toBe(25);
  });
});

describe("timezone-local evaluation dates", () => {
  it("resolves different local dates around UTC midnight without changing the instant", () => {
    const instant = new Date("2026-01-01T01:30:00.000Z");
    expect(dateInTimeZone(instant, "America/Los_Angeles")).toBe("2025-12-31");
    expect(dateInTimeZone(instant, "Pacific/Kiritimati")).toBe("2026-01-01");
  });
});
