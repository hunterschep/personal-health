import type { PublicSourceMetadata, SourceFreshnessState } from "@/server/sources/types";
import { requireSession } from "@/server/auth/session";
import { prisma } from "@/server/db/client";
import {
  getPublicSourceMetadata,
  getSourceBySlug,
  SOURCE_REGISTRY,
} from "@/server/sources/registry";
import { sourceFreshnessState } from "@/server/sources/verification";
import {
  humanizeIdentifier,
  methodIntervals,
  readStringArray,
  ruleIsCurrent,
  summarizeExpression,
  summarizeSchedule,
} from "./transparency-format";

export type SourceCenterRow = {
  metadata: PublicSourceMetadata;
  freshness: SourceFreshnessState;
  activeRuleCount: number;
  totalRuleCount: number;
  hasBaseline: boolean;
  hasAlternative: boolean;
  hasRetiredRule: boolean;
  services: Array<{ slug: string; name: string; category: string }>;
};

export type SourceCenterFilters = {
  query?: string;
  organization?: string;
  category?: string;
  freshness?: string;
  evidence?: string;
  variant?: string;
  activity?: string;
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function uniqueServices(
  services: Array<{ slug: string; name: string; category: string }>,
): Array<{ slug: string; name: string; category: string }> {
  return [...new Map(services.map((service) => [service.slug, service])).values()].sort((a, b) =>
    a.name.localeCompare(b.name),
  );
}

export function filterSourceCenterRows(
  rows: readonly SourceCenterRow[],
  filters: SourceCenterFilters,
): SourceCenterRow[] {
  const query = filters.query?.trim().toLocaleLowerCase("en-US") ?? "";
  return rows.filter((row) => {
    if (
      query !== "" &&
      ![
        row.metadata.organization,
        row.metadata.title,
        row.metadata.sourceType,
        ...row.services.flatMap((service) => [service.name, service.category]),
      ]
        .join(" ")
        .toLocaleLowerCase("en-US")
        .includes(query)
    ) {
      return false;
    }
    if (
      filters.organization !== undefined &&
      filters.organization !== "all" &&
      row.metadata.organization !== filters.organization
    ) {
      return false;
    }
    if (
      filters.category !== undefined &&
      filters.category !== "all" &&
      !row.services.some((service) => service.category === filters.category)
    ) {
      return false;
    }
    if (
      filters.freshness !== undefined &&
      filters.freshness !== "all" &&
      row.freshness !== filters.freshness
    ) {
      return false;
    }
    if (
      filters.evidence !== undefined &&
      filters.evidence !== "all" &&
      row.metadata.evidenceClass !== filters.evidence
    ) {
      return false;
    }
    if (filters.variant === "baseline" && !row.hasBaseline) return false;
    if (filters.variant === "alternative" && !row.hasAlternative) return false;
    if (filters.activity === "active" && !row.metadata.active) return false;
    if (filters.activity === "retired" && row.metadata.active && !row.hasRetiredRule) return false;
    return true;
  });
}

export async function loadSourceCenter(asOfDate = todayIso()) {
  await requireSession();
  const storedSources = await prisma.guidelineSource.findMany({
    select: {
      slug: true,
      rules: {
        select: {
          reviewStatus: true,
          effectiveFrom: true,
          effectiveTo: true,
          isBaseline: true,
          variantId: true,
          service: { select: { slug: true, name: true, category: true } },
        },
      },
    },
  });
  const storedBySlug = new Map(storedSources.map((source) => [source.slug, source]));

  const rows: SourceCenterRow[] = SOURCE_REGISTRY.map((source) => {
    const stored = storedBySlug.get(source.slug);
    const rules = stored?.rules ?? [];
    const currentRules = rules.filter((rule) => ruleIsCurrent(rule, asOfDate));
    return {
      metadata: getPublicSourceMetadata(source),
      freshness: sourceFreshnessState(source, asOfDate),
      activeRuleCount: currentRules.length,
      totalRuleCount: rules.length,
      hasBaseline: rules.some((rule) => rule.isBaseline),
      hasAlternative: rules.some(
        (rule) => !rule.isBaseline && rule.variantId !== "federal_baseline",
      ),
      hasRetiredRule: rules.some((rule) => rule.reviewStatus === "retired"),
      services: uniqueServices(
        rules.map((rule) => ({
          slug: rule.service.slug,
          name: rule.service.name,
          category: rule.service.category,
        })),
      ),
    };
  }).sort((left, right) => {
    const organization = left.metadata.organization.localeCompare(right.metadata.organization);
    return organization === 0
      ? left.metadata.title.localeCompare(right.metadata.title)
      : organization;
  });

  return {
    asOfDate,
    rows,
    organizations: [...new Set(rows.map((row) => row.metadata.organization))].sort(),
    categories: [
      ...new Set(rows.flatMap((row) => row.services.map((service) => service.category))),
    ].sort(),
    evidenceClasses: [...new Set(rows.map((row) => row.metadata.evidenceClass))].sort(),
  };
}

function availability(
  status: string | undefined,
): "available" | "fallback" | "unavailable" | "not_checked" {
  if (status === undefined || status === "running") return "not_checked";
  if (status === "success") return "available";
  if (status === "fallback") return "fallback";
  return "unavailable";
}

export async function loadSourceDetail(sourceSlug: string, asOfDate = todayIso()) {
  await requireSession();
  const registered = getSourceBySlug(sourceSlug);
  if (registered === null) return null;

  const stored = await prisma.guidelineSource.findUnique({
    where: { slug: sourceSlug },
    include: {
      rules: {
        include: {
          service: { include: { methods: { where: { active: true }, orderBy: { name: "asc" } } } },
        },
        orderBy: [{ service: { sortOrder: "asc" } }, { stableKey: "asc" }, { version: "desc" }],
      },
      syncLogs: {
        select: {
          id: true,
          startedAt: true,
          finishedAt: true,
          status: true,
          httpStatus: true,
          contentHash: true,
          changed: true,
        },
        orderBy: { startedAt: "desc" },
        take: 20,
      },
      cacheEntries: {
        select: {
          id: true,
          contentHash: true,
          fetchedAt: true,
          expiresAt: true,
          lastSuccessfulAt: true,
        },
        orderBy: { lastSuccessfulAt: "desc" },
        take: 5,
      },
    },
  });

  const rules = (stored?.rules ?? []).map((rule) => {
    const intervals = new Map(
      methodIntervals(rule.scheduleJson).map((interval) => [interval.methodIdentifier, interval]),
    );
    const allowed = new Set(readStringArray(rule.allowedMethodsJson));
    return {
      id: rule.id,
      stableKey: rule.stableKey,
      version: rule.version,
      variantId: rule.variantId,
      conflictGroup: rule.conflictGroup,
      baseline: rule.isBaseline,
      reviewStatus: rule.reviewStatus,
      current: ruleIsCurrent(rule, asOfDate),
      evidenceGrade: rule.evidenceGrade,
      recommendationClass: humanizeIdentifier(rule.recommendationClass),
      effectiveFrom: rule.effectiveFrom,
      effectiveTo: rule.effectiveTo,
      service: {
        slug: rule.service.slug,
        name: rule.service.name,
        category: rule.service.category,
        description: rule.service.description,
      },
      eligibility: summarizeExpression(rule.appliesWhenJson),
      schedule: summarizeSchedule(rule.scheduleJson),
      methods: rule.service.methods
        .filter((method) => allowed.has(method.id) || allowed.has(method.slug))
        .map((method) => ({
          slug: method.slug,
          name: method.name,
          description: method.description,
          interval:
            intervals.get(method.id)?.interval ?? intervals.get(method.slug)?.interval ?? null,
        })),
      limitations: readStringArray(rule.limitationsJson),
    };
  });
  const latestSync = stored?.syncLogs[0];
  const latestCache = stored?.cacheEntries[0];
  const revision = stored?.contentHash ?? latestCache?.contentHash ?? registered.contentHash;

  return {
    metadata: getPublicSourceMetadata(registered),
    freshness: sourceFreshnessState(registered, asOfDate),
    revision: revision === null || revision === undefined ? null : revision.slice(0, 12),
    services: uniqueServices(
      rules.map((rule) => ({
        slug: rule.service.slug,
        name: rule.service.name,
        category: rule.service.category,
      })),
    ),
    rules,
    externalAvailability: availability(latestSync?.status),
    latestCheckAt: latestSync?.finishedAt ?? latestSync?.startedAt ?? null,
    cache:
      latestCache === undefined
        ? null
        : {
            fetchedAt: latestCache.fetchedAt,
            expiresAt: latestCache.expiresAt,
            lastSuccessfulAt: latestCache.lastSuccessfulAt,
            fresh: latestCache.expiresAt > new Date(),
          },
    changes: (stored?.syncLogs ?? []).map((log) => ({
      id: log.id,
      startedAt: log.startedAt,
      finishedAt: log.finishedAt,
      status: log.status,
      httpStatus: log.httpStatus,
      changed: log.changed,
      revision: log.contentHash?.slice(0, 12) ?? null,
    })),
  };
}

export async function loadServiceProvenance(serviceSlug: string, asOfDate = todayIso()) {
  await requireSession();
  const service = await prisma.serviceCatalog.findUnique({
    where: { slug: serviceSlug },
    include: {
      methods: { orderBy: [{ active: "desc" }, { name: "asc" }] },
      guidelineRules: {
        include: { source: true },
        orderBy: [
          { reviewStatus: "asc" },
          { isBaseline: "desc" },
          { stableKey: "asc" },
          { version: "desc" },
        ],
      },
    },
  });
  if (service === null) return null;

  const methodsByIdentifier = new Map(
    service.methods.flatMap((method) => [
      [method.id, method] as const,
      [method.slug, method] as const,
    ]),
  );
  const rules = service.guidelineRules.map((rule) => {
    const registered = getSourceBySlug(rule.source.slug);
    const intervals = new Map(
      methodIntervals(rule.scheduleJson).map((interval) => [interval.methodIdentifier, interval]),
    );
    const allowedMethods = readStringArray(rule.allowedMethodsJson);
    return {
      id: rule.id,
      stableKey: rule.stableKey,
      version: rule.version,
      variantId: rule.variantId,
      conflictGroup: rule.conflictGroup,
      baseline: rule.isBaseline,
      current: ruleIsCurrent(rule, asOfDate),
      reviewStatus: rule.reviewStatus,
      recommendationClass: humanizeIdentifier(rule.recommendationClass),
      evidenceGrade: rule.evidenceGrade,
      effectiveFrom: rule.effectiveFrom,
      effectiveTo: rule.effectiveTo,
      consumerSummary: rule.consumerSummary,
      eligibility: summarizeExpression(rule.appliesWhenJson),
      exclusions:
        rule.excludesWhenJson === null ? null : summarizeExpression(rule.excludesWhenJson),
      schedule: summarizeSchedule(rule.scheduleJson),
      methods: allowedMethods.flatMap((allowedIdentifier) => {
        const method = methodsByIdentifier.get(allowedIdentifier);
        if (method === undefined) return [];
        return [
          {
            slug: method.slug,
            name: method.name,
            interval:
              intervals.get(method.id)?.interval ?? intervals.get(method.slug)?.interval ?? null,
          },
        ];
      }),
      source:
        registered === null
          ? null
          : {
              metadata: getPublicSourceMetadata(registered),
              freshness: sourceFreshnessState(registered, asOfDate),
            },
    };
  });

  return {
    asOfDate,
    service: {
      id: service.id,
      slug: service.slug,
      name: service.name,
      shortName: service.shortName,
      description: service.description,
      category: service.category,
      bodySystem: service.bodySystem,
      active: service.active,
    },
    methods: service.methods.map((method) => ({
      slug: method.slug,
      name: method.name,
      description: method.description,
      active: method.active,
    })),
    currentRules: rules.filter((rule) => rule.current),
    inactiveRules: rules.filter((rule) => !rule.current),
  };
}

export async function loadSourceChanges() {
  await requireSession();
  const logs = await prisma.sourceSyncLog.findMany({
    select: {
      id: true,
      startedAt: true,
      finishedAt: true,
      status: true,
      httpStatus: true,
      changed: true,
      contentHash: true,
      source: { select: { slug: true, organization: true, title: true } },
    },
    orderBy: { startedAt: "desc" },
    take: 100,
  });
  return logs.map((log) => ({
    id: log.id,
    startedAt: log.startedAt,
    finishedAt: log.finishedAt,
    status: log.status,
    httpStatus: log.httpStatus,
    changed: log.changed,
    revision: log.contentHash?.slice(0, 12) ?? null,
    source: log.source,
  }));
}
