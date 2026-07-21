import type { RecommendationStatus } from "@/contracts";
import { describe, expect, it } from "vitest";
import { determineRecommendationStatus, highestPrecedenceStatus, timingStatus } from "./status";
import type { ScheduleCalculation } from "./types";

const baseSchedule: ScheduleCalculation = {
  dueRange: { start: "2026-10-01", end: "2026-10-01", precision: "day" },
  generalGuidelineDueRange: { start: "2026-10-01", end: "2026-10-01", precision: "day" },
  lastQualifyingEvent: null,
  completedOnce: false,
  historyStatus: "none",
  rangeRepresentsUncertainty: false,
  currentSeasonComplete: false,
  doseSeriesComplete: false,
  routineSatisfied: false,
  tokens: [],
  trace: [],
};

describe("timing status", () => {
  it.each<{
    label: string;
    range: ScheduleCalculation["dueRange"];
    asOf: string;
    uncertain: boolean;
    expected: RecommendationStatus;
  }>([
    {
      label: "future",
      range: { start: "2027-07-21", end: "2027-07-21", precision: "day" },
      asOf: "2026-07-21",
      uncertain: false,
      expected: "future",
    },
    {
      label: "due this year",
      range: { start: "2026-12-31", end: "2026-12-31", precision: "day" },
      asOf: "2026-07-21",
      uncertain: false,
      expected: "due_this_year",
    },
    {
      label: "due soon",
      range: { start: "2026-09-01", end: "2026-09-01", precision: "day" },
      asOf: "2026-07-21",
      uncertain: false,
      expected: "due_soon",
    },
    {
      label: "due now",
      range: { start: "2026-07-01", end: "2026-07-31", precision: "month" },
      asOf: "2026-07-21",
      uncertain: false,
      expected: "due_now",
    },
    {
      label: "overdue",
      range: { start: "2026-01-01", end: "2026-01-01", precision: "day" },
      asOf: "2026-07-21",
      uncertain: false,
      expected: "overdue",
    },
    {
      label: "up to date before earliest approximate due date",
      range: { start: "2027-01-01", end: "2027-12-31", precision: "year" },
      asOf: "2026-07-21",
      uncertain: true,
      expected: "up_to_date",
    },
    {
      label: "confirmation needed inside approximate due range",
      range: { start: "2026-01-01", end: "2026-12-31", precision: "year" },
      asOf: "2026-07-21",
      uncertain: true,
      expected: "needs_date_confirmation",
    },
  ])("assigns $label", ({ range, asOf, uncertain, expected }) => {
    if (range === null) throw new Error("Test range is required.");
    expect(timingStatus(range, asOf, "evidence_based", uncertain)).toBe(expected);
  });

  it("uses a 180-day planning threshold only in extra-attentive mode", () => {
    const range = { start: "2027-01-01", end: "2027-01-01", precision: "day" } as const;
    expect(timingStatus(range, "2026-07-21", "evidence_based", false)).toBe("future");
    expect(timingStatus(range, "2026-07-21", "extra_attentive", false)).toBe("due_soon");
  });
});

describe("status precedence", () => {
  const base = {
    applies: true as const,
    excluded: false as const,
    stopped: false as const,
    recommendationClass: "routine" as const,
    schedule: baseSchedule,
    asOfDate: "2026-07-21",
    carePlanMode: "evidence_based" as const,
    individualizedHistory: false,
    managedOverride: false,
    personalTimingOverride: false,
  };

  it.each([
    ["not_applicable", { applies: false as const }],
    ["not_routinely_recommended", { recommendationClass: "not-recommended" as const }],
    ["clinician_managed", { individualizedHistory: true }],
    ["completed_once", { schedule: { ...baseSchedule, completedOnce: true } }],
    ["discuss_with_clinician", { recommendationClass: "shared-decision" as const }],
    ["unknown_history", { schedule: { ...baseSchedule, historyStatus: "unknown" as const } }],
    [
      "needs_date_confirmation",
      { schedule: { ...baseSchedule, historyStatus: "needs_confirmation" as const } },
    ],
  ] as const)("assigns %s before ordinary timing", (expected, changes) => {
    expect(determineRecommendationStatus({ ...base, ...changes })).toBe(expected);
  });

  it("uses the normative precedence ordering when several candidate statuses exist", () => {
    expect(highestPrecedenceStatus(["future", "overdue", "clinician_managed"])).toBe(
      "clinician_managed",
    );
  });
});
