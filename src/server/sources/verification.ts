import {
  SOURCE_REGISTRY_VERSION,
  sourceRegistryEntrySchema,
  type GuidelineRuleSourceReference,
  type SourceFreshnessState,
  type SourceRegistryEntry,
  type SourceType,
  type SourceVerificationIssue,
  type SourceVerificationReport,
} from "./types";

export const DEFAULT_FRESHNESS_DAYS: Readonly<Record<SourceType, number>> = Object.freeze({
  federal_recommendation: 180,
  federal_immunization: 90,
  consumer_content: 30,
  specialty_guideline: 180,
  app_authored_maintenance: 365,
  clinician_override: 365,
});

function utcDate(isoDate: string): number {
  return Date.parse(`${isoDate}T00:00:00.000Z`);
}

export function sourceFreshnessState(
  source: SourceRegistryEntry,
  asOfDate: string,
  thresholds: Readonly<Record<SourceType, number>> = DEFAULT_FRESHNESS_DAYS,
): SourceFreshnessState {
  if (!source.active || source.lifecycle === "draft" || source.lifecycle === "retired") {
    return "inactive";
  }
  if (
    source.lifecycle === "future" ||
    (source.effectiveAt !== null && source.effectiveAt > asOfDate)
  ) {
    return "future";
  }

  const elapsedDays = Math.floor(
    (utcDate(asOfDate) - utcDate(source.lastVerifiedAt)) / (24 * 60 * 60 * 1_000),
  );
  return elapsedDays > thresholds[source.sourceType] ? "review_due" : "current";
}

function issue(
  code: string,
  severity: SourceVerificationIssue["severity"],
  message: string,
  context: Pick<SourceVerificationIssue, "sourceSlug" | "ruleKey"> = {},
): SourceVerificationIssue {
  return { code, severity, message, ...context };
}

export type VerifySourceStructureOptions = {
  sources: readonly SourceRegistryEntry[];
  rules?: readonly GuidelineRuleSourceReference[];
  asOfDate: string;
  generatedAt?: string;
  thresholds?: Readonly<Record<SourceType, number>>;
};

export function verifySourceStructure({
  sources,
  rules = [],
  asOfDate,
  generatedAt = new Date().toISOString(),
  thresholds = DEFAULT_FRESHNESS_DAYS,
}: VerifySourceStructureOptions): SourceVerificationReport {
  const issues: SourceVerificationIssue[] = [];
  const sourcesBySlug = new Map<string, SourceRegistryEntry>();

  for (const candidate of sources) {
    const parsed = sourceRegistryEntrySchema.safeParse(candidate);
    if (!parsed.success) {
      const sourceContext =
        typeof candidate.slug === "string" ? { sourceSlug: candidate.slug } : {};
      issues.push(
        issue(
          "invalid_source_metadata",
          "error",
          parsed.error.issues.map((entry) => entry.message).join("; "),
          sourceContext,
        ),
      );
      continue;
    }

    const source = parsed.data;
    if (sourcesBySlug.has(source.slug)) {
      issues.push(
        issue("duplicate_source_slug", "error", `Duplicate source slug: ${source.slug}.`, {
          sourceSlug: source.slug,
        }),
      );
      continue;
    }
    sourcesBySlug.set(source.slug, source);

    const freshness = sourceFreshnessState(source, asOfDate, thresholds);
    if (freshness === "review_due") {
      issues.push(
        issue(
          "source_review_due",
          "warning",
          "This rule is based on the last reviewed source version shown below. A source review is due.",
          { sourceSlug: source.slug },
        ),
      );
    }
    if (source.lifecycle === "draft" && source.active) {
      issues.push(
        issue("active_draft_source", "error", "A draft source cannot be active.", {
          sourceSlug: source.slug,
        }),
      );
    }
    if (source.attribution.required && source.attribution.text === null) {
      issues.push(
        issue("missing_required_attribution", "error", "Required attribution text is missing.", {
          sourceSlug: source.slug,
        }),
      );
    }
  }

  const activeRules = rules.filter((rule) => rule.reviewStatus === "active");
  for (const rule of activeRules) {
    const source = sourcesBySlug.get(rule.sourceSlug);
    if (source === undefined) {
      issues.push(
        issue("rule_source_missing", "error", `Active rule references ${rule.sourceSlug}.`, {
          ruleKey: rule.stableKey,
          sourceSlug: rule.sourceSlug,
        }),
      );
      continue;
    }
    if (!source.active || source.lifecycle === "draft" || source.lifecycle === "retired") {
      issues.push(
        issue("rule_source_inactive", "error", "Active rule references an inactive source.", {
          ruleKey: rule.stableKey,
          sourceSlug: source.slug,
        }),
      );
    }
    if (rule.effectiveTo !== null && rule.effectiveTo < rule.effectiveFrom) {
      issues.push(
        issue("rule_effective_dates_invalid", "error", "Rule effective dates are incoherent.", {
          ruleKey: rule.stableKey,
          sourceSlug: source.slug,
        }),
      );
    }
    if (source.effectiveAt !== null && rule.effectiveFrom < source.effectiveAt) {
      issues.push(
        issue(
          "rule_predates_source_effective_date",
          "error",
          "Rule becomes effective before its source.",
          { ruleKey: rule.stableKey, sourceSlug: source.slug },
        ),
      );
    }
    if (rule.importsSourceText && !source.attribution.required) {
      issues.push(
        issue(
          "imported_text_without_attribution_contract",
          "error",
          "Imported source text requires an explicit attribution contract.",
          { ruleKey: rule.stableKey, sourceSlug: source.slug },
        ),
      );
    }
  }

  const conflictGroups = new Map<string, GuidelineRuleSourceReference[]>();
  for (const rule of activeRules) {
    if (rule.conflictGroup === null) continue;
    const group = conflictGroups.get(rule.conflictGroup) ?? [];
    group.push(rule);
    conflictGroups.set(rule.conflictGroup, group);
  }
  for (const [groupName, groupRules] of conflictGroups) {
    const baselineVariants = new Set(
      groupRules.filter((rule) => rule.baseline).map((rule) => rule.variantId ?? rule.stableKey),
    );
    if (baselineVariants.size !== 1) {
      issues.push(
        issue(
          "conflict_group_baseline_invalid",
          "error",
          `Conflict group ${groupName} has ${baselineVariants.size} active baseline variants; expected one.`,
        ),
      );
    }
  }

  return {
    registryVersion: SOURCE_REGISTRY_VERSION,
    generatedAt,
    mode: "offline",
    sourceCount: sources.length,
    activeSourceCount: sources.filter((source) => source.active).length,
    ruleCount: rules.length,
    issues,
    ok: issues.every((entry) => entry.severity !== "error"),
  };
}

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export async function verifyLiveSourceUrls(
  report: SourceVerificationReport,
  sources: readonly SourceRegistryEntry[],
  options: { fetch?: FetchLike; timeoutMs?: number } = {},
): Promise<SourceVerificationReport> {
  const request = options.fetch ?? globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? 8_000;
  const liveIssues: SourceVerificationIssue[] = [];

  for (const source of sources.filter((candidate) => candidate.active)) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      let response = await request(source.canonicalUrl, {
        method: "HEAD",
        redirect: "follow",
        signal: controller.signal,
      });
      if (response.status === 405) {
        response = await request(source.canonicalUrl, {
          method: "GET",
          headers: { Range: "bytes=0-0" },
          redirect: "follow",
          signal: controller.signal,
        });
      }
      if (!response.ok) {
        liveIssues.push(
          issue(
            "source_url_http_error",
            response.status === 404 || response.status === 410 ? "error" : "warning",
            `Live check returned HTTP ${response.status}.`,
            { sourceSlug: source.slug },
          ),
        );
      }
    } catch {
      liveIssues.push(
        issue(
          "source_url_unreachable",
          "warning",
          "Live source could not be reached. Structural verification remains valid.",
          { sourceSlug: source.slug },
        ),
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  const issues = [...report.issues, ...liveIssues];
  return {
    ...report,
    mode: "live",
    issues,
    ok: issues.every((entry) => entry.severity !== "error"),
  };
}

export function formatVerificationReport(report: SourceVerificationReport): string {
  const counts = report.issues.reduce(
    (result, entry) => ({ ...result, [entry.severity]: result[entry.severity] + 1 }),
    { error: 0, warning: 0, info: 0 },
  );
  const lines = [
    `Source verification (${report.mode})`,
    `Registry ${report.registryVersion}: ${report.sourceCount} sources (${report.activeSourceCount} active), ${report.ruleCount} rules`,
    `Result: ${report.ok ? "PASS" : "FAIL"} — ${counts.error} errors, ${counts.warning} warnings, ${counts.info} informational`,
  ];
  for (const entry of report.issues) {
    const subject = entry.ruleKey ?? entry.sourceSlug ?? "registry";
    lines.push(`[${entry.severity.toUpperCase()}] ${entry.code} (${subject}): ${entry.message}`);
  }
  return lines.join("\n");
}

export type SourceInventoryReport = {
  asOfDate: string;
  total: number;
  active: number;
  byType: Record<SourceType, number>;
  byFreshness: Record<SourceFreshnessState, number>;
  sources: Array<{
    slug: string;
    organization: string;
    title: string;
    sourceType: SourceType;
    lifecycle: SourceRegistryEntry["lifecycle"];
    freshness: SourceFreshnessState;
    lastVerifiedAt: string;
    serviceCount: number;
  }>;
};

export function buildSourceInventoryReport(
  sources: readonly SourceRegistryEntry[],
  asOfDate: string,
  thresholds: Readonly<Record<SourceType, number>> = DEFAULT_FRESHNESS_DAYS,
): SourceInventoryReport {
  const byType: Record<SourceType, number> = {
    federal_recommendation: 0,
    federal_immunization: 0,
    consumer_content: 0,
    specialty_guideline: 0,
    app_authored_maintenance: 0,
    clinician_override: 0,
  };
  const byFreshness: Record<SourceFreshnessState, number> = {
    current: 0,
    review_due: 0,
    future: 0,
    inactive: 0,
  };
  const rows = sources.map((source) => {
    const freshness = sourceFreshnessState(source, asOfDate, thresholds);
    byType[source.sourceType] += 1;
    byFreshness[freshness] += 1;
    return {
      slug: source.slug,
      organization: source.organization,
      title: source.title,
      sourceType: source.sourceType,
      lifecycle: source.lifecycle,
      freshness,
      lastVerifiedAt: source.lastVerifiedAt,
      serviceCount: source.serviceSlugs.length,
    };
  });

  return {
    asOfDate,
    total: sources.length,
    active: sources.filter((source) => source.active).length,
    byType,
    byFreshness,
    sources: rows,
  };
}
