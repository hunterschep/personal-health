import type { Expression } from "@/contracts";
import { describe, expect, it } from "vitest";
import { deriveFacts } from "./facts";
import { evaluateExpression } from "./expression";
import { eventFixture, inputFixture, profileFixture, ruleFixture } from "./__tests__/fixtures";

const rule = ruleFixture({ kind: "one_time", dueOnEligibility: true });
const input = inputFixture(rule, {
  profile: profileFixture({
    dateOfBirth: "1969-07-21",
    sexAssignedAtBirth: "male",
    countryCode: "US",
  }),
  anatomy: [
    { key: "prostate", state: "present" },
    { key: "cervix", state: "absent" },
  ],
  riskFactors: [
    {
      type: "tobacco_use",
      value: {
        status: "current",
        periods: [
          {
            started: "2000-07-21",
            ended: null,
            startedYear: null,
            endedYear: null,
            packsPerDay: 1,
          },
        ],
      },
    },
  ],
  conditions: [{ code: "diabetes", status: "active" }],
  familyHistory: [
    {
      conditionCode: "colorectal-cancer",
      relationship: "parent",
      ageAtDiagnosis: 45,
    },
  ],
  surgeries: [{ code: "appendectomy", performedStart: "1990-01-01" }],
  medications: [{ classCodes: ["statin"], status: "active" }],
  careEvents: [eventFixture()],
});
const context = { input, facts: deriveFacts(input) };

describe("expression evaluator", () => {
  it.each<{ label: string; expression: Expression; expected: true | false | "unknown" }>([
    { label: "constant", expression: { op: "constant", value: true }, expected: true },
    {
      label: "all",
      expression: {
        op: "all",
        children: [
          { op: "constant", value: true },
          { op: "age_between", min: 50, max: 60 },
        ],
      },
      expected: true,
    },
    {
      label: "any",
      expression: {
        op: "any",
        children: [
          { op: "constant", value: false },
          { op: "anatomy_is", key: "prostate", state: "present" },
        ],
      },
      expected: true,
    },
    {
      label: "not",
      expression: { op: "not", child: { op: "constant", value: false } },
      expected: true,
    },
    {
      label: "age_between",
      expression: { op: "age_between", min: 57, max: 57 },
      expected: true,
    },
    {
      label: "anatomy_is",
      expression: { op: "anatomy_is", key: "prostate", state: "present" },
      expected: true,
    },
    {
      label: "sex_assigned_at_birth_is",
      expression: { op: "sex_assigned_at_birth_is", value: "male" },
      expected: true,
    },
    {
      label: "risk_equals",
      expression: { op: "risk_equals", type: "tobacco_use", path: "status", value: "current" },
      expected: true,
    },
    {
      label: "risk_number_compare",
      expression: {
        op: "risk_number_compare",
        type: "tobacco_use",
        path: "packYears",
        comparator: "gte",
        value: 20,
      },
      expected: true,
    },
    {
      label: "condition_present",
      expression: { op: "condition_present", code: "diabetes", statuses: ["active"] },
      expected: true,
    },
    {
      label: "condition_absent",
      expression: { op: "condition_absent", code: "colorectal-cancer" },
      expected: true,
    },
    {
      label: "family_history_present",
      expression: {
        op: "family_history_present",
        conditionCode: "colorectal-cancer",
        relationships: ["parent"],
        maxAgeAtDiagnosis: 50,
      },
      expected: true,
    },
    {
      label: "surgery_present",
      expression: { op: "surgery_present", code: "appendectomy" },
      expected: true,
    },
    {
      label: "medication_class_present",
      expression: { op: "medication_class_present", classCode: "statin" },
      expected: true,
    },
    {
      label: "prior_event_exists",
      expression: {
        op: "prior_event_exists",
        serviceId: "service-1",
        resultIn: ["normal"],
      },
      expected: true,
    },
    {
      label: "prior_event_absent",
      expression: { op: "prior_event_absent", serviceId: "different-service" },
      expected: true,
    },
    {
      label: "time_since_event_compare",
      expression: {
        op: "time_since_event_compare",
        serviceId: "service-1",
        comparator: "gte",
        duration: { unit: "years", value: 5 },
      },
      expected: true,
    },
    {
      label: "profile_field_equals",
      expression: { op: "profile_field_equals", field: "countryCode", value: "US" },
      expected: true,
    },
  ])("evaluates the $label node", ({ expression, expected }) => {
    expect(evaluateExpression(expression, context).result).toBe(expected);
  });

  it("uses three-valued logic when a required anatomy or risk fact is unknown", () => {
    expect(
      evaluateExpression({ op: "anatomy_is", key: "uterus", state: "present" }, context),
    ).toMatchObject({ result: "unknown" });
    expect(
      evaluateExpression(
        {
          op: "risk_number_compare",
          type: "height_weight",
          path: "bmi",
          comparator: "gte",
          value: 25,
        },
        context,
      ),
    ).toMatchObject({ result: "unknown" });
  });

  it("propagates unknown through all, any, and not without treating it as false", () => {
    const unknown: Expression = { op: "anatomy_is", key: "uterus", state: "present" };
    expect(
      evaluateExpression(
        { op: "all", children: [{ op: "constant", value: true }, unknown] },
        context,
      ).result,
    ).toBe("unknown");
    expect(
      evaluateExpression(
        { op: "any", children: [{ op: "constant", value: false }, unknown] },
        context,
      ).result,
    ).toBe("unknown");
    expect(evaluateExpression({ op: "not", child: unknown }, context).result).toBe("unknown");
  });

  it("does not request facts from an unused any branch", () => {
    const result = evaluateExpression(
      {
        op: "any",
        children: [
          { op: "risk_equals", type: "tobacco_use", path: "currentSmoker", value: true },
          {
            op: "risk_number_compare",
            type: "tobacco_use",
            path: "yearsSinceQuit",
            comparator: "lte",
            value: 15,
          },
        ],
      },
      context,
    );
    expect(result.result).toBe(true);
    expect(result.missingFacts).toEqual([]);
  });

  it("keeps family-history threshold evaluation unknown when age at diagnosis is missing", () => {
    const unknownFamilyInput = {
      ...input,
      familyHistory: [
        { conditionCode: "colorectal-cancer", relationship: "parent", ageAtDiagnosis: null },
      ],
    };
    expect(
      evaluateExpression(
        {
          op: "family_history_present",
          conditionCode: "colorectal-cancer",
          maxAgeAtDiagnosis: 50,
        },
        { input: unknownFamilyInput, facts: deriveFacts(unknownFamilyInput) },
      ),
    ).toMatchObject({ result: "unknown" });
  });
});
