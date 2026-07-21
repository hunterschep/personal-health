const formatterCache = new Map<string, Intl.DateTimeFormat>();

function dateFormatter(timezone: string): Intl.DateTimeFormat {
  const cached = formatterCache.get(timezone);
  if (cached !== undefined) return cached;

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  formatterCache.set(timezone, formatter);
  return formatter;
}

export function isValidTimezone(timezone: string): boolean {
  try {
    dateFormatter(timezone).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function formatInTimeZone(date: Date, timezone: string): string {
  const parts = dateFormatter(timezone).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  if (year === undefined || month === undefined || day === undefined) {
    throw new RangeError(`Could not format a date in timezone ${timezone}.`);
  }
  return `${year}-${month}-${day}`;
}
