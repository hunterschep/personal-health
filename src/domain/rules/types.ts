import type {
  AnatomyKey,
  AnatomyState,
  CareEventResult,
  DatePrecision,
  DateRange,
  Duration,
  EvaluatedRecommendation,
  ExplanationToken,
  GuidelineRuleDefinition,
  HistoryAssertion,
  NormalizedProfile,
} from "@/contracts";

export type NormalizedAnatomy = {
  key: AnatomyKey;
  state: AnatomyState;
  effectiveDate?: string | null;
};

export type NormalizedRiskFactor = {
  id?: string;
  type: string;
  value: unknown;
  startedAt?: string | null;
  endedAt?: string | null;
  deletedAt?: string | null;
};

export type NormalizedCondition = {
  code: string;
  status: "active" | "resolved" | "history";
  deletedAt?: string | null;
};

export type NormalizedFamilyHistory = {
  conditionCode: string;
  relationship: string;
  ageAtDiagnosis?: number | null;
  deletedAt?: string | null;
};

export type NormalizedSurgery = {
  code: string;
  performedStart?: string | null;
  performedEnd?: string | null;
  deletedAt?: string | null;
};

export type NormalizedMedication = {
  id?: string;
  classCodes: string[];
  status: "active" | "paused" | "ended";
  deletedAt?: string | null;
};

export type NormalizedCareEvent = {
  id: string;
  profileId: string;
  serviceId: string;
  eventType: string;
  methodId: string | null;
  performedStart: string | null;
  performedEnd: string | null;
  datePrecision: DatePrecision;
  result: CareEventResult;
  deletedAt?: string | null;
  supersededByEventId?: string | null;
  correctsEventId?: string | null;
  seriesKey?: string | null;
  doseOrdinal?: number | null;
};

export type ClinicianOverrideType =
  "exact_next_date" | "recurring_interval" | "no_longer_needed" | "clinician_managed";

export type NormalizedClinicianOverride = {
  id: string;
  profileId: string;
  serviceId: string;
  methodId: string | null;
  overrideType: ClinicianOverrideType;
  nextDueStart: string | null;
  nextDueEnd: string | null;
  nextDuePrecision?: DatePrecision;
  interval: Duration | null;
  replacesGeneralGuideline: boolean;
  instructionReceivedDate: string;
  reviewDate?: string | null;
  effectiveTo?: string | null;
  active: boolean;
};

export type GuidelineVariantSelection = {
  conflictGroup: string;
  variantId: string;
};

export type EvaluationRule = GuidelineRuleDefinition & {
  id: string;
  serviceId: string;
  serviceName: string;
  category: string;
  categoryOrder: number;
  serviceSortOrder: number;
  sourceId: string;
  sourceOrganization: string;
};

export type ServiceHistoryAssertion = {
  serviceId: string;
  assertion: HistoryAssertion;
  recordedOn?: string;
};

export type CarePlanEvaluationInput = {
  profile: NormalizedProfile;
  anatomy: NormalizedAnatomy[];
  riskFactors: NormalizedRiskFactor[];
  conditions: NormalizedCondition[];
  familyHistory: NormalizedFamilyHistory[];
  surgeries: NormalizedSurgery[];
  medications: NormalizedMedication[];
  careEvents: NormalizedCareEvent[];
  clinicianOverrides: NormalizedClinicianOverride[];
  selectedVariants: GuidelineVariantSelection[] | Readonly<Record<string, string>>;
  guidelineRules: EvaluationRule[];
  asOfDate: string;
  historyAssertions?: ServiceHistoryAssertion[];
  includeDebugTrace?: boolean;
};

export type TriState = true | false | "unknown";

export type ExpressionTrace = {
  op: string;
  result: TriState;
  fact?: string;
  value?: string | number | boolean | null;
  children?: ExpressionTrace[];
};

export type ExpressionEvaluation = {
  result: TriState;
  matchingFacts: ExplanationToken[];
  missingFacts: ExplanationToken[];
  trace: ExpressionTrace;
};

export type DerivedBmi = {
  value: number;
  heightCentimeters: number;
  weightKilograms: number;
  heightMeasuredOn: string;
  weightMeasuredOn: string;
  heightRiskFactorId: string | null;
  weightRiskFactorId: string | null;
};

export type DerivedPackYears = {
  minimum: number | null;
  maximum: number | null;
  uncertain: boolean;
  currentSmoker: boolean | null;
  yearsSinceQuitMinimum: number | null;
  yearsSinceQuitMaximum: number | null;
};

export type DerivedFacts = {
  age: number;
  anatomy: Map<AnatomyKey, AnatomyState>;
  risksByType: Map<string, NormalizedRiskFactor[]>;
  conditions: NormalizedCondition[];
  familyHistory: NormalizedFamilyHistory[];
  surgeries: NormalizedSurgery[];
  medicationClasses: Set<string>;
  bmi: DerivedBmi | null;
  smoking: DerivedPackYears;
};

export type QualifiedEventSet = {
  relevant: NormalizedCareEvent[];
  qualifying: NormalizedCareEvent[];
  latestQualifying: NormalizedCareEvent | null;
  abnormal: NormalizedCareEvent | null;
  inconclusive: NormalizedCareEvent | null;
  unknownResult: NormalizedCareEvent | null;
  unknownDate: NormalizedCareEvent | null;
  unknownMethod: NormalizedCareEvent | null;
  futureOrOverlapping: NormalizedCareEvent[];
};

export type ScheduleCalculation = {
  dueRange: DateRange | null;
  generalGuidelineDueRange: DateRange | null;
  lastQualifyingEvent: NormalizedCareEvent | null;
  completedOnce: boolean;
  historyStatus: "none" | "unknown" | "needs_confirmation";
  rangeRepresentsUncertainty: boolean;
  currentSeasonComplete: boolean;
  doseSeriesComplete: boolean;
  routineSatisfied: boolean;
  tokens: ExplanationToken[];
  trace: CalculationTraceStep[];
};

export type CalculationTraceStep = {
  step: string;
  outcome: string;
  values?: Record<string, string | number | boolean | null>;
};

export type EngineEvaluatedRecommendation = EvaluatedRecommendation & {
  generalGuidelineDueRange: DateRange | null;
  personalDueRange: DateRange | null;
  calculationTrace: CalculationTraceStep[];
  debugTrace?: {
    appliesWhen: ExpressionTrace;
    excludesWhen: ExpressionTrace | null;
    stopWhen: ExpressionTrace | null;
  };
};
