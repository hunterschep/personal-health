import { describe, expect, it } from "vitest";

import { SERVICE_METHOD_SEED_RECORDS, SERVICE_SEED_RECORDS } from "../prisma/seed/catalog";
import { GUIDELINE_RULE_SEEDS, validateGuidelineRuleSeeds } from "../prisma/seed/rules";
import { SOURCE_REGISTRY } from "../src/server/sources/registry";

const requiredServiceSlugs = [
  "colorectal-cancer-screening",
  "breast-cancer-screening",
  "cervical-cancer-screening",
  "prostate-cancer-discussion",
  "lung-cancer-screening",
  "skin-health-review",
  "blood-pressure-screening",
  "prediabetes-type2-diabetes-screening",
  "lipid-cardiovascular-risk-review",
  "weight-bmi-review",
  "tobacco-use-review",
  "alcohol-use-review",
  "physical-activity-review",
  "nutrition-review",
  "osteoporosis-screening",
  "abdominal-aortic-aneurysm-screening",
  "hepatitis-c-screening",
  "hiv-screening",
  "hepatitis-b-screening",
  "sti-screening",
  "depression-screening",
  "anxiety-screening",
  "intimate-partner-safety",
  "fall-risk-review",
  "hearing-review",
  "vision-review",
  "cognitive-concern-review",
  "functional-status-review",
  "influenza-vaccine",
  "covid-vaccine",
  "tdap-td-vaccine",
  "zoster-vaccine",
  "pneumococcal-vaccine",
  "rsv-vaccine",
  "hpv-vaccine",
  "hepatitis-a-vaccine",
  "hepatitis-b-vaccine",
  "mmr-vaccine",
  "varicella-vaccine",
  "primary-care-check-in",
  "dental-care",
  "eye-exam",
  "hearing-care",
  "skin-care",
  "medication-reconciliation",
  "advance-care-planning",
  "fall-prevention-home-safety",
  "specialist-follow-up",
  "prescription-renewal",
  "custom-lab-bundle",
  "lipid-panel",
  "hemoglobin-a1c",
  "fasting-glucose",
  "kidney-function-panel",
  "liver-function-panel",
  "complete-blood-count",
  "thyroid-testing",
  "vitamin-d-testing",
  "psa-test",
  "custom-lab",
] as const;

describe("reviewed service and method catalog", () => {
  it("contains every required stable service slug exactly once", () => {
    const actual = SERVICE_SEED_RECORDS.map((service) => service.slug).sort();
    expect(actual).toEqual([...requiredServiceSlugs].sort());
    expect(new Set(actual).size).toBe(actual.length);
  });

  it("contains required method families and no duplicate service/method keys", () => {
    const methodKeys = SERVICE_METHOD_SEED_RECORDS.map(
      (method) => `${method.serviceSlug}:${method.slug}`,
    );
    expect(new Set(methodKeys).size).toBe(methodKeys.length);
    expect(methodKeys).toEqual(
      expect.arrayContaining([
        "colorectal-cancer-screening:colonoscopy",
        "colorectal-cancer-screening:fit",
        "colorectal-cancer-screening:stool-dna-fit",
        "colorectal-cancer-screening:flexible-sigmoidoscopy",
        "colorectal-cancer-screening:ct-colonography",
        "cervical-cancer-screening:primary-high-risk-hpv",
        "cervical-cancer-screening:cervical-cytology",
        "cervical-cancer-screening:co-testing",
        "breast-cancer-screening:mammography",
        "prostate-cancer-discussion:psa",
        "lung-cancer-screening:low-dose-ct",
        "osteoporosis-screening:dxa",
        "abdominal-aortic-aneurysm-screening:abdominal-ultrasound",
        "depression-screening:questionnaire",
        "dental-care:dental-visit",
        "eye-exam:eye-exam",
      ]),
    );
  });
});

describe("reviewed guideline rule seeds", () => {
  it("passes structural, source, service, method, conflict, and scenario validation", () => {
    expect(validateGuidelineRuleSeeds()).toEqual([]);
  });

  it("resolves every source to a verified registry entry that declares the service", () => {
    const sourceBySlug = new Map(SOURCE_REGISTRY.map((source) => [source.slug, source]));
    for (const rule of GUIDELINE_RULE_SEEDS) {
      const source = sourceBySlug.get(rule.sourceSlug);
      expect(source, rule.stableKey).toBeDefined();
      expect(source?.lastVerifiedAt, rule.stableKey).toBe("2026-07-21");
      expect(source?.serviceSlugs, rule.stableKey).toContain(rule.serviceSlug);
    }
  });

  it("has one baseline variant in every conflict group", () => {
    const groups = new Map<string, typeof GUIDELINE_RULE_SEEDS>();
    for (const rule of GUIDELINE_RULE_SEEDS) {
      if (rule.conflictGroup === null) continue;
      groups.set(rule.conflictGroup, [...(groups.get(rule.conflictGroup) ?? []), rule]);
    }
    for (const [group, rules] of groups) {
      const baselineVariants = new Set(
        rules.filter((rule) => rule.baseline).map((rule) => rule.variantId),
      );
      expect([...baselineVariants], group).toHaveLength(1);
    }
  });

  it("keeps the cervical source version boundaries explicit", () => {
    const cervicalRules = GUIDELINE_RULE_SEEDS.filter(
      (rule) => rule.serviceSlug === "cervical-cancer-screening",
    );
    expect(cervicalRules.filter((rule) => rule.variantId === "uspstf_2018")).not.toHaveLength(0);
    expect(
      cervicalRules.some(
        (rule) => rule.sourceSlug === "uspstf-cervical-cancer-screening-draft-2024",
      ),
    ).toBe(false);
    const futureHrsa = cervicalRules.find((rule) => rule.variantId === "hrsa_2027");
    expect(futureHrsa?.effectiveFrom).toBe("2027-01-01");
    expect(futureHrsa?.baseline).toBe(false);
  });

  it("applies the 2026 CDC addendum only to the RSV age 50 through 59 rule", () => {
    const addendumRules = GUIDELINE_RULE_SEEDS.filter(
      (rule) => rule.sourceSlug === "cdc-adult-immunization-addendum-rsv-2026",
    );
    expect(addendumRules.map((rule) => rule.stableKey)).toEqual([
      "rsv-cdc-addendum-increased-risk-50-59",
    ]);
  });

  it("does not turn uncertain COVID guidance into an overdue schedule", () => {
    const rule = GUIDELINE_RULE_SEEDS.find(
      (candidate) => candidate.serviceSlug === "covid-vaccine",
    );
    expect(rule?.recommendationClass).toBe("shared-decision");
    expect(rule?.schedule.kind).toBe("custom");
  });

  it("keeps every method-dependent interval tied to that service's recorded method", () => {
    const methodRules = GUIDELINE_RULE_SEEDS.filter(
      (rule) => rule.schedule.kind === "method_dependent",
    );
    expect(methodRules.length).toBeGreaterThan(0);
    for (const rule of methodRules) {
      if (rule.schedule.kind !== "method_dependent") continue;
      expect(rule.allowedMethods).not.toBeNull();
      expect(rule.schedule.methods.map((method) => method.methodId).sort()).toEqual(
        [...(rule.allowedMethods ?? [])].sort(),
      );
      for (const method of rule.schedule.methods) {
        expect(
          rule.scenarioIds.some((scenarioId) => scenarioId.includes(method.methodId)),
          `${rule.stableKey}/${method.methodId}`,
        ).toBe(true);
      }
    }
  });

  it("does not activate universal annual lab bundles or source-free maintenance rules", () => {
    const templateSlugs = new Set([
      "primary-care-check-in",
      "dental-care",
      "eye-exam",
      "hearing-care",
      "skin-care",
      "medication-reconciliation",
      "advance-care-planning",
      "fall-prevention-home-safety",
      "specialist-follow-up",
      "prescription-renewal",
      "custom-lab-bundle",
      "lipid-panel",
      "hemoglobin-a1c",
      "fasting-glucose",
      "kidney-function-panel",
      "liver-function-panel",
      "complete-blood-count",
      "thyroid-testing",
      "vitamin-d-testing",
      "psa-test",
      "custom-lab",
    ]);
    expect(GUIDELINE_RULE_SEEDS.filter((rule) => templateSlugs.has(rule.serviceSlug))).toEqual([]);
  });
});
