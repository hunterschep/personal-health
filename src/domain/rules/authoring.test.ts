import type { Schedule } from "@/contracts";
import { describe, expect, it } from "vitest";
import {
  ageBasedSchedule,
  ageBetween,
  all,
  anatomyIs,
  any,
  assertRuleMayBeMutated,
  cloneRuleVersion,
  conditionPresent,
  customSchedule,
  defineRule,
  doseSeriesSchedule,
  intervalSchedule,
  methodDependentSchedule,
  not,
  oneTimeSchedule,
  priorEventExists,
  riskEquals,
  riskNumber,
  seasonalSchedule,
  sharedDecisionSchedule,
  validateRuleDefinition,
  validateRuleSet,
} from "./authoring";
import { ruleFixture } from "./__tests__/fixtures";

describe("rule authoring validation", () => {
  it("builds typed serializable expressions and schedules without hidden execution", () => {
    expect(
      all(
        ageBetween(45, 75),
        anatomyIs("cervix", "present"),
        any(
          riskEquals("tobacco_use", "status", "current"),
          riskNumber("tobacco_use", "packYears", "gte", 20),
        ),
        not(conditionPresent("prior-cancer")),
        priorEventExists("service", { methodIds: ["method"], resultIn: ["normal"] }),
      ),
    ).toMatchObject({ op: "all", children: expect.any(Array) });
    expect(ageBasedSchedule({ startAge: 45 })).toEqual({ kind: "age_based", startAge: 45 });
    expect(intervalSchedule({ unit: "years", value: 1 })).toMatchObject({ kind: "interval" });
    expect(
      methodDependentSchedule([
        {
          methodId: "method",
          interval: { unit: "years", value: 10 },
          qualifyingResults: ["normal"],
        },
      ]),
    ).toMatchObject({ kind: "method_dependent" });
    expect(oneTimeSchedule()).toEqual({ kind: "one_time", dueOnEligibility: true });
    expect(seasonalSchedule(9, 2)).toMatchObject({ kind: "seasonal" });
    expect(doseSeriesSchedule("series", [{ ordinal: 1 }])).toMatchObject({
      kind: "dose_series",
    });
    expect(sharedDecisionSchedule({ startAge: 55 })).toMatchObject({
      kind: "shared_decision",
    });
    expect(customSchedule()).toEqual({
      kind: "custom",
      requiresUserOrClinicianCadence: true,
    });
  });

  it("round-trips every schedule kind through serializable validated JSON", () => {
    const schedules: Schedule[] = [
      {
        kind: "age_based",
        startAge: 45,
        stopAge: 75,
        interval: { unit: "years", value: 10 },
        initialDue: "on_eligibility",
      },
      {
        kind: "interval",
        interval: { unit: "years", value: 1 },
        anchor: "last_qualifying_event",
      },
      { kind: "one_time", dueOnEligibility: true },
      { kind: "seasonal", seasonStartMonth: 9, seasonEndMonth: 2, repeatsAnnually: true },
      {
        kind: "method_dependent",
        defaultMethodPrompt: true,
        methods: [
          {
            methodId: "method-1",
            interval: { unit: "years", value: 10 },
            qualifyingResults: ["normal"],
          },
        ],
      },
      {
        kind: "dose_series",
        seriesKey: "series",
        doses: [
          { ordinal: 1 },
          {
            ordinal: 2,
            minimumIntervalFromPrior: { unit: "weeks", value: 4 },
            recommendedIntervalFromPrior: { unit: "months", value: 2 },
          },
        ],
      },
      { kind: "shared_decision", startAge: 55, stopAge: 69 },
      { kind: "custom", requiresUserOrClinicianCadence: true },
    ];

    for (const [index, schedule] of schedules.entries()) {
      const definition = defineRule(
        ruleFixture(schedule, {
          stableKey: `schedule-${index}`,
          id: `runtime-${index}`,
          allowedMethods:
            schedule.kind === "method_dependent"
              ? schedule.methods.map((method) => method.methodId)
              : null,
        }),
      );
      expect(JSON.parse(JSON.stringify(definition)).schedule).toEqual(schedule);
    }
  });

  it("rejects unsafe risk paths and empty boolean nodes", () => {
    const invalidPath = ruleFixture(
      { kind: "one_time", dueOnEligibility: true },
      {
        appliesWhen: {
          op: "risk_equals",
          type: "tobacco_use",
          path: "__proto__.polluted",
          value: true,
        },
      },
    );
    expect(validateRuleDefinition(invalidPath)).toMatchObject({ ok: false });
    expect(() => all()).toThrow(RangeError);
  });

  it("rejects incoherent age, method, dose, and effective-date definitions", () => {
    const invalid = [
      ruleFixture({ kind: "age_based", startAge: 80, stopAge: 40 }),
      ruleFixture({
        kind: "method_dependent",
        defaultMethodPrompt: true,
        methods: [
          {
            methodId: "same",
            interval: { unit: "years", value: 1 },
            qualifyingResults: ["normal"],
          },
          {
            methodId: "same",
            interval: { unit: "years", value: 2 },
            qualifyingResults: ["normal"],
          },
        ],
      }),
      ruleFixture({
        kind: "dose_series",
        seriesKey: "series",
        doses: [{ ordinal: 1 }, { ordinal: 3 }],
      }),
      ruleFixture(
        { kind: "one_time", dueOnEligibility: true },
        { effectiveFrom: "2026-01-01", effectiveTo: "2025-01-01" },
      ),
    ];
    invalid.forEach((rule) => expect(validateRuleDefinition(rule).ok).toBe(false));
  });

  it("enforces immutable active versions and creates a draft successor", () => {
    const active = ruleFixture({ kind: "one_time", dueOnEligibility: true });
    expect(() => assertRuleMayBeMutated(active)).toThrow(/immutable/);
    expect(cloneRuleVersion(active)).toMatchObject({
      stableKey: active.stableKey,
      version: 2,
      reviewStatus: "draft",
    });
  });

  it("accepts segmented baseline rules but rejects a different baseline variant", () => {
    const baselineA = ruleFixture(
      { kind: "one_time", dueOnEligibility: true },
      { stableKey: "variant-a", conflictGroup: "group", variantId: "a", baseline: true },
    );
    const baselineASegment = ruleFixture(
      { kind: "one_time", dueOnEligibility: true },
      {
        id: "variant-a-segment",
        stableKey: "variant-a-segment",
        conflictGroup: "group",
        variantId: "a",
        baseline: true,
      },
    );
    const baselineB = ruleFixture(
      { kind: "one_time", dueOnEligibility: true },
      { stableKey: "variant-b", conflictGroup: "group", variantId: "b", baseline: true },
    );
    expect(validateRuleSet([baselineA, baselineASegment])).toEqual([]);
    expect(validateRuleSet([baselineA, baselineB])).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: "conflictGroups.group" })]),
    );
  });

  it("rejects overlapping active versions", () => {
    const versionTwo = ruleFixture(
      { kind: "one_time", dueOnEligibility: true },
      { id: "v2", version: 2, effectiveFrom: "2025-01-01" },
    );
    expect(
      validateRuleSet([ruleFixture({ kind: "one_time", dueOnEligibility: true }), versionTwo]),
    ).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: "stableKeys.synthetic-rule" })]),
    );
  });
});
