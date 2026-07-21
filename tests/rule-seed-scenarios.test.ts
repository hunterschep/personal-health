import { describe, expect, it } from "vitest";

import { evaluateCarePlan } from "@/domain/rules/evaluator";
import { GUIDELINE_RULE_SEEDS } from "../prisma/seed/rules";
import { buildRuleSeedScenarios } from "./support/rule-seed-scenarios";

const expectedOutcomes: Record<string, string> = {
  "aaa-uspstf-men-65-75-ever-smoked-positive": "due_now|2026-07-21|2026-07-21|day",
  "aaa-uspstf-men-65-75-ever-smoked-negative":
    "not_routinely_recommended|2015-07-21|2015-07-21|day",
  "aaa-uspstf-men-65-75-never-smoked-positive": "discuss_with_clinician|2026-07-21|2026-07-21|day",
  "aaa-uspstf-men-65-75-never-smoked-negative":
    "not_routinely_recommended|2015-07-21|2015-07-21|day",
  "aaa-uspstf-women-ever-smoked-insufficient-positive": "discuss_with_clinician|-|-|-",
  "aaa-uspstf-women-ever-smoked-insufficient-negative": "not_routinely_recommended|-|-|-",
  "aaa-uspstf-women-never-smoked-against-positive": "not_routinely_recommended|-|-|-",
  "aaa-uspstf-women-never-smoked-against-negative": "not_routinely_recommended|-|-|-",
  "activity-uspstf-individualized-offer-positive": "discuss_with_clinician|-|-|-",
  "activity-uspstf-individualized-offer-negative": "discuss_with_clinician|-|-|-",
  "alcohol-uspstf-adult-screening-positive": "discuss_with_clinician|-|-|-",
  "alcohol-uspstf-adult-screening-negative": "discuss_with_clinician|-|-|-",
  "anxiety-uspstf-65-plus-insufficient-positive": "discuss_with_clinician|-|-|-",
  "anxiety-uspstf-65-plus-insufficient-negative": "discuss_with_clinician|-|-|-",
  "anxiety-uspstf-adults-through-64-positive": "discuss_with_clinician|-|-|-",
  "anxiety-uspstf-adults-through-64-negative": "not_routinely_recommended|-|-|-",
  "blood-pressure-uspstf-18-39-reasonable-interval-positive": "due_now|2026-07-21|2026-07-21|day",
  "blood-pressure-uspstf-18-39-reasonable-interval-negative":
    "not_routinely_recommended|2004-07-21|2004-07-21|day",
  "blood-pressure-uspstf-annual-40-plus-positive": "due_now|2026-07-21|2026-07-21|day",
  "blood-pressure-uspstf-annual-40-plus-negative": "future|2027-07-21|2027-07-21|day",
  "breast-acs-annual-45-54-positive": "due_now|2026-07-21|2026-07-21|day",
  "breast-acs-annual-45-54-negative": "not_routinely_recommended|2016-07-21|2016-07-21|day",
  "breast-acs-biennial-55-plus-positive": "due_now|2026-07-21|2026-07-21|day",
  "breast-acs-biennial-55-plus-negative": "future|2027-07-21|2027-07-21|day",
  "breast-acs-option-40-44-positive": "discuss_with_clinician|2026-07-21|2031-07-21|year",
  "breast-acs-option-40-44-negative": "not_routinely_recommended|2021-07-21|2026-07-21|year",
  "breast-uspstf-biennial-40-74-positive": "due_now|2026-07-21|2026-07-21|day",
  "breast-uspstf-biennial-40-74-negative": "not_routinely_recommended|1991-07-21|1991-07-21|day",
  "cardiovascular-risk-acc-aha-2026-specialty-positive": "discuss_with_clinician|-|-|-",
  "cardiovascular-risk-acc-aha-2026-specialty-negative": "discuss_with_clinician|-|-|-",
  "cardiovascular-risk-uspstf-statin-discussion-40-75-positive": "discuss_with_clinician|-|-|-",
  "cardiovascular-risk-uspstf-statin-discussion-40-75-negative": "not_routinely_recommended|-|-|-",
  "cervical-acs-primary-hpv-positive": "due_now|2026-07-21|2026-07-21|day",
  "cervical-acs-no-cervix-negative": "not_routinely_recommended|1985-07-21|1985-07-21|day",
  "cervical-acs-methods-25-65-method-primary-high-risk-hpv": "future|2031-07-21|2031-07-21|day",
  "cervical-acs-methods-25-65-method-self-collected-high-risk-hpv":
    "future|2029-07-21|2029-07-21|day",
  "cervical-acs-methods-25-65-method-co-testing": "future|2031-07-21|2031-07-21|day",
  "cervical-acs-methods-25-65-method-cervical-cytology": "future|2029-07-21|2029-07-21|day",
  "cervical-hrsa-future-30-65-positive": "due_now|2027-01-01|2027-01-01|day",
  "cervical-hrsa-future-30-65-negative": "not_routinely_recommended|1991-01-01|1991-01-01|day",
  "cervical-hrsa-future-30-65-method-primary-high-risk-hpv": "future|2032-01-01|2032-01-01|day",
  "cervical-hrsa-future-30-65-method-self-collected-high-risk-hpv":
    "future|2030-01-01|2030-01-01|day",
  "cervical-hrsa-future-30-65-method-co-testing": "future|2032-01-01|2032-01-01|day",
  "cervical-hrsa-future-30-65-method-cervical-cytology": "future|2030-01-01|2030-01-01|day",
  "cervical-uspstf-cytology-21-29-positive": "due_now|2026-07-21|2026-07-21|day",
  "cervical-uspstf-cytology-21-29-negative": "not_routinely_recommended|2017-07-21|2017-07-21|day",
  "cervical-cytology-positive": "due_now|2026-07-21|2026-07-21|day",
  "cervical-no-cervix-negative": "not_routinely_recommended|1990-07-21|1990-07-21|day",
  "cervical-uspstf-methods-30-65-method-cervical-cytology": "future|2029-07-21|2029-07-21|day",
  "cervical-uspstf-methods-30-65-method-primary-high-risk-hpv": "future|2031-07-21|2031-07-21|day",
  "cervical-uspstf-methods-30-65-method-co-testing": "future|2031-07-21|2031-07-21|day",
  "cognition-uspstf-asymptomatic-65-plus-insufficient-positive": "discuss_with_clinician|-|-|-",
  "cognition-uspstf-asymptomatic-65-plus-insufficient-negative": "discuss_with_clinician|-|-|-",
  "colorectal-newly-eligible-positive": "due_now|2026-07-21|2026-07-21|day",
  "colorectal-age-outside-negative": "not_routinely_recommended|1995-07-21|1995-07-21|day",
  "colorectal-uspstf-average-risk-45-75-method-colonoscopy": "future|2036-07-21|2036-07-21|day",
  "colorectal-uspstf-average-risk-45-75-method-fit": "future|2027-07-21|2027-07-21|day",
  "colorectal-uspstf-average-risk-45-75-method-high-sensitivity-guaiac-fobt":
    "future|2027-07-21|2027-07-21|day",
  "colorectal-uspstf-average-risk-45-75-method-stool-dna-fit": "future|2029-07-21|2029-07-21|day",
  "colorectal-uspstf-average-risk-45-75-method-flexible-sigmoidoscopy":
    "future|2031-07-21|2031-07-21|day",
  "colorectal-uspstf-average-risk-45-75-method-flexible-sigmoidoscopy-with-fit":
    "future|2027-07-21|2027-07-21|day",
  "colorectal-uspstf-average-risk-45-75-method-ct-colonography": "future|2031-07-21|2031-07-21|day",
  "colorectal-uspstf-selective-76-85-positive": "discuss_with_clinician|2026-07-21|2036-07-21|year",
  "colorectal-uspstf-selective-76-85-negative":
    "not_routinely_recommended|2016-07-21|2026-07-21|year",
  "covid-cdc-current-guidance-discussion-positive": "discuss_with_clinician|-|-|-",
  "covid-cdc-current-guidance-discussion-negative": "discuss_with_clinician|-|-|-",
  "depression-uspstf-adult-screening-positive": "discuss_with_clinician|-|-|-",
  "depression-uspstf-adult-screening-negative": "discuss_with_clinician|-|-|-",
  "diabetes-uspstf-age-bmi-screening-positive": "due_now|2026-07-21|2026-07-21|day",
  "diabetes-uspstf-age-bmi-screening-negative":
    "not_routinely_recommended|1990-07-21|1990-07-21|day",
  "falls-uspstf-increased-risk-65-plus-positive": "discuss_with_clinician|-|-|-",
  "falls-uspstf-increased-risk-65-plus-negative": "discuss_with_clinician|-|-|-",
  "function-review-no-universal-cadence-positive": "discuss_with_clinician|-|-|-",
  "function-review-no-universal-cadence-negative": "discuss_with_clinician|-|-|-",
  "hearing-uspstf-asymptomatic-50-plus-insufficient-positive": "discuss_with_clinician|-|-|-",
  "hearing-uspstf-asymptomatic-50-plus-insufficient-negative": "discuss_with_clinician|-|-|-",
  "hepatitis-a-cdc-risk-or-request-positive": "discuss_with_clinician|2026-07-21|2026-07-21|day",
  "hepatitis-a-cdc-risk-or-request-negative": "discuss_with_clinician|2026-07-21|2026-07-21|day",
  "hepatitis-b-cdc-60-plus-risk-or-request-positive": "discuss_with_clinician|-|-|-",
  "hepatitis-b-cdc-60-plus-risk-or-request-negative": "discuss_with_clinician|-|-|-",
  "hepatitis-b-cdc-routine-19-59-positive": "due_now|2026-07-21|2026-07-21|day",
  "hepatitis-b-cdc-routine-19-59-negative": "not_routinely_recommended|2026-07-21|2026-07-21|day",
  "hepatitis-b-cdc-universal-adult-once-positive": "due_now|2026-07-21|2026-07-21|day",
  "hepatitis-b-cdc-universal-adult-once-negative": "future|2027-07-21|2027-07-21|day",
  "hepatitis-b-uspstf-risk-based-positive": "due_now|2026-07-21|2026-07-21|day",
  "hepatitis-b-uspstf-risk-based-negative": "future|2027-07-21|2027-07-21|day",
  "hepatitis-c-uspstf-one-time-18-79-positive": "due_now|2026-07-21|2026-07-21|day",
  "hepatitis-c-uspstf-one-time-18-79-negative":
    "not_routinely_recommended|1964-07-21|1964-07-21|day",
  "hiv-uspstf-routine-15-65-positive": "due_now|2026-07-21|2026-07-21|day",
  "hiv-uspstf-routine-15-65-negative": "not_routinely_recommended|1975-07-21|1975-07-21|day",
  "hpv-cdc-routine-through-26-positive": "due_now|2026-07-21|2026-07-21|day",
  "hpv-cdc-routine-through-26-negative": "not_routinely_recommended|2026-07-21|2026-07-21|day",
  "hpv-cdc-shared-decision-27-45-positive": "discuss_with_clinician|2026-07-21|2026-07-21|day",
  "hpv-cdc-shared-decision-27-45-negative": "not_routinely_recommended|2026-07-21|2026-07-21|day",
  "influenza-cdc-seasonal-adult-positive": "due_now|2026-09-01|2027-06-30|month",
  "influenza-cdc-seasonal-adult-negative": "due_now|2026-09-01|2027-06-30|month",
  "lung-uspstf-annual-ldct-positive": "due_now|2026-07-21|2026-07-21|day",
  "lung-uspstf-annual-ldct-negative": "not_routinely_recommended|1995-07-21|1995-07-21|day",
  "mmr-cdc-evidence-of-immunity-review-positive":
    "discuss_with_clinician|2026-07-21|2026-07-21|day",
  "mmr-cdc-evidence-of-immunity-review-negative":
    "discuss_with_clinician|2026-07-21|2026-07-21|day",
  "nutrition-uspstf-individualized-offer-positive": "discuss_with_clinician|-|-|-",
  "nutrition-uspstf-individualized-offer-negative": "discuss_with_clinician|-|-|-",
  "osteoporosis-uspstf-men-insufficient-evidence-positive": "discuss_with_clinician|-|-|-",
  "osteoporosis-uspstf-men-insufficient-evidence-negative": "discuss_with_clinician|-|-|-",
  "osteoporosis-uspstf-women-65-plus-positive": "due_now|2026-07-21|2026-07-21|day",
  "osteoporosis-uspstf-women-65-plus-negative": "future|2027-07-21|2027-07-21|day",
  "osteoporosis-uspstf-younger-postmenopausal-risk-review-positive": "discuss_with_clinician|-|-|-",
  "osteoporosis-uspstf-younger-postmenopausal-risk-review-negative":
    "not_routinely_recommended|-|-|-",
  "pneumococcal-cdc-age-50-plus-review-positive":
    "discuss_with_clinician|2026-07-21|2026-07-21|day",
  "pneumococcal-cdc-age-50-plus-review-negative":
    "discuss_with_clinician|2027-07-21|2027-07-21|day",
  "pneumococcal-cdc-risk-review-19-49-positive": "discuss_with_clinician|-|-|-",
  "pneumococcal-cdc-risk-review-19-49-negative": "not_routinely_recommended|-|-|-",
  "prostate-uspstf-against-70-plus-positive": "not_routinely_recommended|-|-|-",
  "prostate-uspstf-against-70-plus-negative": "not_routinely_recommended|-|-|-",
  "prostate-uspstf-shared-decision-55-69-positive":
    "discuss_with_clinician|2026-07-21|2041-07-21|year",
  "prostate-uspstf-shared-decision-55-69-negative":
    "not_routinely_recommended|2011-07-21|2026-07-21|year",
  "relationship-safety-uspstf-reproductive-age-positive": "discuss_with_clinician|-|-|-",
  "relationship-safety-uspstf-reproductive-age-negative": "not_routinely_recommended|-|-|-",
  "rsv-cdc-addendum-increased-risk-50-59-positive":
    "discuss_with_clinician|2026-07-21|2026-07-21|day",
  "rsv-cdc-addendum-increased-risk-50-59-negative":
    "not_routinely_recommended|2016-07-21|2016-07-21|day",
  "rsv-cdc-increased-risk-60-74-positive": "discuss_with_clinician|2026-07-21|2026-07-21|day",
  "rsv-cdc-increased-risk-60-74-negative": "not_routinely_recommended|2011-07-21|2011-07-21|day",
  "rsv-cdc-routine-75-plus-positive": "due_now|2026-07-21|2026-07-21|day",
  "rsv-cdc-routine-75-plus-negative": "future|2027-07-21|2027-07-21|day",
  "skin-uspstf-insufficient-evidence-positive": "discuss_with_clinician|-|-|-",
  "skin-uspstf-insufficient-evidence-negative": "discuss_with_clinician|-|-|-",
  "sti-uspstf-chlamydia-gonorrhea-risk-based-positive": "discuss_with_clinician|-|-|-",
  "sti-uspstf-chlamydia-gonorrhea-risk-based-negative": "discuss_with_clinician|-|-|-",
  "sti-uspstf-syphilis-increased-risk-positive": "discuss_with_clinician|-|-|-",
  "sti-uspstf-syphilis-increased-risk-negative": "discuss_with_clinician|-|-|-",
  "tdap-td-cdc-primary-and-ten-year-booster-positive": "due_now|2026-07-21|2026-07-21|day",
  "tdap-td-cdc-primary-and-ten-year-booster-negative": "due_now|2026-07-21|2026-07-21|day",
  "tobacco-uspstf-adult-assessment-positive": "discuss_with_clinician|-|-|-",
  "tobacco-uspstf-adult-assessment-negative": "discuss_with_clinician|-|-|-",
  "varicella-cdc-no-evidence-immunity-review-positive":
    "discuss_with_clinician|2026-07-21|2026-07-21|day",
  "varicella-cdc-no-evidence-immunity-review-negative":
    "discuss_with_clinician|2026-07-21|2026-07-21|day",
  "vision-uspstf-asymptomatic-65-plus-insufficient-positive": "discuss_with_clinician|-|-|-",
  "vision-uspstf-asymptomatic-65-plus-insufficient-negative": "discuss_with_clinician|-|-|-",
  "weight-bmi-uspstf-intervention-discussion-positive": "discuss_with_clinician|-|-|-",
  "weight-bmi-uspstf-intervention-discussion-negative": "discuss_with_clinician|-|-|-",
  "zoster-cdc-immunocompromised-19-49-positive": "discuss_with_clinician|2026-07-21|2026-07-21|day",
  "zoster-cdc-immunocompromised-19-49-negative":
    "not_routinely_recommended|2026-07-21|2026-07-21|day",
  "zoster-cdc-two-dose-50-plus-positive": "due_now|2026-07-21|2026-07-21|day",
  "zoster-cdc-two-dose-50-plus-negative": "due_now|2026-07-21|2026-07-21|day",
};

const activeRules = GUIDELINE_RULE_SEEDS.filter((rule) => rule.reviewStatus === "active");
const scenarios = buildRuleSeedScenarios(activeRules);

function outcomeFingerprint(input: (typeof scenarios)[number]["input"]): string {
  const recommendations = evaluateCarePlan(input);
  expect(recommendations).toHaveLength(1);
  const recommendation = recommendations[0];
  if (recommendation === undefined) throw new Error("Expected one catalog recommendation.");
  const dueRange = recommendation.dueRange;
  return `${recommendation.status}|${dueRange?.start ?? "-"}|${dueRange?.end ?? "-"}|${dueRange?.precision ?? "-"}`;
}

describe("active seeded rule scenarios", () => {
  it("has executable positive, negative, and per-method coverage", () => {
    expect(new Set(scenarios.map((scenario) => scenario.id)).size).toBe(scenarios.length);
    expect(Object.keys(expectedOutcomes).sort()).toEqual(
      scenarios.map((scenario) => scenario.id).sort(),
    );

    for (const rule of activeRules) {
      const ruleScenarios = scenarios.filter((scenario) => scenario.stableKey === rule.stableKey);
      expect(
        ruleScenarios.filter((scenario) => scenario.polarity === "positive"),
        `${rule.stableKey} positive scenario`,
      ).toHaveLength(1);
      expect(
        ruleScenarios.filter((scenario) => scenario.polarity === "negative"),
        `${rule.stableKey} negative scenario`,
      ).toHaveLength(1);
      for (const scenario of ruleScenarios) expect(rule.scenarioIds).toContain(scenario.id);

      if (rule.schedule.kind === "method_dependent") {
        expect(
          ruleScenarios
            .filter((scenario) => scenario.polarity === "method")
            .map((scenario) => scenario.methodId)
            .sort(),
          `${rule.stableKey} method scenarios`,
        ).toEqual(rule.schedule.methods.map((method) => method.methodId).sort());
      }
    }
  });

  it.each(scenarios)("$id has the reviewed deterministic status and due range", (scenario) => {
    const first = evaluateCarePlan(scenario.input);
    const second = evaluateCarePlan(scenario.input);
    expect(second).toEqual(first);
    expect(first[0]?.stableKey).toBe(scenario.stableKey);
    expect(first[0]?.debugTrace?.appliesWhen.result).toBe(
      scenario.polarity === "negative" ? false : true,
    );
    expect(outcomeFingerprint(scenario.input)).toBe(expectedOutcomes[scenario.id]);
  });
});
