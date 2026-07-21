import { localDateTimeParts, localDateTimeToInstant } from "@/server/reminders/timezone";

const localWallTimePattern = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/;

export function parseLocalWallTime(value: string, timezone: string): Date {
  const match = localWallTimePattern.exec(value);
  if (match === null) {
    throw new RangeError("Enter a valid local date and time.");
  }
  const [, date, hour, minute] = match;
  if (date === undefined || hour === undefined || minute === undefined) {
    throw new RangeError("Enter a valid local date and time.");
  }

  return localDateTimeToInstant(date, Number(hour), Number(minute), timezone);
}

export function formatLocalWallTime(instant: Date, timezone: string): string {
  const parts = localDateTimeParts(instant, timezone);
  return `${String(parts.year).padStart(4, "0")}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}T${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`;
}

export function localYearMonth(instant: Date, timezone: string): { year: number; month: number } {
  const parts = localDateTimeParts(instant, timezone);
  return { year: parts.year, month: parts.month - 1 };
}

export function assertAppointmentRange(start: Date | null, end: Date | null): void {
  if ((start === null) !== (end === null)) {
    throw new RangeError("Appointment start and end must be provided together.");
  }
  if (start !== null && end !== null && start.getTime() >= end.getTime()) {
    throw new RangeError("Appointment end must be after its start.");
  }
}
