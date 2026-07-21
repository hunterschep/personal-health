import type {
  CustomMaintenance,
  PlannedAction,
  RecommendationInstance,
  Reminder,
} from "@/generated/prisma/client";

import type { CalendarEvent } from "./ics";
import { nextDay, plannedMonthRange } from "./ics";

function sequence(value: Date): number {
  return Math.floor(value.getTime() / 1_000) % 2_147_483_647;
}

function appUrl(baseUrl: string | undefined, path: string): string | null {
  return baseUrl === undefined ? null : new URL(path, baseUrl).toString();
}

export function plannedActionCalendarEvent(
  action: Pick<
    PlannedAction,
    | "id"
    | "profileId"
    | "plannedMonth"
    | "appointmentStart"
    | "appointmentEnd"
    | "timezone"
    | "location"
    | "updatedAt"
  >,
  baseUrl?: string,
): CalendarEvent | null {
  const common = {
    uid: `planned-action-${action.id}@carecadence.local`,
    sequence: sequence(action.updatedAt),
    title: action.appointmentStart === null ? "Care planning reminder" : "Health appointment",
    description: "Review this personal care planning item in CareCadence.",
    location: action.location,
    url: appUrl(baseUrl, `/app/profile/${action.profileId}/calendar`),
  };
  if (action.appointmentStart !== null) {
    return {
      ...common,
      start: { kind: "instant", value: action.appointmentStart, timezone: action.timezone },
      end:
        action.appointmentEnd === null
          ? null
          : { kind: "instant", value: action.appointmentEnd, timezone: action.timezone },
    };
  }
  if (action.plannedMonth !== null) {
    const range = plannedMonthRange(action.plannedMonth);
    return {
      ...common,
      start: { kind: "date", value: range.start },
      end: { kind: "date", value: range.end },
    };
  }
  return null;
}

export function recommendationCalendarEvent(
  recommendation: Pick<
    RecommendationInstance,
    "id" | "profileId" | "dueStart" | "dueEnd" | "updatedAt"
  >,
  baseUrl?: string,
): CalendarEvent | null {
  if (recommendation.dueStart === null) return null;
  const dueStart = recommendation.dueStart.toISOString().slice(0, 10);
  const dueEnd = recommendation.dueEnd ?? recommendation.dueStart;
  return {
    uid: `recommendation-${recommendation.id}@carecadence.local`,
    sequence: sequence(recommendation.updatedAt),
    title: "Care plan timing",
    description:
      "Review this preventive care planning item in CareCadence. Medical timing can change after new history or clinician guidance.",
    start: { kind: "date", value: dueStart },
    end: { kind: "date", value: nextDay(dueEnd) },
    location: null,
    url: appUrl(baseUrl, `/app/profile/${recommendation.profileId}/care-plan/${recommendation.id}`),
  };
}

export function reminderCalendarEvent(
  reminder: Pick<Reminder, "id" | "profileId" | "remindAt" | "updatedAt">,
  timezone: string,
  baseUrl?: string,
): CalendarEvent {
  return {
    uid: `reminder-${reminder.id}@carecadence.local`,
    sequence: sequence(reminder.updatedAt),
    title: "Care reminder",
    description: "Review this personal care reminder in CareCadence.",
    start: { kind: "instant", value: reminder.remindAt, timezone },
    end: null,
    location: null,
    url: appUrl(baseUrl, "/app/reminders"),
  };
}

export function customMaintenanceCalendarEvent(
  item: Pick<CustomMaintenance, "id" | "profileId" | "nextDate" | "updatedAt">,
  baseUrl?: string,
): CalendarEvent | null {
  if (item.nextDate === null) return null;
  return {
    uid: `custom-maintenance-${item.id}@carecadence.local`,
    sequence: sequence(item.updatedAt),
    title: "Personal care cadence",
    description: "Review this chosen personal care cadence in CareCadence.",
    start: { kind: "date", value: item.nextDate.toISOString().slice(0, 10) },
    end: { kind: "date", value: nextDay(item.nextDate) },
    location: null,
    url: appUrl(baseUrl, `/app/profile/${item.profileId}/maintenance`),
  };
}
