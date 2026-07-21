type DateTimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

export type LocalDateTimeParts = DateTimeParts & { weekday: number };

function partsAt(instant: Date, timezone: string): DateTimeParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const read = (type: Intl.DateTimeFormatPartTypes): number => {
    const value = parts.find((part) => part.type === type)?.value;
    if (value === undefined) throw new RangeError(`Could not resolve ${timezone}.`);
    return Number(value);
  };
  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: read("hour"),
    minute: read("minute"),
  };
}

export function localDateTimeParts(instant: Date, timezone: string): LocalDateTimeParts {
  const parts = partsAt(instant, timezone);
  const weekdayName = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
  }).format(instant);
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekdayName);
  if (weekday < 0) throw new RangeError(`Could not resolve the weekday for ${timezone}.`);
  return { ...parts, weekday };
}

function epoch(parts: DateTimeParts): number {
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
}

export function localDateTimeToInstant(
  isoDate: string,
  hour: number,
  minute: number,
  timezone: string,
): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (
    match === null ||
    !Number.isInteger(hour) ||
    hour < 0 ||
    hour > 23 ||
    !Number.isInteger(minute) ||
    minute < 0 ||
    minute > 59
  ) {
    throw new RangeError("A valid local date and time is required.");
  }
  const desired: DateTimeParts = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour,
    minute,
  };
  let result = new Date(epoch(desired));
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const actual = partsAt(result, timezone);
    const adjustment = epoch(desired) - epoch(actual);
    if (adjustment === 0) return result;
    result = new Date(result.getTime() + adjustment);
  }
  const finalParts = partsAt(result, timezone);
  if (epoch(finalParts) !== epoch(desired)) {
    throw new RangeError("The selected local time does not exist in this timezone.");
  }
  return result;
}

export function localDateKey(instant: Date, timezone: string): string {
  const parts = partsAt(instant, timezone);
  return `${String(parts.year).padStart(4, "0")}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}
