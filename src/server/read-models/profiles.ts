import { ageOnDate, dateAtAge, dateInTimeZone } from "@/domain/dates";
import { cache } from "react";
import type { RecommendationStatus } from "@/contracts";
import { requireSession } from "@/server/auth/session";
import { resolveActiveProfileFromList } from "@/server/authorization/active-profile";
import {
  profileCapabilities,
  type ProfileAuthorizationContext,
} from "@/server/authorization/policy";
import { requireProfilePageAccess } from "@/server/authorization/profile-page";
import { accessibleProfileWhere } from "@/server/authorization/profile-query";
import { prisma } from "@/server/db/client";
import { ageBoundaries } from "./transparency-format";

const attentionStatuses: RecommendationStatus[] = ["overdue", "due_now", "needs_date_confirmation"];
const thisYearStatuses: RecommendationStatus[] = ["due_soon", "due_this_year"];
const knownHistoryStates = new Set([
  "never_completed",
  "completed_exact",
  "completed_month",
  "completed_year",
  "completed_date_unknown",
]);

export function displayDateRange(start: Date | null, end: Date | null): string {
  if (start === null || end === null) return "Timing depends on history or a conversation";
  const format = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
  if (start.getTime() === end.getTime()) return format.format(start);
  return `${format.format(start)} – ${format.format(end)}`;
}

function firstExplanation(value: unknown): string {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return "See the calculation details and source limitations.";
  }
  const tokens = (value as { tokens?: unknown }).tokens;
  if (!Array.isArray(tokens)) return "See the calculation details and source limitations.";
  const token = tokens.find(
    (entry): entry is { label: string } =>
      entry !== null &&
      typeof entry === "object" &&
      "label" in entry &&
      typeof entry.label === "string",
  );
  return token?.label ?? "See the calculation details and source limitations.";
}

export const listAccessibleProfiles = cache(async function listAccessibleProfiles() {
  const session = await requireSession();
  const records = await prisma.profile.findMany({
    where: {
      ...accessibleProfileWhere(session.user.id),
    },
    include: {
      recommendations: {
        where: { retiredAt: null },
        include: { service: true },
        orderBy: [{ dueStart: "asc" }, { service: { sortOrder: "asc" } }],
      },
      household: {
        include: {
          members: {
            where: { userId: session.user.id, removedAt: null },
            take: 1,
          },
        },
      },
      accessGrants: {
        where: { userId: session.user.id },
        take: 1,
      },
    },
    orderBy: [{ createdAt: "asc" }, { displayName: "asc" }],
  });
  const profiles = records.map((profile) => {
    const membership = profile.household.members[0] ?? null;
    const grant = profile.accessGrants[0] ?? null;
    const context: ProfileAuthorizationContext = {
      userId: session.user.id,
      profile: {
        ownerUserId: profile.ownerUserId,
        createdByUserId: profile.createdByUserId,
        visibility: profile.visibility,
        claimedAt: profile.claimedAt,
        deletedAt: profile.deletedAt,
      },
      membership:
        membership === null ? null : { role: membership.role, removedAt: membership.removedAt },
      grant: grant === null ? null : { permission: grant.permission },
    };
    return { ...profile, capabilities: profileCapabilities(context) };
  });
  const activeProfile = await resolveActiveProfileFromList(profiles);
  return { session, profiles, activeProfile };
});

export async function loadProfileCarePlan(profileId: string) {
  const { profile, capabilities, session } = await requireProfilePageAccess(profileId, "view");
  const loadedAt = new Date();
  const [recommendations, historyStates] = await Promise.all([
    prisma.recommendationInstance.findMany({
      where: { profileId: profile.id, retiredAt: null },
      include: {
        service: true,
        rule: { include: { source: true } },
        lastQualifyingEvent: true,
        activeOverride: true,
        plannedActions: { where: { status: { in: ["planned", "scheduled"] } } },
        reminders: {
          where: { status: "pending" },
          orderBy: { remindAt: "asc" },
          take: 1,
        },
      },
      orderBy: [{ dueStart: "asc" }, { service: { sortOrder: "asc" } }, { id: "asc" }],
    }),
    prisma.profileServiceHistoryState.findMany({
      where: { profileId: profile.id },
      select: { serviceId: true, state: true, reason: true },
    }),
  ]);
  const historyByService = new Map(historyStates.map((state) => [state.serviceId, state]));
  const asOfDate = dateInTimeZone(loadedAt, profile.timezone);
  return {
    profile,
    capabilities,
    viewerUserId: session.user.id,
    nextAgeMilestone: findNextAgeMilestone(
      profile.dateOfBirth.toISOString().slice(0, 10),
      asOfDate,
      recommendations.map((recommendation) => ({
        service: recommendation.service.name,
        appliesWhen: recommendation.rule.appliesWhenJson,
      })),
    ),
    recommendations: recommendations.map((recommendation) => ({
      id: recommendation.id,
      serviceId: recommendation.serviceId,
      serviceSlug: recommendation.service.slug,
      service: recommendation.service.name,
      category: recommendation.service.category.replaceAll("_", " "),
      categoryKey: recommendation.service.category,
      status: recommendation.status,
      dueStart: recommendation.dueStart,
      dueEnd: recommendation.dueEnd,
      timing: displayDateRange(recommendation.dueStart, recommendation.dueEnd),
      reason: firstExplanation(recommendation.explanationJson),
      history:
        recommendation.lastQualifyingEvent === null
          ? "No qualifying history recorded"
          : `Last recorded ${displayDateRange(
              recommendation.lastQualifyingEvent.performedStart,
              recommendation.lastQualifyingEvent.performedEnd,
            )}`,
      source: `${recommendation.rule.source.organization} · rule v${recommendation.ruleVersion}`,
      sourceUrl: recommendation.rule.source.canonicalUrl,
      sourceOrganization: recommendation.rule.source.organization,
      recommendationClass: recommendation.recommendationClass.replaceAll("_", "-"),
      planned: recommendation.plannedActions.length > 0,
      clinicianOverride: recommendation.activeOverride !== null,
      knownHistory:
        recommendation.lastQualifyingEvent !== null ||
        knownHistoryStates.has(historyByService.get(recommendation.serviceId)?.state ?? ""),
      personalResponse:
        historyByService.get(recommendation.serviceId)?.state === "declined" ||
        historyByService.get(recommendation.serviceId)?.state === "not_applicable_claim"
          ? historyByService.get(recommendation.serviceId)?.state
          : null,
      personalResponseReason: historyByService.get(recommendation.serviceId)?.reason ?? null,
      reminder:
        recommendation.reminders[0] === undefined
          ? null
          : {
              id: recommendation.reminders[0].id,
              snoozedUntil:
                recommendation.reminders[0].snoozedUntil !== null &&
                recommendation.reminders[0].snoozedUntil > loadedAt
                  ? recommendation.reminders[0].snoozedUntil
                  : null,
            },
    })),
  };
}

export type AgeMilestone = { age: number; date: string; service: string };

export function findNextAgeMilestone(
  dateOfBirth: string,
  asOfDate: string,
  recommendations: readonly { service: string; appliesWhen: unknown }[],
): AgeMilestone | null {
  const currentAge = ageOnDate(dateOfBirth, asOfDate);
  const milestones = recommendations.flatMap(({ service, appliesWhen }) => {
    const boundaries = ageBoundaries(appliesWhen);
    const ages = [
      boundaries.minimum !== null && boundaries.minimum > currentAge ? boundaries.minimum : null,
      boundaries.maximum !== null && boundaries.maximum >= currentAge
        ? boundaries.maximum + 1
        : null,
    ].filter((age): age is number => age !== null);
    return ages.map((age) => ({ age, date: dateAtAge(dateOfBirth, age), service }));
  });
  return (
    milestones
      .filter(({ date }) => date > asOfDate)
      .sort(
        (left, right) =>
          left.date.localeCompare(right.date) || left.service.localeCompare(right.service),
      )[0] ?? null
  );
}

export async function loadProfileRecords(profileId: string) {
  const { profile, capabilities } = await requireProfilePageAccess(profileId, "view");
  const [records, clinicianManaged] = await Promise.all([
    prisma.careEvent.findMany({
      where: { profileId: profile.id, deletedAt: null },
      include: { service: true, method: true, documentLinks: { select: { id: true } } },
      orderBy: [{ performedEnd: "desc" }, { createdAt: "desc" }],
    }),
    prisma.recommendationInstance.findMany({
      where: { profileId: profile.id, retiredAt: null, status: "clinician_managed" },
      select: { serviceId: true },
    }),
  ]);
  const clinicianManagedServiceIds = new Set(clinicianManaged.map(({ serviceId }) => serviceId));
  return {
    profile,
    capabilities,
    records: records.map((record) => ({
      ...record,
      clinicianManaged: clinicianManagedServiceIds.has(record.serviceId),
    })),
  };
}

export function profileSummary(
  profile: Awaited<ReturnType<typeof listAccessibleProfiles>>["profiles"][number],
) {
  const recommendations = profile.recommendations;
  const counts = summarizeCarePlanRecommendations(recommendations);
  const next =
    recommendations.find(({ status }) => attentionStatuses.includes(status)) ??
    recommendations.find(
      ({ status }) =>
        status === "due_soon" || status === "due_this_year" || status === "unknown_history",
    ) ??
    recommendations[0] ??
    null;
  return {
    ...counts,
    next,
    age: ageOnDate(
      profile.dateOfBirth.toISOString().slice(0, 10),
      dateInTimeZone(new Date(), profile.timezone),
    ),
  };
}

export function summarizeCarePlanRecommendations(
  recommendations: readonly {
    status: RecommendationStatus;
    recommendationClass: string;
  }[],
) {
  const attention = recommendations.filter(({ status }) =>
    attentionStatuses.includes(status),
  ).length;
  const thisYear = recommendations.filter(({ status }) => thisYearStatuses.includes(status)).length;
  const unknown = recommendations.filter(({ status }) => status === "unknown_history").length;
  const discussion = recommendations.filter(({ status }) =>
    ["discuss_with_clinician", "clinician_managed", "not_routinely_recommended"].includes(status),
  ).length;
  const denominatorItems = recommendations.filter(
    ({ status, recommendationClass }) =>
      recommendationClass === "routine" &&
      status !== "future" &&
      status !== "unknown_history" &&
      status !== "not_applicable" &&
      status !== "not_routinely_recommended" &&
      status !== "discuss_with_clinician" &&
      status !== "clinician_managed",
  );
  const current = denominatorItems.filter(
    ({ status }) => status === "up_to_date" || status === "completed_once",
  ).length;
  return {
    attention,
    thisYear,
    unknown,
    discussion,
    current,
    denominator: denominatorItems.length,
  };
}

export const profileAttentionStatuses = attentionStatuses;
