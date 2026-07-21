import { describe, expect, it } from "vitest";

import {
  classifyRecommendationChanges,
  explicitMedicationClassCodes,
  recommendationChangeCounts,
  type ComparableRecommendation,
} from "./rebuild";

function recommendation(
  overrides: Partial<ComparableRecommendation> = {},
): ComparableRecommendation {
  return {
    id: "recommendation-1",
    stableKey: "screening-rule",
    serviceId: "service-1",
    ruleVersion: 1,
    variantId: "baseline",
    conflictGroup: null,
    status: "unknown_history",
    dueStart: null,
    dueEnd: null,
    activeOverrideId: null,
    ...overrides,
  };
}

describe("recommendation rebuild change classification", () => {
  it("uses only persisted medication class codes", () => {
    expect(explicitMedicationClassCodes(["statin", 42, "ace_inhibitor"])).toEqual([
      "statin",
      "ace_inhibitor",
    ]);
    expect(explicitMedicationClassCodes(null)).toEqual([]);
  });

  it("classifies meaningful state, timing, rule, override, and uncertainty changes", () => {
    const changes = classifyRecommendationChanges(
      [recommendation()],
      [
        recommendation({
          id: "recommendation-2",
          ruleVersion: 2,
          status: "due_now",
          dueStart: "2026-07-21",
          dueEnd: "2026-08-21",
          activeOverrideId: "override-1",
        }),
      ],
    );

    expect(changes.map(({ type }) => type)).toEqual([
      "rule_version_changed",
      "status_changed",
      "due_range_changed",
      "clinician_override_activated",
      "history_uncertainty_resolved",
    ]);
  });

  it("pairs a selected guideline variant as one source change", () => {
    const changes = classifyRecommendationChanges(
      [recommendation({ stableKey: "baseline-rule", conflictGroup: "breast-guidance" })],
      [
        recommendation({
          id: "recommendation-2",
          stableKey: "alternative-rule",
          conflictGroup: "breast-guidance",
          variantId: "alternative",
        }),
      ],
    );

    expect(changes.map(({ type }) => type)).toContain("source_variant_changed");
    expect(changes.map(({ type }) => type)).not.toContain("newly_applicable");
    expect(changes.map(({ type }) => type)).not.toContain("no_longer_applicable");
  });

  it("classifies additions, removals, and override removal and returns complete counts", () => {
    const changes = classifyRecommendationChanges(
      [
        recommendation({ activeOverrideId: "override-1" }),
        recommendation({ id: "removed", stableKey: "removed-rule", serviceId: "service-2" }),
      ],
      [
        recommendation({ id: "next", status: "unknown_history" }),
        recommendation({ id: "added", stableKey: "added-rule", serviceId: "service-3" }),
      ],
    );
    const counts = recommendationChangeCounts(changes);

    expect(changes.map(({ type }) => type)).toEqual([
      "clinician_override_removed",
      "no_longer_applicable",
      "newly_applicable",
    ]);
    expect(counts.clinician_override_removed).toBe(1);
    expect(counts.no_longer_applicable).toBe(1);
    expect(counts.newly_applicable).toBe(1);
    expect(counts.status_changed).toBe(0);
  });
});
