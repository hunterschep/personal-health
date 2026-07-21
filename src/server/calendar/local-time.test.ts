import { describe, expect, it } from "vitest";

import {
  assertAppointmentRange,
  formatLocalWallTime,
  localYearMonth,
  parseLocalWallTime,
} from "./local-time";

const timezone = "America/Los_Angeles";

describe("calendar local wall times", () => {
  it("converts and formats appointment times in the profile timezone", () => {
    const instant = parseLocalWallTime("2026-07-21T09:30", timezone);

    expect(instant.toISOString()).toBe("2026-07-21T16:30:00.000Z");
    expect(formatLocalWallTime(instant, timezone)).toBe("2026-07-21T09:30");
  });

  it("rejects local times skipped by the daylight-saving transition", () => {
    expect(() => parseLocalWallTime("2026-03-08T02:30", timezone)).toThrow(
      "does not exist in this timezone",
    );
  });

  it("rejects offset timestamps and malformed wall times", () => {
    expect(() => parseLocalWallTime("2026-07-21T09:30:00Z", timezone)).toThrow(
      "valid local date and time",
    );
    expect(() => parseLocalWallTime("2026-07-21T25:00", timezone)).toThrow(
      "valid local date and time",
    );
  });

  it("derives the calendar year and month in the profile timezone", () => {
    expect(localYearMonth(new Date("2027-01-01T01:00:00.000Z"), timezone)).toEqual({
      year: 2026,
      month: 11,
    });
  });

  it("requires complete, increasing appointment ranges", () => {
    const start = new Date("2026-07-21T16:30:00.000Z");
    const end = new Date("2026-07-21T17:15:00.000Z");

    expect(() => assertAppointmentRange(start, end)).not.toThrow();
    expect(() => assertAppointmentRange(start, null)).toThrow("provided together");
    expect(() => assertAppointmentRange(end, start)).toThrow("after its start");
  });
});
