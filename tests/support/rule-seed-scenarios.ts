import type {
  Expression,
  GuidelineRuleDefinition,
  NormalizedProfile,
  NumericComparator,
  SexAssignedAtBirth,
} from "@/contracts";
import { addCalendarYears } from "@/domain/dates";
import type {
  CarePlanEvaluationInput,
  EvaluationRule,
  NormalizedAnatomy,
  NormalizedCareEvent,
  NormalizedCondition,
  NormalizedFamilyHistory,
  NormalizedMedication,
  NormalizedRiskFactor,
  NormalizedSurgery,
} from "@/domain/rules/types";
import { SERVICE_SEED_RECORDS } from "../../prisma/seed/catalog";
import { GUIDELINE_RULE_SEEDS } from "../../prisma/seed/rules";
import { SOURCE_REGISTRY } from "../../src/server/sources/registry";

const BASE_AS_OF_DATE = "2026-07-21";

type ScenarioPolarity = "positive" | "negative" | "method";

export type RuleSeedScenario = {
  id: string;
  stableKey: string;
  polarity: ScenarioPolarity;
  methodId: string | null;
  input: CarePlanEvaluationInput;
};

type AgeRange = {
  min: number | null;
  max: number | null;
  includeMin: boolean;
  includeMax: boolean;
};

type ScenarioState = {
  profile: NormalizedProfile;
  anatomy: Map<NormalizedAnatomy["key"], NormalizedAnatomy>;
  risks: Map<string, NormalizedRiskFactor>;
  conditions: Map<string, NormalizedCondition>;
  familyHistory: Map<string, NormalizedFamilyHistory>;
  surgeries: Map<string, NormalizedSurgery>;
  medications: Map<string, NormalizedMedication>;
};

const serviceBySlug = new Map(SERVICE_SEED_RECORDS.map((service) => [service.slug, service]));
const sourceBySlug = new Map(SOURCE_REGISTRY.map((source) => [source.slug, source]));

function first<T>(values: readonly T[], context: string): T {
  const value = values[0];
  if (value === undefined) throw new Error(`${context} must not be empty.`);
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asOfDateFor(rule: GuidelineRuleDefinition): string {
  const effectiveAsOf = rule.effectiveFrom > BASE_AS_OF_DATE ? rule.effectiveFrom : BASE_AS_OF_DATE;
  if (rule.schedule.kind !== "seasonal") return effectiveAsOf;

  const start = `${effectiveAsOf.slice(0, 4)}-${String(rule.schedule.seasonStartMonth).padStart(2, "0")}-01`;
  return start >= effectiveAsOf
    ? start
    : `${Number(effectiveAsOf.slice(0, 4)) + 1}-${start.slice(5)}`;
}

function mergeAgeRanges(left: AgeRange, right: AgeRange): AgeRange {
  const min =
    left.min === null ? right.min : right.min === null ? left.min : Math.max(left.min, right.min);
  const max =
    left.max === null ? right.max : right.max === null ? left.max : Math.min(left.max, right.max);
  return {
    min,
    max,
    includeMin:
      min === left.min && min === right.min
        ? left.includeMin && right.includeMin
        : min === left.min
          ? left.includeMin
          : right.includeMin,
    includeMax:
      max === left.max && max === right.max
        ? left.includeMax && right.includeMax
        : max === left.max
          ? left.includeMax
          : right.includeMax,
  };
}

function ageRange(expression: Expression): AgeRange {
  if (expression.op === "age_between") {
    return {
      min: expression.min ?? null,
      max: expression.max ?? null,
      includeMin: expression.includeMin ?? true,
      includeMax: expression.includeMax ?? true,
    };
  }
  if (expression.op === "all") {
    return expression.children.map(ageRange).reduce(mergeAgeRanges, {
      min: null,
      max: null,
      includeMin: true,
      includeMax: true,
    });
  }
  if (expression.op === "any") {
    return ageRange(first(expression.children, "Seed expression children"));
  }
  return { min: null, max: null, includeMin: true, includeMax: true };
}

function positiveAge(range: AgeRange): number {
  return (range.min ?? 40) + (range.includeMin ? 0 : 1);
}

function negativeAge(range: AgeRange): number {
  if (range.max !== null) return range.max + (range.includeMax ? 1 : 0);
  if (range.min !== null) return Math.max(0, range.min - (range.includeMin ? 1 : 0));
  throw new Error("Seed scenario requires an age constraint to build its negative boundary.");
}

function profileAtAge(age: number, asOfDate: string): NormalizedProfile {
  return {
    id: "seed-scenario-profile",
    householdId: "seed-scenario-household",
    ownerUserId: "seed-scenario-user",
    displayName: "Seed scenario adult",
    relationshipLabel: "Self",
    dateOfBirth: addCalendarYears(asOfDate, -age),
    sexAssignedAtBirth: "unknown",
    genderIdentity: null,
    countryCode: "US",
    timezone: "America/Los_Angeles",
    visibility: "owner_only",
    carePlanMode: "evidence_based",
  };
}

function createState(age: number, asOfDate: string): ScenarioState {
  return {
    profile: profileAtAge(age, asOfDate),
    anatomy: new Map(),
    risks: new Map(),
    conditions: new Map(),
    familyHistory: new Map(),
    surgeries: new Map(),
    medications: new Map(),
  };
}

function sexAssignedAtBirth(value: string): SexAssignedAtBirth {
  if (
    value === "female" ||
    value === "male" ||
    value === "intersex" ||
    value === "unknown" ||
    value === "prefer_not_to_answer"
  ) {
    return value;
  }
  throw new Error(`Unsupported seeded sex assigned at birth value: ${value}`);
}

function numericMatch(comparator: NumericComparator, value: number): number {
  switch (comparator) {
    case "lt":
      return value - 1;
    case "lte":
    case "eq":
    case "gte":
      return value;
    case "gt":
      return value + 1;
  }
}

function setPath(target: Record<string, unknown>, path: string, value: unknown): void {
  const segments = path.split(".");
  let cursor = target;
  for (const segment of segments.slice(0, -1)) {
    const existing = cursor[segment];
    if (typeof existing === "object" && existing !== null && !Array.isArray(existing)) {
      cursor = existing as Record<string, unknown>;
    } else {
      const child: Record<string, unknown> = {};
      cursor[segment] = child;
      cursor = child;
    }
  }
  const last = segments.at(-1);
  if (last === undefined) throw new Error(`Cannot set an empty risk path for ${path}.`);
  cursor[last] = value;
}

function tobaccoRisk(asOfDate: string, status: "current" | "never"): NormalizedRiskFactor {
  return {
    id: "seed-scenario-risk-tobacco-use",
    type: "tobacco_use",
    value:
      status === "never"
        ? { status: "never", periods: [] }
        : {
            status: "current",
            periods: [
              {
                started: addCalendarYears(asOfDate, -30),
                ended: null,
                startedYear: null,
                endedYear: null,
                packsPerDay: 1,
              },
            ],
          },
  };
}

function upsertRawRisk(state: ScenarioState, type: string, path: string, value: unknown): void {
  const current = state.risks.get(type);
  const payload: Record<string, unknown> = isRecord(current?.value) ? { ...current.value } : {};
  setPath(payload, path, value);
  state.risks.set(type, {
    id: `seed-scenario-risk-${type}`,
    type,
    value: payload,
  });
}

function satisfyRiskEquals(
  state: ScenarioState,
  type: string,
  path: string,
  value: string | number | boolean | null,
  asOfDate: string,
): void {
  if (type === "tobacco_use") {
    if (path === "status" && value === "never") {
      state.risks.set(type, tobaccoRisk(asOfDate, "never"));
      return;
    }
    if (path === "currentSmoker" && value === true) {
      state.risks.set(type, tobaccoRisk(asOfDate, "current"));
      return;
    }
  }
  upsertRawRisk(state, type, path, value);
}

function satisfyRiskNumber(
  state: ScenarioState,
  type: string,
  path: string,
  comparator: NumericComparator,
  value: number,
  asOfDate: string,
): void {
  if (type === "tobacco_use" && path === "packYears") {
    state.risks.set(type, tobaccoRisk(asOfDate, "current"));
    return;
  }
  if (type === "height_weight" && path === "bmi") {
    state.risks.set(type, {
      id: "seed-scenario-risk-height-weight",
      type,
      value: {
        measuredOn: asOfDate,
        heightCentimeters: 170,
        weightKilograms: 100,
      },
    });
    return;
  }
  upsertRawRisk(state, type, path, numericMatch(comparator, value));
}

function satisfyFalse(expression: Expression, state: ScenarioState): void {
  switch (expression.op) {
    case "family_history_present":
      state.familyHistory.delete(expression.conditionCode);
      return;
    case "condition_present":
      state.conditions.delete(expression.code);
      return;
    case "surgery_present":
      state.surgeries.delete(expression.code);
      return;
    case "medication_class_present":
      state.medications.delete(expression.classCode);
      return;
    case "constant":
      if (!expression.value) return;
      break;
    default:
      break;
  }
  throw new Error(`Unsupported negated seed expression: ${expression.op}`);
}

function satisfy(expression: Expression, state: ScenarioState, asOfDate: string): void {
  switch (expression.op) {
    case "all":
      for (const child of expression.children) satisfy(child, state, asOfDate);
      return;
    case "any":
      satisfy(first(expression.children, "Seed expression children"), state, asOfDate);
      return;
    case "not":
      satisfyFalse(expression.child, state);
      return;
    case "age_between":
      return;
    case "anatomy_is":
      state.anatomy.set(expression.key, { key: expression.key, state: expression.state });
      return;
    case "sex_assigned_at_birth_is":
      state.profile.sexAssignedAtBirth = sexAssignedAtBirth(expression.value);
      return;
    case "risk_equals":
      satisfyRiskEquals(state, expression.type, expression.path, expression.value, asOfDate);
      return;
    case "risk_number_compare":
      satisfyRiskNumber(
        state,
        expression.type,
        expression.path,
        expression.comparator,
        expression.value,
        asOfDate,
      );
      return;
    case "condition_present":
      state.conditions.set(expression.code, {
        code: expression.code,
        status: expression.statuses?.[0] ?? "active",
      });
      return;
    case "condition_absent":
      state.conditions.delete(expression.code);
      return;
    case "family_history_present":
      state.familyHistory.set(expression.conditionCode, {
        conditionCode: expression.conditionCode,
        relationship: expression.relationships?.[0] ?? "parent",
        ageAtDiagnosis: expression.maxAgeAtDiagnosis ?? null,
      });
      return;
    case "surgery_present":
      state.surgeries.set(expression.code, { code: expression.code });
      return;
    case "medication_class_present":
      state.medications.set(expression.classCode, {
        id: `seed-scenario-medication-${expression.classCode}`,
        classCodes: [expression.classCode],
        status: "active",
      });
      return;
    case "profile_field_equals":
      if (expression.field === "countryCode" && typeof expression.value === "string") {
        state.profile.countryCode = expression.value;
        return;
      }
      if (expression.field === "sexAssignedAtBirth" && typeof expression.value === "string") {
        state.profile.sexAssignedAtBirth = sexAssignedAtBirth(expression.value);
        return;
      }
      if (
        expression.field === "carePlanMode" &&
        (expression.value === "evidence_based" || expression.value === "extra_attentive")
      ) {
        state.profile.carePlanMode = expression.value;
        return;
      }
      throw new Error(`Unsupported seeded profile field value: ${expression.field}`);
    case "constant":
      if (expression.value) return;
      throw new Error("Cannot satisfy a false constant in an active seed rule.");
    case "prior_event_exists":
    case "prior_event_absent":
    case "time_since_event_compare":
      throw new Error(`Unsupported event-based seed applicability expression: ${expression.op}`);
  }
}

function runtimeRule(rule: GuidelineRuleDefinition): EvaluationRule {
  const service = serviceBySlug.get(rule.serviceSlug);
  const source = sourceBySlug.get(rule.sourceSlug);
  if (service === undefined) throw new Error(`Missing service for seeded rule ${rule.stableKey}.`);
  if (source === undefined) throw new Error(`Missing source for seeded rule ${rule.stableKey}.`);

  return {
    ...rule,
    id: `seed-rule-${rule.stableKey}-v${rule.version}`,
    serviceId: `seed-service-${rule.serviceSlug}`,
    serviceName: service.name,
    category: service.category,
    categoryOrder: service.sortOrder,
    serviceSortOrder: service.sortOrder,
    sourceId: `seed-source-${rule.sourceSlug}`,
    sourceOrganization: source.organization,
  };
}

function methodCareEvents(
  rule: EvaluationRule,
  methodId: string | null,
  profileId: string,
  asOfDate: string,
): NormalizedCareEvent[] {
  if (methodId === null) return [];
  if (rule.schedule.kind !== "method_dependent") {
    throw new Error(`Rule ${rule.stableKey} does not support method scenario ${methodId}.`);
  }
  const method = rule.schedule.methods.find((candidate) => candidate.methodId === methodId);
  if (method === undefined) {
    throw new Error(`Rule ${rule.stableKey} does not define method ${methodId}.`);
  }

  return [
    {
      id: `seed-scenario-event-${methodId}`,
      profileId,
      serviceId: rule.serviceId,
      eventType: first(rule.completionEventTypes, `Rule ${rule.stableKey} completion event types`),
      methodId,
      performedStart: asOfDate,
      performedEnd: asOfDate,
      datePrecision: "day",
      result: first(method.qualifyingResults, `Method ${rule.stableKey}/${methodId} results`),
      seriesKey: null,
      doseOrdinal: null,
    },
  ];
}

function scenarioId(rule: GuidelineRuleDefinition, polarity: "positive" | "negative"): string {
  const id = rule.scenarioIds.find((candidate) => candidate.includes(polarity));
  if (id === undefined) {
    throw new Error(`Active seeded rule ${rule.stableKey} has no named ${polarity} scenario.`);
  }
  return id;
}

function buildInput(
  definition: GuidelineRuleDefinition,
  age: number,
  methodId: string | null,
  asOfDate = asOfDateFor(definition),
): CarePlanEvaluationInput {
  const state = createState(age, asOfDate);
  satisfy(definition.appliesWhen, state, asOfDate);
  const rule = runtimeRule(definition);
  const selectedVariants =
    rule.conflictGroup === null ? {} : { [rule.conflictGroup]: rule.variantId };
  const careEvents = methodCareEvents(rule, methodId, state.profile.id, asOfDate);

  return {
    profile: state.profile,
    anatomy: [...state.anatomy.values()],
    riskFactors: [...state.risks.values()],
    conditions: [...state.conditions.values()],
    familyHistory: [...state.familyHistory.values()],
    surgeries: [...state.surgeries.values()],
    medications: [...state.medications.values()],
    careEvents,
    clinicianOverrides: [],
    selectedVariants,
    guidelineRules: [rule],
    asOfDate,
    includeDebugTrace: true,
    historyAssertions: [
      { serviceId: rule.serviceId, assertion: "never_completed", recordedOn: asOfDate },
    ],
  };
}

export function buildRuleSeedInput(
  stableKey: string,
  options: { age?: number; asOfDate?: string; methodId?: string | null } = {},
): CarePlanEvaluationInput {
  const definition = GUIDELINE_RULE_SEEDS.find(
    (rule) => rule.stableKey === stableKey && rule.reviewStatus === "active",
  );
  if (definition === undefined) {
    throw new Error(`Missing active seeded rule ${stableKey}.`);
  }
  const asOfDate = options.asOfDate ?? asOfDateFor(definition);
  if (asOfDate < definition.effectiveFrom) {
    throw new RangeError(
      `Seeded rule ${stableKey} is not effective on requested date ${asOfDate}.`,
    );
  }
  return buildInput(
    definition,
    options.age ?? positiveAge(ageRange(definition.appliesWhen)),
    options.methodId ?? null,
    asOfDate,
  );
}

export function buildRuleSeedScenarios(
  rules: readonly GuidelineRuleDefinition[] = GUIDELINE_RULE_SEEDS,
): RuleSeedScenario[] {
  return rules
    .filter((rule) => rule.reviewStatus === "active")
    .flatMap((rule) => {
      const range = ageRange(rule.appliesWhen);
      const scenarios: RuleSeedScenario[] = [
        {
          id: scenarioId(rule, "positive"),
          stableKey: rule.stableKey,
          polarity: "positive",
          methodId: null,
          input: buildInput(rule, positiveAge(range), null),
        },
        {
          id: scenarioId(rule, "negative"),
          stableKey: rule.stableKey,
          polarity: "negative",
          methodId: null,
          input: buildInput(rule, negativeAge(range), null),
        },
      ];

      if (rule.schedule.kind === "method_dependent") {
        for (const method of rule.schedule.methods) {
          const id = `${rule.stableKey}-method-${method.methodId}`;
          if (!rule.scenarioIds.includes(id)) {
            throw new Error(
              `Active seeded rule ${rule.stableKey} has no scenario for ${method.methodId}.`,
            );
          }
          scenarios.push({
            id,
            stableKey: rule.stableKey,
            polarity: "method",
            methodId: method.methodId,
            input: buildInput(rule, positiveAge(range), method.methodId),
          });
        }
      }

      return scenarios;
    });
}
