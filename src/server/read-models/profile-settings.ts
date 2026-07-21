import { riskFactorPayloadSchemas } from "@/contracts/profile";
import { FIXED_CONDITIONS } from "@/domain/profile-context/constants";
import { prisma } from "@/server/db/client";

export async function loadProfileSettingsContext(profileId: string) {
  const [anatomy, risks, conditions, familyHistory, surgeries] = await Promise.all([
    prisma.profileAnatomy.findMany({ where: { profileId }, orderBy: { anatomyKey: "asc" } }),
    prisma.riskFactor.findMany({
      where: {
        profileId,
        type: {
          in: [
            "tobacco_use",
            "height_weight",
            "pregnancy_status",
            "immunocompromised",
            "alcohol_use",
            "fall_risk",
            "sexual_health_risk",
          ],
        },
        deletedAt: null,
        endedAt: null,
      },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      select: { type: true, valueJson: true },
    }),
    prisma.condition.findMany({
      where: {
        profileId,
        code: { in: FIXED_CONDITIONS.map(({ code }) => code) },
        deletedAt: null,
      },
      select: { code: true },
    }),
    prisma.familyHistory.findMany({
      where: {
        profileId,
        conditionCode: "user-reported-family-history",
        deletedAt: null,
      },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      select: { note: true },
    }),
    prisma.surgery.findMany({
      where: { profileId, code: "user-reported-surgery", deletedAt: null },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      select: { note: true },
    }),
  ]);

  const tobacco = risks
    .filter(({ type }) => type === "tobacco_use")
    .flatMap(({ valueJson }) => {
      const result = riskFactorPayloadSchemas.tobacco_use.safeParse(valueJson);
      return result.success ? [result.data] : [];
    })[0];
  const heightWeight = risks
    .filter(({ type }) => type === "height_weight")
    .flatMap(({ valueJson }) => {
      const result = riskFactorPayloadSchemas.height_weight.safeParse(valueJson);
      return result.success ? [result.data] : [];
    })[0];
  const immunocompromised = risks
    .filter(({ type }) => type === "immunocompromised")
    .flatMap(({ valueJson }) => {
      const result = riskFactorPayloadSchemas.immunocompromised.safeParse(valueJson);
      return result.success ? [result.data] : [];
    })[0];
  const pregnancy = risks
    .filter(({ type }) => type === "pregnancy_status")
    .flatMap(({ valueJson }) => {
      const result = riskFactorPayloadSchemas.pregnancy_status.safeParse(valueJson);
      return result.success ? [result.data] : [];
    })[0];
  const alcohol = risks
    .filter(({ type }) => type === "alcohol_use")
    .flatMap(({ valueJson }) => {
      const result = riskFactorPayloadSchemas.alcohol_use.safeParse(valueJson);
      return result.success ? [result.data] : [];
    })[0];
  const fall = risks
    .filter(({ type }) => type === "fall_risk")
    .flatMap(({ valueJson }) => {
      const result = riskFactorPayloadSchemas.fall_risk.safeParse(valueJson);
      return result.success ? [result.data] : [];
    })[0];
  const sexualHealth = risks
    .filter(({ type }) => type === "sexual_health_risk")
    .flatMap(({ valueJson }) => {
      const result = riskFactorPayloadSchemas.sexual_health_risk.safeParse(valueJson);
      return result.success ? [result.data] : [];
    })[0];
  const smokingPeriod = tobacco?.periods[0];
  const alcoholAssessmentPreference: "yes" | "no" | "unknown" =
    alcohol?.assessmentPreferred === null || alcohol?.assessmentPreferred === undefined
      ? "unknown"
      : alcohol.assessmentPreferred
        ? "yes"
        : "no";
  const selectedCodes = new Set(conditions.map(({ code }) => code));
  const conditionSelections = Object.fromEntries(
    FIXED_CONDITIONS.map(({ key, code }) => [key, selectedCodes.has(code)]),
  );

  return {
    anatomy: Object.fromEntries(anatomy.map(({ anatomyKey, state }) => [anatomyKey, state])),
    healthContext: {
      tobaccoStatus: tobacco?.status ?? "unknown",
      smokingStartYear: smokingPeriod?.startedYear?.toString() ?? "",
      smokingEndYear: smokingPeriod?.endedYear?.toString() ?? "",
      packsPerDay: smokingPeriod?.packsPerDay?.toString() ?? "",
      heightInches:
        heightWeight?.heightCentimeters === null || heightWeight?.heightCentimeters === undefined
          ? ""
          : (Math.round((heightWeight.heightCentimeters / 2.54) * 10) / 10).toString(),
      weightPounds:
        heightWeight?.weightKilograms === null || heightWeight?.weightKilograms === undefined
          ? ""
          : (Math.round((heightWeight.weightKilograms / 0.45359237) * 10) / 10).toString(),
      immunocompromised: immunocompromised?.value ?? "unknown",
      pregnancyStatus: pregnancy?.value ?? "unknown",
      alcoholAssessmentPreference,
      fallConcern: fall?.concern ?? "unknown",
      sexualHealthRisk: sexualHealth?.value ?? "unknown",
      conditions: conditionSelections,
      familyHistoryNote: familyHistory[0]?.note ?? "",
      surgeryNote: surgeries[0]?.note ?? "",
      surgeryAnatomyKey: "" as const,
      surgeryAnatomyState: "" as const,
      confirmSurgeryAnatomy: false,
    },
  };
}
