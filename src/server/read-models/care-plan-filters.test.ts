import { describe, expect, it } from "vitest";

import { filterCarePlanRecommendations, type FilterableRecommendation } from "./care-plan-filters";

function recommendation(
  overrides: Partial<FilterableRecommendation> = {},
): FilterableRecommendation {
  return {
    service: "Colorectal cancer screening",
    status: "due_now",
    categoryKey: "cancer_screening",
    dueStart: new Date("2026-05-01T00:00:00.000Z"),
    recommendationClass: "routine",
    sourceOrganization: "USPSTF",
    planned: false,
    knownHistory: false,
    ...overrides,
  };
}

describe("care-plan filters", () => {
  it("filters across every requested dimension", () => {
    const item = recommendation({ planned: true, knownHistory: true });
    expect(
      filterCarePlanRecommendations([item], {
        query: "colorectal",
        status: "attention",
        category: "cancer_screening",
        year: "2026",
        recommendationClass: "routine",
        source: "USPSTF",
        planned: "planned",
        history: "known",
      }),
    ).toEqual([item]);
  });

  it("keeps unknown timing distinct from a calendar year", () => {
    const unknown = recommendation({ dueStart: null });
    expect(filterCarePlanRecommendations([unknown], { year: "unknown" })).toEqual([unknown]);
    expect(filterCarePlanRecommendations([unknown], { year: "2026" })).toHaveLength(0);
  });

  it("keeps source and planned filters exact", () => {
    const items = [recommendation(), recommendation({ sourceOrganization: "CDC", planned: true })];
    expect(filterCarePlanRecommendations(items, { source: "CDC", planned: "planned" })).toEqual([
      items[1],
    ]);
  });

  it("groups due-soon items with this year instead of needs attention", () => {
    const dueSoon = recommendation({ status: "due_soon" });
    expect(filterCarePlanRecommendations([dueSoon], { status: "this-year" })).toEqual([dueSoon]);
    expect(filterCarePlanRecommendations([dueSoon], { status: "attention" })).toHaveLength(0);
  });
});
