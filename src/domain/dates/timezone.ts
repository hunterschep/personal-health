import { parseIsoDate } from "./calendar";

const formatterCache = new Map<string, Intl.DateTimeFormat>();

export function dateInTimeZone(instant: Date, timezone: string): string {
  if (Number.isNaN(instant.getTime())) {
    throw new RangeError("A valid instant is required.");
  }

  let formatter = formatterCache.get(timezone);
  if (formatter === undefined) {
    formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    formatterCache.set(timezone, formatter);
  }

  const parts = formatter.formatToParts(instant);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  if (year === undefined || month === undefined || day === undefined) {
    throw new RangeError(`Could not resolve a date in timezone ${timezone}.`);
  }

  const value = `${year}-${month}-${day}`;
  parseIsoDate(value);
  return value;
}
