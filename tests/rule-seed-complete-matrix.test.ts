import { describe, expect, it } from "vitest";

import { addCalendarYears, addDuration } from "@/domain/dates";
import { evaluateCarePlan } from "@/domain/rules";
import type { CarePlanEvaluationInput, NormalizedCareEvent } from "@/domain/rules/types";
import { GUIDELINE_RULE_SEEDS } from "../prisma/seed/rules";
import { buildRuleSeedInput } from "./support/rule-seed-scenarios";

const activeRules = GUIDELINE_RULE_SEEDS.filter((rule) => rule.reviewStatus === "active");

function completionMethod(input: CarePlanEvaluationInput): string | null {
  const rule = input.guidelineRules[0];
  if (rule === undefined) throw new Error("A seed scenario requires one runtime rule.");
  if (rule.schedule.kind === "method_dependent") {
    return rule.schedule.methods[0]?.methodId ?? null;
  }
  return rule.allowedMethods?.[0] ?? null;
}

function normalResult(input: CarePlanEvaluationInput): NormalizedCareEvent["result"] {
  const rule = input.guidelineRules[0];
  if (rule?.schedule.kind !== "method_dependent") return "normal";
  return rule.schedule.methods[0]?.qualifyingResults[0] ?? "normal";
}

function event(
  input: CarePlanEvaluationInput,
  changes: Partial<NormalizedCareEvent> = {},
): NormalizedCareEvent {
  const rule = input.guidelineRules[0];
  if (rule === undefined) throw new Error("A seed scenario requires one runtime rule.");
  return {
    id: "complete-matrix-event-1",
    profileId: input.profile.id,
    serviceId: rule.serviceId,
    eventType: rule.completionEventTypes[0] ?? "screening",
    methodId: completionMethod(input),
    performedStart: input.asOfDate,
    performedEnd: input.asOfDate,
    datePrecision: "day",
    result: normalResult(input),
    seriesKey: rule.schedule.kind === "dose_series" ? rule.schedule.seriesKey : null,
    doseOrdinal: rule.schedule.kind === "dose_series" ? 1 : null,
    ...changes,
  };
}

function completedHistory(input: CarePlanEvaluationInput): NormalizedCareEvent[] {
  const rule = input.guidelineRules[0];
  if (rule?.schedule.kind !== "dose_series") return [event(input)];

  let performedOn = addCalendarYears(input.asOfDate, -2);
  return rule.schedule.doses.map((dose, index) => {
    if (index > 0) {
      const interval = dose.recommendedIntervalFromPrior ?? dose.minimumIntervalFromPrior;
      if (interval !== undefined) performedOn = addDuration(performedOn, interval);
    }
    return event(input, {
      id: `complete-matrix-event-${dose.ordinal}`,
      performedStart: performedOn,
      performedEnd: performedOn,
      doseOrdinal: dose.ordinal,
    });
  });
}

function singleRecommendation(input: CarePlanEvaluationInput) {
  const recommendations = evaluateCarePlan(input);
  expect(recommendations).toHaveLength(1);
  const recommendation = recommendations[0];
  if (recommendation === undefined) throw new Error("Expected one seed recommendation.");
  return recommendation;
}

describe("complete active-rule acceptance matrix", () => {
  it("registers every required scenario class with stable IDs", () => {
    for (const rule of activeRules) {
      for (const suffix of [
        "positive",
        "negative",
        "boundary",
        "historical-completion",
        "uncertainty",
        "abnormal-history",
      ]) {
        expect(rule.scenarioIds, `${rule.stableKey}/${suffix}`).toContain(
          `${rule.stableKey}-${suffix}`,
        );
      }
      if (rule.conflictGroup !== null) {
        expect(rule.scenarioIds, `${rule.stableKey}/variant`).toContain(
          `${rule.stableKey}-variant`,
        );
      }
    }
  });

  it.each(activeRules)(
    "$stableKey executes boundary, history, uncertainty, and abnormal cases",
    (rule) => {
      const base = buildRuleSeedInput(rule.stableKey);
      const boundary = singleRecommendation(base);
      expect(boundary.debugTrace?.appliesWhen.result).toBe(true);

      const historyEvents = completedHistory(base);
      const history = singleRecommendation({ ...base, careEvents: historyEvents });
      expect(history.lastQualifyingEventId).toBe(historyEvents.at(-1)?.id);

      if (
        rule.recommendationClass === "routine" &&
        rule.schedule.kind !== "one_time" &&
        rule.schedule.kind !== "custom" &&
        rule.schedule.kind !== "shared_decision"
      ) {
        const uncertainty = singleRecommendation({
          ...base,
          careEvents: [
            event(base, {
              id: "complete-matrix-uncertain",
              performedStart: null,
              performedEnd: null,
              datePrecision: "unknown",
            }),
          ],
        });
        expect(uncertainty.status).toBe("needs_date_confirmation");
      }

      const abnormal = singleRecommendation({
        ...base,
        careEvents: [event(base, { id: "complete-matrix-abnormal", result: "abnormal" })],
      });
      expect(abnormal.status).toBe("clinician_managed");

      if (rule.conflictGroup !== null) {
        expect(boundary.variantId).toBe(rule.variantId);
        expect(base.selectedVariants).toMatchObject({ [rule.conflictGroup]: rule.variantId });
      }
    },
  );
});
