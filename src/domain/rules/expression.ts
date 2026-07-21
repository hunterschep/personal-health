import type { Expression, ExplanationToken, JsonPrimitive, NumericComparator } from "@/contracts";
import { addDurationToRange, compareIsoDates } from "@/domain/dates";
import { normalizeRelationship } from "./facts";
import type {
  CarePlanEvaluationInput,
  DerivedFacts,
  ExpressionEvaluation,
  ExpressionTrace,
  NormalizedCareEvent,
  TriState,
} from "./types";

export type ExpressionContext = {
  input: CarePlanEvaluationInput;
  facts: DerivedFacts;
};

function token(
  code: string,
  label: string,
  value?: string | number | boolean | null,
  sourceFact?: string,
): ExplanationToken {
  const result: ExplanationToken = { code, label };
  if (value !== undefined) {
    result.value = value;
  }
  if (sourceFact !== undefined) {
    result.sourceFact = sourceFact;
  }
  return result;
}

function evaluation(
  result: TriState,
  trace: ExpressionTrace,
  matchingFacts: ExplanationToken[] = [],
  missingFacts: ExplanationToken[] = [],
): ExpressionEvaluation {
  return { result, trace, matchingFacts, missingFacts };
}

function negate(value: TriState): TriState {
  return value === "unknown" ? "unknown" : !value;
}

export function compareNumber(
  actual: number,
  comparator: NumericComparator,
  expected: number,
): boolean {
  switch (comparator) {
    case "lt":
      return actual < expected;
    case "lte":
      return actual <= expected;
    case "eq":
      return actual === expected;
    case "gte":
      return actual >= expected;
    case "gt":
      return actual > expected;
  }
}

function compareUncertainNumber(
  minimum: number | null,
  maximum: number | null,
  comparator: NumericComparator,
  expected: number,
): TriState {
  if (minimum === null || maximum === null) {
    return "unknown";
  }
  if (minimum === maximum) {
    return compareNumber(minimum, comparator, expected);
  }

  switch (comparator) {
    case "gte":
    case "gt":
      if (compareNumber(minimum, comparator, expected)) return true;
      if (!compareNumber(maximum, comparator, expected)) return false;
      return "unknown";
    case "lte":
    case "lt":
      if (compareNumber(maximum, comparator, expected)) return true;
      if (!compareNumber(minimum, comparator, expected)) return false;
      return "unknown";
    case "eq":
      if (expected < minimum || expected > maximum) return false;
      return "unknown";
  }
}

function safePath(value: unknown, path: string): unknown {
  const segments = path.split(".");
  let current: unknown = value;
  for (const segment of segments) {
    if (
      segment === "__proto__" ||
      segment === "prototype" ||
      segment === "constructor" ||
      typeof current !== "object" ||
      current === null ||
      !Object.prototype.hasOwnProperty.call(current, segment)
    ) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

function augmentedRiskValue(type: string, raw: unknown, facts: DerivedFacts): unknown {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return raw;
  }
  if (type === "tobacco_use") {
    return {
      ...raw,
      packYears: { minimum: facts.smoking.minimum, maximum: facts.smoking.maximum },
      currentSmoker: facts.smoking.currentSmoker,
      yearsSinceQuit: {
        minimum: facts.smoking.yearsSinceQuitMinimum,
        maximum: facts.smoking.yearsSinceQuitMaximum,
      },
    };
  }
  if (type === "height_weight") {
    return { ...raw, bmi: facts.bmi?.value };
  }
  return raw;
}

function readRiskValues(context: ExpressionContext, type: string, path: string): unknown[] {
  const factors = context.facts.risksByType.get(type) ?? [];
  return factors.map((factor) =>
    safePath(augmentedRiskValue(type, factor.value, context.facts), path),
  );
}

function primitiveEquals(left: unknown, right: JsonPrimitive): boolean {
  return left === right;
}

function relevantEvents(context: ExpressionContext, serviceId: string): NormalizedCareEvent[] {
  const correctedIds = new Set(
    context.input.careEvents
      .map((event) => event.correctsEventId)
      .filter((id): id is string => id != null),
  );
  return context.input.careEvents.filter(
    (event) =>
      event.profileId === context.input.profile.id &&
      event.serviceId === serviceId &&
      event.deletedAt == null &&
      event.supersededByEventId == null &&
      !correctedIds.has(event.id) &&
      (event.performedStart === null || event.performedStart <= context.input.asOfDate) &&
      (event.performedEnd === null || event.performedEnd <= context.input.asOfDate),
  );
}

function latestKnownEvent(events: NormalizedCareEvent[]): NormalizedCareEvent | null {
  return (
    [...events]
      .filter((event) => event.performedStart !== null && event.performedEnd !== null)
      .sort((left, right) => {
        if (left.performedEnd !== right.performedEnd) {
          return (right.performedEnd ?? "").localeCompare(left.performedEnd ?? "");
        }
        return right.id.localeCompare(left.id);
      })[0] ?? null
  );
}

function compareElapsedRange(
  event: NormalizedCareEvent,
  comparator: NumericComparator,
  duration: Extract<Expression, { op: "time_since_event_compare" }>["duration"],
  asOfDate: string,
): TriState {
  if (event.performedStart === null || event.performedEnd === null) {
    return "unknown";
  }
  const threshold = addDurationToRange(
    {
      start: event.performedStart,
      end: event.performedEnd,
      precision: event.datePrecision,
    },
    duration,
  );
  if (threshold.start === null || threshold.end === null) {
    return "unknown";
  }

  const compareAgainstThreshold = (thresholdDate: string): boolean => {
    const comparison = compareIsoDates(asOfDate, thresholdDate);
    switch (comparator) {
      case "lt":
        return comparison < 0;
      case "lte":
        return comparison <= 0;
      case "eq":
        return comparison === 0;
      case "gte":
        return comparison >= 0;
      case "gt":
        return comparison > 0;
    }
  };

  const earliest = compareAgainstThreshold(threshold.start);
  const latest = compareAgainstThreshold(threshold.end);
  return earliest === latest ? earliest : "unknown";
}

export function evaluateExpression(
  expression: Expression,
  context: ExpressionContext,
): ExpressionEvaluation {
  switch (expression.op) {
    case "constant":
      return evaluation(expression.value, {
        op: expression.op,
        result: expression.value,
        value: expression.value,
      });

    case "all": {
      const children = expression.children.map((child) => evaluateExpression(child, context));
      const result: TriState = children.some((child) => child.result === false)
        ? false
        : children.some((child) => child.result === "unknown")
          ? "unknown"
          : true;
      return evaluation(
        result,
        { op: expression.op, result, children: children.map((child) => child.trace) },
        children.flatMap((child) => child.matchingFacts),
        result === "unknown"
          ? children
              .filter((child) => child.result === "unknown")
              .flatMap((child) => child.missingFacts)
          : [],
      );
    }

    case "any": {
      const children = expression.children.map((child) => evaluateExpression(child, context));
      const result: TriState = children.some((child) => child.result === true)
        ? true
        : children.some((child) => child.result === "unknown")
          ? "unknown"
          : false;
      return evaluation(
        result,
        { op: expression.op, result, children: children.map((child) => child.trace) },
        children
          .filter((child) => result !== true || child.result === true)
          .flatMap((child) => child.matchingFacts),
        result === "unknown"
          ? children
              .filter((child) => child.result === "unknown")
              .flatMap((child) => child.missingFacts)
          : [],
      );
    }

    case "not": {
      const child = evaluateExpression(expression.child, context);
      const result = negate(child.result);
      return evaluation(
        result,
        { op: expression.op, result, children: [child.trace] },
        child.matchingFacts,
        result === "unknown" ? child.missingFacts : [],
      );
    }

    case "age_between": {
      const includeMin = expression.includeMin ?? true;
      const includeMax = expression.includeMax ?? true;
      const aboveMinimum =
        expression.min === undefined ||
        (includeMin ? context.facts.age >= expression.min : context.facts.age > expression.min);
      const belowMaximum =
        expression.max === undefined ||
        (includeMax ? context.facts.age <= expression.max : context.facts.age < expression.max);
      const result = aboveMinimum && belowMaximum;
      return evaluation(
        result,
        { op: expression.op, result, fact: "age", value: context.facts.age },
        result
          ? [
              token(
                "age_in_range",
                "Age is within this guideline's range",
                context.facts.age,
                "age",
              ),
            ]
          : [],
      );
    }

    case "anatomy_is": {
      const state = context.facts.anatomy.get(expression.key);
      if (state === undefined || state === "unknown" || state === "prefer_not_to_answer") {
        if (state === expression.state) {
          return evaluation(true, {
            op: expression.op,
            result: true,
            fact: expression.key,
            value: state,
          });
        }
        const missing = token(
          "profile_fact_needed",
          `Confirm ${expression.key.replaceAll("_", " ")} to evaluate this guideline`,
          state ?? "not_recorded",
          `anatomy.${expression.key}`,
        );
        return evaluation(
          "unknown",
          { op: expression.op, result: "unknown", fact: expression.key, value: state ?? null },
          [],
          [missing],
        );
      }
      const result = state === expression.state;
      return evaluation(
        result,
        { op: expression.op, result, fact: expression.key, value: state },
        result
          ? [
              token(
                "anatomy_present",
                `${expression.key.replaceAll("_", " ")} is ${state}`,
                state,
                `anatomy.${expression.key}`,
              ),
            ]
          : [],
      );
    }

    case "sex_assigned_at_birth_is": {
      const actual = context.input.profile.sexAssignedAtBirth;
      const unknown = actual === "unknown" || actual === "prefer_not_to_answer";
      const result: TriState = unknown ? "unknown" : actual === expression.value;
      return evaluation(
        result,
        { op: expression.op, result, fact: "sexAssignedAtBirth", value: actual },
        result === true
          ? [token("profile_field_match", "Profile information matches this guideline", actual)]
          : [],
        result === "unknown"
          ? [token("profile_fact_needed", "More profile information is needed", actual)]
          : [],
      );
    }

    case "risk_equals": {
      const values = readRiskValues(context, expression.type, expression.path);
      if (values.length === 0 || values.every((value) => value === undefined || value === null)) {
        const missing = token(
          "risk_fact_needed",
          `More ${expression.type.replaceAll("_", " ")} information is needed`,
          null,
          `risk.${expression.type}.${expression.path}`,
        );
        return evaluation(
          "unknown",
          { op: expression.op, result: "unknown", fact: expression.path },
          [],
          [missing],
        );
      }
      const result = values.some((value) => primitiveEquals(value, expression.value));
      return evaluation(
        result,
        { op: expression.op, result, fact: expression.path, value: expression.value },
        result
          ? [
              token(
                "risk_fact_match",
                "A recorded risk factor matches",
                expression.value,
                `risk.${expression.type}.${expression.path}`,
              ),
            ]
          : [],
      );
    }

    case "risk_number_compare": {
      const values = readRiskValues(context, expression.type, expression.path);
      if (values.length === 0) {
        return evaluation(
          "unknown",
          { op: expression.op, result: "unknown", fact: expression.path },
          [],
          [
            token(
              "risk_fact_needed",
              "A numeric risk value is needed",
              null,
              `risk.${expression.type}.${expression.path}`,
            ),
          ],
        );
      }

      const results = values.map((value): TriState => {
        if (typeof value === "number" && Number.isFinite(value)) {
          return compareNumber(value, expression.comparator, expression.value);
        }
        if (typeof value === "object" && value !== null && !Array.isArray(value)) {
          const minimum = safePath(value, "minimum");
          const maximum = safePath(value, "maximum");
          return compareUncertainNumber(
            typeof minimum === "number" ? minimum : null,
            typeof maximum === "number" ? maximum : null,
            expression.comparator,
            expression.value,
          );
        }
        return "unknown";
      });
      const result: TriState = results.some((value) => value === true)
        ? true
        : results.some((value) => value === "unknown")
          ? "unknown"
          : false;
      return evaluation(
        result,
        { op: expression.op, result, fact: expression.path, value: expression.value },
        result === true
          ? [
              token(
                "risk_threshold_met",
                "A risk threshold is met",
                expression.value,
                `risk.${expression.type}.${expression.path}`,
              ),
            ]
          : [],
        result === "unknown"
          ? [
              token(
                "risk_fact_uncertain",
                "The recorded risk range crosses this threshold",
                expression.value,
              ),
            ]
          : [],
      );
    }

    case "condition_present": {
      const matching = context.facts.conditions.filter(
        (condition) =>
          condition.code === expression.code &&
          (expression.statuses === undefined || expression.statuses.includes(condition.status)),
      );
      const result = matching.length > 0;
      return evaluation(
        result,
        { op: expression.op, result, fact: expression.code },
        result
          ? [token("condition_present", "A relevant condition is recorded", expression.code)]
          : [],
      );
    }

    case "condition_absent": {
      const result = !context.facts.conditions.some(
        (condition) => condition.code === expression.code,
      );
      return evaluation(
        result,
        { op: expression.op, result, fact: expression.code },
        result
          ? [token("condition_absent", "No relevant condition is recorded", expression.code)]
          : [],
      );
    }

    case "family_history_present": {
      const relationships = expression.relationships?.map(normalizeRelationship);
      const matchingConditionAndRelationship = context.facts.familyHistory.filter(
        (history) =>
          history.conditionCode === expression.conditionCode &&
          (relationships === undefined ||
            relationships.includes(normalizeRelationship(history.relationship))),
      );
      const matching = matchingConditionAndRelationship.filter(
        (history) =>
          expression.maxAgeAtDiagnosis === undefined ||
          (history.ageAtDiagnosis != null &&
            history.ageAtDiagnosis <= expression.maxAgeAtDiagnosis),
      );
      const result: TriState =
        matching.length > 0
          ? true
          : expression.maxAgeAtDiagnosis !== undefined &&
              matchingConditionAndRelationship.some((history) => history.ageAtDiagnosis == null)
            ? "unknown"
            : false;
      return evaluation(
        result,
        { op: expression.op, result, fact: expression.conditionCode },
        result
          ? [
              token(
                "family_history_match",
                "Relevant family history is recorded",
                expression.conditionCode,
              ),
            ]
          : [],
        result === "unknown"
          ? [
              token(
                "family_history_age_needed",
                "Age at diagnosis is needed to evaluate this family history",
                expression.conditionCode,
              ),
            ]
          : [],
      );
    }

    case "surgery_present": {
      const result = context.facts.surgeries.some((surgery) => surgery.code === expression.code);
      return evaluation(
        result,
        { op: expression.op, result, fact: expression.code },
        result ? [token("surgery_present", "A relevant surgery is recorded", expression.code)] : [],
      );
    }

    case "medication_class_present": {
      const result = context.facts.medicationClasses.has(expression.classCode);
      return evaluation(
        result,
        { op: expression.op, result, fact: expression.classCode },
        result
          ? [
              token(
                "medication_class_present",
                "A relevant medication class is recorded",
                expression.classCode,
              ),
            ]
          : [],
      );
    }

    case "prior_event_exists": {
      const matching = relevantEvents(context, expression.serviceId).filter(
        (event) =>
          (expression.methodIds === undefined ||
            (event.methodId !== null && expression.methodIds.includes(event.methodId))) &&
          (expression.resultIn === undefined || expression.resultIn.includes(event.result)),
      );
      const result = matching.length > 0;
      return evaluation(
        result,
        { op: expression.op, result, fact: expression.serviceId },
        result
          ? [token("prior_event_exists", "Relevant prior care is recorded", expression.serviceId)]
          : [],
      );
    }

    case "prior_event_absent": {
      const result = relevantEvents(context, expression.serviceId).length === 0;
      return evaluation(
        result,
        { op: expression.op, result, fact: expression.serviceId },
        result
          ? [
              token(
                "prior_event_absent",
                "No relevant prior care is recorded",
                expression.serviceId,
              ),
            ]
          : [],
      );
    }

    case "time_since_event_compare": {
      const event = latestKnownEvent(relevantEvents(context, expression.serviceId));
      if (event === null) {
        return evaluation(
          "unknown",
          { op: expression.op, result: "unknown", fact: expression.serviceId },
          [],
          [token("event_date_needed", "A prior event date is needed", null, expression.serviceId)],
        );
      }
      const result = compareElapsedRange(
        event,
        expression.comparator,
        expression.duration,
        context.input.asOfDate,
      );
      return evaluation(
        result,
        { op: expression.op, result, fact: expression.serviceId, value: event.id },
        result === true
          ? [
              token(
                "time_since_event_match",
                "Time since prior care matches this guideline",
                event.id,
              ),
            ]
          : [],
        result === "unknown"
          ? [token("event_date_uncertain", "The prior event date is not precise enough", event.id)]
          : [],
      );
    }

    case "profile_field_equals": {
      const actual = context.input.profile[expression.field];
      const unknown = actual === "unknown" || actual === "prefer_not_to_answer";
      const result: TriState = unknown ? "unknown" : primitiveEquals(actual, expression.value);
      return evaluation(
        result,
        { op: expression.op, result, fact: expression.field, value: String(actual) },
        result === true
          ? [
              token(
                "profile_field_match",
                "Profile information matches this guideline",
                String(actual),
                expression.field,
              ),
            ]
          : [],
        result === "unknown"
          ? [
              token(
                "profile_fact_needed",
                "More profile information is needed",
                String(actual),
                expression.field,
              ),
            ]
          : [],
      );
    }
  }
}
