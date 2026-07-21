import { describe, expect, it } from "vitest";

import {
  changedRuleFields,
  compareRuleVersions,
  type ComparableRule,
  parseRuleDiffArguments,
  renderRuleVersionDiff,
} from "../scripts/rule-diff";

function ruleFixture(overrides: Partial<ComparableRule> = {}): ComparableRule {
  return {
    stableKey: "synthetic-screening-rule",
    version: 1,
    serviceSlug: "synthetic-screening",
    variantId: "federal_baseline",
    conflictGroup: null,
    baseline: true,
    jurisdiction: "US",
    evidenceGrade: "Synthetic A",
    recommendationClass: "routine",
    appliesWhen: { op: "age_between", min: 40, max: 74 },
    excludesWhen: null,
    stopWhen: null,
    schedule: {
      kind: "age_based",
      startAge: 40,
      stopAge: 74,
      interval: { unit: "years", value: 2 },
    },
    completionEventTypes: ["synthetic_screening"],
    allowedMethods: ["synthetic-method"],
    outcomeModifiers: ["abnormal_result_clinician_managed"],
    consumerSummary: "A synthetic reviewed summary.",
    whyItMatters: "A synthetic reviewed rationale.",
    questionsForClinician: ["Is this synthetic option appropriate?"],
    limitations: ["Synthetic fixtures are not medical guidance."],
    effectiveFrom: "2025-01-01",
    effectiveTo: null,
    reviewStatus: "active",
    scenarioIds: ["synthetic-positive", "synthetic-negative"],
    source: {
      slug: "synthetic-source-2025",
      organization: "Synthetic Source Organization",
      title: "Synthetic source",
      canonicalUrl: "https://example.test/synthetic-source",
      sourceType: "federal_recommendation",
      jurisdiction: "US",
      publishedAt: "2025-01-01",
      effectiveAt: "2025-01-01",
      lastVerifiedAt: "2026-07-21",
      contentHash: null,
      attributionText: null,
      licenseOrTermsUrl: null,
      active: true,
    },
    ...overrides,
  };
}

describe("rule diff command arguments", () => {
  it("preserves database-check mode", () => {
    expect(parseRuleDiffArguments(["--check", "--json"])).toEqual({
      mode: "database_check",
      fromVersion: null,
      toVersion: null,
      stableKey: null,
      json: true,
      check: true,
    });
  });

  it("parses semantic versions and an optional stable-key filter", () => {
    expect(
      parseRuleDiffArguments([
        "--from",
        "1",
        "--to=2",
        "--rule",
        "synthetic-screening-rule",
        "--json",
      ]),
    ).toEqual({
      mode: "semantic",
      fromVersion: 1,
      toVersion: 2,
      stableKey: "synthetic-screening-rule",
      json: true,
      check: false,
    });
  });

  it.each([
    [["--from", "1"], "--from and --to"],
    [["--from", "0", "--to", "2"], "positive integer"],
    [["--from", "2", "--to", "2"], "different versions"],
    [["--rule", "synthetic-screening-rule"], "only with --from and --to"],
    [["--unknown"], "Unknown argument"],
  ])("rejects malformed arguments %#", (arguments_, message) => {
    expect(() => parseRuleDiffArguments(arguments_)).toThrow(message);
  });
});

describe("semantic rule version diff", () => {
  it("reports every required semantic field and a database-backed profile estimate", () => {
    const from = ruleFixture();
    const to = ruleFixture({
      version: 2,
      appliesWhen: { op: "age_between", min: 40, max: 79 },
      schedule: {
        kind: "age_based",
        startAge: 40,
        stopAge: 79,
        interval: { unit: "years", value: 1 },
      },
      consumerSummary: "An updated synthetic reviewed summary.",
      effectiveFrom: "2027-01-01",
      scenarioIds: ["synthetic-positive", "synthetic-age-79", "synthetic-negative"],
      source: {
        ...from.source,
        slug: "synthetic-source-2027",
        title: "Updated synthetic source",
        publishedAt: "2027-01-01",
        effectiveAt: "2027-01-01",
      },
    });

    const report = compareRuleVersions([to, from], 1, 2, null, new Map([["US", 14]]));
    expect(report).toMatchObject({
      fromVersion: 1,
      toVersion: 2,
      comparedRuleCount: 1,
      estimatedProfilesAvailable: true,
    });
    expect(report.diffs[0]).toMatchObject({
      stableKey: "synthetic-screening-rule",
      fromVersion: 1,
      toVersion: 2,
      eligibility: { changed: true },
      schedule: { changed: true },
      sourceMetadata: { changed: true },
      summaries: { changed: true },
      estimatedProfileCount: 14,
      snapshotRebuildRequired: true,
    });
    expect(report.diffs[0]?.changedFields).toEqual(
      expect.arrayContaining([
        "eligibility",
        "schedule",
        "source metadata",
        "summaries",
        "scenario IDs",
        "effectiveFrom",
      ]),
    );
    expect(report.diffs[0]?.expectedAffectedScenarioIds).toEqual([
      "synthetic-age-79",
      "synthetic-negative",
      "synthetic-positive",
    ]);

    const text = renderRuleVersionDiff(report);
    expect(text).toContain("synthetic-screening-rule · v1 -> v2");
    expect(text).toContain("eligibility: changed");
    expect(text).toContain("schedule: changed");
    expect(text).toContain("source metadata: changed");
    expect(text).toContain("summaries: changed");
    expect(text).toContain("estimated profiles: 14");
    expect(text).toContain("snapshot rebuild: required");
  });

  it("treats object key order as semantic equality and defers rebuilds for inactive drafts", () => {
    const from = ruleFixture({
      appliesWhen: { op: "age_between", min: 40, max: 74 },
    });
    const to = ruleFixture({
      version: 2,
      appliesWhen: { max: 74, min: 40, op: "age_between" },
      reviewStatus: "reviewed",
    });
    const report = compareRuleVersions([from, to], 1, 2);

    expect(report.diffs[0]?.eligibility.changed).toBe(false);
    expect(report.diffs[0]?.snapshotRebuildRequired).toBe(false);
    expect(report.diffs[0]?.estimatedProfileCount).toBeNull();
    expect(report.diffs[0]?.changedFields).toEqual(["reviewStatus"]);
  });

  it("filters comparisons by stable key and ignores scenario ordering in database checks", () => {
    const from = ruleFixture({ scenarioIds: ["synthetic-positive", "synthetic-negative"] });
    const reordered = ruleFixture({ scenarioIds: ["synthetic-negative", "synthetic-positive"] });
    const otherFrom = ruleFixture({ stableKey: "other-rule" });
    const otherTo = ruleFixture({ stableKey: "other-rule", version: 2 });

    expect(changedRuleFields(from, reordered)).toEqual([]);
    expect(
      compareRuleVersions(
        [from, ruleFixture({ version: 2 }), otherFrom, otherTo],
        1,
        2,
        "other-rule",
      ).diffs.map((diff) => diff.stableKey),
    ).toEqual(["other-rule"]);
  });
});
