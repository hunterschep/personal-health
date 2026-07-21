import { requireProfilePageAccess } from "@/server/authorization/profile-page";
import { prisma } from "@/server/db/client";
import { getPublicSourceMetadata, getSourceBySlug } from "@/server/sources/registry";
import { sourceFreshnessState } from "@/server/sources/verification";
import {
  humanizeIdentifier,
  methodIntervals,
  readExplanationTokens,
  readStoredCalculation,
  readStringArray,
  ruleIsCurrent,
  summarizeExpression,
  summarizeSchedule,
} from "./transparency-format";

function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function dateInTimeZone(value: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone,
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((entry) => entry.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export async function loadRecommendationDetail(
  profileId: string,
  recommendationId: string,
  requestedAsOfDate?: string,
) {
  const { profile, capabilities } = await requireProfilePageAccess(profileId, "view");
  const loadedAt = new Date();
  const asOfDate = requestedAsOfDate ?? dateInTimeZone(loadedAt, profile.timezone);
  const recommendation = await prisma.recommendationInstance.findFirst({
    where: { id: recommendationId, profileId: profile.id, retiredAt: null },
    include: {
      service: { include: { methods: { where: { active: true }, orderBy: { name: "asc" } } } },
      rule: {
        include: {
          source: {
            include: {
              syncLogs: {
                select: {
                  id: true,
                  changed: true,
                  status: true,
                  finishedAt: true,
                  startedAt: true,
                },
                orderBy: { startedAt: "desc" },
                take: 10,
              },
            },
          },
        },
      },
      lastQualifyingEvent: { include: { method: true } },
      activeOverride: {
        include: {
          method: true,
          documentLinks: {
            where: { document: { deletedAt: null } },
            include: { document: true },
          },
        },
      },
      plannedActions: {
        where: { status: { in: ["planned", "scheduled"] } },
        include: {
          reminders: {
            where: { status: "pending" },
            orderBy: { remindAt: "asc" },
          },
        },
        orderBy: [{ appointmentStart: "asc" }, { plannedMonth: "asc" }, { createdAt: "asc" }],
      },
      reminders: {
        where: { status: "pending" },
        orderBy: { remindAt: "asc" },
      },
    },
  });
  if (recommendation === null) return null;

  const [relatedEvents, variants, selection, retiredSnapshots, historyState, pausedOverride] =
    await Promise.all([
      prisma.careEvent.findMany({
        where: { profileId: profile.id, serviceId: recommendation.serviceId, deletedAt: null },
        include: {
          method: true,
          documentLinks: { select: { id: true } },
        },
        orderBy: [{ performedEnd: "desc" }, { createdAt: "desc" }],
      }),
      prisma.guidelineRule.findMany({
        where: { serviceId: recommendation.serviceId },
        include: { source: true },
        orderBy: [
          { reviewStatus: "asc" },
          { isBaseline: "desc" },
          { stableKey: "asc" },
          { version: "desc" },
        ],
      }),
      recommendation.conflictGroup === null
        ? Promise.resolve(null)
        : prisma.profileGuidelineSelection.findUnique({
            where: {
              profileId_conflictGroup: {
                profileId: profile.id,
                conflictGroup: recommendation.conflictGroup,
              },
            },
          }),
      prisma.recommendationInstance.findMany({
        where: {
          profileId: profile.id,
          serviceId: recommendation.serviceId,
          retiredAt: { not: null },
        },
        include: { rule: { include: { source: true } } },
        orderBy: { retiredAt: "desc" },
        take: 12,
      }),
      prisma.profileServiceHistoryState.findUnique({
        where: {
          profileId_serviceId: {
            profileId: profile.id,
            serviceId: recommendation.serviceId,
          },
        },
        select: { state: true, reason: true, recordedAt: true },
      }),
      prisma.clinicianOverride.findFirst({
        where: {
          profileId: profile.id,
          serviceId: recommendation.serviceId,
          active: true,
          pausedAt: { not: null },
        },
        include: {
          method: true,
          documentLinks: {
            where: { document: { deletedAt: null } },
            include: { document: true },
          },
        },
        orderBy: { pausedAt: "desc" },
      }),
    ]);

  const calculation = readStoredCalculation(recommendation.explanationJson);
  const intervals = new Map(
    methodIntervals(recommendation.rule.scheduleJson).map((interval) => [
      interval.methodIdentifier,
      interval,
    ]),
  );
  const allowedMethods = new Set(readStringArray(recommendation.rule.allowedMethodsJson));
  const registeredSource = getSourceBySlug(recommendation.rule.source.slug);
  const source =
    registeredSource === null
      ? null
      : {
          metadata: getPublicSourceMetadata(registeredSource),
          freshness: sourceFreshnessState(registeredSource, asOfDate),
        };
  const pendingReminders = [
    ...recommendation.reminders,
    ...recommendation.plannedActions.flatMap((action) => action.reminders),
  ];
  const uniquePendingReminders = [
    ...new Map(pendingReminders.map((reminder) => [reminder.id, reminder])).values(),
  ].sort((left, right) => left.remindAt.getTime() - right.remindAt.getTime());

  return {
    capabilities,
    profile: {
      id: profile.id,
      displayName: profile.displayName,
      timezone: profile.timezone,
      carePlanMode: profile.carePlanMode,
    },
    recommendation: {
      id: recommendation.id,
      status: recommendation.status,
      recommendationClass: recommendation.recommendationClass,
      dueStart: recommendation.dueStart,
      dueEnd: recommendation.dueEnd,
      variantId: recommendation.variantId,
      conflictGroup: recommendation.conflictGroup,
      ruleVersion: recommendation.ruleVersion,
      evaluatedAsOf: recommendation.evaluatedAsOf,
      createdAt: recommendation.createdAt,
      service: {
        id: recommendation.service.id,
        slug: recommendation.service.slug,
        name: recommendation.service.name,
        shortName: recommendation.service.shortName,
        category: recommendation.service.category,
        description: recommendation.service.description,
        bodySystem: recommendation.service.bodySystem,
      },
    },
    rule: {
      stableKey: recommendation.rule.stableKey,
      version: recommendation.rule.version,
      evidenceGrade: recommendation.rule.evidenceGrade,
      recommendationClass: humanizeIdentifier(recommendation.rule.recommendationClass),
      consumerSummary: recommendation.rule.consumerSummary,
      whyItMatters: recommendation.rule.whyItMatters,
      eligibility: summarizeExpression(recommendation.rule.appliesWhenJson),
      exclusions:
        recommendation.rule.excludesWhenJson === null
          ? null
          : summarizeExpression(recommendation.rule.excludesWhenJson),
      stopBehavior:
        recommendation.rule.stopWhenJson === null
          ? null
          : summarizeExpression(recommendation.rule.stopWhenJson),
      schedule: summarizeSchedule(recommendation.rule.scheduleJson),
      effectiveFrom: recommendation.rule.effectiveFrom,
      effectiveTo: recommendation.rule.effectiveTo,
      reviewedAt: recommendation.rule.reviewedAt,
      questions: readStringArray(recommendation.rule.questionsForClinicianJson),
      limitations:
        calculation.limitations.length > 0
          ? calculation.limitations
          : readStringArray(recommendation.rule.limitationsJson),
    },
    source,
    matchingFacts: readExplanationTokens(recommendation.matchingFactsJson),
    calculation,
    methods: recommendation.service.methods
      .filter((method) => allowedMethods.has(method.id) || allowedMethods.has(method.slug))
      .map((method) => ({
        id: method.id,
        slug: method.slug,
        name: method.name,
        description: method.description,
        interval:
          intervals.get(method.id)?.interval ?? intervals.get(method.slug)?.interval ?? null,
        qualifyingResults:
          intervals.get(method.id)?.qualifyingResults ??
          intervals.get(method.slug)?.qualifyingResults ??
          [],
      })),
    history: relatedEvents.map((event) => ({
      id: event.id,
      performedStart: event.performedStart,
      performedEnd: event.performedEnd,
      datePrecision: event.datePrecision,
      result: event.result,
      source: event.source,
      method: event.method?.name ?? null,
      providerName: event.providerName,
      documentCount: event.documentLinks.length,
      qualifying: event.id === recommendation.lastQualifyingEventId,
    })),
    personalPlan: {
      response:
        historyState?.state === "declined" || historyState?.state === "not_applicable_claim"
          ? {
              state: historyState.state,
              reason: historyState.reason,
              recordedAt: historyState.recordedAt,
            }
          : null,
      pausedOverride:
        pausedOverride === null
          ? null
          : {
              id: pausedOverride.id,
              type: pausedOverride.overrideType,
              nextDueStart: pausedOverride.nextDueStart,
              nextDueEnd: pausedOverride.nextDueEnd,
              clinicianName: pausedOverride.clinicianName,
              practiceName: pausedOverride.practiceName,
              instructionReceivedDate: pausedOverride.instructionReceivedDate,
              reviewDate: pausedOverride.reviewDate,
              reason: pausedOverride.reason,
              method: pausedOverride.method?.name ?? null,
              documentCount: pausedOverride.documentLinks.length,
              documents: pausedOverride.documentLinks.map(({ document }) => ({
                id: document.id,
                filename: document.safeFilename,
                mimeType: document.mimeType,
              })),
              replacesGeneralGuideline: pausedOverride.replacesGeneralGuideline,
              pausedAt: pausedOverride.pausedAt as Date,
            },
      override:
        recommendation.activeOverride === null
          ? null
          : {
              id: recommendation.activeOverride.id,
              type: recommendation.activeOverride.overrideType,
              nextDueStart: recommendation.activeOverride.nextDueStart,
              nextDueEnd: recommendation.activeOverride.nextDueEnd,
              clinicianName: recommendation.activeOverride.clinicianName,
              practiceName: recommendation.activeOverride.practiceName,
              instructionReceivedDate: recommendation.activeOverride.instructionReceivedDate,
              reviewDate: recommendation.activeOverride.reviewDate,
              reason: recommendation.activeOverride.reason,
              method: recommendation.activeOverride.method?.name ?? null,
              documentCount: recommendation.activeOverride.documentLinks.length,
              documents: recommendation.activeOverride.documentLinks.map(({ document }) => ({
                id: document.id,
                filename: document.safeFilename,
                mimeType: document.mimeType,
              })),
              replacesGeneralGuideline: recommendation.activeOverride.replacesGeneralGuideline,
            },
      plannedActions: recommendation.plannedActions.map((action) => ({
        id: action.id,
        title: action.title,
        plannedMonth: action.plannedMonth,
        appointmentStart: action.appointmentStart,
        appointmentEnd: action.appointmentEnd,
        timezone: action.timezone,
        location: action.location,
        status: action.status,
      })),
      reminders: uniquePendingReminders.map((reminder) => ({
        id: reminder.id,
        remindAt: reminder.remindAt,
        channel: reminder.channel,
        snoozedUntil:
          reminder.snoozedUntil !== null && reminder.snoozedUntil > loadedAt
            ? reminder.snoozedUntil
            : null,
      })),
    },
    guidelineSelectionExplicit: selection !== null,
    variants: variants.map((variant) => {
      const registered = getSourceBySlug(variant.source.slug);
      return {
        id: variant.id,
        stableKey: variant.stableKey,
        version: variant.version,
        variantId: variant.variantId,
        conflictGroup: variant.conflictGroup,
        baseline: variant.isBaseline,
        selected:
          selection === null
            ? variant.variantId === recommendation.variantId
            : variant.variantId === selection.variantId,
        current: ruleIsCurrent(variant, asOfDate),
        reviewStatus: variant.reviewStatus,
        evidenceGrade: variant.evidenceGrade,
        recommendationClass: humanizeIdentifier(variant.recommendationClass),
        consumerSummary: variant.consumerSummary,
        eligibility: summarizeExpression(variant.appliesWhenJson),
        schedule: summarizeSchedule(variant.scheduleJson),
        effectiveFrom: variant.effectiveFrom,
        effectiveTo: variant.effectiveTo,
        source:
          registered === null
            ? null
            : {
                metadata: getPublicSourceMetadata(registered),
                freshness: sourceFreshnessState(registered, asOfDate),
              },
      };
    }),
    changeHistory: [
      ...retiredSnapshots.map((snapshot) => ({
        id: snapshot.id,
        kind: "calculation" as const,
        occurredAt: snapshot.retiredAt as Date,
        title: "Previous calculation retired",
        description: `${snapshot.rule.source.organization} · rule v${snapshot.ruleVersion} · ${humanizeIdentifier(snapshot.status)}`,
      })),
      ...recommendation.rule.source.syncLogs
        .filter((log) => log.changed)
        .map((log) => ({
          id: log.id,
          kind: "source" as const,
          occurredAt: log.finishedAt ?? log.startedAt,
          title: "Source revision detected",
          description:
            log.status === "success"
              ? "A source revision was stored for review. The active calculation remained on its reviewed rule version."
              : "A source check detected a revision without changing the reviewed calculation.",
        })),
      ...variants
        .filter((variant) => variant.stableKey === recommendation.rule.stableKey)
        .map((variant) => ({
          id: variant.id,
          kind: "rule" as const,
          occurredAt: variant.effectiveFrom,
          title: `Rule version ${variant.version} effective`,
          description: `${variant.source.organization} · ${isoDate(variant.effectiveFrom)}`,
        })),
    ].sort((left, right) => right.occurredAt.getTime() - left.occurredAt.getTime()),
  };
}
