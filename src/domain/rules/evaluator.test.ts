import type { Schedule } from "@/contracts";
import { describe, expect, it } from "vitest";
import { evaluateCarePlan } from "./evaluator";
import { eventFixture, inputFixture, profileFixture, ruleFixture } from "./__tests__/fixtures";

function evaluate(schedule: Schedule, inputChanges = {}, ruleChanges = {}) {
  const rule = ruleFixture(schedule, ruleChanges);
  const result = evaluateCarePlan(inputFixture(rule, inputChanges))[0];
  if (result === undefined) throw new Error("Expected one evaluated recommendation.");
  return result;
}

describe("all schedule kinds", () => {
  it("calculates an age-based eligibility date and interval", () => {
    const newlyEligible = evaluate(
      { kind: "age_based", startAge: 45, interval: { unit: "years", value: 5 } },
      { profile: profileFixture({ dateOfBirth: "1981-07-21" }) },
    );
    expect(newlyEligible).toMatchObject({
      status: "due_now",
      dueRange: { start: "2026-07-21", end: "2026-07-21" },
    });

    const withHistory = evaluate(
      { kind: "age_based", startAge: 40, interval: { unit: "years", value: 5 } },
      { careEvents: [eventFixture({ performedStart: "2024-06-01", performedEnd: "2024-06-01" })] },
    );
    expect(withHistory).toMatchObject({
      status: "future",
      dueRange: { start: "2029-06-01", end: "2029-06-01" },
    });
  });

  it("requires history for a last-event interval and supports an eligibility anchor", () => {
    expect(
      evaluate({
        kind: "interval",
        interval: { unit: "years", value: 1 },
        anchor: "last_qualifying_event",
      }),
    ).toMatchObject({ status: "unknown_history", dueRange: null });

    expect(
      evaluate({
        kind: "interval",
        interval: { unit: "years", value: 1 },
        anchor: "eligibility_date",
      }),
    ).toMatchObject({
      status: "future",
      dueRange: { start: "2027-07-21", end: "2027-07-21" },
    });
  });

  it("keeps one-time completion complete even when its date is unknown", () => {
    expect(
      evaluate(
        { kind: "one_time", dueOnEligibility: true },
        {
          careEvents: [
            eventFixture({
              performedStart: null,
              performedEnd: null,
              datePrecision: "unknown",
            }),
          ],
        },
      ),
    ).toMatchObject({ status: "completed_once", dueRange: null });
  });

  it("calculates repeating seasonal windows, including a season across year-end", () => {
    const schedule: Schedule = {
      kind: "seasonal",
      seasonStartMonth: 9,
      seasonEndMonth: 2,
      repeatsAnnually: true,
    };
    expect(evaluate(schedule, { asOfDate: "2026-10-15" })).toMatchObject({
      status: "due_now",
      dueRange: { start: "2026-09-01", end: "2027-02-28" },
    });
    expect(
      evaluate(schedule, {
        asOfDate: "2026-10-15",
        careEvents: [eventFixture({ performedStart: "2026-10-01", performedEnd: "2026-10-01" })],
      }),
    ).toMatchObject({
      status: "up_to_date",
      dueRange: { start: "2027-09-01", end: "2028-02-29" },
    });
  });

  it("supports a non-repeating source season", () => {
    const schedule: Schedule = {
      kind: "seasonal",
      seasonStartMonth: 9,
      seasonEndMonth: 12,
      repeatsAnnually: false,
    };
    expect(evaluate(schedule)).toMatchObject({
      status: "overdue",
      dueRange: { start: "2020-09-01", end: "2020-12-31" },
    });
    expect(
      evaluate(schedule, {
        careEvents: [eventFixture({ performedStart: "2020-10-01", performedEnd: "2020-10-01" })],
      }),
    ).toMatchObject({ status: "completed_once", dueRange: null });
  });

  it("uses the method actually completed and never substitutes another method interval", () => {
    const schedule: Schedule = {
      kind: "method_dependent",
      defaultMethodPrompt: true,
      methods: [
        {
          methodId: "colonoscopy",
          interval: { unit: "years", value: 10 },
          qualifyingResults: ["normal"],
        },
        {
          methodId: "fit",
          interval: { unit: "years", value: 1 },
          qualifyingResults: ["normal"],
        },
      ],
    };
    expect(
      evaluate(
        schedule,
        {
          careEvents: [
            eventFixture({
              methodId: "colonoscopy",
              performedStart: "2021-01-01",
              performedEnd: "2021-01-01",
            }),
          ],
        },
        { allowedMethods: ["colonoscopy", "fit"] },
      ),
    ).toMatchObject({
      status: "future",
      dueRange: { start: "2031-01-01", end: "2031-01-01" },
    });
    expect(
      evaluate(
        schedule,
        {
          careEvents: [
            eventFixture({
              methodId: "fit",
              performedStart: "2025-01-01",
              performedEnd: "2025-01-01",
            }),
          ],
        },
        { allowedMethods: ["colonoscopy", "fit"] },
      ),
    ).toMatchObject({ status: "overdue", dueRange: { start: "2026-01-01" } });
  });

  it("tracks partial dose series, validates minimum intervals, and completes the series", () => {
    const schedule: Schedule = {
      kind: "dose_series",
      seriesKey: "synthetic-series",
      doses: [
        { ordinal: 1 },
        {
          ordinal: 2,
          minimumIntervalFromPrior: { unit: "weeks", value: 4 },
          recommendedIntervalFromPrior: { unit: "months", value: 2 },
        },
      ],
    };
    const first = eventFixture({
      id: "dose-1",
      seriesKey: "synthetic-series",
      doseOrdinal: 1,
      performedStart: "2026-06-01",
      performedEnd: "2026-06-01",
    });
    expect(evaluate(schedule, { careEvents: [first] })).toMatchObject({
      status: "due_soon",
      dueRange: { start: "2026-08-01", end: "2026-08-01" },
    });
    expect(
      evaluate(schedule, {
        careEvents: [
          first,
          eventFixture({
            id: "dose-2",
            seriesKey: "synthetic-series",
            doseOrdinal: 2,
            performedStart: "2026-07-15",
            performedEnd: "2026-07-15",
          }),
        ],
      }),
    ).toMatchObject({ status: "completed_once" });
    expect(
      evaluate(schedule, {
        careEvents: [
          first,
          eventFixture({
            id: "dose-too-early",
            seriesKey: "synthetic-series",
            doseOrdinal: 2,
            performedStart: "2026-06-10",
            performedEnd: "2026-06-10",
          }),
        ],
      }),
    ).not.toMatchObject({ status: "completed_once" });
    expect(
      evaluate(schedule, {
        careEvents: [
          eventFixture({
            id: "dose-unknown-date",
            seriesKey: "synthetic-series",
            doseOrdinal: 1,
            performedStart: null,
            performedEnd: null,
            datePrecision: "unknown",
          }),
        ],
      }),
    ).toMatchObject({ status: "needs_date_confirmation", dueRange: null });
  });

  it("keeps completed series boosters actionable and preserves approximate-dose uncertainty", () => {
    const boosterSchedule: Schedule = {
      kind: "dose_series",
      seriesKey: "booster-series",
      doses: [{ ordinal: 1 }],
      boosters: { interval: { unit: "years", value: 1 } },
    };
    expect(
      evaluate(boosterSchedule, {
        careEvents: [
          eventFixture({
            seriesKey: "booster-series",
            doseOrdinal: 1,
            performedStart: "2025-01-01",
            performedEnd: "2025-01-01",
          }),
        ],
      }),
    ).toMatchObject({ status: "overdue", dueRange: { start: "2026-01-01" } });

    const twoDose: Schedule = {
      kind: "dose_series",
      seriesKey: "two-dose",
      doses: [
        { ordinal: 1 },
        { ordinal: 2, minimumIntervalFromPrior: { unit: "weeks", value: 4 } },
      ],
    };
    expect(
      evaluate(twoDose, {
        careEvents: [
          eventFixture({
            id: "approx-one",
            seriesKey: "two-dose",
            doseOrdinal: 1,
            performedStart: "2025-01-01",
            performedEnd: "2025-12-31",
            datePrecision: "year",
          }),
          eventFixture({
            id: "approx-two",
            seriesKey: "two-dose",
            doseOrdinal: 2,
            performedStart: "2025-01-01",
            performedEnd: "2025-12-31",
            datePrecision: "year",
          }),
        ],
      }),
    ).toMatchObject({ status: "needs_date_confirmation" });
  });

  it("keeps shared decisions and custom cadences as discussions", () => {
    expect(
      evaluate(
        { kind: "shared_decision", startAge: 55, stopAge: 69 },
        { profile: profileFixture({ dateOfBirth: "1969-07-21" }) },
        { recommendationClass: "shared-decision" },
      ),
    ).toMatchObject({ status: "discuss_with_clinician" });
    expect(
      evaluate(
        { kind: "custom", requiresUserOrClinicianCadence: true },
        {},
        { recommendationClass: "custom-maintenance" },
      ),
    ).toMatchObject({ status: "discuss_with_clinician" });
  });

  it.each(["selective", "insufficient-evidence"] as const)(
    "never turns a %s recommendation into an overdue task",
    (recommendationClass) => {
      expect(
        evaluate({ kind: "one_time", dueOnEligibility: true }, {}, { recommendationClass }),
      ).toMatchObject({ status: "discuss_with_clinician" });
    },
  );

  it("keeps a recommendation against routine use out of due timing", () => {
    expect(
      evaluate(
        { kind: "one_time", dueOnEligibility: true },
        {},
        { recommendationClass: "not-recommended" },
      ),
    ).toMatchObject({ status: "not_routinely_recommended" });
  });

  it("represents unknown required anatomy as a profile-information prompt", () => {
    const result = evaluate(
      { kind: "one_time", dueOnEligibility: true },
      { anatomy: [{ key: "cervix", state: "unknown" }] },
      { appliesWhen: { op: "anatomy_is", key: "cervix", state: "present" } },
    );
    expect(result).toMatchObject({ status: "unknown_history" });
    expect(result.matchingFacts).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "profile_fact_needed" })]),
    );
  });

  it("surfaces approaching start ages and applies inclusive stop-age boundaries", () => {
    const schedule: Schedule = { kind: "age_based", startAge: 45, stopAge: 75 };
    const appliesWhen = { op: "age_between" as const, min: 45, max: 75 };
    expect(
      evaluate(
        schedule,
        {
          asOfDate: "2026-07-20",
          profile: profileFixture({ dateOfBirth: "1981-07-21" }),
        },
        { appliesWhen },
      ),
    ).toMatchObject({ status: "due_soon", dueRange: { start: "2026-07-21" } });
    expect(
      evaluate(
        schedule,
        {
          asOfDate: "2026-07-21",
          profile: profileFixture({ dateOfBirth: "1981-07-21" }),
        },
        { appliesWhen },
      ),
    ).toMatchObject({ status: "due_now" });
    expect(
      evaluate(
        schedule,
        {
          asOfDate: "2026-07-20",
          profile: profileFixture({ dateOfBirth: "1950-07-21" }),
        },
        { appliesWhen },
      ).status,
    ).not.toBe("not_routinely_recommended");
    expect(
      evaluate(
        schedule,
        {
          asOfDate: "2026-07-21",
          profile: profileFixture({ dateOfBirth: "1950-07-21" }),
        },
        { appliesWhen },
      ),
    ).toMatchObject({ status: "not_routinely_recommended" });
  });
});

describe("event, uncertainty, and outcome behavior", () => {
  const methodSchedule: Schedule = {
    kind: "method_dependent",
    defaultMethodPrompt: true,
    methods: [
      {
        methodId: "colonoscopy",
        interval: { unit: "years", value: 10 },
        qualifyingResults: ["normal"],
      },
    ],
  };

  it("propagates year-only and month-only history without invented precision", () => {
    expect(
      evaluate(
        methodSchedule,
        {
          asOfDate: "2028-07-01",
          careEvents: [
            eventFixture({
              methodId: "colonoscopy",
              performedStart: "2018-01-01",
              performedEnd: "2018-12-31",
              datePrecision: "year",
            }),
          ],
        },
        { allowedMethods: ["colonoscopy"] },
      ),
    ).toMatchObject({
      status: "needs_date_confirmation",
      dueRange: { start: "2028-01-01", end: "2028-12-31", precision: "year" },
    });
    expect(
      evaluate(
        methodSchedule,
        {
          asOfDate: "2028-07-01",
          careEvents: [
            eventFixture({
              methodId: "colonoscopy",
              performedStart: "2018-07-01",
              performedEnd: "2018-07-31",
              datePrecision: "month",
            }),
          ],
        },
        { allowedMethods: ["colonoscopy"] },
      ),
    ).toMatchObject({
      status: "needs_date_confirmation",
      dueRange: { start: "2028-07-01", end: "2028-07-31", precision: "month" },
    });
  });

  it("moves abnormal or inconclusive history out of the routine pathway", () => {
    for (const result of ["abnormal", "inconclusive"] as const) {
      expect(
        evaluate(
          methodSchedule,
          { careEvents: [eventFixture({ methodId: "colonoscopy", result })] },
          { allowedMethods: ["colonoscopy"] },
        ),
      ).toMatchObject({ status: "clinician_managed" });
    }
  });

  it("ignores future events, deleted events, duplicates, and superseded corrections", () => {
    const schedule: Schedule = { kind: "one_time", dueOnEligibility: true };
    expect(
      evaluate(schedule, {
        careEvents: [eventFixture({ performedStart: "2027-01-01", performedEnd: "2027-01-01" })],
      }),
    ).toMatchObject({ status: "due_now", lastQualifyingEventId: null });
    expect(
      evaluate(schedule, { careEvents: [eventFixture({ deletedAt: "2026-01-01" })] }),
    ).toMatchObject({ status: "due_now", lastQualifyingEventId: null });

    const original = eventFixture({ id: "original" });
    const correction = eventFixture({ id: "correction", correctsEventId: "original" });
    const result = evaluate(schedule, {
      careEvents: [original, correction, { ...correction, id: "duplicate" }],
    });
    expect(result).toMatchObject({ status: "completed_once", lastQualifyingEventId: "correction" });
  });

  it("does not let a future exact event turn method history into a confirmation prompt", () => {
    expect(
      evaluate(
        methodSchedule,
        {
          careEvents: [
            eventFixture({
              methodId: "colonoscopy",
              performedStart: "2027-01-01",
              performedEnd: "2027-01-01",
            }),
          ],
        },
        { allowedMethods: ["colonoscopy"] },
      ).status,
    ).not.toBe("needs_date_confirmation");
  });

  it("does not silently anchor from a known event when another completion has no date", () => {
    expect(
      evaluate(
        methodSchedule,
        {
          careEvents: [
            eventFixture({ id: "known", methodId: "colonoscopy" }),
            eventFixture({
              id: "unknown-date",
              methodId: "colonoscopy",
              performedStart: null,
              performedEnd: null,
              datePrecision: "unknown",
            }),
          ],
        },
        { allowedMethods: ["colonoscopy"] },
      ),
    ).toMatchObject({ status: "needs_date_confirmation" });
  });
});

describe("clinician overrides", () => {
  const schedule: Schedule = {
    kind: "method_dependent",
    defaultMethodPrompt: true,
    methods: [
      { methodId: "method", interval: { unit: "years", value: 10 }, qualifyingResults: ["normal"] },
    ],
  };

  it("makes a replacing exact date the active timing while retaining general context", () => {
    const result = evaluate(
      schedule,
      {
        careEvents: [eventFixture({ methodId: "method" })],
        clinicianOverrides: [
          {
            id: "override-1",
            profileId: "profile-1",
            serviceId: "service-1",
            methodId: null,
            overrideType: "exact_next_date",
            nextDueStart: "2026-08-15",
            nextDueEnd: "2026-08-15",
            interval: null,
            replacesGeneralGuideline: true,
            instructionReceivedDate: "2026-01-01",
            active: true,
          },
        ],
      },
      { allowedMethods: ["method"] },
    );
    expect(result).toMatchObject({
      activeOverrideId: "override-1",
      status: "due_soon",
      dueRange: { start: "2026-08-15", end: "2026-08-15" },
      generalGuidelineDueRange: { start: "2030-07-21", end: "2030-07-21" },
    });
  });

  it("anchors a recurring override to the qualifying event and supports managed instructions", () => {
    const recurring = evaluate(
      schedule,
      {
        careEvents: [
          eventFixture({
            methodId: "method",
            performedStart: "2025-07-01",
            performedEnd: "2025-07-01",
          }),
        ],
        clinicianOverrides: [
          {
            id: "recurring",
            profileId: "profile-1",
            serviceId: "service-1",
            methodId: null,
            overrideType: "recurring_interval",
            nextDueStart: null,
            nextDueEnd: null,
            interval: { unit: "years", value: 1 },
            replacesGeneralGuideline: true,
            instructionReceivedDate: "2025-07-02",
            active: true,
          },
        ],
      },
      { allowedMethods: ["method"] },
    );
    expect(recurring).toMatchObject({ status: "overdue", dueRange: { start: "2026-07-01" } });

    const managed = evaluate(schedule, {
      clinicianOverrides: [
        {
          id: "managed",
          profileId: "profile-1",
          serviceId: "service-1",
          methodId: null,
          overrideType: "no_longer_needed",
          nextDueStart: null,
          nextDueEnd: null,
          interval: null,
          replacesGeneralGuideline: true,
          instructionReceivedDate: "2026-01-01",
          active: true,
        },
      ],
    });
    expect(managed).toMatchObject({ status: "clinician_managed", activeOverrideId: "managed" });
  });

  it("keeps a supplemental personal date separate from baseline timing", () => {
    const result = evaluate(schedule, {
      clinicianOverrides: [
        {
          id: "supplement",
          profileId: "profile-1",
          serviceId: "service-1",
          methodId: null,
          overrideType: "exact_next_date",
          nextDueStart: "2026-09-01",
          nextDueEnd: "2026-09-01",
          interval: null,
          replacesGeneralGuideline: false,
          instructionReceivedDate: "2026-01-01",
          active: true,
        },
      ],
    });
    expect(result).toMatchObject({
      activeOverrideId: "supplement",
      personalDueRange: { start: "2026-09-01" },
    });
    expect(result.dueRange).not.toEqual(result.personalDueRange);
  });

  it("treats a bounded exact-date override as a true due window, not historical uncertainty", () => {
    expect(
      evaluate(schedule, {
        clinicianOverrides: [
          {
            id: "window",
            profileId: "profile-1",
            serviceId: "service-1",
            methodId: null,
            overrideType: "exact_next_date",
            nextDueStart: "2026-07-01",
            nextDueEnd: "2026-07-31",
            nextDuePrecision: "month",
            interval: null,
            replacesGeneralGuideline: true,
            instructionReceivedDate: "2026-01-01",
            active: true,
          },
        ],
      }),
    ).toMatchObject({ status: "due_now" });
  });

  it("lets an explicit personal timing plan supersede routine inapplicability", () => {
    expect(
      evaluate(
        schedule,
        {
          clinicianOverrides: [
            {
              id: "personal-follow-up",
              profileId: "profile-1",
              serviceId: "service-1",
              methodId: null,
              overrideType: "exact_next_date",
              nextDueStart: "2026-08-01",
              nextDueEnd: "2026-08-01",
              interval: null,
              replacesGeneralGuideline: true,
              instructionReceivedDate: "2026-01-01",
              active: true,
            },
          ],
        },
        { appliesWhen: { op: "constant", value: false } },
      ),
    ).toMatchObject({ status: "due_soon", activeOverrideId: "personal-follow-up" });
  });

  it("ignores inactive and ended overrides", () => {
    const inactive = {
      id: "inactive",
      profileId: "profile-1",
      serviceId: "service-1",
      methodId: null,
      overrideType: "clinician_managed" as const,
      nextDueStart: null,
      nextDueEnd: null,
      interval: null,
      replacesGeneralGuideline: true,
      instructionReceivedDate: "2025-01-01",
      active: false,
    };
    const ended = { ...inactive, id: "ended", active: true, effectiveTo: "2025-12-31" };
    const result = evaluate(schedule, { clinicianOverrides: [inactive, ended] });
    expect(result.activeOverrideId).toBeNull();
    expect(result.status).not.toBe("clinician_managed");
  });

  it("rejects conflicting active replacing overrides", () => {
    const override = {
      id: "one",
      profileId: "profile-1",
      serviceId: "service-1",
      methodId: null,
      overrideType: "clinician_managed" as const,
      nextDueStart: null,
      nextDueEnd: null,
      interval: null,
      replacesGeneralGuideline: true,
      instructionReceivedDate: "2026-01-01",
      active: true,
    };
    expect(() =>
      evaluate(schedule, { clinicianOverrides: [override, { ...override, id: "two" }] }),
    ).toThrow(/multiple active replacing/);
  });
});

describe("variant, version, explanation, and stable ordering", () => {
  it("selects the effective version and explicit conflict variant", () => {
    const federal = ruleFixture(
      { kind: "age_based", startAge: 40, interval: { unit: "years", value: 2 } },
      {
        id: "federal-v1",
        stableKey: "federal-rule",
        conflictGroup: "screening-conflict",
        variantId: "federal",
        baseline: true,
        effectiveTo: "2026-12-31",
      },
    );
    const specialty = ruleFixture(
      { kind: "age_based", startAge: 40, interval: { unit: "years", value: 1 } },
      {
        id: "specialty-v1",
        stableKey: "specialty-rule",
        conflictGroup: "screening-conflict",
        variantId: "specialty",
        baseline: false,
      },
    );
    const futureVersion = ruleFixture(
      { kind: "age_based", startAge: 50, interval: { unit: "years", value: 1 } },
      {
        id: "federal-v2",
        stableKey: "federal-rule",
        version: 2,
        conflictGroup: "screening-conflict",
        variantId: "federal",
        baseline: true,
        effectiveFrom: "2027-01-01",
      },
    );
    const result = evaluateCarePlan(
      inputFixture(federal, {
        guidelineRules: [futureVersion, specialty, federal],
        selectedVariants: { "screening-conflict": "specialty" },
      }),
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ ruleId: "specialty-v1", variantId: "specialty" });
    expect(result[0]?.explanationTokens).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "selected_guideline_variant", value: "specialty" }),
      ]),
    );
  });

  it("falls back to the baseline for an unavailable selection and rejects contradictory selections", () => {
    const baseline = ruleFixture(
      { kind: "one_time", dueOnEligibility: true },
      {
        stableKey: "baseline",
        conflictGroup: "group",
        variantId: "baseline",
        baseline: true,
      },
    );
    expect(
      evaluateCarePlan(
        inputFixture(baseline, { selectedVariants: { group: "retired-variant" } }),
      )[0],
    ).toMatchObject({ variantId: "baseline" });
    expect(() =>
      evaluateCarePlan(
        inputFixture(baseline, {
          selectedVariants: [
            { conflictGroup: "group", variantId: "baseline" },
            { conflictGroup: "group", variantId: "other" },
          ],
        }),
      ),
    ).toThrow(/multiple selected variants/);
  });

  it("returns byte-stable hashes, safe traces, and deterministic status-first ordering", () => {
    const due = ruleFixture(
      { kind: "one_time", dueOnEligibility: true },
      { id: "due", stableKey: "due-rule", serviceName: "Zulu", serviceSortOrder: 2 },
    );
    const inapplicable = ruleFixture(
      { kind: "one_time", dueOnEligibility: true },
      {
        id: "not-applicable",
        stableKey: "not-applicable-rule",
        serviceId: "service-2",
        serviceSlug: "service-two",
        serviceName: "Alpha",
        appliesWhen: { op: "constant", value: false },
      },
    );
    const input = inputFixture(due, {
      guidelineRules: [due, inapplicable],
      includeDebugTrace: true,
    });
    const first = evaluateCarePlan(input);
    const second = evaluateCarePlan({
      ...input,
      guidelineRules: [...input.guidelineRules].reverse(),
    });
    expect(first.map((item) => item.stableKey)).toEqual(["not-applicable-rule", "due-rule"]);
    expect(first.map((item) => item.calculationHash)).toEqual(
      second.map((item) => item.calculationHash),
    );
    expect(first[0]?.calculationTrace.length).toBeGreaterThan(2);
    expect(first[0]?.debugTrace).toBeDefined();
  });
});
