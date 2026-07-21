import type { NormalizedProfile, Schedule } from "@/contracts";
import type { CarePlanEvaluationInput, EvaluationRule, NormalizedCareEvent } from "../types";

export const AS_OF_DATE = "2026-07-21";

export function profileFixture(changes: Partial<NormalizedProfile> = {}): NormalizedProfile {
  return {
    id: "profile-1",
    householdId: "household-1",
    ownerUserId: "user-1",
    displayName: "Synthetic Adult",
    relationshipLabel: "Self",
    dateOfBirth: "1980-07-21",
    sexAssignedAtBirth: "unknown",
    genderIdentity: null,
    countryCode: "US",
    timezone: "America/Los_Angeles",
    visibility: "owner_only",
    carePlanMode: "evidence_based",
    ...changes,
  };
}

export function ruleFixture(
  schedule: Schedule,
  changes: Partial<EvaluationRule> = {},
): EvaluationRule {
  return {
    id: "rule-1-v1",
    stableKey: "synthetic-rule",
    version: 1,
    serviceId: "service-1",
    serviceSlug: "synthetic-service",
    serviceName: "Synthetic service",
    category: "cancer_screening",
    categoryOrder: 1,
    serviceSortOrder: 1,
    variantId: "federal-baseline",
    conflictGroup: null,
    baseline: false,
    sourceId: "source-1",
    sourceSlug: "synthetic-source",
    sourceOrganization: "Synthetic Source",
    jurisdiction: "US",
    evidenceGrade: "B",
    recommendationClass: "routine",
    appliesWhen: { op: "constant", value: true },
    excludesWhen: null,
    stopWhen: null,
    schedule,
    completionEventTypes: ["screening"],
    allowedMethods: null,
    outcomeModifiers: ["abnormal_to_clinician_managed"],
    consumerSummary: "Synthetic summary for deterministic tests.",
    whyItMatters: "Synthetic explanation for deterministic tests.",
    questionsForClinician: ["What timing fits my history?"],
    limitations: ["Synthetic test rule only."],
    effectiveFrom: "2020-01-01",
    effectiveTo: null,
    reviewStatus: "active",
    reviewedBy: "Synthetic Reviewer",
    reviewedAt: "2026-01-01",
    scenarioIds: ["SYNTHETIC_SCENARIO"],
    ...changes,
  };
}

export function eventFixture(changes: Partial<NormalizedCareEvent> = {}): NormalizedCareEvent {
  return {
    id: "event-1",
    profileId: "profile-1",
    serviceId: "service-1",
    eventType: "screening",
    methodId: null,
    performedStart: "2020-07-21",
    performedEnd: "2020-07-21",
    datePrecision: "day",
    result: "normal",
    ...changes,
  };
}

export function inputFixture(
  rule: EvaluationRule,
  changes: Partial<CarePlanEvaluationInput> = {},
): CarePlanEvaluationInput {
  return {
    profile: profileFixture(),
    anatomy: [],
    riskFactors: [],
    conditions: [],
    familyHistory: [],
    surgeries: [],
    medications: [],
    careEvents: [],
    clinicianOverrides: [],
    selectedVariants: {},
    guidelineRules: [rule],
    asOfDate: AS_OF_DATE,
    ...changes,
  };
}
