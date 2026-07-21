import "dotenv/config";

import { GUIDELINE_RULE_SEEDS } from "../prisma/seed/rules";
import { createPrismaClient } from "../src/server/db/client";
import { SOURCE_REGISTRY, toGuidelineSourceSeed } from "../src/server/sources/registry";
import {
  changedRuleFields,
  compareRuleVersions,
  type ComparableRule,
  type ComparableSourceMetadata,
  parseRuleDiffArguments,
  renderRuleVersionDiff,
} from "./rule-diff";

type RuleIdentity = {
  stableKey: string;
  version: number;
};

type DatabaseCheckReport = {
  seedRules: number;
  databaseRules: number;
  matching: number;
  pending: string[];
  changed: Array<{ identity: string; fields: string[] }>;
  databaseOnly: string[];
  clean: boolean;
};

function identity(rule: RuleIdentity): string {
  return `${rule.stableKey}@${rule.version}`;
}

function isoDate(value: Date | null): string | null {
  return value?.toISOString().slice(0, 10) ?? null;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function recommendationClass(value: string): string {
  return value.replaceAll("_", "-");
}

function sourceMetadataFromSeed(sourceSlug: string): ComparableSourceMetadata {
  const source = SOURCE_REGISTRY.find((candidate) => candidate.slug === sourceSlug);
  if (source === undefined) throw new Error(`Rule source ${sourceSlug} is not registered.`);
  const stored = toGuidelineSourceSeed(source);
  return {
    slug: stored.slug,
    organization: stored.organization,
    title: stored.title,
    canonicalUrl: stored.canonicalUrl,
    sourceType: stored.sourceType,
    jurisdiction: stored.jurisdiction,
    publishedAt: stored.publishedAt,
    effectiveAt: stored.effectiveAt,
    lastVerifiedAt: stored.lastVerifiedAt,
    contentHash: stored.contentHash,
    attributionText: stored.attributionText,
    licenseOrTermsUrl: stored.licenseOrTermsUrl,
    active: stored.active,
  };
}

function comparableSeedRules(): ComparableRule[] {
  return GUIDELINE_RULE_SEEDS.map((rule) => ({
    stableKey: rule.stableKey,
    version: rule.version,
    serviceSlug: rule.serviceSlug,
    variantId: rule.variantId,
    conflictGroup: rule.conflictGroup,
    baseline: rule.baseline,
    jurisdiction: rule.jurisdiction,
    evidenceGrade: rule.evidenceGrade,
    recommendationClass: rule.recommendationClass,
    appliesWhen: rule.appliesWhen,
    excludesWhen: rule.excludesWhen,
    stopWhen: rule.stopWhen,
    schedule: rule.schedule,
    completionEventTypes: rule.completionEventTypes,
    allowedMethods: rule.allowedMethods,
    outcomeModifiers: rule.outcomeModifiers,
    consumerSummary: rule.consumerSummary,
    whyItMatters: rule.whyItMatters,
    questionsForClinician: rule.questionsForClinician,
    limitations: rule.limitations,
    effectiveFrom: rule.effectiveFrom,
    effectiveTo: rule.effectiveTo,
    reviewStatus: rule.reviewStatus,
    scenarioIds: rule.scenarioIds,
    source: sourceMetadataFromSeed(rule.sourceSlug),
  }));
}

function normalizeSchedule(value: unknown, methodSlugsById: ReadonlyMap<string, string>): unknown {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return value;
  const schedule = value as Record<string, unknown>;
  if (schedule.kind !== "method_dependent" || !Array.isArray(schedule.methods)) return value;
  return {
    ...schedule,
    methods: schedule.methods.map((entry) => {
      if (typeof entry !== "object" || entry === null || Array.isArray(entry)) return entry;
      const method = entry as Record<string, unknown>;
      const methodId = method.methodId;
      return {
        ...method,
        methodId:
          typeof methodId === "string" ? (methodSlugsById.get(methodId) ?? methodId) : methodId,
      };
    }),
  };
}

async function comparableDatabaseRules(
  database: ReturnType<typeof createPrismaClient>,
  seedRulesByIdentity: ReadonlyMap<string, ComparableRule>,
): Promise<ComparableRule[]> {
  const rows = await database.guidelineRule.findMany({
    select: {
      stableKey: true,
      version: true,
      variantId: true,
      conflictGroup: true,
      isBaseline: true,
      jurisdiction: true,
      evidenceGrade: true,
      recommendationClass: true,
      appliesWhenJson: true,
      excludesWhenJson: true,
      stopWhenJson: true,
      scheduleJson: true,
      completionEventTypesJson: true,
      allowedMethodsJson: true,
      outcomeModifiersJson: true,
      consumerSummary: true,
      whyItMatters: true,
      questionsForClinicianJson: true,
      limitationsJson: true,
      effectiveFrom: true,
      effectiveTo: true,
      reviewStatus: true,
      service: { select: { slug: true, methods: { select: { id: true, slug: true } } } },
      source: {
        select: {
          slug: true,
          organization: true,
          title: true,
          canonicalUrl: true,
          sourceType: true,
          jurisdiction: true,
          publishedAt: true,
          effectiveAt: true,
          lastVerifiedAt: true,
          contentHash: true,
          attributionText: true,
          licenseOrTermsUrl: true,
          active: true,
        },
      },
    },
    orderBy: [{ stableKey: "asc" }, { version: "asc" }],
  });

  return rows.map((row) => {
    const methodSlugsById = new Map(row.service.methods.map((method) => [method.id, method.slug]));
    const matchingSeed = seedRulesByIdentity.get(identity(row));
    const allowedMethods =
      row.allowedMethodsJson === null
        ? null
        : stringArray(row.allowedMethodsJson).map(
            (methodId) => methodSlugsById.get(methodId) ?? methodId,
          );
    return {
      stableKey: row.stableKey,
      version: row.version,
      serviceSlug: row.service.slug,
      variantId: row.variantId,
      conflictGroup: row.conflictGroup,
      baseline: row.isBaseline,
      jurisdiction: row.jurisdiction,
      evidenceGrade: row.evidenceGrade,
      recommendationClass: recommendationClass(row.recommendationClass),
      appliesWhen: row.appliesWhenJson,
      excludesWhen: row.excludesWhenJson,
      stopWhen: row.stopWhenJson,
      schedule: normalizeSchedule(row.scheduleJson, methodSlugsById),
      completionEventTypes: stringArray(row.completionEventTypesJson),
      allowedMethods,
      outcomeModifiers: stringArray(row.outcomeModifiersJson),
      consumerSummary: row.consumerSummary,
      whyItMatters: row.whyItMatters,
      questionsForClinician: stringArray(row.questionsForClinicianJson),
      limitations: stringArray(row.limitationsJson),
      effectiveFrom: isoDate(row.effectiveFrom) as string,
      effectiveTo: isoDate(row.effectiveTo),
      reviewStatus: row.reviewStatus,
      scenarioIds: matchingSeed?.scenarioIds ?? [],
      source: {
        slug: row.source.slug,
        organization: row.source.organization,
        title: row.source.title,
        canonicalUrl: row.source.canonicalUrl,
        sourceType: row.source.sourceType,
        jurisdiction: row.source.jurisdiction,
        publishedAt: isoDate(row.source.publishedAt),
        effectiveAt: isoDate(row.source.effectiveAt),
        lastVerifiedAt: isoDate(row.source.lastVerifiedAt) as string,
        contentHash: row.source.contentHash?.trimEnd() ?? null,
        attributionText: row.source.attributionText,
        licenseOrTermsUrl: row.source.licenseOrTermsUrl,
        active: row.source.active,
      },
    };
  });
}

function databaseCheckReport(
  expectedRules: readonly ComparableRule[],
  databaseRules: readonly ComparableRule[],
): DatabaseCheckReport {
  const expectedByIdentity = new Map(expectedRules.map((rule) => [identity(rule), rule]));
  const storedByIdentity = new Map(databaseRules.map((rule) => [identity(rule), rule]));
  const pending = [...expectedByIdentity.keys()].filter((key) => !storedByIdentity.has(key));
  const databaseOnly = [...storedByIdentity.keys()].filter((key) => !expectedByIdentity.has(key));
  const changed = [...expectedByIdentity.entries()].flatMap(([key, expected]) => {
    const actual = storedByIdentity.get(key);
    if (actual === undefined) return [];
    const fields = changedRuleFields(actual, expected);
    return fields.length === 0 ? [] : [{ identity: key, fields }];
  });
  return {
    seedRules: expectedByIdentity.size,
    databaseRules: storedByIdentity.size,
    matching: expectedByIdentity.size - pending.length - changed.length,
    pending,
    changed,
    databaseOnly,
    clean: pending.length === 0 && changed.length === 0,
  };
}

function renderDatabaseCheck(report: DatabaseCheckReport): string {
  return `${[
    `Reviewed rule diff: ${report.clean ? "no pending seed versions" : "changes detected"}`,
    `${report.seedRules} seed rules; ${report.databaseRules} database rules; ${report.matching} matching`,
    ...report.pending.map((key) => `PENDING ${key}`),
    ...report.changed.map((entry) => `CHANGED ${entry.identity}: ${entry.fields.join(", ")}`),
    ...report.databaseOnly.map((key) => `DATABASE-ONLY ${key}`),
  ].join("\n")}\n`;
}

async function profileCountsByJurisdiction(
  database: ReturnType<typeof createPrismaClient>,
  rules: readonly ComparableRule[],
  toVersion: number,
  stableKey: string | null,
): Promise<Map<string, number>> {
  const jurisdictions = [
    ...new Set(
      rules
        .filter(
          (rule) =>
            rule.version === toVersion && (stableKey === null || rule.stableKey === stableKey),
        )
        .map((rule) => rule.jurisdiction),
    ),
  ];
  const counts = await Promise.all(
    jurisdictions.map(
      async (jurisdiction) =>
        [
          jurisdiction,
          await database.profile.count({
            where: {
              countryCode: jurisdiction,
              deletedAt: null,
              household: { deletedAt: null },
            },
          }),
        ] as const,
    ),
  );
  return new Map(counts);
}

async function main(): Promise<void> {
  const options = parseRuleDiffArguments(process.argv.slice(2));
  const seedRules = comparableSeedRules();
  const seedRulesByIdentity = new Map(seedRules.map((rule) => [identity(rule), rule]));
  const databaseUrl = process.env.DATABASE_URL;
  const database =
    databaseUrl === undefined || databaseUrl === "" ? null : createPrismaClient(databaseUrl);

  try {
    if (options.mode === "database_check") {
      if (database === null) {
        throw new Error("DATABASE_URL is required for the database-versus-seed rule check.");
      }
      const report = databaseCheckReport(
        seedRules,
        await comparableDatabaseRules(database, seedRulesByIdentity),
      );
      process.stdout.write(
        options.json ? `${JSON.stringify(report, null, 2)}\n` : renderDatabaseCheck(report),
      );
      if (options.check && !report.clean) process.exitCode = 1;
      return;
    }

    const fromVersion = options.fromVersion;
    const toVersion = options.toVersion;
    if (fromVersion === null || toVersion === null) {
      throw new Error("Semantic rule comparison requires --from and --to.");
    }
    const databaseRules =
      database === null ? [] : await comparableDatabaseRules(database, seedRulesByIdentity);
    const mergedByIdentity = new Map(seedRules.map((rule) => [identity(rule), rule]));
    for (const rule of databaseRules) mergedByIdentity.set(identity(rule), rule);
    const mergedRules = [...mergedByIdentity.values()];
    const profileCounts =
      database === null
        ? null
        : await profileCountsByJurisdiction(database, mergedRules, toVersion, options.stableKey);
    const report = compareRuleVersions(
      mergedRules,
      fromVersion,
      toVersion,
      options.stableKey,
      profileCounts,
    );
    if (report.diffs.length === 0) {
      const scope = options.stableKey === null ? "the checked-in catalog" : options.stableKey;
      throw new Error(
        `${scope} does not contain both rule versions ${fromVersion} and ${toVersion}.`,
      );
    }
    process.stdout.write(
      options.json ? `${JSON.stringify(report, null, 2)}\n` : renderRuleVersionDiff(report),
    );
  } finally {
    await database?.$disconnect();
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown rule diff failure.";
  process.stderr.write(`Rule diff failed: ${message}\n`);
  process.exitCode = 1;
});
