import {
  guidelineRuleDefinitionSchema,
  dateRangeSchema,
  normalizedProfileSchema,
  statusPriority,
  type ExplanationToken,
} from "@/contracts";
import { ageOnDate, normalizeDateRange, parseIsoDate } from "@/domain/dates";
import { deriveFacts } from "./facts";
import { qualifyCareEvents } from "./events";
import { evaluateExpression } from "./expression";
import { coreExplanationTokens, deterministicHash, uniqueExplanationTokens } from "./explanations";
import { applyClinicianOverrides } from "./overrides";
import {
  calculateSchedule,
  maximumAgeConstraint,
  minimumAgeConstraint,
  withoutAgeConstraints,
} from "./schedule";
import { determineRecommendationStatus } from "./status";
import type {
  CarePlanEvaluationInput,
  EngineEvaluatedRecommendation,
  EvaluationRule,
  ExpressionEvaluation,
  TriState,
} from "./types";
import { selectEffectiveRuleVersions, selectGuidelineVariants } from "./variants";

function falseEvaluation(op: string): ExpressionEvaluation {
  return {
    result: false,
    matchingFacts: [],
    missingFacts: [],
    trace: { op, result: false },
  };
}

function validateInput(input: CarePlanEvaluationInput): void {
  normalizedProfileSchema.parse(input.profile);
  parseIsoDate(input.asOfDate);
  ageOnDate(input.profile.dateOfBirth, input.asOfDate);
  for (const rule of input.guidelineRules) {
    guidelineRuleDefinitionSchema.parse(rule);
    parseIsoDate(rule.effectiveFrom);
    parseIsoDate(rule.reviewedAt);
    if (rule.effectiveTo !== null) parseIsoDate(rule.effectiveTo);
    if (
      rule.id.trim() === "" ||
      rule.serviceId.trim() === "" ||
      rule.serviceName.trim() === "" ||
      rule.sourceId.trim() === "" ||
      rule.sourceOrganization.trim() === ""
    ) {
      throw new RangeError(`Rule ${rule.stableKey} is missing runtime service or source metadata.`);
    }
  }
  for (const event of input.careEvents) {
    if (event.datePrecision === "unknown") {
      if (event.performedStart !== null || event.performedEnd !== null) {
        throw new RangeError(`Unknown-date event ${event.id} includes date bounds.`);
      }
    } else {
      if (event.performedStart === null || event.performedEnd === null) {
        throw new RangeError(`Known-date event ${event.id} is missing date bounds.`);
      }
      parseIsoDate(event.performedStart);
      parseIsoDate(event.performedEnd);
      if (event.performedStart > event.performedEnd) {
        throw new RangeError(`Care event ${event.id} has reversed date bounds.`);
      }
    }
    dateRangeSchema.parse({
      start: event.performedStart,
      end: event.performedEnd,
      precision: event.datePrecision,
    });
    if (event.datePrecision === "month" && event.performedStart !== null) {
      const normalized = normalizeDateRange(event.performedStart.slice(0, 7), "month");
      if (event.performedStart !== normalized.start || event.performedEnd !== normalized.end) {
        throw new RangeError(`Month-precision event ${event.id} is not normalized.`);
      }
    }
    if (event.datePrecision === "year" && event.performedStart !== null) {
      const normalized = normalizeDateRange(event.performedStart.slice(0, 4), "year");
      if (event.performedStart !== normalized.start || event.performedEnd !== normalized.end) {
        throw new RangeError(`Year-precision event ${event.id} is not normalized.`);
      }
    }
  }
  for (const entry of input.anatomy) {
    if (entry.effectiveDate != null) parseIsoDate(entry.effectiveDate);
  }
  for (const risk of input.riskFactors) {
    if (risk.startedAt != null) parseIsoDate(risk.startedAt);
    if (risk.endedAt != null) parseIsoDate(risk.endedAt);
    if (risk.startedAt != null && risk.endedAt != null && risk.startedAt > risk.endedAt) {
      throw new RangeError(`Risk factor ${risk.id ?? risk.type} has reversed effective dates.`);
    }
  }
  for (const surgery of input.surgeries) {
    if (surgery.performedStart != null) parseIsoDate(surgery.performedStart);
    if (surgery.performedEnd != null) parseIsoDate(surgery.performedEnd);
    if (
      surgery.performedStart != null &&
      surgery.performedEnd != null &&
      surgery.performedStart > surgery.performedEnd
    ) {
      throw new RangeError(`Surgery ${surgery.code} has reversed date bounds.`);
    }
  }
  for (const override of input.clinicianOverrides) {
    parseIsoDate(override.instructionReceivedDate);
    if (override.reviewDate != null) parseIsoDate(override.reviewDate);
    if (override.effectiveTo != null) parseIsoDate(override.effectiveTo);
    if ((override.nextDueStart === null) !== (override.nextDueEnd === null)) {
      throw new RangeError(`Override ${override.id} has an incomplete due range.`);
    }
    if (override.nextDueStart != null && override.nextDueEnd != null) {
      parseIsoDate(override.nextDueStart);
      parseIsoDate(override.nextDueEnd);
      if (override.nextDueStart > override.nextDueEnd) {
        throw new RangeError(`Override ${override.id} has reversed due dates.`);
      }
    }
    if (
      override.overrideType === "exact_next_date" &&
      (override.nextDueStart === null || override.nextDueEnd === null)
    ) {
      throw new RangeError(`Exact-date override ${override.id} requires due dates.`);
    }
    if (override.overrideType === "recurring_interval" && override.interval === null) {
      throw new RangeError(`Recurring override ${override.id} requires an interval.`);
    }
  }
  for (const assertion of input.historyAssertions ?? []) {
    if (assertion.recordedOn != null) parseIsoDate(assertion.recordedOn);
  }
}

function scheduleStopResult(rule: EvaluationRule, age: number): TriState {
  const expressionStopAge = maximumAgeConstraint(rule.appliesWhen);
  if (
    ((rule.schedule.kind === "age_based" || rule.schedule.kind === "shared_decision") &&
      rule.schedule.stopAge !== undefined &&
      age > rule.schedule.stopAge) ||
    (expressionStopAge !== null && age > expressionStopAge)
  ) {
    return true;
  }
  return false;
}

function futureAgeApplicability(
  rule: EvaluationRule,
  raw: ExpressionEvaluation,
  context: Parameters<typeof evaluateExpression>[1],
  age: number,
): ExpressionEvaluation {
  const minimumAge = minimumAgeConstraint(rule.appliesWhen);
  if (minimumAge === null || age >= minimumAge || raw.result === true) return raw;
  const withoutAge = evaluateExpression(withoutAgeConstraints(rule.appliesWhen), context);
  if (withoutAge.result === false) return raw;
  return {
    result: withoutAge.result,
    matchingFacts: [
      ...withoutAge.matchingFacts,
      {
        code: "age_eligibility_upcoming",
        label: "This guideline begins at a future age milestone",
        value: minimumAge,
        sourceFact: "age",
      },
    ],
    missingFacts: withoutAge.missingFacts,
    trace: raw.trace,
  };
}

function historyAssertionFor(input: CarePlanEvaluationInput, serviceId: string) {
  return input.historyAssertions
    ?.filter((assertion) => assertion.serviceId === serviceId)
    .sort((left, right) => {
      if (left.recordedOn !== right.recordedOn) {
        return (right.recordedOn ?? "").localeCompare(left.recordedOn ?? "");
      }
      return left.assertion.localeCompare(right.assertion);
    })[0]?.assertion;
}

function evaluationTokens(evaluation: ExpressionEvaluation): ExplanationToken[] {
  return [...evaluation.matchingFacts, ...evaluation.missingFacts];
}

function canonicalArrayForHash<T>(items: readonly T[]): T[] {
  return [...items].sort((left, right) =>
    deterministicHash(left).localeCompare(deterministicHash(right)),
  );
}

function compareRecommendations(
  left: EngineEvaluatedRecommendation,
  right: EngineEvaluatedRecommendation,
  metadata: Map<string, EvaluationRule>,
): number {
  const statusDifference = statusPriority[left.status] - statusPriority[right.status];
  if (statusDifference !== 0) return statusDifference;
  const leftDue = left.dueRange?.start ?? "9999-12-31";
  const rightDue = right.dueRange?.start ?? "9999-12-31";
  if (leftDue !== rightDue) return leftDue.localeCompare(rightDue);
  const leftRule = metadata.get(`${left.stableKey}:${left.ruleVersion}`);
  const rightRule = metadata.get(`${right.stableKey}:${right.ruleVersion}`);
  const categoryDifference =
    (leftRule?.categoryOrder ?? Number.MAX_SAFE_INTEGER) -
    (rightRule?.categoryOrder ?? Number.MAX_SAFE_INTEGER);
  if (categoryDifference !== 0) return categoryDifference;
  const serviceDifference =
    (leftRule?.serviceSortOrder ?? Number.MAX_SAFE_INTEGER) -
    (rightRule?.serviceSortOrder ?? Number.MAX_SAFE_INTEGER);
  if (serviceDifference !== 0) return serviceDifference;
  const nameDifference = left.serviceName.localeCompare(right.serviceName);
  if (nameDifference !== 0) return nameDifference;
  return left.stableKey.localeCompare(right.stableKey);
}

export function evaluateCarePlan(input: CarePlanEvaluationInput): EngineEvaluatedRecommendation[] {
  validateInput(input);
  const facts = deriveFacts(input);
  const effective = selectEffectiveRuleVersions(input.guidelineRules, input.asOfDate);
  const selected = selectGuidelineVariants(effective, input.selectedVariants);
  const metadata = new Map(
    selected.rules.map((rule) => [`${rule.stableKey}:${rule.version}`, rule]),
  );

  const recommendations = selected.rules.map((rule): EngineEvaluatedRecommendation => {
    const expressionContext = { input, facts };
    const rawApplies = evaluateExpression(rule.appliesWhen, expressionContext);
    const applies = futureAgeApplicability(rule, rawApplies, expressionContext, facts.age);
    const excludes =
      rule.excludesWhen === null
        ? falseEvaluation("no_exclusion")
        : evaluateExpression(rule.excludesWhen, expressionContext);
    const stopExpression =
      rule.stopWhen === null
        ? falseEvaluation("no_stop")
        : evaluateExpression(rule.stopWhen, expressionContext);
    const stopped: TriState =
      stopExpression.result === true || scheduleStopResult(rule, facts.age) === true
        ? true
        : stopExpression.result;
    const events = qualifyCareEvents(rule, input.careEvents, input.profile.id, input.asOfDate);
    const historyAssertion = historyAssertionFor(input, rule.serviceId);
    const baselineSchedule = calculateSchedule(
      rule,
      events,
      input.profile.dateOfBirth,
      input.asOfDate,
      historyAssertion,
    );
    const override = applyClinicianOverrides(
      baselineSchedule,
      input.clinicianOverrides,
      input.profile.id,
      rule.serviceId,
      input.asOfDate,
    );
    const individualizedHistory = events.abnormal !== null || events.inconclusive !== null;
    const status = determineRecommendationStatus({
      applies: applies.result,
      excluded: excludes.result,
      stopped,
      recommendationClass: rule.recommendationClass,
      schedule: override.schedule,
      asOfDate: input.asOfDate,
      carePlanMode: input.profile.carePlanMode,
      individualizedHistory,
      managedOverride: override.managedOverride,
      personalTimingOverride: override.personalTimingOverride,
    });
    const conflictSelection =
      rule.conflictGroup === null
        ? { variantId: rule.variantId, explicit: false }
        : (selected.selectedByConflictGroup.get(rule.conflictGroup) ?? {
            variantId: rule.variantId,
            explicit: false,
          });
    const matchingFacts = uniqueExplanationTokens([
      ...evaluationTokens(applies),
      ...(excludes.result === true ? evaluationTokens(excludes) : []),
      ...(stopped === true ? evaluationTokens(stopExpression) : []),
    ]);
    const explanationTokens = uniqueExplanationTokens([
      ...coreExplanationTokens({
        rule,
        status,
        recommendationClass: rule.recommendationClass,
        selectedVariantExplicitly: conflictSelection.explicit,
        dueRange: override.schedule.dueRange,
        lastQualifyingEvent: override.schedule.lastQualifyingEvent,
        abnormalEvent: events.abnormal ?? events.inconclusive,
        approximateDueRange: override.schedule.rangeRepresentsUncertainty,
      }),
      ...baselineSchedule.tokens,
      ...override.tokens,
      ...(events.unknownMethod === null
        ? []
        : [
            {
              code: "last_event_method_unknown",
              label: "Confirm the prior method to calculate the correct interval",
              value: events.unknownMethod.id,
            },
          ]),
      ...(events.futureOrOverlapping.length === 0
        ? []
        : [
            {
              code: "future_event_ignored",
              label: "A future-dated or not-yet-certain event was not used",
              value: events.futureOrOverlapping.length,
            },
          ]),
    ]);
    const calculationTrace = [
      {
        step: "rule_selection",
        outcome: "Selected the effective reviewed rule and guideline variant.",
        values: {
          stableKey: rule.stableKey,
          version: rule.version,
          variantId: rule.variantId,
        },
      },
      {
        step: "eligibility",
        outcome: `Applicability evaluated as ${String(applies.result)}.`,
      },
      {
        step: "event_qualification",
        outcome: "Qualified profile events by service, method, result, correction, and date.",
        values: {
          relevantEvents: events.relevant.length,
          qualifyingEvents: events.qualifying.length,
        },
      },
      ...baselineSchedule.trace,
      ...override.trace,
      { step: "status", outcome: `Assigned ${status} using status precedence.` },
    ];
    const calculationHash = deterministicHash({
      profileId: input.profile.id,
      carePlanMode: input.profile.carePlanMode,
      asOfDate: input.asOfDate,
      stableKey: rule.stableKey,
      ruleVersion: rule.version,
      variantId: rule.variantId,
      status,
      dueRange: override.schedule.dueRange,
      anatomy: canonicalArrayForHash(input.anatomy),
      riskFactors: canonicalArrayForHash(input.riskFactors),
      conditions: canonicalArrayForHash(input.conditions),
      familyHistory: canonicalArrayForHash(input.familyHistory),
      surgeries: canonicalArrayForHash(input.surgeries),
      medicationClasses: [...facts.medicationClasses].sort(),
      events: canonicalArrayForHash(
        events.relevant.map((event) => ({
          id: event.id,
          serviceId: event.serviceId,
          eventType: event.eventType,
          methodId: event.methodId,
          performedStart: event.performedStart,
          performedEnd: event.performedEnd,
          datePrecision: event.datePrecision,
          result: event.result,
          supersededByEventId: event.supersededByEventId ?? null,
          correctsEventId: event.correctsEventId ?? null,
          seriesKey: event.seriesKey ?? null,
          doseOrdinal: event.doseOrdinal ?? null,
        })),
      ),
      activeOverrideId: override.activeOverrideId,
      matchingFacts,
    });

    return {
      stableKey: rule.stableKey,
      serviceId: rule.serviceId,
      serviceSlug: rule.serviceSlug,
      serviceName: rule.serviceName,
      category: rule.category,
      ruleId: rule.id,
      ruleVersion: rule.version,
      variantId: rule.variantId,
      conflictGroup: rule.conflictGroup,
      sourceId: rule.sourceId,
      sourceOrganization: rule.sourceOrganization,
      status,
      recommendationClass: rule.recommendationClass,
      dueRange: override.schedule.dueRange,
      lastQualifyingEventId: override.schedule.lastQualifyingEvent?.id ?? null,
      activeOverrideId: override.activeOverrideId,
      evaluatedAsOf: input.asOfDate,
      explanationTokens,
      matchingFacts,
      limitations: rule.limitations,
      calculationHash,
      generalGuidelineDueRange: baselineSchedule.generalGuidelineDueRange,
      personalDueRange: override.personalDueRange,
      calculationTrace,
      ...(input.includeDebugTrace
        ? {
            debugTrace: {
              appliesWhen: applies.trace,
              excludesWhen: rule.excludesWhen === null ? null : excludes.trace,
              stopWhen: rule.stopWhen === null ? null : stopExpression.trace,
            },
          }
        : {}),
    };
  });

  return recommendations.sort((left, right) => compareRecommendations(left, right, metadata));
}
