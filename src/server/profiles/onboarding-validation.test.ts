import { describe, expect, it } from "vitest";

import {
  onboardingDraftDataSchema,
  readStoredOnboardingDraftData,
  validateCompleteOnboarding,
  validateOnboardingStep,
} from "./onboarding-validation";

function completeData() {
  return {
    displayName: "Alex",
    relationshipLabel: "Self",
    dateOfBirth: "1980-05-12",
    sexAssignedAtBirth: "female",
    genderIdentity: "",
    countryCode: "US",
    timezone: "America/Los_Angeles",
    visibility: "owner_only",
    ownership: "self",
    anatomy_cervix: "present",
    anatomy_breast_tissue: "present",
    anatomy_prostate: "absent",
    anatomy_uterus: "present",
    anatomy_ovaries: "present",
    tobaccoStatus: "former",
    smokingStartYear: "2000",
    smokingEndYear: "2010",
    packsPerDay: "0.5",
    heightInches: "65",
    weightPounds: "145",
    immunocompromised: "no",
    condition_Hypertension: true,
    familyHistory: "Parent — colorectal cancer",
    surgeries: "Appendectomy",
    medicationName: "",
    medicationDose: "",
    medicationFrequency: "",
    medicationPrescriber: "",
    medicationReason: "",
    medicationStartedDate: "",
    medicationStartedPrecision: "unknown",
    monitoringInstructions: "",
    nextMedicationReview: "",
  };
}

describe("onboarding validation", () => {
  it("rejects unknown client fields instead of reading or storing raw extras", () => {
    const result = onboardingDraftDataSchema.safeParse({
      ...completeData(),
      unreviewedMedicalFlag: "yes",
    });

    expect(result.success).toBe(false);
  });

  it("strips legacy draft extras before returning them to the client", () => {
    expect(readStoredOnboardingDraftData({ displayName: "Alex", hidden: "value" })).toEqual({
      displayName: "Alex",
    });
  });

  it("normalizes validated risk payloads through existing bounds", () => {
    const result = validateCompleteOnboarding(completeData(), new Date("2026-07-21T12:00:00.000Z"));

    expect(result.healthContext.tobaccoRisk).toMatchObject({
      status: "former",
      periods: [{ startedYear: 2000, endedYear: 2010, packsPerDay: 0.5 }],
    });
    expect(result.healthContext.heightWeightRisk).toMatchObject({
      measuredOn: "2026-07-21",
      heightCentimeters: 165.1,
      weightKilograms: 65.77,
    });
    expect(result.healthContext.selectedConditionCodes).toContain("hypertension");
    expect(result.healthContext.pregnancyRisk).toEqual({ value: "unknown" });
    expect(result.healthContext.alcoholRisk).toEqual({
      assessmentPreferred: null,
      riskLevel: null,
    });
    expect(result.healthContext.fallRisk).toEqual({ concern: "unknown" });
    expect(result.healthContext.sexualHealthRisk).toEqual({ value: "unknown" });
  });

  it("rejects contradictory or impossible smoking years", () => {
    expect(() =>
      validateCompleteOnboarding(
        { ...completeData(), smokingStartYear: "2015", smokingEndYear: "2010" },
        new Date("2026-07-21T12:00:00.000Z"),
      ),
    ).toThrow(/Quit year/);
    expect(() =>
      validateCompleteOnboarding(
        { ...completeData(), smokingStartYear: "1970", smokingEndYear: "2010" },
        new Date("2026-07-21T12:00:00.000Z"),
      ),
    ).toThrow(/birth year/);
    expect(() =>
      validateCompleteOnboarding(
        { ...completeData(), smokingStartYear: "2027", smokingEndYear: "" },
        new Date("2026-07-21T12:00:00.000Z"),
      ),
    ).toThrow(/future/);
  });

  it("rejects smoking details for a never-smoker and out-of-contract weight", () => {
    expect(() =>
      validateCompleteOnboarding(
        { ...completeData(), tobaccoStatus: "never", smokingStartYear: "2000" },
        new Date("2026-07-21T12:00:00.000Z"),
      ),
    ).toThrow(/Smoking years/);
    expect(() =>
      validateCompleteOnboarding(
        { ...completeData(), weightPounds: "1400" },
        new Date("2026-07-21T12:00:00.000Z"),
      ),
    ).toThrow();
  });

  it("gives step-specific validation before advancing", () => {
    expect(() =>
      validateOnboardingStep(
        { ...completeData(), displayName: "" },
        0,
        new Date("2026-07-21T12:00:00.000Z"),
      ),
    ).toThrow();
    expect(() =>
      validateOnboardingStep(
        { ...completeData(), anatomy_cervix: undefined },
        1,
        new Date("2026-07-21T12:00:00.000Z"),
      ),
    ).toThrow();
  });

  it("requires a medication name when medication details are present", () => {
    expect(() =>
      validateCompleteOnboarding(
        { ...completeData(), medicationDose: "10 mg" },
        new Date("2026-07-21T12:00:00.000Z"),
      ),
    ).toThrow(/medication name/i);
  });

  it("normalizes medication reason and start timing without inventing precision", () => {
    const result = validateCompleteOnboarding(
      {
        ...completeData(),
        medicationName: "Example medicine",
        medicationReason: "Blood pressure",
        medicationStartedDate: "2024-05",
        medicationStartedPrecision: "month",
      },
      new Date("2026-07-21T12:00:00.000Z"),
    );

    expect(result.medication).toMatchObject({
      reason: "Blood pressure",
      started: { start: "2024-05-01", end: "2024-05-31", precision: "month" },
    });
  });

  it("rejects medication start values that do not match their declared precision", () => {
    expect(() =>
      validateOnboardingStep(
        {
          ...completeData(),
          medicationName: "Example medicine",
          medicationStartedDate: "2024",
          medicationStartedPrecision: "month",
        },
        4,
        new Date("2026-07-21T12:00:00.000Z"),
      ),
    ).toThrow(/start timing/i);
  });

  it("requires explicit confirmation before a surgery changes anatomy", () => {
    expect(() =>
      validateCompleteOnboarding(
        {
          ...completeData(),
          surgeries: "Hysterectomy",
          surgeryAnatomyKey: "uterus",
          surgeryAnatomyState: "absent",
          confirmSurgeryAnatomy: false,
        },
        new Date("2026-07-21T12:00:00.000Z"),
      ),
    ).toThrow(/Confirm the proposed anatomy update/);

    const result = validateCompleteOnboarding(
      {
        ...completeData(),
        surgeries: "Hysterectomy",
        surgeryAnatomyKey: "uterus",
        surgeryAnatomyState: "absent",
        confirmSurgeryAnatomy: true,
      },
      new Date("2026-07-21T12:00:00.000Z"),
    );
    expect(result.healthContext.anatomyUpdate).toEqual({ key: "uterus", state: "absent" });
  });
});
