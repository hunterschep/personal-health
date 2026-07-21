export type ComparableSourceMetadata = {
  slug: string;
  organization: string;
  title: string;
  canonicalUrl: string;
  sourceType: string;
  jurisdiction: string;
  publishedAt: string | null;
  effectiveAt: string | null;
  lastVerifiedAt: string;
  contentHash: string | null;
  attributionText: string | null;
  licenseOrTermsUrl: string | null;
  active: boolean;
};

export type ComparableRule = {
  stableKey: string;
  version: number;
  serviceSlug: string;
  variantId: string;
  conflictGroup: string | null;
  baseline: boolean;
  jurisdiction: string;
  evidenceGrade: string | null;
  recommendationClass: string;
  appliesWhen: unknown;
  excludesWhen: unknown;
  stopWhen: unknown;
  schedule: unknown;
  completionEventTypes: string[];
  allowedMethods: string[] | null;
  outcomeModifiers: string[];
  consumerSummary: string;
  whyItMatters: string;
  questionsForClinician: string[];
  limitations: string[];
  effectiveFrom: string;
  effectiveTo: string | null;
  reviewStatus: string;
  scenarioIds: string[];
  source: ComparableSourceMetadata;
};

export type RuleDiffOptions = {
  mode: "database_check" | "semantic";
  fromVersion: number | null;
  toVersion: number | null;
  stableKey: string | null;
  json: boolean;
  check: boolean;
};

export type ValueChange<T> = {
  changed: boolean;
  from: T;
  to: T;
};

export type RuleVersionDiff = {
  stableKey: string;
  fromVersion: number;
  toVersion: number;
  eligibility: ValueChange<{
    appliesWhen: unknown;
    excludesWhen: unknown;
    stopWhen: unknown;
  }>;
  schedule: ValueChange<unknown>;
  sourceMetadata: ValueChange<ComparableSourceMetadata>;
  summaries: ValueChange<{
    consumerSummary: string;
    whyItMatters: string;
    questionsForClinician: string[];
    limitations: string[];
  }>;
  expectedAffectedScenarioIds: string[];
  changedFields: string[];
  estimatedProfileCount: number | null;
  snapshotRebuildRequired: boolean;
};

export type RuleVersionDiffReport = {
  fromVersion: number;
  toVersion: number;
  stableKey: string | null;
  comparedRuleCount: number;
  estimatedProfilesAvailable: boolean;
  diffs: RuleVersionDiff[];
};

function parsePositiveVersion(value: string | undefined, flag: string): number {
  if (value === undefined || !/^\d+$/.test(value)) {
    throw new TypeError(`${flag} requires a positive integer version.`);
  }
  const version = Number(value);
  if (!Number.isSafeInteger(version) || version < 1) {
    throw new TypeError(`${flag} requires a positive integer version.`);
  }
  return version;
}

function optionValue(arguments_: string[], index: number, flag: string): [string, number] {
  const argument = arguments_[index];
  if (argument === undefined) throw new TypeError(`${flag} requires a value.`);
  const inlineValue = argument.startsWith(`${flag}=`) ? argument.slice(flag.length + 1) : null;
  if (inlineValue !== null) return [inlineValue, index];
  const value = arguments_[index + 1];
  if (value === undefined || value.startsWith("--")) {
    throw new TypeError(`${flag} requires a value.`);
  }
  return [value, index + 1];
}

export function parseRuleDiffArguments(arguments_: string[]): RuleDiffOptions {
  let fromVersion: number | null = null;
  let toVersion: number | null = null;
  let stableKey: string | null = null;
  let json = false;
  let check = false;

  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === "--json") {
      json = true;
      continue;
    }
    if (argument === "--check") {
      check = true;
      continue;
    }
    if (argument === "--from" || argument?.startsWith("--from=")) {
      const [value, consumedIndex] = optionValue(arguments_, index, "--from");
      fromVersion = parsePositiveVersion(value, "--from");
      index = consumedIndex;
      continue;
    }
    if (argument === "--to" || argument?.startsWith("--to=")) {
      const [value, consumedIndex] = optionValue(arguments_, index, "--to");
      toVersion = parsePositiveVersion(value, "--to");
      index = consumedIndex;
      continue;
    }
    if (argument === "--rule" || argument?.startsWith("--rule=")) {
      const [value, consumedIndex] = optionValue(arguments_, index, "--rule");
      if (!/^[a-z0-9-]+$/.test(value)) {
        throw new TypeError("--rule requires a stable rule key.");
      }
      stableKey = value;
      index = consumedIndex;
      continue;
    }
    throw new TypeError(`Unknown argument: ${argument ?? ""}`);
  }

  if ((fromVersion === null) !== (toVersion === null)) {
    throw new TypeError("--from and --to must be supplied together.");
  }
  if (fromVersion !== null && fromVersion === toVersion) {
    throw new TypeError("--from and --to must identify different versions.");
  }
  if (stableKey !== null && fromVersion === null) {
    throw new TypeError("--rule is available only with --from and --to.");
  }

  return {
    mode: fromVersion === null ? "database_check" : "semantic",
    fromVersion,
    toVersion,
    stableKey,
    json,
    check,
  };
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (typeof value !== "object" || value === null) return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, canonicalize(child)]),
  );
}

export function semanticValuesEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(canonicalize(left)) === JSON.stringify(canonicalize(right));
}

function change<T>(from: T, to: T): ValueChange<T> {
  return { changed: !semanticValuesEqual(from, to), from, to };
}

function summaries(rule: ComparableRule) {
  return {
    consumerSummary: rule.consumerSummary,
    whyItMatters: rule.whyItMatters,
    questionsForClinician: rule.questionsForClinician,
    limitations: rule.limitations,
  };
}

function eligibility(rule: ComparableRule) {
  return {
    appliesWhen: rule.appliesWhen,
    excludesWhen: rule.excludesWhen,
    stopWhen: rule.stopWhen,
  };
}

const OTHER_COMPARABLE_FIELDS = [
  "serviceSlug",
  "variantId",
  "conflictGroup",
  "baseline",
  "jurisdiction",
  "evidenceGrade",
  "recommendationClass",
  "completionEventTypes",
  "allowedMethods",
  "outcomeModifiers",
  "effectiveFrom",
  "effectiveTo",
  "reviewStatus",
] as const satisfies readonly (keyof ComparableRule)[];

export function changedRuleFields(from: ComparableRule, to: ComparableRule): string[] {
  const fields: string[] = [];
  if (!semanticValuesEqual(eligibility(from), eligibility(to))) fields.push("eligibility");
  if (!semanticValuesEqual(from.schedule, to.schedule)) fields.push("schedule");
  if (!semanticValuesEqual(from.source, to.source)) fields.push("source metadata");
  if (!semanticValuesEqual(summaries(from), summaries(to))) fields.push("summaries");
  if (!semanticValuesEqual([...from.scenarioIds].sort(), [...to.scenarioIds].sort())) {
    fields.push("scenario IDs");
  }
  for (const field of OTHER_COMPARABLE_FIELDS) {
    if (!semanticValuesEqual(from[field], to[field])) fields.push(field);
  }
  return fields;
}

function buildDiff(
  from: ComparableRule,
  to: ComparableRule,
  estimatedProfileCount: number | null,
): RuleVersionDiff {
  if (from.stableKey !== to.stableKey) {
    throw new TypeError("Rule version comparisons require the same stable key.");
  }
  const changedFields = changedRuleFields(from, to);
  return {
    stableKey: to.stableKey,
    fromVersion: from.version,
    toVersion: to.version,
    eligibility: change(eligibility(from), eligibility(to)),
    schedule: change(from.schedule, to.schedule),
    sourceMetadata: change(from.source, to.source),
    summaries: change(summaries(from), summaries(to)),
    expectedAffectedScenarioIds: [...new Set([...from.scenarioIds, ...to.scenarioIds])].sort(),
    changedFields,
    estimatedProfileCount,
    // A newly active immutable version needs fresh snapshots even when its
    // reviewed behavior is intentionally unchanged, so history points to the
    // version that was actually evaluated.
    snapshotRebuildRequired: to.reviewStatus === "active" && from.version !== to.version,
  };
}

export function compareRuleVersions(
  rules: readonly ComparableRule[],
  fromVersion: number,
  toVersion: number,
  stableKey: string | null = null,
  profileCountsByJurisdiction: ReadonlyMap<string, number> | null = null,
): RuleVersionDiffReport {
  const byIdentity = new Map(rules.map((rule) => [`${rule.stableKey}@${rule.version}`, rule]));
  const stableKeys = [
    ...new Set(
      rules
        .filter((rule) => rule.version === fromVersion || rule.version === toVersion)
        .map((rule) => rule.stableKey),
    ),
  ]
    .filter((candidate) => stableKey === null || candidate === stableKey)
    .sort();

  const diffs = stableKeys.flatMap((candidate) => {
    const from = byIdentity.get(`${candidate}@${fromVersion}`);
    const to = byIdentity.get(`${candidate}@${toVersion}`);
    if (from === undefined || to === undefined) return [];
    return [buildDiff(from, to, profileCountsByJurisdiction?.get(to.jurisdiction) ?? null)];
  });

  return {
    fromVersion,
    toVersion,
    stableKey,
    comparedRuleCount: diffs.length,
    estimatedProfilesAvailable: profileCountsByJurisdiction !== null,
    diffs,
  };
}

function describeChange(label: string, value: ValueChange<unknown>): string[] {
  if (!value.changed) return [`  ${label}: unchanged`];
  return [
    `  ${label}: changed`,
    `    from: ${JSON.stringify(canonicalize(value.from))}`,
    `    to:   ${JSON.stringify(canonicalize(value.to))}`,
  ];
}

export function renderRuleVersionDiff(report: RuleVersionDiffReport): string {
  const heading = `Rule version diff: ${report.fromVersion} -> ${report.toVersion}`;
  if (report.diffs.length === 0) {
    return `${heading}\nNo stable rule key has both requested versions.\n`;
  }

  return `${[
    heading,
    `${report.comparedRuleCount} stable rule ${report.comparedRuleCount === 1 ? "key" : "keys"} compared.`,
    ...report.diffs.flatMap((diff) => [
      "",
      `${diff.stableKey} · v${diff.fromVersion} -> v${diff.toVersion}`,
      ...describeChange("eligibility", diff.eligibility),
      ...describeChange("schedule", diff.schedule),
      ...describeChange("source metadata", diff.sourceMetadata),
      ...describeChange("summaries", diff.summaries),
      `  changed fields: ${diff.changedFields.length === 0 ? "none" : diff.changedFields.join(", ")}`,
      `  expected affected scenarios: ${diff.expectedAffectedScenarioIds.length === 0 ? "none recorded" : diff.expectedAffectedScenarioIds.join(", ")}`,
      `  estimated profiles: ${diff.estimatedProfileCount ?? "unavailable (run with DATABASE_URL)"}`,
      `  snapshot rebuild: ${diff.snapshotRebuildRequired ? "required" : "not required until activation"}`,
    ]),
  ].join("\n")}\n`;
}
