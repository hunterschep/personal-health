import { addCalendarDays } from "@/domain/dates";

import { localDateTimeParts, localDateTimeToInstant } from "./timezone";

export type ReminderSchedulingPreferences = {
  quietDays: readonly number[];
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  timezone: string;
};

export function reminderSchedulingPreferences(
  preference:
    | {
        quietDaysJson?: unknown;
        quietHoursStart?: string | null;
        quietHoursEnd?: string | null;
        timezone?: string | null;
      }
    | null
    | undefined,
  fallbackTimezone: string,
): ReminderSchedulingPreferences {
  return {
    quietDays: Array.isArray(preference?.quietDaysJson)
      ? preference.quietDaysJson.filter(
          (value): value is number => typeof value === "number" && value >= 0 && value <= 6,
        )
      : [],
    quietHoursStart: preference?.quietHoursStart ?? null,
    quietHoursEnd: preference?.quietHoursEnd ?? null,
    timezone: preference?.timezone ?? fallbackTimezone,
  };
}

function parseTime(value: string): { hour: number; minute: number; total: number } {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (match === null) throw new RangeError("Quiet hours must use HH:mm.");
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) throw new RangeError("Quiet hours must use a valid time.");
  return { hour, minute, total: hour * 60 + minute };
}

function isoDate(parts: { year: number; month: number; day: number }): string {
  return `${String(parts.year).padStart(4, "0")}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

export function applyQuietTime(instant: Date, preferences: ReminderSchedulingPreferences): Date {
  let candidate = instant;
  const quietStart =
    preferences.quietHoursStart === null ? null : parseTime(preferences.quietHoursStart);
  const quietEnd = preferences.quietHoursEnd === null ? null : parseTime(preferences.quietHoursEnd);

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const local = localDateTimeParts(candidate, preferences.timezone);
    const date = isoDate(local);
    if (preferences.quietDays.includes(local.weekday)) {
      candidate = localDateTimeToInstant(
        addCalendarDays(date, 1),
        quietEnd?.hour ?? 9,
        quietEnd?.minute ?? 0,
        preferences.timezone,
      );
      continue;
    }
    if (quietStart === null || quietEnd === null || quietStart.total === quietEnd.total) {
      return candidate;
    }
    const current = local.hour * 60 + local.minute;
    const crossesMidnight = quietStart.total > quietEnd.total;
    const isQuiet = crossesMidnight
      ? current >= quietStart.total || current < quietEnd.total
      : current >= quietStart.total && current < quietEnd.total;
    if (!isQuiet) return candidate;
    const nextDate =
      crossesMidnight && current >= quietStart.total ? addCalendarDays(date, 1) : date;
    candidate = localDateTimeToInstant(
      nextDate,
      quietEnd.hour,
      quietEnd.minute,
      preferences.timezone,
    );
  }
  throw new RangeError("Quiet-day preferences do not leave an available reminder time.");
}
