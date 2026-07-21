import type { DatePrecision, RecommendationStatus } from "@/contracts";
import { evaluateCarePlan } from "@/domain/rules/evaluator";
import type {
  CarePlanEvaluationInput,
  NormalizedCareEvent,
  NormalizedClinicianOverride,
} from "@/domain/rules/types";
import { describe, expect, it } from "vitest";

import { buildRuleSeedInput } from "./support/rule-seed-scenarios";

const AS_OF_DATE = "2026-07-21";

type ExpectedOutcome = {
  status: RecommendationStatus;
  start: string | null;
  end: string | null;
  precision: DatePrecision | null;
};

type CancerScenario = {
  id: string;
  stableKey: string;
  input: CarePlanEvaluationInput;
  expected: ExpectedOutcome;
};

function ruleFor(input: CarePlanEvaluationInput) {
  const rule = input.guidelineRules[0];
  if (rule === undefined) throw new Error("Expected one seeded rule.");
  return rule;
}

function careEvent(
  input: CarePlanEvaluationInput,
  changes: Partial<NormalizedCareEvent> = {},
): NormalizedCareEvent {
  const rule = ruleFor(input);
  return {
    id: `cancer-scenario-event-${changes.id ?? "primary"}`,
    profileId: input.profile.id,
    serviceId: rule.serviceId,
    eventType: rule.completionEventTypes[0] ?? "screening",
    methodId: rule.allowedMethods?.[0] ?? null,
    performedStart: AS_OF_DATE,
    performedEnd: AS_OF_DATE,
    datePrecision: "day",
    result: "normal",
    seriesKey: null,
    doseOrdinal: null,
    ...changes,
  };
}

function withEvents(
  input: CarePlanEvaluationInput,
  ...events: NormalizedCareEvent[]
): CarePlanEvaluationInput {
  return { ...input, careEvents: events };
}

function clinicianIntervalOverride(input: CarePlanEvaluationInput): NormalizedClinicianOverride {
  return {
    id: "cancer-scenario-psa-override",
    profileId: input.profile.id,
    serviceId: ruleFor(input).serviceId,
    methodId: "psa",
    overrideType: "recurring_interval",
    nextDueStart: null,
    nextDueEnd: null,
    interval: { unit: "years", value: 1 },
    replacesGeneralGuideline: true,
    instructionReceivedDate: "2025-07-21",
    active: true,
  };
}

function expected(
  status: RecommendationStatus,
  start: string | null,
  end: string | null = start,
  precision: DatePrecision | null = start === null ? null : "day",
): ExpectedOutcome {
  return { status, start, end, precision };
}

const colorectalNew = buildRuleSeedInput("colorectal-uspstf-average-risk-45-75", {
  age: 45,
  asOfDate: AS_OF_DATE,
});
const colorectalColonoscopy = buildRuleSeedInput("colorectal-uspstf-average-risk-45-75", {
  age: 60,
  asOfDate: AS_OF_DATE,
});
const colorectalFit = buildRuleSeedInput("colorectal-uspstf-average-risk-45-75", {
  age: 60,
  asOfDate: AS_OF_DATE,
});
const colorectalYear = buildRuleSeedInput("colorectal-uspstf-average-risk-45-75", {
  age: 60,
  asOfDate: AS_OF_DATE,
});
const colorectalUnknownMethod = buildRuleSeedInput("colorectal-uspstf-average-risk-45-75", {
  age: 60,
  asOfDate: AS_OF_DATE,
});
const colorectalAbnormal = buildRuleSeedInput("colorectal-uspstf-average-risk-45-75", {
  age: 60,
  asOfDate: AS_OF_DATE,
});
const colorectalSelective = buildRuleSeedInput("colorectal-uspstf-selective-76-85", {
  age: 76,
  asOfDate: AS_OF_DATE,
});
const colorectalCancer = buildRuleSeedInput("colorectal-uspstf-average-risk-45-75", {
  age: 60,
  asOfDate: AS_OF_DATE,
});

const breastNew = buildRuleSeedInput("breast-uspstf-biennial-40-74", {
  age: 40,
  asOfDate: AS_OF_DATE,
});
const breastExact = buildRuleSeedInput("breast-uspstf-biennial-40-74", {
  age: 50,
  asOfDate: AS_OF_DATE,
});
const breastYear = buildRuleSeedInput("breast-uspstf-biennial-40-74", {
  age: 50,
  asOfDate: AS_OF_DATE,
});
const breastSpecialty = buildRuleSeedInput("breast-acs-annual-45-54", {
  age: 50,
  asOfDate: AS_OF_DATE,
});
const breastAbnormal = buildRuleSeedInput("breast-uspstf-biennial-40-74", {
  age: 50,
  asOfDate: AS_OF_DATE,
});
const breastNoTissue = buildRuleSeedInput("breast-uspstf-biennial-40-74", {
  age: 50,
  asOfDate: AS_OF_DATE,
});

const cervicalCytology = buildRuleSeedInput("cervical-uspstf-methods-30-65", {
  age: 40,
  asOfDate: AS_OF_DATE,
});
const cervicalHpv = buildRuleSeedInput("cervical-uspstf-methods-30-65", {
  age: 40,
  asOfDate: AS_OF_DATE,
});
const cervicalCotest = buildRuleSeedInput("cervical-uspstf-methods-30-65", {
  age: 40,
  asOfDate: AS_OF_DATE,
});
const cervicalNoCervix = buildRuleSeedInput("cervical-uspstf-methods-30-65", {
  age: 40,
  asOfDate: AS_OF_DATE,
});
const cervicalHighRisk = buildRuleSeedInput("cervical-uspstf-methods-30-65", {
  age: 40,
  asOfDate: AS_OF_DATE,
});
const cervicalUnknownMethod = buildRuleSeedInput("cervical-uspstf-methods-30-65", {
  age: 40,
  asOfDate: AS_OF_DATE,
});
const cervicalYear = buildRuleSeedInput("cervical-uspstf-methods-30-65", {
  age: 40,
  asOfDate: AS_OF_DATE,
});

const prostateWith = buildRuleSeedInput("prostate-uspstf-shared-decision-55-69", {
  age: 57,
  asOfDate: AS_OF_DATE,
});
const prostateWithout = buildRuleSeedInput("prostate-uspstf-shared-decision-55-69", {
  age: 57,
  asOfDate: AS_OF_DATE,
});
const prostateOlder = buildRuleSeedInput("prostate-uspstf-against-70-plus", {
  age: 70,
  asOfDate: AS_OF_DATE,
});
const prostateOverride = buildRuleSeedInput("prostate-uspstf-shared-decision-55-69", {
  age: 57,
  asOfDate: AS_OF_DATE,
});
const prostateCancer = buildRuleSeedInput("prostate-uspstf-shared-decision-55-69", {
  age: 57,
  asOfDate: AS_OF_DATE,
});

function tobaccoRisk(
  status: "current" | "former",
  started: string,
  ended: string | null,
  packsPerDay: number | null,
) {
  return {
    id: `cancer-scenario-tobacco-${status}`,
    type: "tobacco_use",
    value: {
      status,
      periods: [{ started, ended, startedYear: null, endedYear: null, packsPerDay }],
    },
  };
}

const lungCurrent = buildRuleSeedInput("lung-uspstf-annual-ldct", {
  age: 50,
  asOfDate: AS_OF_DATE,
});
const lungFormerWithin = buildRuleSeedInput("lung-uspstf-annual-ldct", {
  age: 50,
  asOfDate: AS_OF_DATE,
});
const lungFormerOutside = buildRuleSeedInput("lung-uspstf-annual-ldct", {
  age: 60,
  asOfDate: AS_OF_DATE,
});
const lungInsufficient = buildRuleSeedInput("lung-uspstf-annual-ldct", {
  age: 50,
  asOfDate: AS_OF_DATE,
});
const lungMissingPacks = buildRuleSeedInput("lung-uspstf-annual-ldct", {
  age: 50,
  asOfDate: AS_OF_DATE,
});
const lungBoundary = buildRuleSeedInput("lung-uspstf-annual-ldct", {
  age: 80,
  asOfDate: AS_OF_DATE,
});
const lungAbnormal = buildRuleSeedInput("lung-uspstf-annual-ldct", {
  age: 60,
  asOfDate: AS_OF_DATE,
});

const scenarios: CancerScenario[] = [
  {
    id: "colorectal-newly-eligible-no-history",
    stableKey: "colorectal-uspstf-average-risk-45-75",
    input: colorectalNew,
    expected: expected("due_now", AS_OF_DATE),
  },
  {
    id: "colorectal-normal-colonoscopy-five-years-ago",
    stableKey: "colorectal-uspstf-average-risk-45-75",
    input: withEvents(
      colorectalColonoscopy,
      careEvent(colorectalColonoscopy, {
        methodId: "colonoscopy",
        performedStart: "2021-07-21",
        performedEnd: "2021-07-21",
      }),
    ),
    expected: expected("future", "2031-07-21"),
  },
  {
    id: "colorectal-normal-fit-at-annual-interval",
    stableKey: "colorectal-uspstf-average-risk-45-75",
    input: withEvents(
      colorectalFit,
      careEvent(colorectalFit, {
        methodId: "fit",
        performedStart: "2025-07-21",
        performedEnd: "2025-07-21",
      }),
    ),
    expected: expected("due_now", AS_OF_DATE),
  },
  {
    id: "colorectal-year-only-colonoscopy",
    stableKey: "colorectal-uspstf-average-risk-45-75",
    input: withEvents(
      colorectalYear,
      careEvent(colorectalYear, {
        methodId: "colonoscopy",
        performedStart: "2021-01-01",
        performedEnd: "2021-12-31",
        datePrecision: "year",
      }),
    ),
    expected: expected("up_to_date", "2031-01-01", "2031-12-31", "year"),
  },
  {
    id: "colorectal-unknown-method",
    stableKey: "colorectal-uspstf-average-risk-45-75",
    input: withEvents(
      colorectalUnknownMethod,
      careEvent(colorectalUnknownMethod, {
        methodId: null,
        performedStart: "2025-07-21",
        performedEnd: "2025-07-21",
      }),
    ),
    expected: expected("needs_date_confirmation", null),
  },
  {
    id: "colorectal-abnormal-prior-result",
    stableKey: "colorectal-uspstf-average-risk-45-75",
    input: withEvents(
      colorectalAbnormal,
      careEvent(colorectalAbnormal, {
        methodId: "fit",
        performedStart: "2025-07-21",
        performedEnd: "2025-07-21",
        result: "abnormal",
      }),
    ),
    expected: expected("clinician_managed", "2011-07-21"),
  },
  {
    id: "colorectal-selective-older-adult",
    stableKey: "colorectal-uspstf-selective-76-85",
    input: colorectalSelective,
    expected: expected("discuss_with_clinician", AS_OF_DATE, "2036-07-21", "year"),
  },
  {
    id: "colorectal-prior-cancer",
    stableKey: "colorectal-uspstf-average-risk-45-75",
    input: { ...colorectalCancer, conditions: [{ code: "colorectal_cancer", status: "history" }] },
    expected: expected("clinician_managed", "2011-07-21"),
  },
  {
    id: "breast-eligible-no-history",
    stableKey: "breast-uspstf-biennial-40-74",
    input: breastNew,
    expected: expected("due_now", AS_OF_DATE),
  },
  {
    id: "breast-up-to-date-exact-mammogram",
    stableKey: "breast-uspstf-biennial-40-74",
    input: withEvents(
      breastExact,
      careEvent(breastExact, {
        methodId: "mammography",
        performedStart: "2025-07-21",
        performedEnd: "2025-07-21",
      }),
    ),
    expected: expected("future", "2027-07-21"),
  },
  {
    id: "breast-approximate-year-mammogram",
    stableKey: "breast-uspstf-biennial-40-74",
    input: withEvents(
      breastYear,
      careEvent(breastYear, {
        methodId: "mammography",
        performedStart: "2025-01-01",
        performedEnd: "2025-12-31",
        datePrecision: "year",
      }),
    ),
    expected: expected("up_to_date", "2027-01-01", "2027-12-31", "year"),
  },
  {
    id: "breast-selected-specialty-annual-variant",
    stableKey: "breast-acs-annual-45-54",
    input: withEvents(
      breastSpecialty,
      careEvent(breastSpecialty, {
        methodId: "mammography",
        performedStart: "2025-07-21",
        performedEnd: "2025-07-21",
      }),
    ),
    expected: expected("due_now", AS_OF_DATE),
  },
  {
    id: "breast-prior-abnormal-result",
    stableKey: "breast-uspstf-biennial-40-74",
    input: withEvents(
      breastAbnormal,
      careEvent(breastAbnormal, {
        methodId: "mammography",
        performedStart: "2025-07-21",
        performedEnd: "2025-07-21",
        result: "abnormal",
      }),
    ),
    expected: expected("clinician_managed", "2016-07-21"),
  },
  {
    id: "breast-absent-tissue-after-bilateral-mastectomy",
    stableKey: "breast-uspstf-biennial-40-74",
    input: {
      ...breastNoTissue,
      anatomy: [{ key: "breast_tissue", state: "absent" }],
      surgeries: [{ code: "bilateral_mastectomy", performedStart: "2020-01-01" }],
    },
    expected: expected("not_applicable", "2016-07-21"),
  },
  {
    id: "cervical-exact-cytology",
    stableKey: "cervical-uspstf-methods-30-65",
    input: withEvents(
      cervicalCytology,
      careEvent(cervicalCytology, {
        methodId: "cervical-cytology",
        performedStart: "2024-07-21",
        performedEnd: "2024-07-21",
      }),
    ),
    expected: expected("future", "2027-07-21"),
  },
  {
    id: "cervical-primary-hpv",
    stableKey: "cervical-uspstf-methods-30-65",
    input: withEvents(
      cervicalHpv,
      careEvent(cervicalHpv, {
        methodId: "primary-high-risk-hpv",
        performedStart: "2024-07-21",
        performedEnd: "2024-07-21",
      }),
    ),
    expected: expected("future", "2029-07-21"),
  },
  {
    id: "cervical-co-test",
    stableKey: "cervical-uspstf-methods-30-65",
    input: withEvents(
      cervicalCotest,
      careEvent(cervicalCotest, {
        methodId: "co-testing",
        performedStart: "2024-07-21",
        performedEnd: "2024-07-21",
      }),
    ),
    expected: expected("future", "2029-07-21"),
  },
  {
    id: "cervical-no-cervix-no-special-history",
    stableKey: "cervical-uspstf-methods-30-65",
    input: { ...cervicalNoCervix, anatomy: [{ key: "cervix", state: "absent" }] },
    expected: expected("not_applicable", "2016-07-21"),
  },
  {
    id: "cervical-no-cervix-high-risk-history",
    stableKey: "cervical-uspstf-methods-30-65",
    input: {
      ...cervicalHighRisk,
      anatomy: [{ key: "cervix", state: "absent" }],
      conditions: [{ code: "cin2_or_higher", status: "history" }],
    },
    expected: expected("clinician_managed", "2016-07-21"),
  },
  {
    id: "cervical-unknown-method",
    stableKey: "cervical-uspstf-methods-30-65",
    input: withEvents(
      cervicalUnknownMethod,
      careEvent(cervicalUnknownMethod, {
        methodId: null,
        performedStart: "2024-07-21",
        performedEnd: "2024-07-21",
      }),
    ),
    expected: expected("needs_date_confirmation", null),
  },
  {
    id: "cervical-approximate-year-event",
    stableKey: "cervical-uspstf-methods-30-65",
    input: withEvents(
      cervicalYear,
      careEvent(cervicalYear, {
        methodId: "cervical-cytology",
        performedStart: "2024-01-01",
        performedEnd: "2024-12-31",
        datePrecision: "year",
      }),
    ),
    expected: expected("up_to_date", "2027-01-01", "2027-12-31", "year"),
  },
  {
    id: "prostate-age-57-with-prostate",
    stableKey: "prostate-uspstf-shared-decision-55-69",
    input: prostateWith,
    expected: expected("discuss_with_clinician", "2024-07-21", "2039-07-21", "year"),
  },
  {
    id: "prostate-age-57-without-prostate",
    stableKey: "prostate-uspstf-shared-decision-55-69",
    input: { ...prostateWithout, anatomy: [{ key: "prostate", state: "absent" }] },
    expected: expected("not_applicable", "2024-07-21", "2039-07-21", "year"),
  },
  {
    id: "prostate-older-outside-shared-window",
    stableKey: "prostate-uspstf-against-70-plus",
    input: prostateOlder,
    expected: expected("not_routinely_recommended", null),
  },
  {
    id: "prostate-active-clinician-psa-interval",
    stableKey: "prostate-uspstf-shared-decision-55-69",
    input: {
      ...withEvents(
        prostateOverride,
        careEvent(prostateOverride, {
          methodId: "psa",
          performedStart: "2025-07-21",
          performedEnd: "2025-07-21",
        }),
      ),
      clinicianOverrides: [clinicianIntervalOverride(prostateOverride)],
    },
    expected: expected("due_now", AS_OF_DATE),
  },
  {
    id: "prostate-prior-cancer",
    stableKey: "prostate-uspstf-shared-decision-55-69",
    input: { ...prostateCancer, conditions: [{ code: "prostate_cancer", status: "history" }] },
    expected: expected("clinician_managed", "2024-07-21", "2039-07-21", "year"),
  },
  {
    id: "lung-current-smoker-above-threshold",
    stableKey: "lung-uspstf-annual-ldct",
    input: lungCurrent,
    expected: expected("due_now", AS_OF_DATE),
  },
  {
    id: "lung-former-smoker-within-quit-window",
    stableKey: "lung-uspstf-annual-ldct",
    input: {
      ...lungFormerWithin,
      riskFactors: [tobaccoRisk("former", "1986-07-21", "2016-07-21", 1)],
    },
    expected: expected("due_now", AS_OF_DATE),
  },
  {
    id: "lung-former-smoker-outside-quit-window",
    stableKey: "lung-uspstf-annual-ldct",
    input: {
      ...lungFormerOutside,
      riskFactors: [tobaccoRisk("former", "1980-07-21", "2010-07-20", 1)],
    },
    expected: expected("not_applicable", "2016-07-21"),
  },
  {
    id: "lung-insufficient-pack-years",
    stableKey: "lung-uspstf-annual-ldct",
    input: {
      ...lungInsufficient,
      riskFactors: [tobaccoRisk("current", "2016-07-21", null, 1)],
    },
    expected: expected("not_applicable", AS_OF_DATE),
  },
  {
    id: "lung-missing-packs-per-day",
    stableKey: "lung-uspstf-annual-ldct",
    input: {
      ...lungMissingPacks,
      riskFactors: [tobaccoRisk("current", "1996-07-21", null, null)],
    },
    expected: expected("unknown_history", AS_OF_DATE),
  },
  {
    id: "lung-upper-age-boundary",
    stableKey: "lung-uspstf-annual-ldct",
    input: lungBoundary,
    expected: expected("overdue", "1996-07-21"),
  },
  {
    id: "lung-abnormal-prior-ldct",
    stableKey: "lung-uspstf-annual-ldct",
    input: withEvents(
      lungAbnormal,
      careEvent(lungAbnormal, {
        methodId: "low-dose-ct",
        performedStart: "2025-07-21",
        performedEnd: "2025-07-21",
        result: "abnormal",
      }),
    ),
    expected: expected("clinician_managed", "2016-07-21"),
  },
];

describe("reviewed cancer seed acceptance scenarios", () => {
  it("covers every PLAN cancer scenario with a unique deterministic fixture", () => {
    expect(new Set(scenarios.map((scenario) => scenario.id)).size).toBe(33);
    expect(scenarios).toHaveLength(33);
  });

  it.each(scenarios)("$id", ({ stableKey, input, expected: outcome }) => {
    const first = evaluateCarePlan(input);
    const second = evaluateCarePlan(input);
    expect(second).toEqual(first);
    expect(first).toHaveLength(1);
    const recommendation = first[0];
    expect(recommendation?.stableKey).toBe(stableKey);
    expect(recommendation?.status).toBe(outcome.status);
    expect(recommendation?.dueRange?.start ?? null).toBe(outcome.start);
    expect(recommendation?.dueRange?.end ?? null).toBe(outcome.end);
    expect(recommendation?.dueRange?.precision ?? null).toBe(outcome.precision);
  });
});
