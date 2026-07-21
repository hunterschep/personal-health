import { describe, expect, it } from "vitest";
import { deriveBmi, derivePackYears, firstDegreeFamilyHistory } from "./facts";

describe("BMI derivation", () => {
  it("uses the most recent reasonably paired valid height and weight", () => {
    const bmi = deriveBmi([
      {
        id: "old",
        type: "height_weight",
        value: {
          measuredOn: "2024-01-01",
          heightCentimeters: 170,
          weightKilograms: 90,
        },
      },
      {
        id: "height",
        type: "height_weight",
        value: {
          measuredOn: "2026-01-01",
          heightCentimeters: 180,
          weightKilograms: null,
        },
      },
      {
        id: "weight",
        type: "height_weight",
        value: {
          measuredOn: "2026-01-15",
          heightCentimeters: null,
          weightKilograms: 81,
        },
      },
    ]);

    expect(bmi).toMatchObject({
      value: 25,
      heightCentimeters: 180,
      weightKilograms: 81,
      heightRiskFactorId: "height",
      weightRiskFactorId: "weight",
    });
  });

  it("does not calculate from invalid units or measurements more than a year apart", () => {
    expect(
      deriveBmi([
        {
          type: "height_weight",
          value: { measuredOn: "2024-01-01", heightCentimeters: 175, weightKilograms: null },
        },
        {
          type: "height_weight",
          value: { measuredOn: "2026-01-01", heightCentimeters: null, weightKilograms: 75 },
        },
      ]),
    ).toBeNull();
    expect(
      deriveBmi([
        {
          type: "height_weight",
          value: { measuredOn: "2026-01-01", heightCentimeters: 1.75, weightKilograms: 75 },
        },
      ]),
    ).toBeNull();
  });
});

describe("pack-year derivation", () => {
  it("sums multiple explicit smoking periods", () => {
    expect(
      derivePackYears(
        [
          {
            type: "tobacco_use",
            value: {
              status: "former",
              periods: [
                {
                  started: "2000-01-01",
                  ended: "2010-01-01",
                  startedYear: null,
                  endedYear: null,
                  packsPerDay: 1,
                },
                {
                  started: "2015-01-01",
                  ended: "2020-01-01",
                  startedYear: null,
                  endedYear: null,
                  packsPerDay: 2,
                },
              ],
            },
          },
        ],
        "2026-01-01",
      ),
    ).toMatchObject({
      minimum: 20,
      maximum: 20,
      uncertain: false,
      currentSmoker: false,
      yearsSinceQuitMinimum: 6,
      yearsSinceQuitMaximum: 6,
    });
  });

  it("propagates year-only start and quit uncertainty", () => {
    const result = derivePackYears(
      [
        {
          type: "tobacco_use",
          value: {
            status: "former",
            periods: [
              {
                started: null,
                ended: null,
                startedYear: 2000,
                endedYear: 2010,
                packsPerDay: 1,
              },
            ],
          },
        },
      ],
      "2026-07-01",
    );
    expect(result.uncertain).toBe(true);
    expect(result.minimum).toBeLessThan(10);
    expect(result.maximum).toBeGreaterThan(10);
    expect(result.yearsSinceQuitMinimum).toBeLessThan(result.yearsSinceQuitMaximum as number);
  });

  it("does not infer current smoking from a former period with no end", () => {
    expect(
      derivePackYears(
        [
          {
            type: "tobacco_use",
            value: {
              status: "former",
              periods: [
                {
                  started: "2000-01-01",
                  ended: null,
                  startedYear: null,
                  endedYear: null,
                  packsPerDay: 1,
                },
              ],
            },
          },
        ],
        "2026-01-01",
      ),
    ).toMatchObject({ minimum: null, maximum: null, currentSmoker: false, uncertain: true });
  });

  it("represents never smoking as a known zero", () => {
    expect(
      derivePackYears(
        [{ type: "tobacco_use", value: { status: "never", periods: [] } }],
        "2026-01-01",
      ),
    ).toMatchObject({ minimum: 0, maximum: 0, currentSmoker: false, uncertain: false });
  });
});

describe("family-history normalization", () => {
  it("matches common first-degree relationship labels without inferring syndromes", () => {
    expect(
      firstDegreeFamilyHistory([
        { relationship: "Mother", conditionCode: "colorectal-cancer", ageAtDiagnosis: 48 },
        { relationship: "aunt", conditionCode: "colorectal-cancer", ageAtDiagnosis: 44 },
      ]),
    ).toEqual([{ relationship: "Mother", conditionCode: "colorectal-cancer", ageAtDiagnosis: 48 }]);
  });
});
