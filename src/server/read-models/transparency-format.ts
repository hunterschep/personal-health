import {
  expressionSchema,
  scheduleSchema,
  type Duration,
  type Expression,
  type Schedule,
} from "@/contracts";

export type DisplayExplanationToken = {
  code: string;
  label: string;
  value: string | number | boolean | null | undefined;
};

export type DisplayCalculationStep = {
  step: string;
  outcome: string;
  values: Array<{ label: string; value: string | number | boolean | null }>;
};

export type StoredDateRange = {
  start: string | null;
  end: string | null;
  precision: "day" | "month" | "year" | "unknown";
};

export type StoredCalculation = {
  tokens: DisplayExplanationToken[];
  limitations: string[];
  generalGuidelineDueRange: StoredDateRange | null;
  personalDueRange: StoredDateRange | null;
  trace: DisplayCalculationStep[];
};

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function primitive(value: unknown): string | number | boolean | null | undefined {
  return value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
    ? value
    : undefined;
}

function readDateRange(value: unknown): StoredDateRange | null {
  const candidate = record(value);
  if (candidate === null) return null;
  const start = candidate.start;
  const end = candidate.end;
  const precision = candidate.precision;
  if (
    (start === null || typeof start === "string") &&
    (end === null || typeof end === "string") &&
    (precision === "day" ||
      precision === "month" ||
      precision === "year" ||
      precision === "unknown")
  ) {
    return { start, end, precision };
  }
  return null;
}

export function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string");
}

export function readExplanationTokens(value: unknown): DisplayExplanationToken[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    const candidate = record(entry);
    if (
      candidate === null ||
      typeof candidate.code !== "string" ||
      typeof candidate.label !== "string"
    ) {
      return [];
    }
    return [
      {
        code: candidate.code,
        label: candidate.label,
        value: primitive(candidate.value),
      },
    ];
  });
}

export function readStoredCalculation(value: unknown): StoredCalculation {
  const candidate = record(value);
  if (candidate === null) {
    return {
      tokens: [],
      limitations: [],
      generalGuidelineDueRange: null,
      personalDueRange: null,
      trace: [],
    };
  }

  const trace = Array.isArray(candidate.calculationTrace)
    ? candidate.calculationTrace.flatMap((entry): DisplayCalculationStep[] => {
        const step = record(entry);
        if (step === null || typeof step.step !== "string" || typeof step.outcome !== "string") {
          return [];
        }
        const rawValues = record(step.values);
        const values =
          rawValues === null
            ? []
            : Object.entries(rawValues).flatMap(([key, rawValue]) => {
                const value = primitive(rawValue);
                if (value === undefined || key.toLocaleLowerCase("en-US").endsWith("id")) return [];
                return [{ label: humanizeIdentifier(key), value }];
              });
        return [{ step: humanizeIdentifier(step.step), outcome: step.outcome, values }];
      })
    : [];

  return {
    tokens: readExplanationTokens(candidate.tokens),
    limitations: readStringArray(candidate.limitations),
    generalGuidelineDueRange: readDateRange(candidate.generalGuidelineDueRange),
    personalDueRange: readDateRange(candidate.personalDueRange),
    trace,
  };
}

export function humanizeIdentifier(value: string): string {
  const words = value.replaceAll("_", " ").replaceAll("-", " ");
  return words.replace(/^./, (character) => character.toLocaleUpperCase("en-US"));
}

export function durationLabel(duration: Duration): string {
  const unit = duration.value === 1 ? duration.unit.replace(/s$/, "") : duration.unit;
  return `${duration.value} ${unit}`;
}

function joinPhrases(parts: string[], conjunction: "and" | "or"): string {
  if (parts.length === 0) return "No additional criteria";
  if (parts.length === 1) return parts[0] ?? "No additional criteria";
  if (parts.length === 2) return `${parts[0]} ${conjunction} ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")}, ${conjunction} ${parts.at(-1)}`;
}

function comparisonLabel(value: "lt" | "lte" | "eq" | "gte" | "gt"): string {
  const labels = {
    lt: "less than",
    lte: "no more than",
    eq: "equal to",
    gte: "at least",
    gt: "more than",
  } as const;
  return labels[value];
}

function expressionLabel(expression: Expression): string {
  switch (expression.op) {
    case "all":
      return joinPhrases(expression.children.map(expressionLabel), "and");
    case "any":
      return `At least one of: ${joinPhrases(expression.children.map(expressionLabel), "or")}`;
    case "not":
      return `Does not match: ${expressionLabel(expression.child)}`;
    case "age_between":
      if (expression.min !== undefined && expression.max !== undefined) {
        return expression.min === expression.max
          ? `Age ${expression.min}`
          : `Ages ${expression.min} through ${expression.max}`;
      }
      if (expression.min !== undefined) return `Age ${expression.min} or older`;
      return `Age ${expression.max ?? 0} or younger`;
    case "anatomy_is":
      return `${humanizeIdentifier(expression.key)} is recorded as ${humanizeIdentifier(expression.state).toLocaleLowerCase("en-US")}`;
    case "sex_assigned_at_birth_is":
      return `Sex assigned at birth is ${humanizeIdentifier(expression.value).toLocaleLowerCase("en-US")}`;
    case "risk_equals":
      return `${humanizeIdentifier(expression.type)} ${humanizeIdentifier(expression.path).toLocaleLowerCase("en-US")} is ${String(expression.value)}`;
    case "risk_number_compare":
      return `${humanizeIdentifier(expression.type)} ${humanizeIdentifier(expression.path).toLocaleLowerCase("en-US")} is ${comparisonLabel(expression.comparator)} ${expression.value}`;
    case "condition_present":
      return `${humanizeIdentifier(expression.code)} is recorded`;
    case "condition_absent":
      return `${humanizeIdentifier(expression.code)} is not recorded`;
    case "family_history_present":
      return `Family history includes ${humanizeIdentifier(expression.conditionCode).toLocaleLowerCase("en-US")}`;
    case "surgery_present":
      return `${humanizeIdentifier(expression.code)} surgery is recorded`;
    case "medication_class_present":
      return `${humanizeIdentifier(expression.classCode)} medication is recorded`;
    case "prior_event_exists":
      return `A qualifying prior ${humanizeIdentifier(expression.serviceId).toLocaleLowerCase("en-US")} record exists`;
    case "prior_event_absent":
      return `No qualifying prior ${humanizeIdentifier(expression.serviceId).toLocaleLowerCase("en-US")} record exists`;
    case "time_since_event_compare":
      return `Time since ${humanizeIdentifier(expression.serviceId).toLocaleLowerCase("en-US")} is ${comparisonLabel(expression.comparator)} ${durationLabel(expression.duration)}`;
    case "profile_field_equals":
      return `${humanizeIdentifier(expression.field)} is ${String(expression.value)}`;
    case "constant":
      return expression.value ? "Applies without another profile criterion" : "Does not apply";
  }
}

export function summarizeExpression(value: unknown): string {
  const parsed = expressionSchema.safeParse(value);
  return parsed.success
    ? expressionLabel(parsed.data)
    : "Eligibility is described in the reviewed rule.";
}

function scheduleLabel(schedule: Schedule): string {
  switch (schedule.kind) {
    case "age_based": {
      const range =
        schedule.startAge !== undefined && schedule.stopAge !== undefined
          ? `from ages ${schedule.startAge} through ${schedule.stopAge}`
          : schedule.startAge !== undefined
            ? `beginning at age ${schedule.startAge}`
            : schedule.stopAge !== undefined
              ? `through age ${schedule.stopAge}`
              : "when eligible";
      return schedule.interval === undefined
        ? `One reviewed action ${range}`
        : `Every ${durationLabel(schedule.interval)} ${range}`;
    }
    case "interval":
      return `Every ${durationLabel(schedule.interval)}, anchored to ${humanizeIdentifier(schedule.anchor).toLocaleLowerCase("en-US")}`;
    case "one_time":
      return schedule.dueOnEligibility
        ? "One time when eligibility begins"
        : "One-time history tracking";
    case "seasonal":
      return `During the reviewed season (months ${schedule.seasonStartMonth}–${schedule.seasonEndMonth})${schedule.repeatsAnnually ? ", repeated annually" : ""}`;
    case "method_dependent":
      return "The next interval follows the method actually completed";
    case "dose_series":
      return `${schedule.doses.length}-dose series${schedule.boosters === undefined ? "" : ` with boosters every ${durationLabel(schedule.boosters.interval)}`}`;
    case "shared_decision": {
      const range =
        schedule.startAge !== undefined && schedule.stopAge !== undefined
          ? ` from ages ${schedule.startAge} through ${schedule.stopAge}`
          : schedule.startAge !== undefined
            ? ` beginning at age ${schedule.startAge}`
            : "";
      return `Clinician discussion${range}`;
    }
    case "custom":
      return "Timing comes from the recorded personal maintenance plan";
  }
}

export function summarizeSchedule(value: unknown): string {
  const parsed = scheduleSchema.safeParse(value);
  return parsed.success ? scheduleLabel(parsed.data) : "Timing is stored in the reviewed rule.";
}

export type MethodInterval = {
  methodIdentifier: string;
  interval: string;
  qualifyingResults: string[];
};

export function methodIntervals(value: unknown): MethodInterval[] {
  const parsed = scheduleSchema.safeParse(value);
  if (!parsed.success || parsed.data.kind !== "method_dependent") return [];
  return parsed.data.methods.map((method) => ({
    methodIdentifier: method.methodId,
    interval: `Every ${durationLabel(method.interval)}`,
    qualifyingResults: method.qualifyingResults,
  }));
}

export function ageBoundaries(value: unknown): { minimum: number | null; maximum: number | null } {
  const parsed = expressionSchema.safeParse(value);
  if (!parsed.success) return { minimum: null, maximum: null };

  function bounds(expression: Expression): { minimum: number | null; maximum: number | null } {
    if (expression.op === "age_between") {
      return { minimum: expression.min ?? null, maximum: expression.max ?? null };
    }
    if (expression.op !== "all") return { minimum: null, maximum: null };
    const children = expression.children.map(bounds);
    const minimums = children.flatMap((entry) => (entry.minimum === null ? [] : [entry.minimum]));
    const maximums = children.flatMap((entry) => (entry.maximum === null ? [] : [entry.maximum]));
    return {
      minimum: minimums.length === 0 ? null : Math.max(...minimums),
      maximum: maximums.length === 0 ? null : Math.min(...maximums),
    };
  }

  return bounds(parsed.data);
}

export function ruleIsCurrent(
  rule: { reviewStatus: string; effectiveFrom: Date; effectiveTo: Date | null },
  asOfDate: string,
): boolean {
  const start = rule.effectiveFrom.toISOString().slice(0, 10);
  const end = rule.effectiveTo?.toISOString().slice(0, 10) ?? null;
  return rule.reviewStatus === "active" && start <= asOfDate && (end === null || end >= asOfDate);
}

export function safeTokenValue(value: DisplayExplanationToken["value"]): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(value)) return null;
  return typeof value === "string" ? humanizeIdentifier(value) : String(value);
}
