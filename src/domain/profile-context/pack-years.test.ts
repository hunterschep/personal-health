import { describe, expect, it } from "vitest";

import { packYearPreview } from "./pack-years";

describe("pack-year preview", () => {
  it("calculates an approximate former-smoker total from year-only input", () => {
    expect(
      packYearPreview(
        { status: "former", startedYear: "2000", endedYear: "2010", packsPerDay: "0.5" },
        2026,
      ),
    ).toEqual({
      packYears: 5,
      detail: "Year-only dates and average use make this estimate approximate.",
    });
  });

  it("uses the current year for an ongoing period and explains uncertainty", () => {
    expect(
      packYearPreview(
        { status: "current", startedYear: 2020, endedYear: null, packsPerDay: 1 },
        2026,
      ),
    ).toMatchObject({ packYears: 6, detail: expect.stringContaining("through 2026") });
  });

  it("does not invent a total when a year is missing", () => {
    expect(
      packYearPreview(
        { status: "former", startedYear: 2000, endedYear: null, packsPerDay: 1 },
        2026,
      ),
    ).toMatchObject({ packYears: null, detail: expect.stringContaining("quit year") });
  });
});
