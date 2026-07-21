import { describe, expect, it } from "vitest";
import {
  ageBoundaries,
  methodIntervals,
  readStoredCalculation,
  safeTokenValue,
  summarizeExpression,
  summarizeSchedule,
} from "./transparency-format";

describe("transparency formatting", () => {
  it("turns reviewed eligibility expressions into readable summaries", () => {
    expect(
      summarizeExpression({
        op: "all",
        children: [
          { op: "age_between", min: 45, max: 75 },
          { op: "anatomy_is", key: "breast_tissue", state: "present" },
        ],
      }),
    ).toBe("Ages 45 through 75 and Breast tissue is recorded as present");
    expect(
      ageBoundaries({
        op: "all",
        children: [
          { op: "age_between", min: 40, max: 74 },
          { op: "constant", value: true },
        ],
      }),
    ).toEqual({ minimum: 40, maximum: 74 });
  });

  it("keeps method-specific intervals separate", () => {
    const schedule = {
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
    expect(summarizeSchedule(schedule)).toBe(
      "The next interval follows the method actually completed",
    );
    expect(methodIntervals(schedule)).toEqual([
      {
        methodIdentifier: "colonoscopy",
        interval: "Every 10 years",
        qualifyingResults: ["normal"],
      },
      { methodIdentifier: "fit", interval: "Every 1 year", qualifyingResults: ["normal"] },
    ]);
  });

  it("sanitizes stored calculation details for ordinary users", () => {
    const calculation = readStoredCalculation({
      tokens: [{ code: "age", label: "Age in range", value: 45 }],
      limitations: ["Average-risk pathway only."],
      generalGuidelineDueRange: {
        start: "2026-07-21",
        end: "2026-07-21",
        precision: "day",
      },
      personalDueRange: null,
      calculationTrace: [
        {
          step: "event_qualification",
          outcome: "Qualified relevant care events.",
          values: { eventId: "11111111-1111-4111-8111-111111111111", relevantEvents: 1 },
        },
      ],
    });
    expect(calculation.trace[0]?.values).toEqual([{ label: "RelevantEvents", value: 1 }]);
    expect(calculation.limitations).toEqual(["Average-risk pathway only."]);
    expect(safeTokenValue("11111111-1111-4111-8111-111111111111")).toBeNull();
  });
});
