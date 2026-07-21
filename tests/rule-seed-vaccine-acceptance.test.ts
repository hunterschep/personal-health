import type { DatePrecision, RecommendationStatus } from "@/contracts";
import { evaluateCarePlan } from "@/domain/rules/evaluator";
import type { CarePlanEvaluationInput, NormalizedCareEvent } from "@/domain/rules/types";
import { describe, expect, it } from "vitest";

import { buildRuleSeedInput } from "./support/rule-seed-scenarios";

const AS_OF_DATE = "2026-10-15";
const CURRENT_SEASON = ["2026-09-01", "2027-06-30"] as const;
const NEXT_SEASON = ["2027-09-01", "2028-06-30"] as const;

const matrixStates = [
  "never_vaccinated",
  "partial_series",
  "completed_series",
  "unknown_dates",
  "age_transition",
  "relevant_condition",
  "minimum_interval_violation",
  "approximate_year_dose",
] as const;
type VaccineState = (typeof matrixStates)[number];

type ExpectedOutcome = {
  status: RecommendationStatus;
  start: string | null;
  end: string | null;
  precision: DatePrecision | null;
};

type VaccineConfig = {
  vaccine: string;
  stableKey: string;
  age: number;
  transitionStableKey?: string;
  transitionAge: number;
  relevantStableKey?: string;
  relevantAge?: number;
  completedDates?: string[];
  expected: Record<VaccineState, ExpectedOutcome>;
};

type VaccineScenario = {
  id: string;
  vaccine: string;
  state: VaccineState | "current_season";
  stableKey: string;
  input: CarePlanEvaluationInput;
  expected: ExpectedOutcome;
};

function outcome(
  status: RecommendationStatus,
  start: string | null,
  end: string | null = start,
  precision: DatePrecision | null = start === null ? null : "day",
): ExpectedOutcome {
  return { status, start, end, precision };
}

function ruleFor(input: CarePlanEvaluationInput) {
  const rule = input.guidelineRules[0];
  if (rule === undefined) throw new Error("Expected one seeded vaccine rule.");
  return rule;
}

function doseEvent(
  input: CarePlanEvaluationInput,
  changes: Partial<NormalizedCareEvent> = {},
): NormalizedCareEvent {
  const rule = ruleFor(input);
  return {
    id: `vaccine-scenario-event-${changes.id ?? "dose"}`,
    profileId: input.profile.id,
    serviceId: rule.serviceId,
    eventType: rule.completionEventTypes[0] ?? "immunization",
    methodId: rule.allowedMethods?.[0] ?? null,
    performedStart: "2026-01-15",
    performedEnd: "2026-01-15",
    datePrecision: "day",
    result: "normal",
    seriesKey: rule.schedule.kind === "dose_series" ? rule.schedule.seriesKey : null,
    doseOrdinal: null,
    ...changes,
  };
}

function inputFor(stableKey: string, age: number): CarePlanEvaluationInput {
  return buildRuleSeedInput(stableKey, { age, asOfDate: AS_OF_DATE });
}

function withEvents(
  input: CarePlanEvaluationInput,
  events: NormalizedCareEvent[],
): CarePlanEvaluationInput {
  return { ...input, careEvents: events };
}

function completedInput(input: CarePlanEvaluationInput, dates: string[]): CarePlanEvaluationInput {
  const rule = ruleFor(input);
  if (rule.schedule.kind === "seasonal") {
    return withEvents(input, [
      doseEvent(input, {
        id: "current-season",
        performedStart: "2026-10-01",
        performedEnd: "2026-10-01",
      }),
    ]);
  }
  if (rule.schedule.kind === "dose_series") {
    return withEvents(
      input,
      dates.map((date, index) =>
        doseEvent(input, {
          id: `complete-${index + 1}`,
          performedStart: date,
          performedEnd: date,
          doseOrdinal: index + 1,
        }),
      ),
    );
  }
  return withEvents(input, [
    doseEvent(input, {
      id: "complete",
      performedStart: "2026-01-15",
      performedEnd: "2026-01-15",
    }),
  ]);
}

function partialInput(vaccine: string, input: CarePlanEvaluationInput): CarePlanEvaluationInput {
  if (vaccine === "influenza") {
    return withEvents(input, [
      doseEvent(input, {
        id: "prior-season",
        performedStart: "2025-10-15",
        performedEnd: "2025-10-15",
      }),
    ]);
  }
  if (vaccine === "tdap_td" || vaccine === "rsv") {
    return withEvents(input, [doseEvent(input, { id: "uncertain-dose", result: "unknown" })]);
  }
  if (vaccine === "pneumococcal") {
    return withEvents(input, [doseEvent(input, { id: "other-product", methodId: "dose-record" })]);
  }
  return withEvents(input, [doseEvent(input, { id: "first-dose", doseOrdinal: 1 })]);
}

function unknownDateInput(input: CarePlanEvaluationInput): CarePlanEvaluationInput {
  return withEvents(input, [
    doseEvent(input, {
      id: "unknown-date",
      performedStart: null,
      performedEnd: null,
      datePrecision: "unknown",
      doseOrdinal: 1,
    }),
  ]);
}

function minimumIntervalInput(input: CarePlanEvaluationInput): CarePlanEvaluationInput {
  const rule = ruleFor(input);
  if (rule.schedule.kind === "seasonal") {
    return withEvents(input, [
      doseEvent(input, {
        id: "season-dose-1",
        performedStart: "2026-10-01",
        performedEnd: "2026-10-01",
      }),
      doseEvent(input, {
        id: "season-dose-2",
        performedStart: "2026-10-02",
        performedEnd: "2026-10-02",
      }),
    ]);
  }
  return withEvents(input, [
    doseEvent(input, { id: "interval-dose-1", doseOrdinal: 1 }),
    doseEvent(input, {
      id: "interval-dose-2",
      performedStart: "2026-01-16",
      performedEnd: "2026-01-16",
      doseOrdinal: rule.schedule.kind === "dose_series" ? 2 : null,
    }),
  ]);
}

function approximateYearInput(input: CarePlanEvaluationInput): CarePlanEvaluationInput {
  return withEvents(input, [
    doseEvent(input, {
      id: "year-only-dose",
      performedStart: "2025-01-01",
      performedEnd: "2025-12-31",
      datePrecision: "year",
      doseOrdinal: 1,
    }),
  ]);
}

const configs: VaccineConfig[] = [
  {
    vaccine: "influenza",
    stableKey: "influenza-cdc-seasonal-adult",
    age: 40,
    transitionAge: 19,
    expected: {
      never_vaccinated: outcome("due_now", ...CURRENT_SEASON, "month"),
      partial_series: outcome("due_now", ...CURRENT_SEASON, "month"),
      completed_series: outcome("up_to_date", ...NEXT_SEASON, "month"),
      unknown_dates: outcome("needs_date_confirmation", ...CURRENT_SEASON, "month"),
      age_transition: outcome("due_now", ...CURRENT_SEASON, "month"),
      relevant_condition: outcome("due_now", ...CURRENT_SEASON, "month"),
      minimum_interval_violation: outcome("up_to_date", ...NEXT_SEASON, "month"),
      approximate_year_dose: outcome("due_now", ...CURRENT_SEASON, "month"),
    },
  },
  {
    vaccine: "covid_19",
    stableKey: "covid-cdc-current-guidance-discussion",
    age: 40,
    transitionAge: 19,
    expected: Object.fromEntries(
      matrixStates.map((state) => [state, outcome("discuss_with_clinician", null)]),
    ) as Record<VaccineState, ExpectedOutcome>,
  },
  {
    vaccine: "tdap_td",
    stableKey: "tdap-td-cdc-primary-and-ten-year-booster",
    age: 40,
    transitionAge: 19,
    completedDates: ["2026-01-15"],
    expected: {
      never_vaccinated: outcome("due_now", AS_OF_DATE),
      partial_series: outcome("needs_date_confirmation", null),
      completed_series: outcome("future", "2036-01-15"),
      unknown_dates: outcome("needs_date_confirmation", null),
      age_transition: outcome("due_now", AS_OF_DATE),
      relevant_condition: outcome("due_now", AS_OF_DATE),
      minimum_interval_violation: outcome("future", "2036-01-15"),
      approximate_year_dose: outcome("up_to_date", "2035-01-01", "2035-12-31", "year"),
    },
  },
  {
    vaccine: "zoster",
    stableKey: "zoster-cdc-two-dose-50-plus",
    age: 50,
    transitionAge: 50,
    relevantStableKey: "zoster-cdc-immunocompromised-19-49",
    relevantAge: 40,
    completedDates: ["2026-01-15", "2026-03-15"],
    expected: {
      never_vaccinated: outcome("due_now", AS_OF_DATE),
      partial_series: outcome("overdue", "2026-03-15"),
      completed_series: outcome("completed_once", null),
      unknown_dates: outcome("needs_date_confirmation", null),
      age_transition: outcome("due_now", AS_OF_DATE),
      relevant_condition: outcome("discuss_with_clinician", AS_OF_DATE),
      minimum_interval_violation: outcome("overdue", "2026-03-15"),
      approximate_year_dose: outcome("overdue", "2025-03-01", "2026-02-28", "year"),
    },
  },
  {
    vaccine: "pneumococcal",
    stableKey: "pneumococcal-cdc-age-50-plus-review",
    age: 50,
    transitionAge: 50,
    relevantStableKey: "pneumococcal-cdc-risk-review-19-49",
    relevantAge: 40,
    expected: {
      never_vaccinated: outcome("discuss_with_clinician", AS_OF_DATE),
      partial_series: outcome("discuss_with_clinician", AS_OF_DATE),
      completed_series: outcome("completed_once", null),
      unknown_dates: outcome("completed_once", null),
      age_transition: outcome("discuss_with_clinician", AS_OF_DATE),
      relevant_condition: outcome("discuss_with_clinician", null),
      minimum_interval_violation: outcome("completed_once", null),
      approximate_year_dose: outcome("completed_once", null),
    },
  },
  {
    vaccine: "rsv",
    stableKey: "rsv-cdc-routine-75-plus",
    age: 75,
    transitionAge: 75,
    relevantStableKey: "rsv-cdc-increased-risk-60-74",
    relevantAge: 65,
    expected: {
      never_vaccinated: outcome("due_now", AS_OF_DATE),
      partial_series: outcome("needs_date_confirmation", null),
      completed_series: outcome("completed_once", null),
      unknown_dates: outcome("completed_once", null),
      age_transition: outcome("due_now", AS_OF_DATE),
      relevant_condition: outcome("discuss_with_clinician", "2021-10-15"),
      minimum_interval_violation: outcome("completed_once", null),
      approximate_year_dose: outcome("completed_once", null),
    },
  },
  {
    vaccine: "hpv",
    stableKey: "hpv-cdc-routine-through-26",
    age: 19,
    transitionStableKey: "hpv-cdc-shared-decision-27-45",
    transitionAge: 27,
    completedDates: ["2026-01-15", "2026-03-15", "2026-07-15"],
    expected: {
      never_vaccinated: outcome("due_now", AS_OF_DATE),
      partial_series: outcome("overdue", "2026-03-15"),
      completed_series: outcome("completed_once", null),
      unknown_dates: outcome("needs_date_confirmation", null),
      age_transition: outcome("discuss_with_clinician", AS_OF_DATE),
      relevant_condition: outcome("due_now", AS_OF_DATE),
      minimum_interval_violation: outcome("overdue", "2026-03-15"),
      approximate_year_dose: outcome("overdue", "2025-03-01", "2026-02-28", "year"),
    },
  },
  {
    vaccine: "hepatitis_a",
    stableKey: "hepatitis-a-cdc-risk-or-request",
    age: 40,
    transitionAge: 19,
    completedDates: ["2026-01-15", "2026-07-15"],
    expected: {
      never_vaccinated: outcome("discuss_with_clinician", AS_OF_DATE),
      partial_series: outcome("discuss_with_clinician", "2026-07-15"),
      completed_series: outcome("completed_once", null),
      unknown_dates: outcome("discuss_with_clinician", null),
      age_transition: outcome("discuss_with_clinician", AS_OF_DATE),
      relevant_condition: outcome("discuss_with_clinician", AS_OF_DATE),
      minimum_interval_violation: outcome("discuss_with_clinician", "2026-07-15"),
      approximate_year_dose: outcome("discuss_with_clinician", "2025-07-01", "2026-06-30", "year"),
    },
  },
  {
    vaccine: "hepatitis_b",
    stableKey: "hepatitis-b-cdc-routine-19-59",
    age: 40,
    transitionStableKey: "hepatitis-b-cdc-60-plus-risk-or-request",
    transitionAge: 60,
    relevantStableKey: "hepatitis-b-cdc-60-plus-risk-or-request",
    relevantAge: 65,
    completedDates: ["2026-01-15", "2026-02-15", "2026-07-15"],
    expected: {
      never_vaccinated: outcome("due_now", AS_OF_DATE),
      partial_series: outcome("overdue", "2026-02-15"),
      completed_series: outcome("completed_once", null),
      unknown_dates: outcome("needs_date_confirmation", null),
      age_transition: outcome("discuss_with_clinician", null),
      relevant_condition: outcome("discuss_with_clinician", null),
      minimum_interval_violation: outcome("overdue", "2026-02-15"),
      approximate_year_dose: outcome("overdue", "2025-02-01", "2026-01-31", "year"),
    },
  },
  {
    vaccine: "mmr",
    stableKey: "mmr-cdc-evidence-of-immunity-review",
    age: 40,
    transitionAge: 19,
    completedDates: ["2026-01-15", "2026-02-15"],
    expected: {
      never_vaccinated: outcome("discuss_with_clinician", AS_OF_DATE),
      partial_series: outcome("discuss_with_clinician", "2026-02-12"),
      completed_series: outcome("completed_once", null),
      unknown_dates: outcome("discuss_with_clinician", null),
      age_transition: outcome("discuss_with_clinician", AS_OF_DATE),
      relevant_condition: outcome("discuss_with_clinician", AS_OF_DATE),
      minimum_interval_violation: outcome("discuss_with_clinician", "2026-02-12"),
      approximate_year_dose: outcome("discuss_with_clinician", "2025-01-29", "2026-01-28", "year"),
    },
  },
  {
    vaccine: "varicella",
    stableKey: "varicella-cdc-no-evidence-immunity-review",
    age: 40,
    transitionAge: 19,
    completedDates: ["2026-01-15", "2026-02-15"],
    expected: {
      never_vaccinated: outcome("discuss_with_clinician", AS_OF_DATE),
      partial_series: outcome("discuss_with_clinician", "2026-02-12"),
      completed_series: outcome("completed_once", null),
      unknown_dates: outcome("discuss_with_clinician", null),
      age_transition: outcome("discuss_with_clinician", AS_OF_DATE),
      relevant_condition: outcome("discuss_with_clinician", AS_OF_DATE),
      minimum_interval_violation: outcome("discuss_with_clinician", "2026-02-12"),
      approximate_year_dose: outcome("discuss_with_clinician", "2025-01-29", "2026-01-28", "year"),
    },
  },
];

function scenarioInput(config: VaccineConfig, state: VaccineState): CarePlanEvaluationInput {
  if (state === "age_transition") {
    return inputFor(config.transitionStableKey ?? config.stableKey, config.transitionAge);
  }
  if (state === "relevant_condition") {
    const input = inputFor(
      config.relevantStableKey ?? config.stableKey,
      config.relevantAge ?? config.age,
    );
    if (config.relevantStableKey !== undefined) return input;
    return {
      ...input,
      riskFactors: [
        ...input.riskFactors,
        { id: `${config.vaccine}-condition`, type: "immunocompromised", value: { value: "yes" } },
      ],
      conditions: [...input.conditions, { code: "chronic_liver_disease", status: "active" }],
    };
  }

  const input = inputFor(config.stableKey, config.age);
  switch (state) {
    case "never_vaccinated":
      return input;
    case "partial_series":
      return partialInput(config.vaccine, input);
    case "completed_series":
      return completedInput(input, config.completedDates ?? []);
    case "unknown_dates":
      return unknownDateInput(input);
    case "minimum_interval_violation":
      return minimumIntervalInput(input);
    case "approximate_year_dose":
      return approximateYearInput(input);
  }
}

const matrixScenarios: VaccineScenario[] = configs.flatMap((config) =>
  matrixStates.map((state) => {
    const input = scenarioInput(config, state);
    return {
      id: `${config.vaccine}-${state.replaceAll("_", "-")}`,
      vaccine: config.vaccine,
      state,
      stableKey: ruleFor(input).stableKey,
      input,
      expected: config.expected[state],
    };
  }),
);

const influenzaSeasonal = inputFor("influenza-cdc-seasonal-adult", 40);
const covidSeasonal = inputFor("covid-cdc-current-guidance-discussion", 40);
const seasonalScenarios: VaccineScenario[] = [
  {
    id: "influenza-current-season",
    vaccine: "influenza",
    state: "current_season",
    stableKey: "influenza-cdc-seasonal-adult",
    input: completedInput(influenzaSeasonal, []),
    expected: outcome("up_to_date", ...NEXT_SEASON, "month"),
  },
  {
    id: "covid-19-current-season",
    vaccine: "covid_19",
    state: "current_season",
    stableKey: "covid-cdc-current-guidance-discussion",
    input: completedInput(covidSeasonal, []),
    expected: outcome("discuss_with_clinician", null),
  },
];

const scenarios = [...matrixScenarios, ...seasonalScenarios];

describe("reviewed vaccine seed acceptance matrix", () => {
  it("covers every vaccine across the required history matrix", () => {
    expect(configs.map((config) => config.vaccine)).toEqual([
      "influenza",
      "covid_19",
      "tdap_td",
      "zoster",
      "pneumococcal",
      "rsv",
      "hpv",
      "hepatitis_a",
      "hepatitis_b",
      "mmr",
      "varicella",
    ]);
    for (const config of configs) {
      expect(
        matrixScenarios
          .filter((scenario) => scenario.vaccine === config.vaccine)
          .map((scenario) => scenario.state),
      ).toEqual(matrixStates);
    }
    expect(new Set(scenarios.map((scenario) => scenario.id)).size).toBe(90);
    expect(scenarios).toHaveLength(90);
  });

  it.each(scenarios)("$id", ({ stableKey, input, expected: expectedOutcome }) => {
    const first = evaluateCarePlan(input);
    const second = evaluateCarePlan(input);
    expect(second).toEqual(first);
    expect(first).toHaveLength(1);
    const recommendation = first[0];
    expect(recommendation?.stableKey).toBe(stableKey);
    expect(recommendation?.status).toBe(expectedOutcome.status);
    expect(recommendation?.dueRange?.start ?? null).toBe(expectedOutcome.start);
    expect(recommendation?.dueRange?.end ?? null).toBe(expectedOutcome.end);
    expect(recommendation?.dueRange?.precision ?? null).toBe(expectedOutcome.precision);
  });
});
