import type {
  Expression,
  GuidelineRuleDefinition,
  RecommendationClass,
  Schedule,
} from "@/contracts";
import {
  ageBasedSchedule,
  all,
  anatomyIs,
  any,
  conditionPresent,
  customSchedule,
  defineRule,
  doseSeriesSchedule,
  methodDependentSchedule,
  oneTimeSchedule,
  riskEquals,
  riskNumber,
  seasonalSchedule,
  sharedDecisionSchedule,
  validateRuleSet,
} from "@/domain/rules";
import {
  Prisma,
  type RecommendationClass as StoredRecommendationClass,
} from "@/generated/prisma/client";
import type { DatabaseClient } from "@/server/db";
import { createGuidelineRepository } from "@/server/repositories/guideline";
import { SOURCE_REGISTRY } from "@/server/sources/registry";

import { SERVICE_METHOD_SEED_RECORDS, SERVICE_SEED_RECORDS, serviceEventType } from "./catalog";

const REVIEWED_AT = "2026-07-21";
const REVIEWED_BY = "CareCadence source review";

const routineOutcomeModifiers = [
  "abnormal_result_clinician_managed",
  "inconclusive_result_clinician_managed",
  "clinician_override_may_replace_general_timing",
] as const;

type ReviewedRuleInput = {
  stableKey: string;
  serviceSlug: string;
  sourceSlug: string;
  variantId?: string;
  conflictGroup?: string | null;
  baseline?: boolean;
  evidenceGrade: string | null;
  recommendationClass: RecommendationClass;
  appliesWhen: Expression;
  excludesWhen?: Expression | null;
  stopWhen?: Expression | null;
  schedule: Schedule;
  allowedMethods?: string[] | null;
  outcomeModifiers?: string[];
  consumerSummary: string;
  whyItMatters: string;
  questionsForClinician?: string[];
  limitations: string[];
  effectiveFrom: string;
  effectiveTo?: string | null;
  reviewStatus?: "draft" | "reviewed" | "active" | "retired";
  scenarioIds?: string[];
};

function reviewedRule(input: ReviewedRuleInput): GuidelineRuleDefinition {
  const methodScenarioIds =
    input.schedule.kind === "method_dependent"
      ? input.schedule.methods.map((method) => `${input.stableKey}-method-${method.methodId}`)
      : [];
  const acceptanceScenarioIds = [
    `${input.stableKey}-positive`,
    `${input.stableKey}-negative`,
    `${input.stableKey}-boundary`,
    `${input.stableKey}-historical-completion`,
    `${input.stableKey}-uncertainty`,
    `${input.stableKey}-abnormal-history`,
    ...(input.conflictGroup === undefined || input.conflictGroup === null
      ? []
      : [`${input.stableKey}-variant`]),
  ];
  return defineRule({
    stableKey: input.stableKey,
    version: 1,
    serviceSlug: input.serviceSlug,
    variantId: input.variantId ?? "federal_baseline",
    conflictGroup: input.conflictGroup ?? null,
    baseline: input.baseline ?? false,
    sourceSlug: input.sourceSlug,
    jurisdiction: "US",
    evidenceGrade: input.evidenceGrade,
    recommendationClass: input.recommendationClass,
    appliesWhen: input.appliesWhen,
    excludesWhen: input.excludesWhen ?? null,
    stopWhen: input.stopWhen ?? null,
    schedule: input.schedule,
    completionEventTypes: [serviceEventType(input.serviceSlug)],
    allowedMethods: input.allowedMethods ?? null,
    outcomeModifiers: input.outcomeModifiers ?? [...routineOutcomeModifiers],
    consumerSummary: input.consumerSummary,
    whyItMatters: input.whyItMatters,
    questionsForClinician: input.questionsForClinician ?? [
      "What parts of my history change this recommendation?",
      "Which option fits my preferences and health history?",
    ],
    limitations: input.limitations,
    effectiveFrom: input.effectiveFrom,
    effectiveTo: input.effectiveTo ?? null,
    reviewStatus: input.reviewStatus ?? "active",
    reviewedBy: REVIEWED_BY,
    reviewedAt: REVIEWED_AT,
    scenarioIds: [
      ...new Set([...(input.scenarioIds ?? []), ...acceptanceScenarioIds, ...methodScenarioIds]),
    ],
  });
}

const age = (min?: number, max?: number): Expression => ({
  op: "age_between",
  ...(min === undefined ? {} : { min }),
  ...(max === undefined ? {} : { max }),
});

const sexAssignedAtBirth = (value: string): Expression => ({
  op: "sex_assigned_at_birth_is",
  value,
});

const colorectalManagedHistory = any(
  conditionPresent("colorectal_cancer"),
  conditionPresent("lynch_syndrome"),
  conditionPresent("familial_adenomatous_polyposis"),
  conditionPresent("inflammatory_bowel_disease"),
);

const cervicalManagedHistory = any(
  conditionPresent("cervical_cancer"),
  conditionPresent("cin2_or_higher"),
  conditionPresent("des_exposure_in_utero"),
  conditionPresent("hiv"),
);

const cardiovascularDiseaseHistory = any(
  conditionPresent("atherosclerotic_cardiovascular_disease"),
  conditionPresent("myocardial_infarction"),
  conditionPresent("stroke"),
);

const cancerRules: GuidelineRuleDefinition[] = [
  reviewedRule({
    stableKey: "colorectal-uspstf-average-risk-45-75",
    serviceSlug: "colorectal-cancer-screening",
    sourceSlug: "uspstf-colorectal-cancer-screening-2021",
    evidenceGrade: "USPSTF A/B",
    recommendationClass: "routine",
    appliesWhen: age(45, 75),
    excludesWhen: colorectalManagedHistory,
    schedule: methodDependentSchedule([
      {
        methodId: "colonoscopy",
        interval: { unit: "years", value: 10 },
        qualifyingResults: ["normal"],
      },
      { methodId: "fit", interval: { unit: "years", value: 1 }, qualifyingResults: ["normal"] },
      {
        methodId: "high-sensitivity-guaiac-fobt",
        interval: { unit: "years", value: 1 },
        qualifyingResults: ["normal"],
      },
      {
        methodId: "stool-dna-fit",
        interval: { unit: "years", value: 3 },
        qualifyingResults: ["normal"],
      },
      {
        methodId: "flexible-sigmoidoscopy",
        interval: { unit: "years", value: 5 },
        qualifyingResults: ["normal"],
      },
      {
        methodId: "flexible-sigmoidoscopy-with-fit",
        interval: { unit: "years", value: 1 },
        qualifyingResults: ["normal"],
      },
      {
        methodId: "ct-colonography",
        interval: { unit: "years", value: 5 },
        qualifyingResults: ["normal"],
      },
    ]),
    allowedMethods: [
      "colonoscopy",
      "fit",
      "high-sensitivity-guaiac-fobt",
      "stool-dna-fit",
      "flexible-sigmoidoscopy",
      "flexible-sigmoidoscopy-with-fit",
      "ct-colonography",
    ],
    consumerSummary:
      "Adults ages 45 through 75 should be screened for colorectal cancer using an accepted strategy.",
    whyItMatters:
      "Screening can find colorectal cancer earlier and some methods can find precancerous polyps.",
    limitations: [
      "This rule is for average-risk screening; prior cancer, high-risk syndromes, inflammatory bowel disease, abnormal findings, or symptoms need clinician-managed follow-up.",
      "USPSTF permits stool DNA-FIT every 1 to 3 years. This reviewed implementation uses the source-supported 3-year option and a clinician override can record another source-supported cadence.",
      "The combined flexible-sigmoidoscopy plus FIT strategy is represented by its annual FIT component; the separate 10-year sigmoidoscopy component requires clinician tracking.",
      "A positive stool or imaging test is not a normal completion and needs diagnostic follow-up.",
    ],
    effectiveFrom: "2021-05-18",
    scenarioIds: [
      "colorectal-newly-eligible-positive",
      "colorectal-age-outside-negative",
      "colorectal-colonoscopy-normal",
      "colorectal-fit-normal",
      "colorectal-guaiac-normal",
      "colorectal-dna-fit-normal",
      "colorectal-sigmoidoscopy-normal",
      "colorectal-sigmoidoscopy-fit-normal",
      "colorectal-ct-colonography-normal",
      "colorectal-year-only-history",
      "colorectal-unknown-method",
      "colorectal-abnormal-history",
    ],
  }),
  reviewedRule({
    stableKey: "colorectal-uspstf-selective-76-85",
    serviceSlug: "colorectal-cancer-screening",
    sourceSlug: "uspstf-colorectal-cancer-screening-2021",
    evidenceGrade: "USPSTF C",
    recommendationClass: "selective",
    appliesWhen: age(76, 85),
    excludesWhen: colorectalManagedHistory,
    schedule: sharedDecisionSchedule({ startAge: 76, stopAge: 85 }),
    allowedMethods: null,
    consumerSummary:
      "For adults ages 76 through 85, colorectal screening is a selective, individualized decision.",
    whyItMatters:
      "Prior screening, overall health, preferences, and the balance of benefits and harms affect whether screening is useful.",
    limitations: [
      "This is a discussion item, not an automatic overdue task.",
      "CareCadence does not estimate life expectancy or procedural suitability.",
    ],
    effectiveFrom: "2021-05-18",
  }),
  reviewedRule({
    stableKey: "breast-uspstf-biennial-40-74",
    serviceSlug: "breast-cancer-screening",
    sourceSlug: "uspstf-breast-cancer-screening-2024",
    variantId: "uspstf_2024",
    conflictGroup: "breast-screening-guideline",
    baseline: true,
    evidenceGrade: "USPSTF B",
    recommendationClass: "routine",
    appliesWhen: all(age(40, 74), anatomyIs("breast_tissue", "present")),
    excludesWhen: conditionPresent("breast_cancer"),
    schedule: ageBasedSchedule({
      startAge: 40,
      stopAge: 74,
      interval: { unit: "years", value: 2 },
      initialDue: "on_eligibility",
    }),
    allowedMethods: ["mammography"],
    consumerSummary:
      "The USPSTF recommends screening mammography every two years from ages 40 through 74 for women.",
    whyItMatters: "Mammography can find breast cancer before symptoms develop.",
    limitations: [
      "This baseline is recorded against breast anatomy and average-risk history; prior cancer, abnormal findings, symptoms, or a high-risk plan need clinician management.",
      "The source states evidence is insufficient for screening mammography at age 75 or older and for supplemental MRI or ultrasound solely because of dense breasts.",
    ],
    effectiveFrom: "2024-04-30",
  }),
  reviewedRule({
    stableKey: "breast-acs-option-40-44",
    serviceSlug: "breast-cancer-screening",
    sourceSlug: "acs-breast-cancer-screening-guideline",
    variantId: "acs_current",
    conflictGroup: "breast-screening-guideline",
    evidenceGrade: "ACS specialty",
    recommendationClass: "shared-decision",
    appliesWhen: all(age(40, 44), anatomyIs("breast_tissue", "present")),
    excludesWhen: conditionPresent("breast_cancer"),
    schedule: sharedDecisionSchedule({ startAge: 40, stopAge: 44 }),
    allowedMethods: ["mammography"],
    consumerSummary:
      "The ACS specialty guideline says adults ages 40 through 44 should have the option to begin annual mammography.",
    whyItMatters:
      "Starting before age 45 is a preference-sensitive choice in this specialty guideline.",
    limitations: [
      "This is an optional specialty alternative, not the default federal variant.",
      "The registry source does not publish a machine-readable effective date; 2026-07-21 is the CareCadence reviewed activation date.",
    ],
    effectiveFrom: REVIEWED_AT,
  }),
  reviewedRule({
    stableKey: "breast-acs-annual-45-54",
    serviceSlug: "breast-cancer-screening",
    sourceSlug: "acs-breast-cancer-screening-guideline",
    variantId: "acs_current",
    conflictGroup: "breast-screening-guideline",
    evidenceGrade: "ACS specialty",
    recommendationClass: "routine",
    appliesWhen: all(age(45, 54), anatomyIs("breast_tissue", "present")),
    excludesWhen: conditionPresent("breast_cancer"),
    schedule: ageBasedSchedule({
      startAge: 45,
      stopAge: 54,
      interval: { unit: "years", value: 1 },
      initialDue: "on_eligibility",
    }),
    allowedMethods: ["mammography"],
    consumerSummary:
      "The ACS specialty guideline recommends annual mammography from ages 45 through 54.",
    whyItMatters: "This specialty variant uses a different interval than the federal baseline.",
    limitations: [
      "This specialty alternative must be selected explicitly and is not blended with the USPSTF interval.",
      "The registry source does not publish a machine-readable effective date; 2026-07-21 is the CareCadence reviewed activation date.",
    ],
    effectiveFrom: REVIEWED_AT,
  }),
  reviewedRule({
    stableKey: "breast-acs-biennial-55-plus",
    serviceSlug: "breast-cancer-screening",
    sourceSlug: "acs-breast-cancer-screening-guideline",
    variantId: "acs_current",
    conflictGroup: "breast-screening-guideline",
    evidenceGrade: "ACS specialty",
    recommendationClass: "routine",
    appliesWhen: all(age(55), anatomyIs("breast_tissue", "present")),
    excludesWhen: conditionPresent("breast_cancer"),
    schedule: ageBasedSchedule({
      startAge: 55,
      interval: { unit: "years", value: 2 },
      initialDue: "on_eligibility",
    }),
    allowedMethods: ["mammography"],
    consumerSummary:
      "The ACS specialty guideline says adults 55 and older may transition to mammography every two years or continue annually.",
    whyItMatters:
      "Screening continuation depends on health, preferences, and the likelihood of benefit.",
    limitations: [
      "This implementation uses the source-supported two-year option; an annual personal cadence can be recorded with a clinician override.",
      "The ACS says screening should continue while a person is in good health and expected to live at least 10 more years; CareCadence does not calculate that judgment.",
      "The registry source does not publish a machine-readable effective date; 2026-07-21 is the CareCadence reviewed activation date.",
    ],
    effectiveFrom: REVIEWED_AT,
  }),
  reviewedRule({
    stableKey: "cervical-uspstf-cytology-21-29",
    serviceSlug: "cervical-cancer-screening",
    sourceSlug: "uspstf-cervical-cancer-screening-2018",
    variantId: "uspstf_2018",
    conflictGroup: "cervical-screening-guideline",
    baseline: true,
    evidenceGrade: "USPSTF A",
    recommendationClass: "routine",
    appliesWhen: all(age(21, 29), anatomyIs("cervix", "present")),
    excludesWhen: cervicalManagedHistory,
    schedule: ageBasedSchedule({
      startAge: 21,
      stopAge: 29,
      interval: { unit: "years", value: 3 },
      initialDue: "on_eligibility",
    }),
    allowedMethods: ["cervical-cytology"],
    consumerSummary:
      "The active final USPSTF guideline recommends cervical cytology every three years from ages 21 through 29.",
    whyItMatters:
      "Routine screening can find precancerous cervical changes before cancer develops.",
    limitations: [
      "This rule does not apply to high-risk or abnormal-history follow-up.",
      "The 2024 USPSTF draft is not active and is not used for this calculation.",
    ],
    effectiveFrom: "2018-08-21",
  }),
  reviewedRule({
    stableKey: "cervical-uspstf-methods-30-65",
    serviceSlug: "cervical-cancer-screening",
    sourceSlug: "uspstf-cervical-cancer-screening-2018",
    variantId: "uspstf_2018",
    conflictGroup: "cervical-screening-guideline",
    baseline: true,
    evidenceGrade: "USPSTF A",
    recommendationClass: "routine",
    appliesWhen: all(age(30, 65), anatomyIs("cervix", "present")),
    excludesWhen: cervicalManagedHistory,
    schedule: methodDependentSchedule([
      {
        methodId: "cervical-cytology",
        interval: { unit: "years", value: 3 },
        qualifyingResults: ["normal"],
      },
      {
        methodId: "primary-high-risk-hpv",
        interval: { unit: "years", value: 5 },
        qualifyingResults: ["normal"],
      },
      {
        methodId: "co-testing",
        interval: { unit: "years", value: 5 },
        qualifyingResults: ["normal"],
      },
    ]),
    allowedMethods: ["cervical-cytology", "primary-high-risk-hpv", "co-testing"],
    consumerSummary:
      "From ages 30 through 65, the active final USPSTF guideline supports cytology every three years, primary high-risk HPV testing every five years, or co-testing every five years.",
    whyItMatters: "The next screening window depends on the method actually completed.",
    limitations: [
      "Stopping after age 65 requires adequate prior screening and no high-risk history; CareCadence cannot infer an adequate negative series from one event.",
      "A person without a cervix and without high-risk history is not routinely eligible; high-risk or abnormal history needs clinician management.",
      "The 2024 USPSTF draft is not active and is not used for this calculation.",
    ],
    effectiveFrom: "2018-08-21",
    scenarioIds: [
      "cervical-cytology-positive",
      "cervical-primary-hpv-positive",
      "cervical-cotest-positive",
      "cervical-unknown-method",
      "cervical-no-cervix-negative",
      "cervical-high-risk-managed",
      "cervical-year-only-history",
    ],
  }),
  reviewedRule({
    stableKey: "cervical-acs-methods-25-65",
    serviceSlug: "cervical-cancer-screening",
    sourceSlug: "acs-cervical-cancer-screening-guideline-2025",
    variantId: "acs_2025",
    conflictGroup: "cervical-screening-guideline",
    evidenceGrade: "ACS specialty",
    recommendationClass: "routine",
    appliesWhen: all(age(25, 65), anatomyIs("cervix", "present")),
    excludesWhen: cervicalManagedHistory,
    schedule: methodDependentSchedule([
      {
        methodId: "primary-high-risk-hpv",
        interval: { unit: "years", value: 5 },
        qualifyingResults: ["normal"],
      },
      {
        methodId: "self-collected-high-risk-hpv",
        interval: { unit: "years", value: 3 },
        qualifyingResults: ["normal"],
      },
      {
        methodId: "co-testing",
        interval: { unit: "years", value: 5 },
        qualifyingResults: ["normal"],
      },
      {
        methodId: "cervical-cytology",
        interval: { unit: "years", value: 3 },
        qualifyingResults: ["normal"],
      },
    ]),
    allowedMethods: [
      "primary-high-risk-hpv",
      "self-collected-high-risk-hpv",
      "co-testing",
      "cervical-cytology",
    ],
    consumerSummary:
      "The selected ACS specialty variant begins at age 25 and uses a method-specific interval, with primary HPV testing preferred.",
    whyItMatters:
      "The ACS alternative begins earlier than the current USPSTF HPV-based options and includes reviewed self-collection guidance.",
    limitations: [
      "This specialty alternative must be selected explicitly.",
      "Only an approved self-collected HPV test used under applicable clinical instructions qualifies for the three-year method interval.",
      "High-risk or abnormal history needs clinician-managed follow-up.",
    ],
    effectiveFrom: "2025-12-04",
    scenarioIds: [
      "cervical-acs-primary-hpv-positive",
      "cervical-acs-self-collected-positive",
      "cervical-acs-cotest-positive",
      "cervical-acs-cytology-positive",
      "cervical-acs-no-cervix-negative",
    ],
  }),
  reviewedRule({
    stableKey: "cervical-hrsa-future-30-65",
    serviceSlug: "cervical-cancer-screening",
    sourceSlug: "hrsa-womens-preventive-services-guidelines-2026-future",
    variantId: "hrsa_2027",
    conflictGroup: "cervical-screening-guideline",
    evidenceGrade: "HRSA supported",
    recommendationClass: "routine",
    appliesWhen: all(age(30, 65), anatomyIs("cervix", "present")),
    excludesWhen: cervicalManagedHistory,
    schedule: methodDependentSchedule([
      {
        methodId: "primary-high-risk-hpv",
        interval: { unit: "years", value: 5 },
        qualifyingResults: ["normal"],
      },
      {
        methodId: "self-collected-high-risk-hpv",
        interval: { unit: "years", value: 3 },
        qualifyingResults: ["normal"],
      },
      {
        methodId: "co-testing",
        interval: { unit: "years", value: 5 },
        qualifyingResults: ["normal"],
      },
      {
        methodId: "cervical-cytology",
        interval: { unit: "years", value: 3 },
        qualifyingResults: ["normal"],
      },
    ]),
    allowedMethods: [
      "primary-high-risk-hpv",
      "self-collected-high-risk-hpv",
      "co-testing",
      "cervical-cytology",
    ],
    consumerSummary:
      "This future HRSA-supported variant is available only for plan years beginning in 2027 and later.",
    whyItMatters:
      "The future coverage guideline adds reviewed method choices without changing today’s default USPSTF rule.",
    limitations: [
      "This rule is future-effective on 2027-01-01 and must not affect calculations before then.",
      "The controlling Federal Register notice is 91 FR 283, published January 5, 2026; a conflicting date on an HRSA page is not used.",
      "Coverage requirements and personal clinical suitability are different questions.",
    ],
    effectiveFrom: "2027-01-01",
  }),
  reviewedRule({
    stableKey: "prostate-uspstf-shared-decision-55-69",
    serviceSlug: "prostate-cancer-discussion",
    sourceSlug: "uspstf-prostate-cancer-screening-2018",
    evidenceGrade: "USPSTF C",
    recommendationClass: "shared-decision",
    appliesWhen: all(age(55, 69), anatomyIs("prostate", "present")),
    excludesWhen: conditionPresent("prostate_cancer"),
    schedule: sharedDecisionSchedule({ startAge: 55, stopAge: 69 }),
    allowedMethods: ["clinical-discussion", "psa"],
    consumerSummary:
      "For adults ages 55 through 69 with a prostate, PSA-based screening is an individual decision after discussing benefits and harms.",
    whyItMatters:
      "Potential benefit is small for some people and must be weighed against false positives, biopsy, overdiagnosis, and treatment harms.",
    limitations: [
      "This rule never creates an automatic annual PSA cadence.",
      "Higher-risk context can change the conversation, but the source does not provide a separate automatic interval for CareCadence to apply.",
    ],
    effectiveFrom: "2018-05-08",
  }),
  reviewedRule({
    stableKey: "prostate-uspstf-against-70-plus",
    serviceSlug: "prostate-cancer-discussion",
    sourceSlug: "uspstf-prostate-cancer-screening-2018",
    evidenceGrade: "USPSTF D",
    recommendationClass: "not-recommended",
    appliesWhen: all(age(70), anatomyIs("prostate", "present")),
    excludesWhen: conditionPresent("prostate_cancer"),
    schedule: customSchedule(),
    allowedMethods: ["clinical-discussion", "psa"],
    consumerSummary:
      "The USPSTF recommends against routine PSA-based screening at age 70 or older.",
    whyItMatters:
      "For this age group, expected screening harms outweigh the expected benefit at the population level.",
    limitations: [
      "A personal clinician plan remains visible as an override and does not rewrite the general source guidance.",
    ],
    effectiveFrom: "2018-05-08",
  }),
  reviewedRule({
    stableKey: "lung-uspstf-annual-ldct",
    serviceSlug: "lung-cancer-screening",
    sourceSlug: "uspstf-lung-cancer-screening-2021",
    evidenceGrade: "USPSTF B",
    recommendationClass: "routine",
    appliesWhen: all(
      age(50, 80),
      riskNumber("tobacco_use", "packYears", "gte", 20),
      any(
        riskEquals("tobacco_use", "currentSmoker", true),
        all(
          riskEquals("tobacco_use", "currentSmoker", false),
          riskNumber("tobacco_use", "yearsSinceQuit", "lte", 15),
        ),
      ),
    ),
    excludesWhen: conditionPresent("lung_cancer"),
    schedule: ageBasedSchedule({
      startAge: 50,
      stopAge: 80,
      interval: { unit: "years", value: 1 },
      initialDue: "on_eligibility",
    }),
    allowedMethods: ["low-dose-ct"],
    consumerSummary:
      "Annual low-dose CT screening is recommended from ages 50 through 80 for people with at least 20 pack-years who currently smoke or quit within 15 years.",
    whyItMatters:
      "For people who meet all criteria, low-dose CT can reduce the risk of dying from lung cancer.",
    limitations: [
      "Incomplete smoking amount, duration, status, or quit timing produces a history prompt instead of an overdue label.",
      "Screening stops after 15 years without smoking or when health limits curative lung surgery; CareCadence can calculate quit timing but not surgical fitness.",
      "Symptoms, prior lung cancer, or an abnormal scan need clinician-managed evaluation.",
    ],
    effectiveFrom: "2021-03-09",
  }),
  reviewedRule({
    stableKey: "skin-uspstf-insufficient-evidence",
    serviceSlug: "skin-health-review",
    sourceSlug: "uspstf-skin-cancer-screening-2023",
    evidenceGrade: "USPSTF I",
    recommendationClass: "insufficient-evidence",
    appliesWhen: age(18),
    schedule: customSchedule(),
    allowedMethods: ["clinical-discussion"],
    consumerSummary:
      "Evidence is insufficient to recommend universal clinician visual skin screening for asymptomatic adults.",
    whyItMatters:
      "A changing or concerning skin finding still deserves prompt clinical attention even though no universal screening cadence is established.",
    limitations: [
      "This item never becomes overdue without a personal or clinician cadence.",
      "The statement concerns clinician visual examination of asymptomatic people and does not apply to evaluating a symptom or known high-risk surveillance plan.",
    ],
    effectiveFrom: "2023-07-25",
  }),
];

const cardiometabolicRules: GuidelineRuleDefinition[] = [
  reviewedRule({
    stableKey: "blood-pressure-uspstf-annual-40-plus",
    serviceSlug: "blood-pressure-screening",
    sourceSlug: "uspstf-hypertension-screening-2021",
    evidenceGrade: "USPSTF A",
    recommendationClass: "routine",
    appliesWhen: age(40),
    excludesWhen: conditionPresent("hypertension"),
    schedule: ageBasedSchedule({
      startAge: 40,
      interval: { unit: "years", value: 1 },
      initialDue: "on_eligibility",
    }),
    allowedMethods: ["clinical-measurement"],
    consumerSummary:
      "The USPSTF suggests annual blood pressure screening for adults 40 or older and for adults at increased risk.",
    whyItMatters:
      "High blood pressure often has no symptoms and contributes to cardiovascular disease.",
    limitations: [
      "A positive office screen should be confirmed with measurements outside the clinical setting before starting treatment.",
      "A home reading is useful context but does not automatically satisfy this clinical screening record.",
      "Existing hypertension or abnormal measurements follow a clinician-managed plan.",
    ],
    effectiveFrom: "2021-04-27",
  }),
  reviewedRule({
    stableKey: "blood-pressure-uspstf-18-39-reasonable-interval",
    serviceSlug: "blood-pressure-screening",
    sourceSlug: "uspstf-hypertension-screening-2021",
    evidenceGrade: "USPSTF A",
    recommendationClass: "routine",
    appliesWhen: age(18, 39),
    excludesWhen: conditionPresent("hypertension"),
    schedule: ageBasedSchedule({
      startAge: 18,
      stopAge: 39,
      interval: { unit: "years", value: 3 },
      initialDue: "on_eligibility",
    }),
    allowedMethods: ["clinical-measurement"],
    consumerSummary:
      "For adults ages 18 through 39 with normal prior blood pressure and no increased risk, screening every three to five years is a reasonable source-supported interval.",
    whyItMatters: "Periodic screening can identify hypertension before complications develop.",
    limitations: [
      "This implementation uses the three-year end of the source's reasonable three-to-five-year range; a clinician override can record another source-supported interval.",
      "Increased-risk adults may need annual screening; CareCadence does not yet model every hypertension risk factor.",
    ],
    effectiveFrom: "2021-04-27",
  }),
  reviewedRule({
    stableKey: "diabetes-uspstf-age-bmi-screening",
    serviceSlug: "prediabetes-type2-diabetes-screening",
    sourceSlug: "uspstf-prediabetes-type-2-diabetes-screening-2021",
    evidenceGrade: "USPSTF B",
    recommendationClass: "routine",
    appliesWhen: all(age(35, 70), riskNumber("height_weight", "bmi", "gte", 25)),
    excludesWhen: any(
      conditionPresent("type_1_diabetes"),
      conditionPresent("type_2_diabetes"),
      conditionPresent("prediabetes"),
    ),
    schedule: ageBasedSchedule({
      startAge: 35,
      stopAge: 70,
      interval: { unit: "years", value: 3 },
      initialDue: "on_eligibility",
    }),
    allowedMethods: ["hemoglobin-a1c", "fasting-plasma-glucose", "oral-glucose-tolerance"],
    consumerSummary:
      "The USPSTF recommends screening adults ages 35 through 70 who have overweight or obesity for prediabetes and type 2 diabetes.",
    whyItMatters:
      "Screening can identify people who may benefit from effective preventive interventions.",
    limitations: [
      "The optimal repeat interval is uncertain; the source says repeating every three years after a normal result may be reasonable.",
      "The BMI threshold can differ for some populations; CareCadence uses 25 because race and ethnicity are not collected for rule evaluation.",
      "Pregnancy-related diabetes care and existing diabetes management are outside this screening rule.",
    ],
    effectiveFrom: "2021-08-24",
  }),
  reviewedRule({
    stableKey: "cardiovascular-risk-uspstf-statin-discussion-40-75",
    serviceSlug: "lipid-cardiovascular-risk-review",
    sourceSlug: "uspstf-statin-primary-prevention-2022",
    variantId: "uspstf_2022",
    conflictGroup: "cardiovascular-risk-guideline",
    baseline: true,
    evidenceGrade: "USPSTF B/C",
    recommendationClass: "shared-decision",
    appliesWhen: age(40, 75),
    excludesWhen: cardiovascularDiseaseHistory,
    schedule: customSchedule(),
    allowedMethods: ["clinical-discussion", "lipid-panel"],
    consumerSummary:
      "Adults ages 40 through 75 may need a primary-prevention cardiovascular risk assessment using risk factors and a 10-year risk estimate.",
    whyItMatters:
      "A lipid value is one input to a broader decision about cardiovascular prevention; it is not a universal annual task.",
    limitations: [
      "This source addresses preventive statin decisions, not a universal lipid screening interval.",
      "CareCadence does not calculate a validated 10-year cardiovascular risk score or recommend medication.",
      "Known cardiovascular disease follows a clinician-managed secondary-prevention plan.",
    ],
    effectiveFrom: "2022-08-23",
  }),
  reviewedRule({
    stableKey: "cardiovascular-risk-acc-aha-2026-specialty",
    serviceSlug: "lipid-cardiovascular-risk-review",
    sourceSlug: "acc-aha-dyslipidemia-guideline-2026",
    variantId: "acc_aha_2026",
    conflictGroup: "cardiovascular-risk-guideline",
    evidenceGrade: "ACC/AHA specialty",
    recommendationClass: "shared-decision",
    appliesWhen: age(18),
    schedule: customSchedule(),
    allowedMethods: ["clinical-discussion", "lipid-panel"],
    consumerSummary:
      "The 2026 ACC/AHA dyslipidemia guideline is available as a labeled specialty risk-review alternative.",
    whyItMatters:
      "A specialty cardiovascular plan may use additional risk assessment beyond the federal preventive-medication baseline.",
    limitations: [
      "This variant does not create a universal annual lipid panel.",
      "Risk estimation, treatment thresholds, pregnancy considerations, and medication choices require a clinician.",
    ],
    effectiveFrom: "2026-03-13",
  }),
  reviewedRule({
    stableKey: "weight-bmi-uspstf-intervention-discussion",
    serviceSlug: "weight-bmi-review",
    sourceSlug: "uspstf-obesity-adults-interventions-2018",
    evidenceGrade: "USPSTF B",
    recommendationClass: "shared-decision",
    appliesWhen: all(age(18), riskNumber("height_weight", "bmi", "gte", 30)),
    schedule: customSchedule(),
    allowedMethods: ["clinical-discussion"],
    consumerSummary:
      "Adults with a BMI of 30 or higher should be offered or referred to intensive, multicomponent behavioral interventions.",
    whyItMatters:
      "Supportive, sustained programs can improve health outcomes; BMI is only a screening measure and not a moral score or diagnosis.",
    limitations: [
      "CareCadence derives BMI only from valid paired measurements and does not diagnose a condition from BMI alone.",
      "No universal repeat interval is supplied by this intervention recommendation.",
    ],
    effectiveFrom: "2018-09-18",
  }),
  reviewedRule({
    stableKey: "tobacco-uspstf-adult-assessment",
    serviceSlug: "tobacco-use-review",
    sourceSlug: "uspstf-tobacco-cessation-adults-2021",
    evidenceGrade: "USPSTF A",
    recommendationClass: "custom-maintenance",
    appliesWhen: age(18),
    schedule: customSchedule(),
    allowedMethods: ["clinical-discussion"],
    consumerSummary:
      "Clinicians should ask adults about tobacco use and offer evidence-based support to people who use tobacco.",
    whyItMatters:
      "A private assessment can connect a person with appropriate support when they want it.",
    limitations: [
      "This item records an assessment or discussion and does not provide treatment instructions.",
      "The source does not define one universal repeat interval, so this item never becomes overdue without a personal cadence.",
    ],
    effectiveFrom: "2021-01-19",
  }),
  reviewedRule({
    stableKey: "alcohol-uspstf-adult-screening",
    serviceSlug: "alcohol-use-review",
    sourceSlug: "uspstf-unhealthy-alcohol-use-2018",
    evidenceGrade: "USPSTF B",
    recommendationClass: "custom-maintenance",
    appliesWhen: age(18),
    schedule: customSchedule(),
    allowedMethods: ["questionnaire", "clinical-discussion"],
    consumerSummary:
      "The USPSTF recommends screening adults for unhealthy alcohol use and offering brief counseling when appropriate.",
    whyItMatters:
      "A private, nonjudgmental screening conversation can identify use that may affect health.",
    limitations: [
      "A screening result is not a diagnosis and this app does not provide treatment instructions.",
      "The source does not establish a universal repeat cadence.",
    ],
    effectiveFrom: "2018-11-13",
  }),
  reviewedRule({
    stableKey: "activity-uspstf-individualized-offer",
    serviceSlug: "physical-activity-review",
    sourceSlug: "uspstf-diet-activity-no-cvd-risk-2022",
    evidenceGrade: "USPSTF C",
    recommendationClass: "selective",
    appliesWhen: age(18),
    excludesWhen: cardiovascularDiseaseHistory,
    schedule: customSchedule(),
    allowedMethods: ["clinical-discussion"],
    consumerSummary:
      "For adults without known cardiovascular risk factors, clinicians may selectively offer behavioral counseling about physical activity.",
    whyItMatters:
      "Support can help people make activity changes that fit their goals and circumstances.",
    limitations: [
      "This is an individualized offer, not a universal overdue task.",
      "Adults with cardiovascular risk factors are addressed by separate source guidance and may need a clinician-directed plan.",
    ],
    effectiveFrom: "2022-07-26",
  }),
  reviewedRule({
    stableKey: "nutrition-uspstf-individualized-offer",
    serviceSlug: "nutrition-review",
    sourceSlug: "uspstf-diet-activity-no-cvd-risk-2022",
    evidenceGrade: "USPSTF C",
    recommendationClass: "selective",
    appliesWhen: age(18),
    excludesWhen: cardiovascularDiseaseHistory,
    schedule: customSchedule(),
    allowedMethods: ["clinical-discussion"],
    consumerSummary:
      "For adults without known cardiovascular risk factors, clinicians may selectively offer behavioral counseling about a healthy diet.",
    whyItMatters:
      "Support can help people make nutrition changes that fit their goals, culture, access, and circumstances.",
    limitations: [
      "This is an individualized offer, not a universal overdue task.",
      "CareCadence does not prescribe a diet or provide treatment instructions.",
    ],
    effectiveFrom: "2022-07-26",
  }),
];

const boneVascularAndInfectiousRules: GuidelineRuleDefinition[] = [
  reviewedRule({
    stableKey: "osteoporosis-uspstf-women-65-plus",
    serviceSlug: "osteoporosis-screening",
    sourceSlug: "uspstf-osteoporosis-screening-2025",
    evidenceGrade: "USPSTF B",
    recommendationClass: "routine",
    appliesWhen: all(age(65), sexAssignedAtBirth("female")),
    excludesWhen: any(conditionPresent("osteoporosis"), conditionPresent("fragility_fracture")),
    schedule: oneTimeSchedule(),
    allowedMethods: ["dxa"],
    consumerSummary: "The USPSTF recommends osteoporosis screening for women age 65 or older.",
    whyItMatters:
      "Risk assessment and bone measurement can identify people at higher risk of fractures.",
    limitations: [
      "Prior osteoporosis, a fragility fracture, or an abnormal result needs clinician-managed care rather than average-risk screening.",
      "The source does not establish a universal repeat DXA interval after a normal result.",
      "Sex assigned at birth is used only because this source frames its evidence by women and men; anatomy, menopause, medication, and individual risk still require clinical review.",
    ],
    effectiveFrom: "2025-01-14",
  }),
  reviewedRule({
    stableKey: "osteoporosis-uspstf-younger-postmenopausal-risk-review",
    serviceSlug: "osteoporosis-screening",
    sourceSlug: "uspstf-osteoporosis-screening-2025",
    evidenceGrade: "USPSTF B",
    recommendationClass: "shared-decision",
    appliesWhen: all(age(50, 64), sexAssignedAtBirth("female")),
    excludesWhen: any(conditionPresent("osteoporosis"), conditionPresent("fragility_fracture")),
    schedule: customSchedule(),
    allowedMethods: ["dxa"],
    consumerSummary:
      "Postmenopausal women younger than 65 should first have fracture risk assessed; screening is recommended when risk is increased.",
    whyItMatters: "A two-step risk assessment helps avoid treating age alone as the decision.",
    limitations: [
      "CareCadence does not collect menopause status or calculate a validated fracture-risk tool, so this is a discussion prompt and never an automatic overdue task.",
      "A clinician should decide whether DXA is appropriate.",
    ],
    effectiveFrom: "2025-01-14",
  }),
  reviewedRule({
    stableKey: "osteoporosis-uspstf-men-insufficient-evidence",
    serviceSlug: "osteoporosis-screening",
    sourceSlug: "uspstf-osteoporosis-screening-2025",
    evidenceGrade: "USPSTF I",
    recommendationClass: "insufficient-evidence",
    appliesWhen: all(age(65), sexAssignedAtBirth("male")),
    excludesWhen: any(conditionPresent("osteoporosis"), conditionPresent("fragility_fracture")),
    schedule: customSchedule(),
    allowedMethods: ["dxa"],
    consumerSummary:
      "For men, the USPSTF finds evidence insufficient to assess the balance of benefits and harms of routine osteoporosis screening.",
    whyItMatters:
      "Individual fracture risk can still justify a clinical discussion even without a universal screening recommendation.",
    limitations: ["This item never becomes overdue without a clinician-defined plan."],
    effectiveFrom: "2025-01-14",
  }),
  reviewedRule({
    stableKey: "aaa-uspstf-men-65-75-ever-smoked",
    serviceSlug: "abdominal-aortic-aneurysm-screening",
    sourceSlug: "uspstf-abdominal-aortic-aneurysm-screening-2019",
    evidenceGrade: "USPSTF B",
    recommendationClass: "routine",
    appliesWhen: all(
      age(65, 75),
      sexAssignedAtBirth("male"),
      riskNumber("tobacco_use", "packYears", "gt", 0),
    ),
    schedule: oneTimeSchedule(),
    allowedMethods: ["abdominal-ultrasound"],
    consumerSummary:
      "The USPSTF recommends one-time ultrasound screening for men ages 65 through 75 who have ever smoked.",
    whyItMatters: "An abdominal aortic aneurysm can enlarge without symptoms and may rupture.",
    limitations: [
      "The source defines ever smoked as at least 100 cigarettes. CareCadence uses a recorded positive pack-year history; incomplete amount or duration produces a history prompt.",
      "An abnormal result exits routine screening and needs clinician-managed surveillance.",
    ],
    effectiveFrom: "2019-12-10",
  }),
  reviewedRule({
    stableKey: "aaa-uspstf-men-65-75-never-smoked",
    serviceSlug: "abdominal-aortic-aneurysm-screening",
    sourceSlug: "uspstf-abdominal-aortic-aneurysm-screening-2019",
    evidenceGrade: "USPSTF C",
    recommendationClass: "selective",
    appliesWhen: all(
      age(65, 75),
      sexAssignedAtBirth("male"),
      riskEquals("tobacco_use", "status", "never"),
    ),
    schedule: oneTimeSchedule(),
    allowedMethods: ["abdominal-ultrasound"],
    consumerSummary:
      "For men ages 65 through 75 who have never smoked, one-time AAA screening should be offered selectively.",
    whyItMatters:
      "Family history and other risk factors affect whether the small expected benefit is worthwhile.",
    limitations: [
      "This is a selective discussion, not an automatic overdue task.",
      "CareCadence records family history but does not calculate overall AAA risk.",
    ],
    effectiveFrom: "2019-12-10",
  }),
  reviewedRule({
    stableKey: "aaa-uspstf-women-never-smoked-against",
    serviceSlug: "abdominal-aortic-aneurysm-screening",
    sourceSlug: "uspstf-abdominal-aortic-aneurysm-screening-2019",
    evidenceGrade: "USPSTF D",
    recommendationClass: "not-recommended",
    appliesWhen: all(
      age(65, 75),
      sexAssignedAtBirth("female"),
      riskEquals("tobacco_use", "status", "never"),
      {
        op: "not",
        child: {
          op: "family_history_present",
          conditionCode: "abdominal_aortic_aneurysm",
        },
      },
    ),
    schedule: customSchedule(),
    allowedMethods: ["abdominal-ultrasound"],
    consumerSummary:
      "The USPSTF recommends against routine AAA screening for women who have never smoked and have no family history of AAA.",
    whyItMatters: "In this group, expected harms from screening outweigh expected benefit.",
    limitations: [
      "Family history can change the applicable source subgroup and should be discussed with a clinician.",
      "A personal clinician plan remains available as an override.",
    ],
    effectiveFrom: "2019-12-10",
  }),
  reviewedRule({
    stableKey: "aaa-uspstf-women-ever-smoked-insufficient",
    serviceSlug: "abdominal-aortic-aneurysm-screening",
    sourceSlug: "uspstf-abdominal-aortic-aneurysm-screening-2019",
    evidenceGrade: "USPSTF I",
    recommendationClass: "insufficient-evidence",
    appliesWhen: all(
      age(65, 75),
      sexAssignedAtBirth("female"),
      any(riskNumber("tobacco_use", "packYears", "gt", 0), {
        op: "family_history_present",
        conditionCode: "abdominal_aortic_aneurysm",
      }),
    ),
    schedule: customSchedule(),
    allowedMethods: ["abdominal-ultrasound"],
    consumerSummary:
      "For women ages 65 through 75 who have ever smoked or have a family history, evidence is insufficient for a universal AAA screening recommendation.",
    whyItMatters:
      "The decision depends on individual risk and the uncertain balance of benefit and harm.",
    limitations: ["This item never becomes overdue without a clinician-defined plan."],
    effectiveFrom: "2019-12-10",
  }),
  reviewedRule({
    stableKey: "hepatitis-c-uspstf-one-time-18-79",
    serviceSlug: "hepatitis-c-screening",
    sourceSlug: "uspstf-hepatitis-c-screening-2020",
    evidenceGrade: "USPSTF B",
    recommendationClass: "routine",
    appliesWhen: age(18, 79),
    excludesWhen: conditionPresent("hepatitis_c"),
    schedule: oneTimeSchedule(),
    allowedMethods: ["blood-test"],
    consumerSummary: "The USPSTF recommends hepatitis C screening for adults ages 18 through 79.",
    whyItMatters:
      "Hepatitis C can cause serious liver disease and may be present without symptoms.",
    limitations: [
      "Most adults need screening once; people with ongoing risk may need periodic screening under a clinician plan.",
      "A positive or abnormal result needs confirmatory testing and clinician-managed care.",
      "Pregnancy is not used to personalize this rule.",
    ],
    effectiveFrom: "2020-03-02",
  }),
  reviewedRule({
    stableKey: "hiv-uspstf-routine-15-65",
    serviceSlug: "hiv-screening",
    sourceSlug: "uspstf-hiv-screening-2019",
    evidenceGrade: "USPSTF A",
    recommendationClass: "routine",
    appliesWhen: age(15, 65),
    excludesWhen: conditionPresent("hiv"),
    schedule: oneTimeSchedule(),
    allowedMethods: ["blood-test"],
    consumerSummary:
      "The USPSTF recommends HIV screening for adolescents and adults ages 15 through 65.",
    whyItMatters: "Early diagnosis allows effective care and helps prevent transmission.",
    limitations: [
      "People outside the routine age range and people with ongoing risk may also need screening; a clinician should set repeat timing.",
      "A positive or abnormal result needs confirmatory testing and clinician-managed care.",
      "This sensitive service is excluded from household activity details and reminder subjects.",
    ],
    effectiveFrom: "2019-06-11",
  }),
  reviewedRule({
    stableKey: "hepatitis-b-uspstf-risk-based",
    serviceSlug: "hepatitis-b-screening",
    sourceSlug: "uspstf-hepatitis-b-screening-2020",
    variantId: "uspstf_2020_risk_based",
    conflictGroup: "hepatitis-b-screening-guideline",
    baseline: true,
    evidenceGrade: "USPSTF B",
    recommendationClass: "routine",
    appliesWhen: all(
      age(18),
      any(
        riskEquals("sexual_health_risk", "value", "present"),
        conditionPresent("hiv"),
        conditionPresent("hepatitis_c"),
      ),
    ),
    excludesWhen: conditionPresent("hepatitis_b"),
    schedule: oneTimeSchedule(),
    allowedMethods: ["triple-panel-blood-test"],
    consumerSummary:
      "The USPSTF recommends hepatitis B screening for adolescents and adults at increased risk.",
    whyItMatters:
      "Hepatitis B may be present without symptoms and can cause chronic liver disease.",
    limitations: [
      "CareCadence intentionally captures only a small, consent-based subset of sensitive risk context and cannot identify every USPSTF risk group.",
      "Country-of-birth prevalence, household exposure, injection history, and pregnancy-related screening require a clinician discussion.",
      "A positive result needs clinician-managed care.",
    ],
    effectiveFrom: "2020-12-15",
  }),
  reviewedRule({
    stableKey: "hepatitis-b-cdc-universal-adult-once",
    serviceSlug: "hepatitis-b-screening",
    sourceSlug: "cdc-hepatitis-b-universal-screening-2023",
    variantId: "cdc_2023_universal",
    conflictGroup: "hepatitis-b-screening-guideline",
    evidenceGrade: "CDC 2023",
    recommendationClass: "routine",
    appliesWhen: age(18),
    excludesWhen: conditionPresent("hepatitis_b"),
    schedule: oneTimeSchedule(),
    allowedMethods: ["triple-panel-blood-test"],
    consumerSummary:
      "The CDC recommends that all adults be screened at least once for hepatitis B with a triple panel.",
    whyItMatters:
      "Universal once-in-adulthood screening can identify infection, immunity, or susceptibility.",
    limitations: [
      "This CDC public-health variant is distinct from the default USPSTF risk-based variant and must be selected explicitly.",
      "People with ongoing risk and people who are pregnant may need additional testing under current clinician guidance.",
    ],
    effectiveFrom: "2023-03-10",
  }),
  reviewedRule({
    stableKey: "sti-uspstf-chlamydia-gonorrhea-risk-based",
    serviceSlug: "sti-screening",
    sourceSlug: "uspstf-chlamydia-gonorrhea-screening-2021",
    evidenceGrade: "USPSTF B",
    recommendationClass: "shared-decision",
    appliesWhen: all(
      age(15),
      sexAssignedAtBirth("female"),
      riskEquals("sexual_health_risk", "value", "present"),
    ),
    schedule: customSchedule(),
    allowedMethods: ["chlamydia-gonorrhea-test"],
    consumerSummary:
      "The USPSTF recommends chlamydia and gonorrhea screening for sexually active women age 24 or younger and for older women at increased risk.",
    whyItMatters: "Screening can find infections that have no symptoms and prevent complications.",
    limitations: [
      "CareCadence does not infer sexual activity, pregnancy, gender, anatomy, or specific exposures; this private prompt appears only from consent-based risk input.",
      "The source does not define one universal repeat interval, so timing belongs in a clinician plan.",
      "Evidence is insufficient for routine screening in men; individualized testing may still be appropriate.",
    ],
    effectiveFrom: "2021-09-14",
  }),
  reviewedRule({
    stableKey: "sti-uspstf-syphilis-increased-risk",
    serviceSlug: "sti-screening",
    sourceSlug: "uspstf-syphilis-screening-2022",
    evidenceGrade: "USPSTF A",
    recommendationClass: "shared-decision",
    appliesWhen: all(age(15), riskEquals("sexual_health_risk", "value", "present")),
    schedule: customSchedule(),
    allowedMethods: ["syphilis-blood-test"],
    consumerSummary:
      "The USPSTF recommends syphilis screening for nonpregnant adolescents and adults who are at increased risk.",
    whyItMatters:
      "Testing can identify infection early and prevent serious health effects and transmission.",
    limitations: [
      "This private prompt uses only consent-based risk input and does not display the underlying detail in household activity.",
      "Local epidemiology, pregnancy, and the frequency of ongoing risk require a clinician to set timing.",
    ],
    effectiveFrom: "2022-09-27",
  }),
];

const mentalBehavioralAndFunctionalRules: GuidelineRuleDefinition[] = [
  reviewedRule({
    stableKey: "depression-uspstf-adult-screening",
    serviceSlug: "depression-screening",
    sourceSlug: "uspstf-depression-suicide-risk-adults-2023",
    evidenceGrade: "USPSTF B",
    recommendationClass: "custom-maintenance",
    appliesWhen: age(18),
    schedule: customSchedule(),
    allowedMethods: ["questionnaire"],
    consumerSummary:
      "The USPSTF recommends depression screening for adults when systems are in place for diagnosis, treatment, and follow-up.",
    whyItMatters:
      "A screening questionnaire can identify people who may benefit from a fuller clinical assessment.",
    limitations: [
      "A screening result is not a diagnosis and concerning results need timely clinical assessment.",
      "The source found insufficient evidence for suicide-risk screening and does not define an optimal repeat interval.",
      "This item never becomes overdue without a personal or clinician cadence.",
    ],
    effectiveFrom: "2023-06-20",
  }),
  reviewedRule({
    stableKey: "anxiety-uspstf-adults-through-64",
    serviceSlug: "anxiety-screening",
    sourceSlug: "uspstf-anxiety-adults-screening-2023",
    evidenceGrade: "USPSTF B",
    recommendationClass: "custom-maintenance",
    appliesWhen: age(18, 64),
    schedule: customSchedule(),
    allowedMethods: ["questionnaire"],
    consumerSummary:
      "The USPSTF recommends screening adults age 64 or younger for anxiety disorders.",
    whyItMatters:
      "Screening can identify people who may benefit from a fuller clinical assessment and support.",
    limitations: [
      "A screening result is not a diagnosis and the source does not define an optimal repeat interval.",
      "This rule does not distinguish pregnancy or postpartum status.",
    ],
    effectiveFrom: "2023-06-20",
  }),
  reviewedRule({
    stableKey: "anxiety-uspstf-65-plus-insufficient",
    serviceSlug: "anxiety-screening",
    sourceSlug: "uspstf-anxiety-adults-screening-2023",
    evidenceGrade: "USPSTF I",
    recommendationClass: "insufficient-evidence",
    appliesWhen: age(65),
    schedule: customSchedule(),
    allowedMethods: ["questionnaire"],
    consumerSummary:
      "For adults age 65 or older, the USPSTF finds evidence insufficient for universal anxiety screening.",
    whyItMatters:
      "Symptoms or concerns still deserve clinical attention even without a universal screening recommendation.",
    limitations: ["This item never becomes overdue without a clinician-defined plan."],
    effectiveFrom: "2023-06-20",
  }),
  reviewedRule({
    stableKey: "relationship-safety-uspstf-reproductive-age",
    serviceSlug: "intimate-partner-safety",
    sourceSlug: "uspstf-intimate-partner-violence-screening-2025",
    evidenceGrade: "USPSTF B",
    recommendationClass: "custom-maintenance",
    appliesWhen: all(age(18, 49), sexAssignedAtBirth("female")),
    schedule: customSchedule(),
    allowedMethods: ["questionnaire"],
    consumerSummary:
      "The USPSTF recommends screening women of reproductive age for intimate partner violence and providing or referring to ongoing support when needed.",
    whyItMatters: "A private, trauma-informed check-in can make it easier to connect with support.",
    limitations: [
      "This sensitive item is owner-private and excluded from household activity, shared reminders, exports for other members, and notification subjects.",
      "CareCadence does not assess immediate danger or replace emergency or professional support.",
      "The app uses an age proxy because reproductive status is not inferred.",
    ],
    effectiveFrom: "2025-06-24",
  }),
  reviewedRule({
    stableKey: "falls-uspstf-increased-risk-65-plus",
    serviceSlug: "fall-risk-review",
    sourceSlug: "uspstf-falls-prevention-older-adults-2024",
    evidenceGrade: "USPSTF B/C",
    recommendationClass: "selective",
    appliesWhen: all(age(65), riskEquals("fall_risk", "concern", "yes")),
    schedule: customSchedule(),
    allowedMethods: ["questionnaire"],
    consumerSummary:
      "For community-dwelling adults 65 or older at increased fall risk, exercise interventions are recommended and multifactorial interventions may be offered selectively.",
    whyItMatters: "A risk review can support an individualized fall-prevention plan.",
    limitations: [
      "This service records a risk review, not an exercise prescription or diagnosis.",
      "The source does not establish a universal screening cadence.",
    ],
    effectiveFrom: "2024-06-04",
  }),
  reviewedRule({
    stableKey: "hearing-uspstf-asymptomatic-50-plus-insufficient",
    serviceSlug: "hearing-review",
    sourceSlug: "uspstf-hearing-loss-screening-2021",
    evidenceGrade: "USPSTF I",
    recommendationClass: "insufficient-evidence",
    appliesWhen: age(50),
    schedule: customSchedule(),
    allowedMethods: ["clinical-discussion"],
    consumerSummary:
      "For asymptomatic adults age 50 or older, evidence is insufficient for universal hearing-loss screening.",
    whyItMatters:
      "Hearing concerns still deserve evaluation even though no universal screening cadence is established.",
    limitations: [
      "This statement does not apply to people with symptoms or a clinician-directed hearing plan and never creates an overdue task.",
    ],
    effectiveFrom: "2021-03-23",
  }),
  reviewedRule({
    stableKey: "vision-uspstf-asymptomatic-65-plus-insufficient",
    serviceSlug: "vision-review",
    sourceSlug: "uspstf-visual-acuity-screening-2022",
    evidenceGrade: "USPSTF I",
    recommendationClass: "insufficient-evidence",
    appliesWhen: age(65),
    schedule: customSchedule(),
    allowedMethods: ["clinical-discussion"],
    consumerSummary:
      "For asymptomatic adults age 65 or older, evidence is insufficient for universal impaired-visual-acuity screening in primary care.",
    whyItMatters: "Vision changes or concerns still warrant an eye-care evaluation.",
    limitations: [
      "This statement does not replace symptom evaluation, diabetes eye care, glaucoma care, or a personal eye-exam plan.",
    ],
    effectiveFrom: "2022-05-24",
  }),
  reviewedRule({
    stableKey: "cognition-uspstf-asymptomatic-65-plus-insufficient",
    serviceSlug: "cognitive-concern-review",
    sourceSlug: "uspstf-cognitive-impairment-screening-2020",
    evidenceGrade: "USPSTF I",
    recommendationClass: "insufficient-evidence",
    appliesWhen: age(65),
    schedule: customSchedule(),
    allowedMethods: ["clinical-discussion"],
    consumerSummary:
      "For community-dwelling adults age 65 or older without recognized signs or symptoms, evidence is insufficient for universal cognitive-impairment screening.",
    whyItMatters:
      "A new concern from the person, family, or clinician still deserves appropriate evaluation.",
    limitations: [
      "A screening result is not a diagnosis.",
      "This item never becomes overdue and does not apply to evaluation of reported symptoms.",
    ],
    effectiveFrom: "2020-02-25",
  }),
  reviewedRule({
    stableKey: "function-review-no-universal-cadence",
    serviceSlug: "functional-status-review",
    sourceSlug: "uspstf-cognitive-impairment-screening-2020",
    evidenceGrade: "Source boundary",
    recommendationClass: "insufficient-evidence",
    appliesWhen: age(65),
    schedule: customSchedule(),
    allowedMethods: ["clinical-discussion"],
    consumerSummary:
      "No universal functional-status screening cadence is encoded; record a concern or follow a personal clinician plan.",
    whyItMatters:
      "Changes in daily function can be important context for a clinician even when a universal preventive screening schedule is not established.",
    limitations: [
      "The cited USPSTF statement addresses cognitive-impairment screening, not a standalone recommendation for periodic functional-status screening.",
      "This source-boundary item never becomes overdue and must not be presented as a federal functional-screening requirement.",
      "Symptoms, safety concerns, and changes in daily activities deserve timely individualized evaluation.",
    ],
    effectiveFrom: "2020-02-25",
  }),
];

const cdcVaccineSource = "cdc-adult-immunization-schedule-2025-operative";

const immunizationRules: GuidelineRuleDefinition[] = [
  reviewedRule({
    stableKey: "influenza-cdc-seasonal-adult",
    serviceSlug: "influenza-vaccine",
    sourceSlug: cdcVaccineSource,
    evidenceGrade: "CDC/ACIP operative",
    recommendationClass: "routine",
    appliesWhen: age(19),
    schedule: seasonalSchedule(9, 6, true),
    allowedMethods: ["dose-record"],
    consumerSummary:
      "CDC adult guidance recommends influenza vaccination every season for adults who do not have a contraindication.",
    whyItMatters: "Seasonal vaccination lowers the risk of influenza and serious complications.",
    limitations: [
      "The September-through-June planning window is an app planning representation, not a claim that every month is equally preferred.",
      "CareCadence does not perform individualized vaccine safety or contraindication screening.",
    ],
    effectiveFrom: "2025-07-02",
  }),
  reviewedRule({
    stableKey: "covid-cdc-current-guidance-discussion",
    serviceSlug: "covid-vaccine",
    sourceSlug: cdcVaccineSource,
    evidenceGrade: "CDC operative source limitation",
    recommendationClass: "shared-decision",
    appliesWhen: age(19),
    schedule: customSchedule(),
    allowedMethods: ["dose-record"],
    consumerSummary:
      "Review the current seasonal COVID-19 vaccine guidance with a clinician or pharmacist.",
    whyItMatters:
      "Recommendations can depend on the current season, prior doses, age, and health context.",
    limitations: [
      "Under the 2026 federal injunction boundary, the operative adult schedule source is dated July 2, 2025, while the available COVID schedule content is inconsistent or stale.",
      "CareCadence therefore does not calculate a COVID dose cadence or mark this item overdue until current operative seasonal guidance is reviewed and versioned.",
      "The live CDC page cannot directly change this rule.",
    ],
    effectiveFrom: "2025-07-02",
  }),
  reviewedRule({
    stableKey: "tdap-td-cdc-primary-and-ten-year-booster",
    serviceSlug: "tdap-td-vaccine",
    sourceSlug: cdcVaccineSource,
    evidenceGrade: "CDC/ACIP operative",
    recommendationClass: "routine",
    appliesWhen: age(19),
    schedule: doseSeriesSchedule("tdap-td-adult", [{ ordinal: 1 }], {
      interval: { unit: "years", value: 10 },
    }),
    allowedMethods: ["dose-record", "tdap", "td"],
    consumerSummary:
      "Adults should have one Tdap dose, then a Td or Tdap booster every 10 years, with additional wound or pregnancy guidance when applicable.",
    whyItMatters:
      "Vaccination protects against tetanus and diphtheria, and Tdap also protects against pertussis.",
    limitations: [
      "A product-unspecified first dose cannot prove that the adult Tdap requirement was met and should be confirmed.",
      "Pregnancy and wound-management schedules require current clinician guidance and are not calculated here.",
      "CareCadence does not perform individualized vaccine safety screening.",
    ],
    effectiveFrom: "2025-07-02",
  }),
  reviewedRule({
    stableKey: "zoster-cdc-two-dose-50-plus",
    serviceSlug: "zoster-vaccine",
    sourceSlug: cdcVaccineSource,
    evidenceGrade: "CDC/ACIP operative",
    recommendationClass: "routine",
    appliesWhen: age(50),
    schedule: doseSeriesSchedule("recombinant-zoster", [
      { ordinal: 1 },
      {
        ordinal: 2,
        minimumIntervalFromPrior: { unit: "weeks", value: 4 },
        recommendedIntervalFromPrior: { unit: "months", value: 2 },
      },
    ]),
    allowedMethods: ["dose-record", "recombinant-zoster"],
    consumerSummary:
      "CDC adult guidance recommends a two-dose recombinant zoster vaccine series beginning at age 50.",
    whyItMatters: "Vaccination lowers the risk of shingles and its complications.",
    limitations: [
      "The usual second-dose window is two to six months; the engine displays the recommended two-month anchor and accepts later valid doses.",
      "A shorter one-to-two-month interval may be used for some immunocompromised people under clinician guidance.",
    ],
    effectiveFrom: "2025-07-02",
  }),
  reviewedRule({
    stableKey: "zoster-cdc-immunocompromised-19-49",
    serviceSlug: "zoster-vaccine",
    sourceSlug: cdcVaccineSource,
    evidenceGrade: "CDC/ACIP operative",
    recommendationClass: "shared-decision",
    appliesWhen: all(age(19, 49), riskEquals("immunocompromised", "value", "yes")),
    schedule: doseSeriesSchedule("recombinant-zoster", [
      { ordinal: 1 },
      {
        ordinal: 2,
        minimumIntervalFromPrior: { unit: "weeks", value: 4 },
        recommendedIntervalFromPrior: { unit: "months", value: 2 },
      },
    ]),
    allowedMethods: ["dose-record", "recombinant-zoster"],
    consumerSummary:
      "Adults age 19 or older who are or will be immunodeficient or immunosuppressed may need the two-dose recombinant zoster series.",
    whyItMatters: "Immunocompromise can increase the risk and severity of shingles.",
    limitations: [
      "The app uses only a broad consent-based immunocompromised flag and cannot determine timing around treatment or individualized safety.",
      "Confirm the series and interval with a clinician.",
    ],
    effectiveFrom: "2025-07-02",
  }),
  reviewedRule({
    stableKey: "pneumococcal-cdc-age-50-plus-review",
    serviceSlug: "pneumococcal-vaccine",
    sourceSlug: cdcVaccineSource,
    evidenceGrade: "CDC/ACIP operative",
    recommendationClass: "shared-decision",
    appliesWhen: age(50),
    schedule: oneTimeSchedule(),
    allowedMethods: ["pcv20", "pcv21"],
    consumerSummary:
      "CDC adult guidance recommends reviewing pneumococcal vaccination at age 50 or older; a single PCV20 or PCV21 can complete the simplified pathway.",
    whyItMatters: "Pneumococcal vaccination helps prevent serious pneumococcal disease.",
    limitations: [
      "The evidence recommendation is routine, but CareCadence presents a discussion state because prior PCV15, PCV13, PPSV23, product, dates, and risk context can change what remains due.",
      "Only a recorded PCV20 or PCV21 is treated as completing this simplified rule. Other histories require a clinician or pharmacist plan rather than an automatic overdue label.",
      "CareCadence does not perform individualized vaccine safety screening.",
    ],
    effectiveFrom: "2025-07-02",
  }),
  reviewedRule({
    stableKey: "pneumococcal-cdc-risk-review-19-49",
    serviceSlug: "pneumococcal-vaccine",
    sourceSlug: cdcVaccineSource,
    evidenceGrade: "CDC/ACIP operative",
    recommendationClass: "shared-decision",
    appliesWhen: all(age(19, 49), riskEquals("immunocompromised", "value", "yes")),
    schedule: customSchedule(),
    allowedMethods: ["dose-record", "pcv15", "pcv20", "pcv21", "ppsv23"],
    consumerSummary:
      "Some adults younger than 50 with a risk condition need pneumococcal vaccination.",
    whyItMatters:
      "Certain health conditions can increase the risk of serious pneumococcal disease.",
    limitations: [
      "The app captures only a broad immunocompromised flag and cannot represent every CDC risk condition or product sequence.",
      "A clinician or pharmacist should set the product and interval; this item never becomes automatically overdue.",
    ],
    effectiveFrom: "2025-07-02",
  }),
  reviewedRule({
    stableKey: "rsv-cdc-routine-75-plus",
    serviceSlug: "rsv-vaccine",
    sourceSlug: cdcVaccineSource,
    evidenceGrade: "CDC/ACIP operative",
    recommendationClass: "routine",
    appliesWhen: age(75),
    schedule: oneTimeSchedule(),
    allowedMethods: ["dose-record"],
    consumerSummary:
      "CDC adult guidance recommends one RSV vaccine dose for adults age 75 or older who have not received one.",
    whyItMatters: "Older adults have a higher risk of severe RSV illness.",
    limitations: [
      "RSV vaccination is not currently represented as an annual dose.",
      "Timing with pregnancy or other vaccines and individualized safety require current clinician guidance.",
    ],
    effectiveFrom: "2025-07-02",
  }),
  reviewedRule({
    stableKey: "rsv-cdc-increased-risk-60-74",
    serviceSlug: "rsv-vaccine",
    sourceSlug: cdcVaccineSource,
    evidenceGrade: "CDC/ACIP operative",
    recommendationClass: "shared-decision",
    appliesWhen: all(age(60, 74), riskEquals("immunocompromised", "value", "yes")),
    schedule: oneTimeSchedule(),
    allowedMethods: ["dose-record"],
    consumerSummary:
      "Adults ages 60 through 74 at increased risk of severe RSV disease should review one-dose vaccination.",
    whyItMatters:
      "Some health conditions increase the chance of hospitalization or severe RSV illness.",
    limitations: [
      "CareCadence models only a broad immunocompromised flag and cannot identify every increased-risk condition.",
      "This is a clinician or pharmacist discussion, not individualized vaccine clearance.",
    ],
    effectiveFrom: "2025-07-02",
  }),
  reviewedRule({
    stableKey: "rsv-cdc-addendum-increased-risk-50-59",
    serviceSlug: "rsv-vaccine",
    sourceSlug: "cdc-adult-immunization-addendum-rsv-2026",
    evidenceGrade: "CDC amendment 2026",
    recommendationClass: "shared-decision",
    appliesWhen: all(age(50, 59), riskEquals("immunocompromised", "value", "yes")),
    schedule: oneTimeSchedule(),
    allowedMethods: ["dose-record"],
    consumerSummary:
      "The operative April 27, 2026 addendum extends RSV vaccination review to adults ages 50 through 59 at increased risk of severe disease.",
    whyItMatters:
      "The amendment expands protection for younger adults with important risk conditions.",
    limitations: [
      "This rule applies only the reviewed RSV amendment; it does not import unrelated later CDC page changes.",
      "CareCadence models only a broad immunocompromised flag and cannot identify every increased-risk condition.",
    ],
    effectiveFrom: "2026-04-27",
  }),
  reviewedRule({
    stableKey: "hpv-cdc-routine-through-26",
    serviceSlug: "hpv-vaccine",
    sourceSlug: cdcVaccineSource,
    evidenceGrade: "CDC/ACIP operative",
    recommendationClass: "routine",
    appliesWhen: age(19, 26),
    schedule: doseSeriesSchedule("hpv-adult-three-dose", [
      { ordinal: 1 },
      {
        ordinal: 2,
        minimumIntervalFromPrior: { unit: "weeks", value: 4 },
        recommendedIntervalFromPrior: { unit: "months", value: 2 },
      },
      {
        ordinal: 3,
        minimumIntervalFromPrior: { unit: "weeks", value: 12 },
        recommendedIntervalFromPrior: { unit: "months", value: 4 },
      },
    ]),
    allowedMethods: ["dose-record"],
    consumerSummary:
      "CDC adult guidance recommends completing HPV vaccination through age 26 if the series was not completed earlier.",
    whyItMatters:
      "HPV vaccination prevents infections that can cause several cancers and genital warts.",
    limitations: [
      "People who began the series before age 15 generally use a two-dose schedule; the current engine cannot derive age at first dose and conservatively displays the adult three-dose path until history is confirmed.",
      "The third dose also must be at least five months after the first; the engine checks the minimum interval from the prior dose and flags uncertain histories for confirmation.",
    ],
    effectiveFrom: "2025-07-02",
  }),
  reviewedRule({
    stableKey: "hpv-cdc-shared-decision-27-45",
    serviceSlug: "hpv-vaccine",
    sourceSlug: cdcVaccineSource,
    evidenceGrade: "CDC shared decision",
    recommendationClass: "shared-decision",
    appliesWhen: age(27, 45),
    schedule: doseSeriesSchedule("hpv-adult-three-dose", [
      { ordinal: 1 },
      {
        ordinal: 2,
        minimumIntervalFromPrior: { unit: "weeks", value: 4 },
        recommendedIntervalFromPrior: { unit: "months", value: 2 },
      },
      {
        ordinal: 3,
        minimumIntervalFromPrior: { unit: "weeks", value: 12 },
        recommendedIntervalFromPrior: { unit: "months", value: 4 },
      },
    ]),
    allowedMethods: ["dose-record"],
    consumerSummary:
      "For some adults ages 27 through 45 who are not adequately vaccinated, HPV vaccination is a shared clinical decision.",
    whyItMatters:
      "Some people may still benefit depending on prior vaccination and likely future exposure.",
    limitations: [
      "This is not routine catch-up vaccination for everyone in this age range and never appears as an automatic overdue task.",
      "Age at first dose and prior product history should be confirmed.",
    ],
    effectiveFrom: "2025-07-02",
  }),
  reviewedRule({
    stableKey: "hepatitis-a-cdc-risk-or-request",
    serviceSlug: "hepatitis-a-vaccine",
    sourceSlug: cdcVaccineSource,
    evidenceGrade: "CDC/ACIP operative",
    recommendationClass: "shared-decision",
    appliesWhen: age(19),
    schedule: doseSeriesSchedule("hepatitis-a-two-dose", [
      { ordinal: 1 },
      {
        ordinal: 2,
        minimumIntervalFromPrior: { unit: "months", value: 6 },
        recommendedIntervalFromPrior: { unit: "months", value: 6 },
      },
    ]),
    allowedMethods: ["dose-record"],
    consumerSummary:
      "Adults with a hepatitis A risk indication, and adults who request protection without disclosing a risk, may receive vaccination.",
    whyItMatters: "Vaccination prevents hepatitis A infection and serious complications.",
    limitations: [
      "Product and combination-vaccine schedules differ; this rule represents a common two-dose single-antigen pathway.",
      "CareCadence does not require disclosure of sensitive risk details and presents this as a discussion item.",
    ],
    effectiveFrom: "2025-07-02",
  }),
  reviewedRule({
    stableKey: "hepatitis-b-cdc-routine-19-59",
    serviceSlug: "hepatitis-b-vaccine",
    sourceSlug: cdcVaccineSource,
    evidenceGrade: "CDC/ACIP operative",
    recommendationClass: "routine",
    appliesWhen: age(19, 59),
    schedule: doseSeriesSchedule("hepatitis-b-adult-three-dose", [
      { ordinal: 1 },
      {
        ordinal: 2,
        minimumIntervalFromPrior: { unit: "weeks", value: 4 },
        recommendedIntervalFromPrior: { unit: "months", value: 1 },
      },
      {
        ordinal: 3,
        minimumIntervalFromPrior: { unit: "weeks", value: 8 },
        recommendedIntervalFromPrior: { unit: "months", value: 5 },
      },
    ]),
    allowedMethods: ["dose-record", "three-dose-hepb"],
    consumerSummary:
      "CDC adult guidance recommends hepatitis B vaccination for all adults ages 19 through 59 who have not completed a series.",
    whyItMatters: "Vaccination prevents hepatitis B and its long-term liver complications.",
    limitations: [
      "Licensed products include two-dose, three-dose, and combination schedules. This rule calculates a standard three-dose pathway; a two-dose product history should use a clinician override until product-conditional series are supported.",
      "The final dose also must be at least 16 weeks after the first; the engine checks the minimum interval from the prior dose and uncertain histories need confirmation.",
    ],
    effectiveFrom: "2025-07-02",
  }),
  reviewedRule({
    stableKey: "hepatitis-b-cdc-60-plus-risk-or-request",
    serviceSlug: "hepatitis-b-vaccine",
    sourceSlug: cdcVaccineSource,
    evidenceGrade: "CDC/ACIP operative",
    recommendationClass: "shared-decision",
    appliesWhen: age(60),
    schedule: customSchedule(),
    allowedMethods: ["dose-record", "two-dose-hepb", "three-dose-hepb"],
    consumerSummary:
      "Adults age 60 or older with hepatitis B risk factors should be vaccinated, and adults without known risk may also receive vaccination.",
    whyItMatters: "Vaccination prevents hepatitis B and its long-term liver complications.",
    limitations: [
      "Risk, product, and prior-dose history determine the series; this item stays a discussion rather than an automatic overdue task.",
      "CareCadence does not require disclosure of sensitive risk details.",
    ],
    effectiveFrom: "2025-07-02",
  }),
  reviewedRule({
    stableKey: "mmr-cdc-evidence-of-immunity-review",
    serviceSlug: "mmr-vaccine",
    sourceSlug: cdcVaccineSource,
    evidenceGrade: "CDC/ACIP operative",
    recommendationClass: "shared-decision",
    appliesWhen: age(19),
    schedule: doseSeriesSchedule("mmr-adult", [
      { ordinal: 1 },
      {
        ordinal: 2,
        minimumIntervalFromPrior: { unit: "weeks", value: 4 },
        recommendedIntervalFromPrior: { unit: "weeks", value: 4 },
      },
    ]),
    allowedMethods: ["dose-record"],
    consumerSummary:
      "Adults without presumptive evidence of immunity to measles, mumps, and rubella should review whether one or more MMR doses are indicated.",
    whyItMatters:
      "Vaccination prevents infections that can cause serious complications and outbreaks.",
    limitations: [
      "Birth before 1957, laboratory evidence, prior documented doses, occupation, travel, outbreak, and other risk context affect whether zero, one, or two doses are indicated.",
      "The engine displays a conservative two-dose review path so that one recorded dose is not incorrectly treated as complete for a person who needs two; a clinician can mark a one-dose pathway complete with a personal plan.",
      "The current profile model does not represent all evidence-of-immunity criteria, so this item never becomes automatically overdue.",
    ],
    effectiveFrom: "2025-07-02",
  }),
  reviewedRule({
    stableKey: "varicella-cdc-no-evidence-immunity-review",
    serviceSlug: "varicella-vaccine",
    sourceSlug: cdcVaccineSource,
    evidenceGrade: "CDC/ACIP operative",
    recommendationClass: "shared-decision",
    appliesWhen: age(19),
    schedule: doseSeriesSchedule("varicella-adult", [
      { ordinal: 1 },
      {
        ordinal: 2,
        minimumIntervalFromPrior: { unit: "weeks", value: 4 },
        recommendedIntervalFromPrior: { unit: "weeks", value: 4 },
      },
    ]),
    allowedMethods: ["dose-record"],
    consumerSummary:
      "Adults without evidence of immunity to varicella should review a two-dose vaccination series.",
    whyItMatters: "Vaccination prevents chickenpox and its complications.",
    limitations: [
      "Prior disease verification, laboratory evidence, prior documented doses, pregnancy, and immunocompromise affect eligibility and safety.",
      "The current profile model does not represent all evidence-of-immunity or contraindication criteria, so this item never becomes automatically overdue.",
    ],
    effectiveFrom: "2025-07-02",
  }),
];

export const GUIDELINE_RULE_SEEDS: readonly GuidelineRuleDefinition[] = Object.freeze(
  [
    ...cancerRules,
    ...cardiometabolicRules,
    ...boneVascularAndInfectiousRules,
    ...mentalBehavioralAndFunctionalRules,
    ...immunizationRules,
  ].sort((left, right) => {
    const stableKey = left.stableKey.localeCompare(right.stableKey);
    return stableKey === 0 ? left.version - right.version : stableKey;
  }),
);

// Source verification discovers this conventional export without coupling to
// Prisma seed naming.
export const GUIDELINE_RULES = GUIDELINE_RULE_SEEDS;

export type RuleSeedValidationIssue = {
  path: string;
  message: string;
};

function scheduledMethodSlugs(rule: GuidelineRuleDefinition): string[] {
  return rule.schedule.kind === "method_dependent"
    ? rule.schedule.methods.map((method) => method.methodId)
    : [];
}

export function validateGuidelineRuleSeeds(
  rules: readonly GuidelineRuleDefinition[] = GUIDELINE_RULE_SEEDS,
): RuleSeedValidationIssue[] {
  const issues: RuleSeedValidationIssue[] = validateRuleSet(rules).map((issue) => ({
    path: issue.path,
    message: issue.message,
  }));
  const sourcesBySlug = new Map(SOURCE_REGISTRY.map((source) => [source.slug, source]));
  const servicesBySlug = new Map(SERVICE_SEED_RECORDS.map((entry) => [entry.slug, entry]));
  const methodKeys = new Set(
    SERVICE_METHOD_SEED_RECORDS.map((method) => `${method.serviceSlug}:${method.slug}`),
  );

  const duplicateServices = SERVICE_SEED_RECORDS.filter(
    (entry, index, entries) =>
      entries.findIndex((candidate) => candidate.slug === entry.slug) !== index,
  );
  for (const service of duplicateServices) {
    issues.push({ path: `services.${service.slug}`, message: "Service slug is duplicated." });
  }

  const seenMethodKeys = new Set<string>();
  for (const method of SERVICE_METHOD_SEED_RECORDS) {
    const key = `${method.serviceSlug}:${method.slug}`;
    if (seenMethodKeys.has(key)) {
      issues.push({
        path: `methods.${key}`,
        message: "Method slug is duplicated within its service.",
      });
    }
    seenMethodKeys.add(key);
    if (!servicesBySlug.has(method.serviceSlug)) {
      issues.push({ path: `methods.${key}`, message: "Method references an unknown service." });
    }
  }

  const seenVersions = new Set<string>();
  for (const rule of rules) {
    const versionKey = `${rule.stableKey}:${rule.version}`;
    if (seenVersions.has(versionKey)) {
      issues.push({ path: `rules.${versionKey}`, message: "Rule version is duplicated." });
    }
    seenVersions.add(versionKey);

    const source = sourcesBySlug.get(rule.sourceSlug);
    if (source === undefined) {
      issues.push({
        path: `rules.${versionKey}.sourceSlug`,
        message: "Source slug is not registered.",
      });
    } else {
      if (source.lastVerifiedAt.length === 0) {
        issues.push({
          path: `rules.${versionKey}.sourceSlug`,
          message: "Source has no verification date.",
        });
      }
      if (!source.serviceSlugs.includes(rule.serviceSlug)) {
        issues.push({
          path: `rules.${versionKey}.sourceSlug`,
          message: `Source does not declare service ${rule.serviceSlug}.`,
        });
      }
      if (rule.reviewStatus === "active" && (source.lifecycle === "draft" || !source.active)) {
        issues.push({
          path: `rules.${versionKey}.sourceSlug`,
          message: "An active rule cannot use a draft or inactive source.",
        });
      }
    }

    if (!servicesBySlug.has(rule.serviceSlug)) {
      issues.push({
        path: `rules.${versionKey}.serviceSlug`,
        message: "Service slug is not seeded.",
      });
    }

    const methodSlugs = [...(rule.allowedMethods ?? []), ...scheduledMethodSlugs(rule)];
    for (const methodSlug of new Set(methodSlugs)) {
      if (!methodKeys.has(`${rule.serviceSlug}:${methodSlug}`)) {
        issues.push({
          path: `rules.${versionKey}.methods.${methodSlug}`,
          message: "Method slug is not seeded for this service.",
        });
      }
    }

    if (
      ![
        "positive",
        "negative",
        "boundary",
        "historical-completion",
        "uncertainty",
        "abnormal-history",
      ].every((suffix) => rule.scenarioIds.includes(`${rule.stableKey}-${suffix}`))
    ) {
      issues.push({
        path: `rules.${versionKey}.scenarioIds`,
        message:
          "Every reviewed rule needs positive, negative, boundary, historical, uncertainty, and abnormal-history scenario IDs.",
      });
    }
    if (rule.conflictGroup !== null && !rule.scenarioIds.includes(`${rule.stableKey}-variant`)) {
      issues.push({
        path: `rules.${versionKey}.scenarioIds`,
        message: "Every guideline variant needs a variant-selection scenario ID.",
      });
    }
    if (rule.schedule.kind === "method_dependent") {
      for (const method of rule.schedule.methods) {
        if (!rule.scenarioIds.some((scenarioId) => scenarioId.includes(method.methodId))) {
          issues.push({
            path: `rules.${versionKey}.scenarioIds`,
            message: `Method ${method.methodId} has no named scenario.`,
          });
        }
      }
    }

    if (
      rule.serviceSlug.endsWith("lab") ||
      rule.serviceSlug.endsWith("panel") ||
      rule.serviceSlug === "custom-lab-bundle"
    ) {
      if (
        rule.reviewStatus === "active" &&
        rule.schedule.kind === "age_based" &&
        rule.schedule.interval?.unit === "years" &&
        rule.schedule.interval.value === 1
      ) {
        issues.push({
          path: `rules.${versionKey}.schedule`,
          message: "A universal annual lab rule cannot be active by default.",
        });
      }
    }
  }

  return issues;
}

export function assertValidGuidelineRuleSeeds(
  rules: readonly GuidelineRuleDefinition[] = GUIDELINE_RULE_SEEDS,
): void {
  const issues = validateGuidelineRuleSeeds(rules);
  if (issues.length > 0) {
    throw new Error(
      `Guideline seed validation failed:\n${issues
        .map((issue) => `- ${issue.path}: ${issue.message}`)
        .join("\n")}`,
    );
  }
}

function recommendationClassToDatabase(value: RecommendationClass): StoredRecommendationClass {
  switch (value) {
    case "shared-decision":
      return "shared_decision";
    case "insufficient-evidence":
      return "insufficient_evidence";
    case "not-recommended":
      return "not_recommended";
    case "custom-maintenance":
      return "custom_maintenance";
    default:
      return value;
  }
}

function dateOnly(value: string | null): Date | null {
  return value === null ? null : new Date(`${value}T00:00:00.000Z`);
}

function inputJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

async function resolveRuleForDatabase(
  database: DatabaseClient,
  seed: GuidelineRuleDefinition,
): Promise<Prisma.GuidelineRuleUncheckedCreateInput> {
  const service = await database.serviceCatalog.findUnique({ where: { slug: seed.serviceSlug } });
  if (service === null) {
    throw new Error(`Cannot seed ${seed.stableKey}: service ${seed.serviceSlug} is missing.`);
  }
  const source = await database.guidelineSource.findUnique({ where: { slug: seed.sourceSlug } });
  if (source === null) {
    throw new Error(`Cannot seed ${seed.stableKey}: source ${seed.sourceSlug} is missing.`);
  }
  const methods = await database.serviceMethod.findMany({
    where: { serviceId: service.id },
    select: { id: true, slug: true },
  });
  const methodIds = new Map(methods.map((method) => [method.slug, method.id]));
  const resolveMethod = (slug: string): string => {
    const id = methodIds.get(slug);
    if (id === undefined) {
      throw new Error(
        `Cannot seed ${seed.stableKey}: method ${seed.serviceSlug}/${slug} is missing.`,
      );
    }
    return id;
  };

  const schedule: Schedule =
    seed.schedule.kind === "method_dependent"
      ? {
          ...seed.schedule,
          methods: seed.schedule.methods.map((method) => ({
            ...method,
            methodId: resolveMethod(method.methodId),
          })),
        }
      : seed.schedule;
  const allowedMethods = seed.allowedMethods?.map(resolveMethod) ?? null;
  const runtimeDefinition = defineRule({
    ...seed,
    schedule,
    allowedMethods,
  });

  return {
    stableKey: runtimeDefinition.stableKey,
    version: runtimeDefinition.version,
    serviceId: service.id,
    variantId: runtimeDefinition.variantId,
    conflictGroup: runtimeDefinition.conflictGroup,
    isBaseline: runtimeDefinition.baseline,
    sourceId: source.id,
    jurisdiction: runtimeDefinition.jurisdiction,
    evidenceGrade: runtimeDefinition.evidenceGrade,
    recommendationClass: recommendationClassToDatabase(runtimeDefinition.recommendationClass),
    appliesWhenJson: inputJson(runtimeDefinition.appliesWhen),
    excludesWhenJson:
      runtimeDefinition.excludesWhen === null
        ? Prisma.DbNull
        : inputJson(runtimeDefinition.excludesWhen),
    stopWhenJson:
      runtimeDefinition.stopWhen === null ? Prisma.DbNull : inputJson(runtimeDefinition.stopWhen),
    scheduleJson: inputJson(runtimeDefinition.schedule),
    completionEventTypesJson: inputJson(runtimeDefinition.completionEventTypes),
    allowedMethodsJson:
      runtimeDefinition.allowedMethods === null
        ? Prisma.DbNull
        : inputJson(runtimeDefinition.allowedMethods),
    outcomeModifiersJson: inputJson(runtimeDefinition.outcomeModifiers),
    consumerSummary: runtimeDefinition.consumerSummary,
    whyItMatters: runtimeDefinition.whyItMatters,
    questionsForClinicianJson: inputJson(runtimeDefinition.questionsForClinician),
    limitationsJson: inputJson(runtimeDefinition.limitations),
    effectiveFrom: dateOnly(runtimeDefinition.effectiveFrom) as Date,
    effectiveTo: dateOnly(runtimeDefinition.effectiveTo),
    reviewStatus: runtimeDefinition.reviewStatus,
    reviewedBy: runtimeDefinition.reviewedBy,
    reviewedAt: dateOnly(runtimeDefinition.reviewedAt) as Date,
  };
}

export async function seedGuidelineRules(database: DatabaseClient): Promise<number> {
  assertValidGuidelineRuleSeeds();
  const repository = createGuidelineRepository(database);

  for (const seed of GUIDELINE_RULE_SEEDS) {
    const existing = await repository.findRuleVersion(seed.stableKey, seed.version);
    if (existing !== null) continue;
    const resolved = await resolveRuleForDatabase(database, seed);
    await repository.createRuleVersion(resolved);
  }

  return GUIDELINE_RULE_SEEDS.length;
}
