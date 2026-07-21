import { describe, expect, it } from "vitest";
import { evaluateCarePlan } from "./evaluator";
import { eventFixture, inputFixture, profileFixture, ruleFixture } from "./__tests__/fixtures";

describe("required named medical scenarios", () => {
  it("PROSTATE_SHARED_DECISION_AGE_57", () => {
    const rule = ruleFixture(
      { kind: "shared_decision", startAge: 55, stopAge: 69 },
      {
        id: "prostate-rule",
        stableKey: "prostate-shared-decision",
        serviceId: "prostate-discussion",
        serviceSlug: "prostate-cancer-discussion",
        serviceName: "Prostate cancer screening discussion",
        recommendationClass: "shared-decision",
        appliesWhen: {
          op: "all",
          children: [
            { op: "age_between", min: 55, max: 69 },
            { op: "anatomy_is", key: "prostate", state: "present" },
          ],
        },
      },
    );
    const result = evaluateCarePlan(
      inputFixture(rule, {
        profile: profileFixture({ dateOfBirth: "1969-07-21" }),
        anatomy: [{ key: "prostate", state: "present" }],
      }),
    )[0];
    expect(result).toMatchObject({
      status: "discuss_with_clinician",
      recommendationClass: "shared-decision",
    });
    expect(result?.status).not.toBe("overdue");
  });

  it("MAMMOGRAPHY_VARIANT_SWITCH", () => {
    const baseline = ruleFixture(
      { kind: "age_based", startAge: 40, stopAge: 74, interval: { unit: "years", value: 2 } },
      {
        id: "mammography-federal",
        stableKey: "mammography-federal",
        serviceId: "mammography",
        serviceSlug: "breast-cancer-screening",
        serviceName: "Breast cancer screening",
        conflictGroup: "mammography-guideline",
        variantId: "federal",
        baseline: true,
        appliesWhen: { op: "anatomy_is", key: "breast_tissue", state: "present" },
      },
    );
    const specialty = ruleFixture(
      { kind: "age_based", startAge: 40, interval: { unit: "years", value: 1 } },
      {
        id: "mammography-specialty",
        stableKey: "mammography-specialty",
        serviceId: "mammography",
        serviceSlug: "breast-cancer-screening",
        serviceName: "Breast cancer screening",
        conflictGroup: "mammography-guideline",
        variantId: "specialty",
        baseline: false,
      },
    );
    const history = eventFixture({
      serviceId: "mammography",
      performedStart: "2024-01-01",
      performedEnd: "2024-12-31",
      datePrecision: "year",
    });
    const common = {
      profile: profileFixture({ dateOfBirth: "1964-07-21" }),
      anatomy: [{ key: "breast_tissue" as const, state: "present" as const }],
      guidelineRules: [baseline, specialty],
      careEvents: [history],
    };
    const federal = evaluateCarePlan(
      inputFixture(baseline, { ...common, selectedVariants: {} }),
    )[0];
    const selectedSpecialty = evaluateCarePlan(
      inputFixture(baseline, {
        ...common,
        selectedVariants: { "mammography-guideline": "specialty" },
      }),
    )[0];
    expect(federal).toMatchObject({
      variantId: "federal",
      dueRange: { start: "2026-01-01", end: "2026-12-31" },
      status: "needs_date_confirmation",
    });
    expect(selectedSpecialty).toMatchObject({
      variantId: "specialty",
      dueRange: { start: "2025-01-01", end: "2025-12-31" },
      status: "overdue",
    });
  });

  it("COLORECTAL_NEWLY_ELIGIBLE_45", () => {
    const rule = ruleFixture(
      {
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
      },
      {
        stableKey: "colorectal-average-risk",
        serviceId: "colorectal",
        serviceSlug: "colorectal-cancer-screening",
        appliesWhen: { op: "age_between", min: 45, max: 75 },
        allowedMethods: ["colonoscopy", "fit"],
      },
    );
    const result = evaluateCarePlan(
      inputFixture(rule, { profile: profileFixture({ dateOfBirth: "1981-07-21" }) }),
    )[0];
    expect(result).toMatchObject({ status: "due_now", recommendationClass: "routine" });
    expect(result?.explanationTokens).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "method_choice_needed" })]),
    );
  });

  it("COLORECTAL_COLONOSCOPY_METHOD_INTERVAL", () => {
    const rule = ruleFixture(
      {
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
      },
      {
        stableKey: "colorectal-method-aware",
        serviceId: "colorectal",
        serviceSlug: "colorectal-cancer-screening",
        allowedMethods: ["colonoscopy", "fit"],
      },
    );
    const result = evaluateCarePlan(
      inputFixture(rule, {
        careEvents: [
          eventFixture({
            serviceId: "colorectal",
            methodId: "colonoscopy",
            performedStart: "2023-04-10",
            performedEnd: "2023-04-10",
          }),
        ],
      }),
    )[0];
    expect(result).toMatchObject({
      status: "future",
      dueRange: { start: "2033-04-10", end: "2033-04-10" },
    });
  });

  function lungScenario(
    quitDate: string | null,
    options: {
      status?: "current" | "former" | "unknown";
      packsPerDay?: number | null;
      dateOfBirth?: string;
      started?: string;
      endedYear?: number | null;
    } = {},
  ) {
    const rule = ruleFixture(
      { kind: "age_based", startAge: 50, stopAge: 80, interval: { unit: "years", value: 1 } },
      {
        stableKey: "lung-risk-based",
        serviceId: "lung-screening",
        serviceSlug: "lung-cancer-screening",
        appliesWhen: {
          op: "all",
          children: [
            { op: "age_between", min: 50, max: 80 },
            {
              op: "risk_number_compare",
              type: "tobacco_use",
              path: "packYears",
              comparator: "gte",
              value: 20,
            },
            {
              op: "any",
              children: [
                { op: "risk_equals", type: "tobacco_use", path: "currentSmoker", value: true },
                {
                  op: "all",
                  children: [
                    { op: "risk_equals", type: "tobacco_use", path: "currentSmoker", value: false },
                    {
                      op: "risk_number_compare",
                      type: "tobacco_use",
                      path: "yearsSinceQuit",
                      comparator: "lte",
                      value: 15,
                    },
                  ],
                },
              ],
            },
          ],
        },
      },
    );
    return evaluateCarePlan(
      inputFixture(rule, {
        profile: profileFixture({ dateOfBirth: options.dateOfBirth ?? "1966-07-21" }),
        riskFactors: [
          {
            type: "tobacco_use",
            value: {
              status: options.status ?? "former",
              periods: [
                {
                  started: options.started ?? "1985-01-01",
                  ended: quitDate,
                  startedYear: null,
                  endedYear: options.endedYear ?? null,
                  packsPerDay: options.packsPerDay === undefined ? 1 : options.packsPerDay,
                },
              ],
            },
          },
        ],
      }),
    )[0];
  }

  it("LUNG_FORMER_SMOKER_WITHIN_WINDOW", () => {
    expect(lungScenario("2015-07-21")).toMatchObject({ status: "overdue" });
  });

  it("LUNG_FORMER_SMOKER_OUTSIDE_WINDOW", () => {
    expect(lungScenario("2005-07-21")).toMatchObject({ status: "not_applicable" });
  });

  it("lung eligibility independently responds to age, pack-years, current status, missing history, and quit-year uncertainty", () => {
    expect(lungScenario(null, { status: "current" })).toMatchObject({ status: "overdue" });
    expect(lungScenario(null, { status: "current", packsPerDay: 0.25 })).toMatchObject({
      status: "not_applicable",
    });
    expect(lungScenario(null, { status: "current", packsPerDay: null })).toMatchObject({
      status: "unknown_history",
    });
    expect(
      lungScenario("2015-07-21", {
        dateOfBirth: "1976-08-01",
        started: "1995-01-01",
      }),
    ).toMatchObject({ status: "due_soon" });
    expect(lungScenario(null, { status: "former", endedYear: 2011 })).toMatchObject({
      status: "unknown_history",
    });
  });

  it("YEAR_ONLY_HISTORY_UNCERTAIN", () => {
    const rule = ruleFixture(
      {
        kind: "method_dependent",
        defaultMethodPrompt: true,
        methods: [
          {
            methodId: "colonoscopy",
            interval: { unit: "years", value: 10 },
            qualifyingResults: ["normal"],
          },
        ],
      },
      { allowedMethods: ["colonoscopy"] },
    );
    expect(
      evaluateCarePlan(
        inputFixture(rule, {
          asOfDate: "2028-06-01",
          careEvents: [
            eventFixture({
              methodId: "colonoscopy",
              performedStart: "2018-01-01",
              performedEnd: "2018-12-31",
              datePrecision: "year",
            }),
          ],
        }),
      )[0],
    ).toMatchObject({
      status: "needs_date_confirmation",
      dueRange: { start: "2028-01-01", end: "2028-12-31" },
    });
  });

  it("NO_CERVIX_ROUTINE_EXCLUDED", () => {
    const rule = ruleFixture(
      { kind: "age_based", startAge: 21, stopAge: 65, interval: { unit: "years", value: 5 } },
      {
        stableKey: "cervical-routine",
        serviceId: "cervical",
        serviceSlug: "cervical-cancer-screening",
        appliesWhen: { op: "anatomy_is", key: "cervix", state: "present" },
      },
    );
    expect(
      evaluateCarePlan(inputFixture(rule, { anatomy: [{ key: "cervix", state: "absent" }] }))[0],
    ).toMatchObject({ status: "not_applicable" });
    expect(
      evaluateCarePlan(
        inputFixture(rule, {
          anatomy: [{ key: "cervix", state: "absent" }],
          careEvents: [eventFixture({ serviceId: "cervical", result: "abnormal" })],
        }),
      )[0],
    ).toMatchObject({ status: "clinician_managed" });
  });

  it("ABNORMAL_HISTORY_CLINICIAN_MANAGED", () => {
    const rule = ruleFixture(
      { kind: "age_based", startAge: 45, interval: { unit: "years", value: 5 } },
      { serviceId: "screening" },
    );
    expect(
      evaluateCarePlan(
        inputFixture(rule, {
          careEvents: [eventFixture({ serviceId: "screening", result: "abnormal" })],
        }),
      )[0],
    ).toMatchObject({ status: "clinician_managed" });
  });

  it("AAA_ONE_TIME_COMPLETE", () => {
    const rule = ruleFixture(
      { kind: "one_time", dueOnEligibility: true },
      {
        stableKey: "aaa-one-time",
        serviceId: "aaa",
        serviceSlug: "abdominal-aortic-aneurysm-screening",
      },
    );
    expect(
      evaluateCarePlan(inputFixture(rule, { careEvents: [eventFixture({ serviceId: "aaa" })] }))[0],
    ).toMatchObject({ status: "completed_once", dueRange: null });
  });

  it("CLINICIAN_OVERRIDE_PRECEDENCE", () => {
    const rule = ruleFixture(
      { kind: "age_based", startAge: 40, interval: { unit: "years", value: 5 } },
      { serviceId: "override-service" },
    );
    expect(
      evaluateCarePlan(
        inputFixture(rule, {
          clinicianOverrides: [
            {
              id: "personal-date",
              profileId: "profile-1",
              serviceId: "override-service",
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
        }),
      )[0],
    ).toMatchObject({
      activeOverrideId: "personal-date",
      dueRange: { start: "2026-08-01", end: "2026-08-01" },
      status: "due_soon",
    });
  });
});
