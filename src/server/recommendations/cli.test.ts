import { describe, expect, it } from "vitest";

import { parseRebuildCliOptions, rebuildProfileWhere } from "./cli";

describe("recommendation rebuild CLI", () => {
  it("parses all required scope, dry-run, date, batch, and resume options", () => {
    expect(
      parseRebuildCliOptions([
        "--household",
        "household-1",
        "--rule",
        "rule-key",
        "--dry-run",
        "--as-of",
        "2026-07-21",
        "--batch-size",
        "25",
        "--after",
        "profile-10",
      ]),
    ).toMatchObject({
      all: false,
      householdId: "household-1",
      ruleStableKey: "rule-key",
      dryRun: true,
      asOfDate: "2026-07-21",
      batchSize: 25,
      afterProfileId: "profile-10",
    });
  });

  it("defaults to all profiles and rejects conflicting targets or malformed values", () => {
    expect(parseRebuildCliOptions([]).all).toBe(true);
    expect(() => parseRebuildCliOptions(["--all", "--profile", "profile-1"])).toThrow(
      "Choose only one",
    );
    expect(() => parseRebuildCliOptions(["--as-of", "July 21"])).toThrow("YYYY-MM-DD");
    expect(() => parseRebuildCliOptions(["--batch-size", "0"])).toThrow("1 through 1000");
    expect(() => parseRebuildCliOptions(["--unknown"])).toThrow("Unknown option");
  });

  it("builds a bounded, resumable profile filter without health data", () => {
    const options = parseRebuildCliOptions(["--household", "household-1", "--after", "profile-2"]);
    expect(rebuildProfileWhere(options, ["US"])).toEqual({
      deletedAt: null,
      householdId: "household-1",
      countryCode: { in: ["US"] },
      AND: [{ id: { gt: "profile-2" } }],
    });
  });

  it("keeps an exact profile target bounded when pagination advances", () => {
    const options = parseRebuildCliOptions(["--profile", "profile-1", "--after", "profile-1"]);
    expect(rebuildProfileWhere(options, [])).toMatchObject({
      AND: [{ id: "profile-1" }, { id: { gt: "profile-1" } }],
    });
  });
});
