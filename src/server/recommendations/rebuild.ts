import { guidelineRuleDefinitionSchema, type RecommendationClass } from "@/contracts";
import { dateInTimeZone } from "@/domain/dates";
import {
  evaluateCarePlan,
  type CarePlanEvaluationInput,
  type EvaluationRule,
} from "@/domain/rules";
import {
  Prisma,
  type RecommendationClass as StoredRecommendationClass,
  type RecommendationStatus,
} from "@/generated/prisma/client";
import { AuthorizationError, NotFoundError } from "@/domain/shared/errors";
import { canEditProfile, type ProfileAuthorizationContext } from "@/server/authorization/policy";
import type { DatabaseClient } from "@/server/db";
import { prisma } from "@/server/db/client";
import { createRecommendationRepository } from "@/server/repositories";
import type { SnapshotSyncResult } from "@/server/repositories/recommendation";

export const REBUILD_REASONS = [
  "profile_created",
  "profile_edited",
  "anatomy_changed",
  "risk_changed",
  "condition_changed",
  "family_history_changed",
  "surgery_changed",
  "medication_class_changed",
  "care_event_created",
  "care_event_edited",
  "care_event_deleted",
  "guideline_variant_selected",
  "clinician_override_changed",
  "rule_version_activated",
  "manual_rebuild",
  "daily_maintenance",
] as const;

export type RecommendationRebuildReason = (typeof REBUILD_REASONS)[number];

export const RECOMMENDATION_CHANGE_TYPES = [
  "newly_applicable",
  "no_longer_applicable",
  "status_changed",
  "due_range_changed",
  "source_variant_changed",
  "rule_version_changed",
  "clinician_override_activated",
  "clinician_override_removed",
  "history_uncertainty_resolved",
] as const;

export type RecommendationChangeType = (typeof RECOMMENDATION_CHANGE_TYPES)[number];

export type ComparableRecommendation = {
  id: string;
  stableKey: string;
  serviceId: string;
  ruleVersion: number;
  variantId: string;
  conflictGroup: string | null;
  status: RecommendationStatus;
  dueStart: string | null;
  dueEnd: string | null;
  activeOverrideId: string | null;
};

export type RecommendationChange = {
  type: RecommendationChangeType;
  previousId: string | null;
  nextId: string | null;
  serviceId: string;
};

export type RebuildProfileRecommendationsInput = {
  profileId: string;
  actorUserId: string | null;
  asOfDate?: string;
  reason: RecommendationRebuildReason;
  dryRun?: boolean;
};

export type RebuildResult = SnapshotSyncResult & {
  profileId: string;
  asOfDate: string;
  reason: RecommendationRebuildReason;
  persisted: boolean;
  changes: RecommendationChange[];
  changedRecommendationIds: string[];
};

const SENSITIVE_ACTIVITY_SERVICE_SLUGS = new Set([
  "alcohol-use-review",
  "anxiety-screening",
  "chlamydia-gonorrhea-screening",
  "depression-screening",
  "hiv-screening",
  "intimate-partner-safety",
  "sexual-health-review",
  "syphilis-screening",
  "tobacco-use-review",
]);

function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function nullableIsoDate(value: Date | null): string | null {
  return value === null ? null : isoDate(value);
}

export function explicitMedicationClassCodes(value: Prisma.JsonValue | null): string[] {
  return jsonArray(value).filter((entry): entry is string => typeof entry === "string");
}

function change(
  type: RecommendationChangeType,
  previous: ComparableRecommendation | null,
  next: ComparableRecommendation | null,
): RecommendationChange {
  return {
    type,
    previousId: previous?.id ?? null,
    nextId: next?.id ?? null,
    serviceId: next?.serviceId ?? previous?.serviceId ?? "",
  };
}

function classifyPair(
  previous: ComparableRecommendation,
  next: ComparableRecommendation,
): RecommendationChange[] {
  const changes: RecommendationChange[] = [];
  if (previous.ruleVersion !== next.ruleVersion) {
    changes.push(change("rule_version_changed", previous, next));
  }
  if (previous.variantId !== next.variantId) {
    changes.push(change("source_variant_changed", previous, next));
  }
  if (previous.status !== next.status) {
    changes.push(change("status_changed", previous, next));
  }
  if (previous.dueStart !== next.dueStart || previous.dueEnd !== next.dueEnd) {
    changes.push(change("due_range_changed", previous, next));
  }
  if (previous.activeOverrideId === null && next.activeOverrideId !== null) {
    changes.push(change("clinician_override_activated", previous, next));
  }
  if (previous.activeOverrideId !== null && next.activeOverrideId === null) {
    changes.push(change("clinician_override_removed", previous, next));
  }
  if (
    (previous.status === "unknown_history" || previous.status === "needs_date_confirmation") &&
    next.status !== "unknown_history" &&
    next.status !== "needs_date_confirmation"
  ) {
    changes.push(change("history_uncertainty_resolved", previous, next));
  }
  return changes;
}

/**
 * Compare the visible plan by stable rule identity. Variant swaps use the
 * conflict group and service as their secondary identity so they remain one
 * explainable change rather than an unrelated removal and addition.
 */
export function classifyRecommendationChanges(
  previous: readonly ComparableRecommendation[],
  next: readonly ComparableRecommendation[],
): RecommendationChange[] {
  const remainingPrevious = new Map(previous.map((item) => [item.stableKey, item]));
  const remainingNext = new Map(next.map((item) => [item.stableKey, item]));
  const changes: RecommendationChange[] = [];

  for (const [stableKey, nextItem] of remainingNext) {
    const previousItem = remainingPrevious.get(stableKey);
    if (previousItem === undefined) continue;
    changes.push(...classifyPair(previousItem, nextItem));
    remainingPrevious.delete(stableKey);
    remainingNext.delete(stableKey);
  }

  for (const [nextKey, nextItem] of [...remainingNext]) {
    if (nextItem.conflictGroup === null) continue;
    const replacement = [...remainingPrevious.entries()].find(
      ([, previousItem]) =>
        previousItem.serviceId === nextItem.serviceId &&
        previousItem.conflictGroup === nextItem.conflictGroup,
    );
    if (replacement === undefined) continue;
    const [previousKey, previousItem] = replacement;
    changes.push(change("source_variant_changed", previousItem, nextItem));
    changes.push(
      ...classifyPair(previousItem, nextItem).filter(
        ({ type }) => type !== "source_variant_changed",
      ),
    );
    remainingPrevious.delete(previousKey);
    remainingNext.delete(nextKey);
  }

  for (const previousItem of remainingPrevious.values()) {
    changes.push(change("no_longer_applicable", previousItem, null));
  }
  for (const nextItem of remainingNext.values()) {
    changes.push(change("newly_applicable", null, nextItem));
  }
  return changes;
}

export function recommendationChangeCounts(
  changes: readonly RecommendationChange[],
): Record<RecommendationChangeType, number> {
  return Object.fromEntries(
    RECOMMENDATION_CHANGE_TYPES.map((type) => [
      type,
      changes.filter((item) => item.type === type).length,
    ]),
  ) as Record<RecommendationChangeType, number>;
}

function recommendationClassFromDatabase(value: StoredRecommendationClass): RecommendationClass {
  switch (value) {
    case "shared_decision":
      return "shared-decision";
    case "insufficient_evidence":
      return "insufficient-evidence";
    case "not_recommended":
      return "not-recommended";
    case "custom_maintenance":
      return "custom-maintenance";
    default:
      return value;
  }
}

function recommendationClassToDatabase(value: RecommendationClass): StoredRecommendationClass {
  switch (value) {
    case "shared-decision":
      return "shared_decision";
    case "insufficient-evidence":
      return "insufficient_evidence";
    case "not-recommended":
      return "not_recommended";
    case "custom-maintenance":
      return "custom_maintenance";
    default:
      return value;
  }
}

function jsonArray(value: Prisma.JsonValue | null): Prisma.JsonArray {
  return Array.isArray(value) ? value : [];
}

function runtimeRule(
  row: Awaited<ReturnType<typeof loadEvaluationRows>>["rules"][number],
): EvaluationRule {
  const definition = guidelineRuleDefinitionSchema.parse({
    stableKey: row.stableKey,
    version: row.version,
    serviceSlug: row.service.slug,
    variantId: row.variantId,
    conflictGroup: row.conflictGroup,
    baseline: row.isBaseline,
    sourceSlug: row.source.slug,
    jurisdiction: row.jurisdiction,
    evidenceGrade: row.evidenceGrade,
    recommendationClass: recommendationClassFromDatabase(row.recommendationClass),
    appliesWhen: row.appliesWhenJson,
    excludesWhen: row.excludesWhenJson,
    stopWhen: row.stopWhenJson,
    schedule: row.scheduleJson,
    completionEventTypes: jsonArray(row.completionEventTypesJson),
    allowedMethods: row.allowedMethodsJson === null ? null : jsonArray(row.allowedMethodsJson),
    outcomeModifiers: row.outcomeModifiersJson === null ? [] : jsonArray(row.outcomeModifiersJson),
    consumerSummary: row.consumerSummary,
    whyItMatters: row.whyItMatters,
    questionsForClinician: jsonArray(row.questionsForClinicianJson),
    limitations: jsonArray(row.limitationsJson),
    effectiveFrom: isoDate(row.effectiveFrom),
    effectiveTo: nullableIsoDate(row.effectiveTo),
    reviewStatus: row.reviewStatus,
    reviewedBy: row.reviewedBy,
    reviewedAt: isoDate(row.reviewedAt),
    scenarioIds: [`${row.stableKey}-reviewed`],
  });

  return {
    ...definition,
    id: row.id,
    serviceId: row.serviceId,
    serviceName: row.service.name,
    category: row.service.category,
    categoryOrder: row.service.sortOrder,
    serviceSortOrder: row.service.sortOrder,
    sourceId: row.sourceId,
    sourceOrganization: row.source.organization,
  };
}

async function loadEvaluationRows(database: DatabaseClient, profileId: string, asOf: Date) {
  const profile = await database.profile.findFirst({
    where: { id: profileId, deletedAt: null },
    include: {
      anatomy: true,
      riskFactors: { where: { deletedAt: null } },
      conditions: { where: { deletedAt: null } },
      familyHistory: { where: { deletedAt: null } },
      surgeries: { where: { deletedAt: null } },
      medications: { where: { deletedAt: null } },
      careEvents: {
        where: { deletedAt: null },
        include: { service: { select: { eventType: true } } },
      },
      clinicianOverrides: { where: { active: true, pausedAt: null } },
      guidelineSelections: true,
      serviceHistoryStates: true,
    },
  });
  if (profile === null) throw new Error(`Profile ${profileId} was not found.`);

  const rules = await database.guidelineRule.findMany({
    where: {
      jurisdiction: profile.countryCode,
      reviewStatus: "active",
      effectiveFrom: { lte: asOf },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: asOf } }],
      service: { active: true },
      source: { active: true },
    },
    include: { service: true, source: true },
    orderBy: [{ stableKey: "asc" }, { version: "desc" }],
  });

  return { profile, rules };
}

export async function buildCarePlanEvaluationInput(
  database: DatabaseClient,
  profileId: string,
  asOfDate: string,
): Promise<CarePlanEvaluationInput> {
  const rows = await loadEvaluationRows(database, profileId, new Date(`${asOfDate}T00:00:00.000Z`));
  const { profile } = rows;

  return {
    profile: {
      id: profile.id,
      householdId: profile.householdId,
      ownerUserId: profile.ownerUserId,
      displayName: profile.displayName,
      relationshipLabel: profile.relationshipLabel,
      dateOfBirth: isoDate(profile.dateOfBirth),
      sexAssignedAtBirth: profile.sexAssignedAtBirth,
      genderIdentity: profile.genderIdentity,
      countryCode: profile.countryCode,
      timezone: profile.timezone,
      visibility: profile.visibility,
      carePlanMode: profile.carePlanMode,
    },
    anatomy: profile.anatomy.map((entry) => ({
      key: entry.anatomyKey,
      state: entry.state,
      effectiveDate: nullableIsoDate(entry.effectiveDate),
    })),
    riskFactors: profile.riskFactors.map((entry) => ({
      id: entry.id,
      type: entry.type,
      value: entry.valueJson,
      startedAt: nullableIsoDate(entry.startedAt),
      endedAt: nullableIsoDate(entry.endedAt),
    })),
    conditions: profile.conditions.map((entry) => ({ code: entry.code, status: entry.status })),
    familyHistory: profile.familyHistory.map((entry) => ({
      conditionCode: entry.conditionCode,
      relationship: entry.relationship,
      ageAtDiagnosis: entry.ageAtDiagnosis,
    })),
    surgeries: profile.surgeries.map((entry) => ({
      code: entry.code,
      performedStart: nullableIsoDate(entry.performedStart),
      performedEnd: nullableIsoDate(entry.performedEnd),
    })),
    medications: profile.medications.map((entry) => ({
      id: entry.id,
      classCodes: explicitMedicationClassCodes(entry.classCodesJson),
      status: entry.status,
    })),
    careEvents: profile.careEvents.map((entry) => ({
      id: entry.id,
      profileId: entry.profileId,
      serviceId: entry.serviceId,
      eventType: entry.service.eventType,
      methodId: entry.methodId,
      performedStart: nullableIsoDate(entry.performedStart),
      performedEnd: nullableIsoDate(entry.performedEnd),
      datePrecision: entry.datePrecision,
      result: entry.result,
    })),
    clinicianOverrides: profile.clinicianOverrides.map((entry) => ({
      id: entry.id,
      profileId: entry.profileId,
      serviceId: entry.serviceId,
      methodId: entry.methodId,
      overrideType: entry.overrideType,
      nextDueStart: nullableIsoDate(entry.nextDueStart),
      nextDueEnd: nullableIsoDate(entry.nextDueEnd),
      interval:
        entry.intervalJson !== null &&
        typeof entry.intervalJson === "object" &&
        !Array.isArray(entry.intervalJson)
          ? (entry.intervalJson as { unit: "days" | "weeks" | "months" | "years"; value: number })
          : null,
      replacesGeneralGuideline: entry.replacesGeneralGuideline,
      instructionReceivedDate: isoDate(entry.instructionReceivedDate),
      reviewDate: nullableIsoDate(entry.reviewDate),
      active: entry.active,
    })),
    selectedVariants: profile.guidelineSelections.map((entry) => ({
      conflictGroup: entry.conflictGroup,
      variantId: entry.variantId,
    })),
    guidelineRules: rows.rules.map(runtimeRule),
    asOfDate,
    historyAssertions: profile.serviceHistoryStates.map((entry) => ({
      serviceId: entry.serviceId,
      assertion: entry.state,
      recordedOn: isoDate(entry.recordedAt),
    })),
  };
}

async function authorizedRebuildProfile(
  database: DatabaseClient,
  profileId: string,
  actorUserId: string | null,
) {
  if (actorUserId === null) {
    const profile = await database.profile.findFirst({
      where: { id: profileId, deletedAt: null },
    });
    if (profile === null) throw new NotFoundError();
    return profile;
  }
  const profile = await database.profile.findFirst({
    where: { id: profileId, deletedAt: null },
    include: {
      household: {
        select: { members: { where: { userId: actorUserId, removedAt: null }, take: 1 } },
      },
      accessGrants: {
        where: { userId: actorUserId },
        take: 1,
        select: { permission: true },
      },
    },
  });
  if (profile === null) throw new NotFoundError();

  const membership = profile.household.members[0] ?? null;
  const grant = profile.accessGrants[0] ?? null;
  const context: ProfileAuthorizationContext = {
    userId: actorUserId,
    profile: {
      ownerUserId: profile.ownerUserId,
      createdByUserId: profile.createdByUserId,
      visibility: profile.visibility,
      claimedAt: profile.claimedAt,
      deletedAt: profile.deletedAt,
    },
    membership:
      membership === null ? null : { role: membership.role, removedAt: membership.removedAt },
    grant,
  };
  if (!canEditProfile(context)) throw new NotFoundError();
  return profile;
}

function toComparableCurrent(
  row: Awaited<ReturnType<typeof loadCurrentRecommendations>>[number],
): ComparableRecommendation {
  return {
    id: row.id,
    stableKey: row.rule.stableKey,
    serviceId: row.serviceId,
    ruleVersion: row.ruleVersion,
    variantId: row.variantId,
    conflictGroup: row.conflictGroup,
    status: row.status,
    dueStart: nullableIsoDate(row.dueStart),
    dueEnd: nullableIsoDate(row.dueEnd),
    activeOverrideId: row.activeOverrideId,
  };
}

function loadCurrentRecommendations(database: DatabaseClient, profileId: string) {
  return database.recommendationInstance.findMany({
    where: { profileId, retiredAt: null },
    include: { rule: { select: { stableKey: true } } },
    orderBy: [{ ruleId: "asc" }, { id: "asc" }],
  });
}

async function rebuildProfileRecommendationsWithDatabase(
  options: RebuildProfileRecommendationsInput,
  database: DatabaseClient,
): Promise<RebuildResult> {
  if (
    options.actorUserId === null &&
    options.reason !== "daily_maintenance" &&
    options.reason !== "rule_version_activated" &&
    options.reason !== "manual_rebuild"
  ) {
    throw new AuthorizationError("Interactive recommendation rebuilds require an actor.");
  }
  const profile = await authorizedRebuildProfile(database, options.profileId, options.actorUserId);
  const asOfDate = options.asOfDate ?? dateInTimeZone(new Date(), profile.timezone);
  const input = await buildCarePlanEvaluationInput(database, options.profileId, asOfDate);
  const [evaluated, currentRows] = await Promise.all([
    Promise.resolve(evaluateCarePlan(input)),
    loadCurrentRecommendations(database, options.profileId),
  ]);
  const snapshots = evaluated.map((recommendation) => ({
    profileId: options.profileId,
    serviceId: recommendation.serviceId,
    ruleId: recommendation.ruleId,
    ruleVersion: recommendation.ruleVersion,
    variantId: recommendation.variantId,
    conflictGroup: recommendation.conflictGroup,
    status: recommendation.status,
    recommendationClass: recommendationClassToDatabase(recommendation.recommendationClass),
    dueStart:
      recommendation.dueRange === null
        ? null
        : new Date(`${recommendation.dueRange.start}T00:00:00.000Z`),
    dueEnd:
      recommendation.dueRange === null
        ? null
        : new Date(`${recommendation.dueRange.end}T00:00:00.000Z`),
    lastQualifyingEventId: recommendation.lastQualifyingEventId,
    activeOverrideId: recommendation.activeOverrideId,
    explanationJson: {
      tokens: recommendation.explanationTokens,
      limitations: recommendation.limitations,
      generalGuidelineDueRange: recommendation.generalGuidelineDueRange,
      personalDueRange: recommendation.personalDueRange,
      calculationTrace: recommendation.calculationTrace,
    } as Prisma.InputJsonObject,
    matchingFactsJson: recommendation.matchingFacts as Prisma.InputJsonArray,
    calculationHash: recommendation.calculationHash,
    evaluatedAsOf: new Date(`${recommendation.evaluatedAsOf}T00:00:00.000Z`),
  }));

  const previous = currentRows.map(toComparableCurrent);
  const next: ComparableRecommendation[] = evaluated.map((recommendation) => ({
    id: `pending:${recommendation.ruleId}`,
    stableKey: recommendation.stableKey,
    serviceId: recommendation.serviceId,
    ruleVersion: recommendation.ruleVersion,
    variantId: recommendation.variantId,
    conflictGroup: recommendation.conflictGroup,
    status: recommendation.status,
    dueStart: recommendation.dueRange?.start ?? null,
    dueEnd: recommendation.dueRange?.end ?? null,
    activeOverrideId: recommendation.activeOverrideId,
  }));
  const changes = classifyRecommendationChanges(previous, next);
  if (options.dryRun === true) {
    return {
      profileId: options.profileId,
      asOfDate,
      reason: options.reason,
      persisted: false,
      changes,
      changedRecommendationIds: [],
      createdIds: [],
      unchangedIds: [],
      retiredIds: [],
    };
  }

  const synchronized = await createRecommendationRepository(database).synchronizeActiveSnapshots(
    options.profileId,
    snapshots,
    new Date(),
  );
  const changedRecommendationIds = [...synchronized.createdIds, ...synchronized.retiredIds];
  if (changes.length > 0) {
    const metadata = {
      reason: options.reason,
      changedRecommendationCount: changedRecommendationIds.length,
      changeCounts: recommendationChangeCounts(changes),
    };
    await database.auditLog.create({
      data: {
        householdId: profile.householdId,
        profileId: profile.id,
        actorUserId: options.actorUserId,
        action: "recommendations.rebuilt",
        entityType: "Profile",
        entityId: profile.id,
        metadataJson: metadata,
      },
    });

    if (options.reason === "rule_version_activated") {
      await database.auditLog.create({
        data: {
          householdId: profile.householdId,
          profileId: profile.id,
          actorUserId: options.actorUserId,
          action: "guideline_rule.updated",
          entityType: "Profile",
          entityId: profile.id,
          metadataJson: { changed: true },
        },
      });
    }

    const changedServiceIds = [...new Set(changes.map((item) => item.serviceId))];
    const changedServices = await database.serviceCatalog.findMany({
      where: { id: { in: changedServiceIds } },
      select: { slug: true },
    });
    const hasShareableChange = changedServices.some(
      ({ slug }) => !SENSITIVE_ACTIVITY_SERVICE_SLUGS.has(slug),
    );
    if (profile.visibility !== "owner_only" && hasShareableChange) {
      if (options.reason !== "rule_version_activated") {
        await database.auditLog.create({
          data: {
            householdId: profile.householdId,
            profileId: profile.id,
            actorUserId: options.actorUserId,
            action: "care_plan.changed",
            entityType: "Profile",
            entityId: profile.id,
            metadataJson: { changed: true },
          },
        });
      }
    }
  }

  return {
    ...synchronized,
    profileId: options.profileId,
    asOfDate,
    reason: options.reason,
    persisted: true,
    changes,
    changedRecommendationIds,
  };
}

export async function rebuildProfileRecommendations(
  options: RebuildProfileRecommendationsInput,
  database: DatabaseClient = prisma,
): Promise<RebuildResult> {
  return rebuildProfileRecommendationsWithDatabase(options, database);
}

/**
 * Compatibility wrapper for existing transaction workflows. New callers
 * should provide actor and reason so the rebuild remains authorized and
 * explainable.
 */
export async function rebuildRecommendations(
  database: DatabaseClient,
  profileId: string,
  requestedAsOfDate?: string,
  context: {
    actorUserId: string | null;
    reason: RecommendationRebuildReason;
  } = { actorUserId: null, reason: "manual_rebuild" },
): Promise<RebuildResult> {
  return rebuildProfileRecommendationsWithDatabase(
    {
      profileId,
      actorUserId: context.actorUserId,
      reason: context.reason,
      ...(requestedAsOfDate === undefined ? {} : { asOfDate: requestedAsOfDate }),
    },
    database,
  );
}
