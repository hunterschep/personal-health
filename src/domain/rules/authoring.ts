import {
  guidelineRuleDefinitionSchema,
  type AnatomyKey,
  type AnatomyState,
  type CareEventResult,
  type Duration,
  type Expression,
  type GuidelineRuleDefinition,
  type JsonPrimitive,
  type NumericComparator,
  type Schedule,
} from "@/contracts";
import { parseIsoDate } from "@/domain/dates";

export type RuleValidationIssue = {
  path: string;
  message: string;
};

export type RuleValidationResult =
  { ok: true; rule: GuidelineRuleDefinition } | { ok: false; issues: RuleValidationIssue[] };

export type RuleValidationOptions = {
  allowedRiskPaths?: Readonly<Record<string, readonly string[]>>;
};

export const DEFAULT_ALLOWED_RISK_PATHS: Readonly<Record<string, readonly string[]>> = {
  tobacco_use: ["status", "packYears", "currentSmoker", "yearsSinceQuit"],
  height_weight: ["bmi", "heightCentimeters", "weightKilograms", "measuredOn"],
  pregnancy_status: ["value"],
  immunocompromised: ["value"],
  alcohol_use: ["assessmentPreferred", "riskLevel"],
  fall_risk: ["concern"],
  sexual_health_risk: ["value"],
  occupational_exposure: ["value"],
};

function expressionIssues(
  expression: Expression,
  path: string,
  allowedRiskPaths: Readonly<Record<string, readonly string[]>>,
): RuleValidationIssue[] {
  const issues: RuleValidationIssue[] = [];
  if (expression.op === "age_between") {
    if (expression.min === undefined && expression.max === undefined) {
      issues.push({ path, message: "An age range needs at least one bound." });
    }
    if (
      expression.min !== undefined &&
      expression.max !== undefined &&
      expression.min > expression.max
    ) {
      issues.push({ path, message: "The minimum age cannot exceed the maximum age." });
    }
  }
  if (expression.op === "risk_equals" || expression.op === "risk_number_compare") {
    const paths = allowedRiskPaths[expression.type];
    if (paths === undefined || !paths.includes(expression.path)) {
      issues.push({
        path: `${path}.path`,
        message: `Risk path ${expression.type}.${expression.path} is not allowlisted.`,
      });
    }
  }
  if (expression.op === "all" || expression.op === "any") {
    expression.children.forEach((child, index) => {
      issues.push(...expressionIssues(child, `${path}.children.${index}`, allowedRiskPaths));
    });
  } else if (expression.op === "not") {
    issues.push(...expressionIssues(expression.child, `${path}.child`, allowedRiskPaths));
  }
  return issues;
}

function scheduleIssues(schedule: Schedule): RuleValidationIssue[] {
  const issues: RuleValidationIssue[] = [];
  if (
    schedule.kind === "age_based" &&
    schedule.startAge !== undefined &&
    schedule.stopAge !== undefined &&
    schedule.startAge > schedule.stopAge
  ) {
    issues.push({ path: "schedule", message: "Schedule start age cannot exceed stop age." });
  }
  if (schedule.kind === "method_dependent") {
    const ids = schedule.methods.map((method) => method.methodId);
    if (new Set(ids).size !== ids.length) {
      issues.push({ path: "schedule.methods", message: "Method IDs must be unique." });
    }
  }
  if (schedule.kind === "dose_series") {
    const ordinals = [...schedule.doses].map((dose) => dose.ordinal).sort((a, b) => a - b);
    if (ordinals.some((ordinal, index) => ordinal !== index + 1)) {
      issues.push({
        path: "schedule.doses",
        message: "Dose ordinals must be unique and consecutive from one.",
      });
    }
  }
  return issues;
}

export function validateRuleDefinition(
  input: unknown,
  options: RuleValidationOptions = {},
): RuleValidationResult {
  const parsed = guidelineRuleDefinitionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    };
  }

  const rule = parsed.data;
  const allowedRiskPaths = options.allowedRiskPaths ?? DEFAULT_ALLOWED_RISK_PATHS;
  const issues = [
    ...expressionIssues(rule.appliesWhen, "appliesWhen", allowedRiskPaths),
    ...(rule.excludesWhen === null
      ? []
      : expressionIssues(rule.excludesWhen, "excludesWhen", allowedRiskPaths)),
    ...(rule.stopWhen === null
      ? []
      : expressionIssues(rule.stopWhen, "stopWhen", allowedRiskPaths)),
    ...scheduleIssues(rule.schedule),
  ];

  if (rule.effectiveTo !== null && rule.effectiveFrom > rule.effectiveTo) {
    issues.push({ path: "effectiveTo", message: "Effective end cannot precede start." });
  }
  for (const [path, value] of [
    ["effectiveFrom", rule.effectiveFrom],
    ["reviewedAt", rule.reviewedAt],
    ...(rule.effectiveTo === null ? [] : [["effectiveTo", rule.effectiveTo]]),
  ] as Array<[string, string]>) {
    try {
      parseIsoDate(value);
    } catch {
      issues.push({ path, message: "Use a real calendar date." });
    }
  }
  if (rule.baseline && rule.conflictGroup === null) {
    issues.push({ path: "baseline", message: "Only a conflict-group variant can be baseline." });
  }
  if (
    rule.schedule.kind === "method_dependent" &&
    rule.allowedMethods !== null &&
    rule.schedule.methods.some((method) => !rule.allowedMethods?.includes(method.methodId))
  ) {
    issues.push({
      path: "allowedMethods",
      message: "Every scheduled method must appear in allowed methods.",
    });
  }
  if (rule.reviewStatus === "active" && rule.scenarioIds.length === 0) {
    issues.push({ path: "scenarioIds", message: "An active rule needs a scenario." });
  }

  return issues.length === 0 ? { ok: true, rule } : { ok: false, issues };
}

export function defineRule(input: unknown): GuidelineRuleDefinition {
  const result = validateRuleDefinition(input);
  if (!result.ok) {
    throw new RangeError(
      result.issues.map((issue) => `${issue.path || "rule"}: ${issue.message}`).join("; "),
    );
  }
  return result.rule;
}

export function validateRuleSet(rules: readonly GuidelineRuleDefinition[]): RuleValidationIssue[] {
  const issues: RuleValidationIssue[] = [];
  rules.forEach((rule, index) => {
    const result = validateRuleDefinition(rule);
    if (!result.ok) {
      issues.push(
        ...result.issues.map((issue) => ({
          path: `rules.${index}${issue.path === "" ? "" : `.${issue.path}`}`,
          message: issue.message,
        })),
      );
    }
  });

  const active = rules.filter((rule) => rule.reviewStatus === "active");
  const conflictGroups = new Set(
    active.map((rule) => rule.conflictGroup).filter((group): group is string => group !== null),
  );
  for (const group of conflictGroups) {
    const baselineVariants = new Set(
      active
        .filter((rule) => rule.conflictGroup === group && rule.baseline)
        .map((rule) => rule.variantId),
    );
    if (baselineVariants.size !== 1) {
      issues.push({
        path: `conflictGroups.${group}`,
        message: "An active conflict group needs exactly one baseline variant.",
      });
    }
  }

  const byStableKey = new Map<string, GuidelineRuleDefinition[]>();
  for (const rule of active) {
    const versions = byStableKey.get(rule.stableKey) ?? [];
    versions.push(rule);
    byStableKey.set(rule.stableKey, versions);
  }
  for (const [stableKey, versions] of byStableKey) {
    for (const left of versions) {
      for (const right of versions) {
        if (left.version >= right.version) continue;
        const leftEnd = left.effectiveTo ?? "9999-12-31";
        const rightEnd = right.effectiveTo ?? "9999-12-31";
        if (left.effectiveFrom <= rightEnd && right.effectiveFrom <= leftEnd) {
          issues.push({
            path: `stableKeys.${stableKey}`,
            message: `Active versions ${left.version} and ${right.version} overlap.`,
          });
        }
      }
    }
  }
  return issues;
}

export function assertRuleMayBeMutated(rule: GuidelineRuleDefinition): void {
  if (rule.reviewStatus === "active") {
    throw new Error("Active rule versions are immutable; clone a new version instead.");
  }
}

export function cloneRuleVersion(
  rule: GuidelineRuleDefinition,
  changes: Partial<Omit<GuidelineRuleDefinition, "stableKey" | "version">> = {},
): GuidelineRuleDefinition {
  return guidelineRuleDefinitionSchema.parse({
    ...rule,
    ...changes,
    stableKey: rule.stableKey,
    version: rule.version + 1,
    reviewStatus: changes.reviewStatus ?? "draft",
  });
}

export function all(...children: Expression[]): Expression {
  if (children.length === 0) throw new RangeError("all() needs at least one expression.");
  return { op: "all", children };
}

export function any(...children: Expression[]): Expression {
  if (children.length === 0) throw new RangeError("any() needs at least one expression.");
  return { op: "any", children };
}

export function not(child: Expression): Expression {
  return { op: "not", child };
}

export function ageBetween(
  min?: number,
  max?: number,
  options: { includeMin?: boolean; includeMax?: boolean } = {},
): Expression {
  return {
    op: "age_between",
    ...(min === undefined ? {} : { min }),
    ...(max === undefined ? {} : { max }),
    ...(options.includeMin === undefined ? {} : { includeMin: options.includeMin }),
    ...(options.includeMax === undefined ? {} : { includeMax: options.includeMax }),
  };
}

export function anatomyIs(key: AnatomyKey, state: AnatomyState): Expression {
  return { op: "anatomy_is", key, state };
}

export function riskEquals(type: string, path: string, value: JsonPrimitive): Expression {
  return { op: "risk_equals", type, path, value };
}

export function riskNumber(
  type: string,
  path: string,
  comparator: NumericComparator,
  value: number,
): Expression {
  return { op: "risk_number_compare", type, path, comparator, value };
}

export function conditionPresent(
  code: string,
  statuses?: Array<"active" | "resolved" | "history">,
): Expression {
  return { op: "condition_present", code, ...(statuses === undefined ? {} : { statuses }) };
}

export function priorEventExists(
  serviceId: string,
  options: { methodIds?: string[]; resultIn?: CareEventResult[] } = {},
): Expression {
  return {
    op: "prior_event_exists",
    serviceId,
    ...(options.methodIds === undefined ? {} : { methodIds: options.methodIds }),
    ...(options.resultIn === undefined ? {} : { resultIn: options.resultIn }),
  };
}

export function intervalSchedule(
  interval: Duration,
  anchor: "last_qualifying_event" | "eligibility_date" = "last_qualifying_event",
): Schedule {
  return { kind: "interval", interval, anchor };
}

export function ageBasedSchedule(
  options: {
    startAge?: number;
    stopAge?: number;
    interval?: Duration;
    initialDue?: "on_eligibility" | "calendar_year";
  } = {},
): Schedule {
  return {
    kind: "age_based",
    ...(options.startAge === undefined ? {} : { startAge: options.startAge }),
    ...(options.stopAge === undefined ? {} : { stopAge: options.stopAge }),
    ...(options.interval === undefined ? {} : { interval: options.interval }),
    ...(options.initialDue === undefined ? {} : { initialDue: options.initialDue }),
  };
}

export function methodDependentSchedule(
  methods: Array<{
    methodId: string;
    interval: Duration;
    qualifyingResults: CareEventResult[];
  }>,
  defaultMethodPrompt = true,
): Schedule {
  return { kind: "method_dependent", defaultMethodPrompt, methods };
}

export function oneTimeSchedule(dueOnEligibility = true): Schedule {
  return { kind: "one_time", dueOnEligibility };
}

export function seasonalSchedule(
  seasonStartMonth: number,
  seasonEndMonth: number,
  repeatsAnnually = true,
): Schedule {
  return { kind: "seasonal", seasonStartMonth, seasonEndMonth, repeatsAnnually };
}

export function doseSeriesSchedule(
  seriesKey: string,
  doses: Array<{
    ordinal: number;
    minimumIntervalFromPrior?: Duration;
    recommendedIntervalFromPrior?: Duration;
  }>,
  boosters?: { interval: Duration },
): Schedule {
  return {
    kind: "dose_series",
    seriesKey,
    doses,
    ...(boosters === undefined ? {} : { boosters }),
  };
}

export function sharedDecisionSchedule(
  options: {
    startAge?: number;
    stopAge?: number;
    repeatConversationAfter?: Duration;
  } = {},
): Schedule {
  return {
    kind: "shared_decision",
    ...(options.startAge === undefined ? {} : { startAge: options.startAge }),
    ...(options.stopAge === undefined ? {} : { stopAge: options.stopAge }),
    ...(options.repeatConversationAfter === undefined
      ? {}
      : { repeatConversationAfter: options.repeatConversationAfter }),
  };
}

export function customSchedule(): Schedule {
  return { kind: "custom", requiresUserOrClinicianCadence: true };
}
