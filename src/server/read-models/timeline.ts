import { statusLabels } from "@/contracts";
import { addCalendarYears, ageOnDate, dateAtAge } from "@/domain/dates";
import { requireProfilePageAccess } from "@/server/authorization/profile-page";
import {
  customMaintenanceVisibilityWhere,
  isProfileOwnerOrOrganizer,
} from "@/server/custom-maintenance";
import { prisma } from "@/server/db/client";
import { ageBoundaries, humanizeIdentifier, ruleIsCurrent } from "./transparency-format";

export type TimelineEntryKind =
  | "care_event"
  | "recommendation"
  | "planned_action"
  | "appointment"
  | "clinician_override"
  | "guideline_selection"
  | "rule_update"
  | "milestone"
  | "custom_maintenance"
  | "document"
  | "history";

export type TimelineEntry = {
  id: string;
  kind: TimelineEntryKind;
  title: string;
  description: string;
  sortDate: string;
  yearLabel: string;
  dateLabel: string;
  precision: "day" | "month" | "year" | "unknown";
  approximate: boolean;
  current: boolean;
  future: boolean;
  category: string | null;
  href: string | null;
};

export type TimelineFilters = {
  period?: string;
  type?: string;
  category?: string;
};

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

function displayExactDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

export function timelineDateLabels(
  start: string | null,
  end: string | null,
  precision: TimelineEntry["precision"],
): { yearLabel: string; dateLabel: string; approximate: boolean } {
  if (precision === "unknown" || start === null) {
    return { yearLabel: "Unknown", dateLabel: "Date unknown", approximate: true };
  }
  if (precision === "year") {
    return { yearLabel: start.slice(0, 4), dateLabel: "Year only", approximate: true };
  }
  if (precision === "month") {
    return {
      yearLabel: start.slice(0, 4),
      dateLabel: new Intl.DateTimeFormat("en-US", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      }).format(new Date(`${start}T00:00:00.000Z`)),
      approximate: true,
    };
  }
  return {
    yearLabel: start.slice(0, 4),
    dateLabel:
      end !== null && end !== start
        ? `${displayExactDate(start)} – ${displayExactDate(end)}`
        : displayExactDate(start),
    approximate: end !== null && end !== start,
  };
}

function entry(input: {
  id: string;
  kind: TimelineEntryKind;
  title: string;
  description: string;
  start: string | null;
  end?: string | null;
  sortDate?: string;
  precision?: TimelineEntry["precision"];
  current?: boolean;
  category?: string | null;
  href?: string | null;
  asOfDate: string;
}): TimelineEntry {
  const precision = input.precision ?? "day";
  const end = input.end ?? input.start;
  const labels = timelineDateLabels(input.start, end, precision);
  const sortDate = input.sortDate ?? input.start ?? input.asOfDate;
  return {
    id: input.id,
    kind: input.kind,
    title: input.title,
    description: input.description,
    sortDate,
    yearLabel: labels.yearLabel,
    dateLabel: labels.dateLabel,
    precision,
    approximate: labels.approximate,
    current: input.current ?? false,
    future: sortDate > input.asOfDate,
    category: input.category ?? null,
    href: input.href ?? null,
  };
}

export function customMaintenanceTimelineEntry(input: {
  id: string;
  profileId: string;
  title: string;
  category: string;
  source: "personal" | "clinician" | "app_template";
  nextDate: string;
  asOfDate: string;
}): TimelineEntry | null {
  if (input.nextDate <= input.asOfDate) return null;
  const sourceDescription =
    input.source === "clinician"
      ? "A clinician-defined personal cadence"
      : input.source === "personal"
        ? "A personally chosen cadence"
        : "An optional health-maintenance cadence";
  return entry({
    id: `custom-maintenance-${input.id}`,
    kind: "custom_maintenance",
    title: `${input.title} personal cadence`,
    description: `${sourceDescription} is scheduled for this date. It is not a guideline deadline and does not change medical timing.`,
    start: input.nextDate,
    category: input.category,
    href: `/app/profile/${input.profileId}/maintenance`,
    asOfDate: input.asOfDate,
  });
}

export function filterTimelineEntries(
  entries: readonly TimelineEntry[],
  filters: TimelineFilters,
  asOfDate: string,
): TimelineEntry[] {
  const period = filters.period ?? "all";
  const fiveYearsAgo = addCalendarYears(asOfDate, -5);
  const fiveYearsAhead = addCalendarYears(asOfDate, 5);
  return entries.filter((item) => {
    if (period === "past-five" && (item.sortDate < fiveYearsAgo || item.sortDate > asOfDate)) {
      return false;
    }
    if (period === "current" && !item.sortDate.startsWith(asOfDate.slice(0, 4))) return false;
    if (period === "future-five" && (item.sortDate < asOfDate || item.sortDate > fiveYearsAhead)) {
      return false;
    }
    if (filters.type !== undefined && filters.type !== "all" && item.kind !== filters.type) {
      return false;
    }
    if (
      filters.category !== undefined &&
      filters.category !== "all" &&
      item.category !== filters.category
    ) {
      return false;
    }
    return true;
  });
}

function dueTiming(start: Date | null, end: Date | null): string {
  if (start === null) return "Timing depends on history or a clinician discussion.";
  const first = isoDate(start);
  const last = end === null ? first : isoDate(end);
  return first === last
    ? `Timing: ${displayExactDate(first)}.`
    : `Timing window: ${displayExactDate(first)} – ${displayExactDate(last)}.`;
}

export async function loadProfileTimeline(profileId: string, requestedAsOfDate?: string) {
  const { session, profile } = await requireProfilePageAccess(profileId, "view");
  const asOfDate = requestedAsOfDate ?? dateInTimeZone(new Date(), profile.timezone);
  const canAccessOwnerOnly = isProfileOwnerOrOrganizer(profile, session.user.id);
  const [
    careEvents,
    recommendations,
    plannedActions,
    overrides,
    selections,
    documents,
    historyStates,
    audits,
    customMaintenance,
  ] = await Promise.all([
    prisma.careEvent.findMany({
      where: { profileId: profile.id, deletedAt: null },
      include: { service: true, method: true },
      orderBy: [{ performedStart: "asc" }, { createdAt: "asc" }],
    }),
    prisma.recommendationInstance.findMany({
      where: { profileId: profile.id },
      include: { service: true, rule: { include: { source: true } } },
      orderBy: [{ evaluatedAsOf: "asc" }, { createdAt: "asc" }],
    }),
    prisma.plannedAction.findMany({
      where: { profileId: profile.id, status: { not: "cancelled" } },
      include: { service: true },
      orderBy: [{ appointmentStart: "asc" }, { plannedMonth: "asc" }, { createdAt: "asc" }],
    }),
    prisma.clinicianOverride.findMany({
      where: { profileId: profile.id },
      include: { service: true, method: true },
      orderBy: { instructionReceivedDate: "asc" },
    }),
    prisma.profileGuidelineSelection.findMany({
      where: { profileId: profile.id },
      orderBy: { selectedAt: "asc" },
    }),
    prisma.document.findMany({
      where: { profileId: profile.id, deletedAt: null },
      orderBy: { createdAt: "asc" },
    }),
    prisma.profileServiceHistoryState.findMany({
      where: { profileId: profile.id },
      include: { service: true },
      orderBy: { recordedAt: "asc" },
    }),
    prisma.auditLog.findMany({
      where: {
        profileId: profile.id,
        action: { in: ["profile.created", "profile.claimed", "guideline_rule.updated"] },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.customMaintenance.findMany({
      where: {
        profileId: profile.id,
        status: "active",
        nextDate: { gt: new Date(`${asOfDate}T00:00:00.000Z`) },
        ...customMaintenanceVisibilityWhere(canAccessOwnerOnly),
      },
      select: {
        id: true,
        title: true,
        category: true,
        source: true,
        nextDate: true,
      },
      orderBy: [{ nextDate: "asc" }, { title: "asc" }],
    }),
  ]);

  const entries: TimelineEntry[] = [];
  for (const event of careEvents) {
    const start = event.performedStart === null ? null : isoDate(event.performedStart);
    const end = event.performedEnd === null ? null : isoDate(event.performedEnd);
    entries.push(
      entry({
        id: `care-event-${event.id}`,
        kind: "care_event",
        title: `${event.method?.name ?? event.service.name} recorded`,
        description:
          event.datePrecision === "unknown"
            ? `${humanizeIdentifier(event.result)} result · care timing remains unknown; positioned by when the record was added.`
            : `${humanizeIdentifier(event.result)} result · ${humanizeIdentifier(event.source).toLocaleLowerCase("en-US")}.`,
        start,
        end,
        sortDate: start ?? isoDate(event.createdAt),
        precision: event.datePrecision,
        category: event.service.category,
        href: `/app/profile/${profile.id}/records/${event.id}`,
        asOfDate,
      }),
    );
  }

  for (const recommendation of recommendations) {
    if (recommendation.retiredAt !== null) {
      const retiredOn = dateInTimeZone(recommendation.retiredAt, profile.timezone);
      entries.push(
        entry({
          id: `recommendation-retired-${recommendation.id}`,
          kind: "recommendation",
          title: `${recommendation.service.name} calculation updated`,
          description: `The prior ${statusLabels[recommendation.status].toLocaleLowerCase("en-US")} snapshot was preserved when the plan was recalculated.`,
          start: retiredOn,
          category: recommendation.service.category,
          href: null,
          asOfDate,
        }),
      );
      continue;
    }
    const dueStart = recommendation.dueStart === null ? null : isoDate(recommendation.dueStart);
    const displayOn = dueStart ?? isoDate(recommendation.evaluatedAsOf);
    entries.push(
      entry({
        id: `recommendation-current-${recommendation.id}`,
        kind: "recommendation",
        title: `${recommendation.service.name} · ${statusLabels[recommendation.status]}`,
        description: `${dueTiming(recommendation.dueStart, recommendation.dueEnd)} Source: ${recommendation.rule.source.organization}.`,
        start: displayOn,
        end: recommendation.dueEnd === null ? displayOn : isoDate(recommendation.dueEnd),
        current: true,
        category: recommendation.service.category,
        href: `/app/profile/${profile.id}/care-plan/${recommendation.id}`,
        asOfDate,
      }),
    );
  }

  for (const action of plannedActions) {
    const appointment = action.appointmentStart !== null;
    const actionDate =
      action.appointmentStart !== null
        ? dateInTimeZone(action.appointmentStart, action.timezone)
        : action.plannedMonth === null
          ? dateInTimeZone(action.createdAt, profile.timezone)
          : isoDate(action.plannedMonth);
    entries.push(
      entry({
        id: `planned-action-${action.id}`,
        kind: appointment ? "appointment" : "planned_action",
        title: appointment ? `${action.title} appointment` : `${action.title} planned`,
        description: appointment
          ? `${action.location ?? "Location not recorded"} · planning does not change the medical due window.`
          : `Planned for organization · ${humanizeIdentifier(action.status).toLocaleLowerCase("en-US")} · medical timing is unchanged.`,
        start: actionDate,
        precision: appointment ? "day" : action.plannedMonth === null ? "day" : "month",
        category: action.service.category,
        href: `/app/profile/${profile.id}/calendar`,
        asOfDate,
      }),
    );
  }

  for (const override of overrides) {
    entries.push(
      entry({
        id: `clinician-override-${override.id}`,
        kind: "clinician_override",
        title: `${override.service.name} clinician instruction recorded`,
        description: `${humanizeIdentifier(override.overrideType)}${override.method === null ? "" : ` · ${override.method.name}`} · general guidance remains visible.`,
        start: isoDate(override.instructionReceivedDate),
        category: override.service.category,
        href: null,
        asOfDate,
      }),
    );
    if (!override.active) {
      entries.push(
        entry({
          id: `clinician-override-ended-${override.id}`,
          kind: "clinician_override",
          title: `${override.service.name} clinician instruction ended`,
          description:
            "The personal instruction stopped controlling the plan; general reviewed guidance remains visible.",
          start: dateInTimeZone(override.updatedAt, profile.timezone),
          category: override.service.category,
          href: null,
          asOfDate,
        }),
      );
    }
  }

  const servicesByConflictGroup = new Map<string, (typeof recommendations)[number]["service"]>();
  for (const recommendation of recommendations.filter((item) => item.retiredAt === null)) {
    if (recommendation.conflictGroup !== null) {
      servicesByConflictGroup.set(recommendation.conflictGroup, recommendation.service);
    }
  }
  for (const selection of selections) {
    const service = servicesByConflictGroup.get(selection.conflictGroup);
    entries.push(
      entry({
        id: `guideline-selection-${selection.id}`,
        kind: "guideline_selection",
        title: "Guideline variant selected",
        description: `${humanizeIdentifier(selection.variantId)} for ${humanizeIdentifier(selection.conflictGroup).toLocaleLowerCase("en-US")}. Choosing a variant changes the organizer schedule, not clinical truth.`,
        start: dateInTimeZone(selection.selectedAt, profile.timezone),
        category: service?.category ?? null,
        href: service === undefined ? null : `/app/sources/services/${service.slug}`,
        asOfDate,
      }),
    );
  }

  for (const item of customMaintenance) {
    if (item.nextDate === null) continue;
    const milestone = customMaintenanceTimelineEntry({
      id: item.id,
      profileId: profile.id,
      title: item.title,
      category: item.category,
      source: item.source,
      nextDate: isoDate(item.nextDate),
      asOfDate,
    });
    if (milestone !== null) entries.push(milestone);
  }

  const currentRecommendations = recommendations.filter((item) => item.retiredAt === null);
  const seenRuleUpdates = new Set<string>();
  for (const recommendation of currentRecommendations) {
    const key = `${recommendation.rule.stableKey}:${recommendation.rule.version}`;
    if (seenRuleUpdates.has(key)) continue;
    seenRuleUpdates.add(key);
    entries.push(
      entry({
        id: `rule-update-${recommendation.rule.id}`,
        kind: "rule_update",
        title: `${recommendation.service.name} guidance version became effective`,
        description: `${recommendation.rule.source.organization} · rule version ${recommendation.rule.version}.`,
        start: isoDate(recommendation.rule.effectiveFrom),
        category: recommendation.service.category,
        href: `/app/sources/${recommendation.rule.source.slug}`,
        asOfDate,
      }),
    );
  }

  for (const document of documents) {
    entries.push(
      entry({
        id: `document-${document.id}`,
        kind: "document",
        title: "Private document added",
        description: `${document.safeFilename} · available only to people authorized for this profile.`,
        start: dateInTimeZone(document.createdAt, profile.timezone),
        href: `/api/documents/${document.id}`,
        asOfDate,
      }),
    );
  }

  for (const state of historyStates) {
    entries.push(
      entry({
        id: `history-state-${state.id}`,
        kind: "history",
        title: `${state.service.name} history clarified`,
        description: `${humanizeIdentifier(state.state)} was recorded so uncertainty remains explicit rather than guessed.`,
        start: dateInTimeZone(state.recordedAt, profile.timezone),
        category: state.service.category,
        href: `/app/profile/${profile.id}/records`,
        asOfDate,
      }),
    );
  }

  for (const audit of audits) {
    if (audit.action === "guideline_rule.updated") {
      entries.push(
        entry({
          id: `profile-audit-${audit.id}`,
          kind: "rule_update",
          title: "Synthetic guideline rule update recorded",
          description:
            "A demo-only maintenance event shows how a reviewed rule change appears without exposing profile details.",
          start: dateInTimeZone(audit.createdAt, profile.timezone),
          href: "/app/sources/changes",
          asOfDate,
        }),
      );
      continue;
    }
    entries.push(
      entry({
        id: `profile-audit-${audit.id}`,
        kind: "history",
        title:
          audit.action === "profile.claimed"
            ? "Profile privacy ownership claimed"
            : "Profile created",
        description:
          audit.action === "profile.claimed"
            ? "Adult ownership and sharing controls took effect."
            : "Private preventive-care organization began for this profile.",
        start: dateInTimeZone(audit.createdAt, profile.timezone),
        href: `/app/profile/${profile.id}/sharing`,
        asOfDate,
      }),
    );
  }

  const age = ageOnDate(isoDate(profile.dateOfBirth), asOfDate);
  const seenMilestones = new Set<string>();
  for (const recommendation of currentRecommendations) {
    if (!ruleIsCurrent(recommendation.rule, asOfDate)) continue;
    const boundaries = ageBoundaries(recommendation.rule.appliesWhenJson);
    const candidates = [
      boundaries.minimum !== null && boundaries.minimum > age
        ? {
            age: boundaries.minimum,
            title: `${recommendation.service.name} eligibility begins`,
            description: `The active reviewed rule begins at age ${boundaries.minimum}. It will be re-evaluated with the source version active then.`,
          }
        : null,
      boundaries.maximum !== null && boundaries.maximum >= age
        ? {
            age: boundaries.maximum + 1,
            title: `${recommendation.service.name} routine age range changes`,
            description: `The current routine age range runs through age ${boundaries.maximum}; guidance may then become selective, stop, or need a clinician discussion.`,
          }
        : null,
    ];
    for (const candidate of candidates) {
      if (candidate === null) continue;
      const milestoneDate = dateAtAge(isoDate(profile.dateOfBirth), candidate.age);
      const key = `${recommendation.serviceId}:${candidate.age}:${candidate.title}`;
      if (milestoneDate <= asOfDate || seenMilestones.has(key)) continue;
      seenMilestones.add(key);
      entries.push(
        entry({
          id: `milestone-${recommendation.id}-${candidate.age}`,
          kind: "milestone",
          title: candidate.title,
          description: candidate.description,
          start: milestoneDate,
          category: recommendation.service.category,
          href: `/app/profile/${profile.id}/care-plan/${recommendation.id}`,
          asOfDate,
        }),
      );
    }
  }

  for (const override of overrides) {
    if (override.reviewDate === null || isoDate(override.reviewDate) <= asOfDate) continue;
    entries.push(
      entry({
        id: `override-review-${override.id}`,
        kind: "milestone",
        title: `${override.service.name} personal plan review`,
        description:
          "Review the recorded clinician instruction without changing the general source-backed guidance.",
        start: isoDate(override.reviewDate),
        category: override.service.category,
        href: null,
        asOfDate,
      }),
    );
  }

  entries.sort((left, right) => {
    const dateDifference = left.sortDate.localeCompare(right.sortDate);
    return dateDifference === 0 ? left.title.localeCompare(right.title) : dateDifference;
  });
  const categories = [
    ...new Set(entries.flatMap((item) => (item.category === null ? [] : [item.category]))),
  ].sort();
  const futureMilestones = entries.filter(
    (item) => (item.kind === "milestone" || item.kind === "custom_maintenance") && item.future,
  );

  return {
    asOfDate,
    profile: {
      id: profile.id,
      displayName: profile.displayName,
      timezone: profile.timezone,
    },
    entries,
    categories,
    nextMilestone: futureMilestones[0] ?? null,
  };
}
