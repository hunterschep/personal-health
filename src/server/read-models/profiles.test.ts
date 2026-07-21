import { describe, expect, it } from "vitest";

import { findNextAgeMilestone, summarizeCarePlanRecommendations } from "./profiles";

describe("overview age milestone", () => {
  it("finds the nearest future boundary from active recommendation rules", () => {
    expect(
      findNextAgeMilestone("1980-07-21", "2026-07-21", [
        {
          service: "Later service",
          appliesWhen: { op: "age_between", min: 50 },
        },
        {
          service: "Nearer service",
          appliesWhen: { op: "age_between", min: 47, max: 75 },
        },
      ]),
    ).toEqual({ age: 47, date: "2027-07-21", service: "Nearer service" });
  });
});

describe("overview metrics", () => {
  it("counts snapshot groups and excludes informational items from completion", () => {
    const summary = summarizeCarePlanRecommendations([
      { status: "due_now", recommendationClass: "routine" },
      { status: "up_to_date", recommendationClass: "routine" },
      { status: "due_this_year", recommendationClass: "routine" },
      { status: "due_soon", recommendationClass: "routine" },
      { status: "unknown_history", recommendationClass: "routine" },
      { status: "discuss_with_clinician", recommendationClass: "shared_decision" },
      { status: "not_applicable", recommendationClass: "routine" },
    ]);

    expect(summary).toEqual({
      attention: 1,
      thisYear: 2,
      unknown: 1,
      discussion: 1,
      current: 1,
      denominator: 4,
    });
  });
});
