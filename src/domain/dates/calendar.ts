import type { DateRange } from "@/contracts/shared";
import type { Duration } from "@/contracts/rules";

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const ISO_MONTH_PATTERN = /^(\d{4})-(\d{2})$/;
const ISO_YEAR_PATTERN = /^(\d{4})$/;

type CalendarDate = {
  year: number;
  month: number;
  day: number;
};

export function daysInMonth(year: number, month: number): number {
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new RangeError("A valid calendar year and month are required.");
  }

  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

export function parseIsoDate(value: string): CalendarDate {
  const match = ISO_DATE_PATTERN.exec(value);
  if (match === null) {
    throw new RangeError(`Invalid ISO date: ${value}`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    throw new RangeError(`Invalid ISO date: ${value}`);
  }

  return { year, month, day };
}

export function formatIsoDate(date: CalendarDate): string {
  const { year, month, day } = date;
  if (day < 1 || day > daysInMonth(year, month)) {
    throw new RangeError("Invalid calendar date.");
  }

  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function toEpochDay(value: string): number {
  const { year, month, day } = parseIsoDate(value);
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

function fromEpochDay(value: number): string {
  const date = new Date(value * 86_400_000);
  return formatIsoDate({
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  });
}

export function compareIsoDates(left: string, right: string): number {
  parseIsoDate(left);
  parseIsoDate(right);
  return left < right ? -1 : left > right ? 1 : 0;
}

export function differenceInCalendarDays(later: string, earlier: string): number {
  return toEpochDay(later) - toEpochDay(earlier);
}

export function addCalendarDays(value: string, days: number): string {
  if (!Number.isInteger(days)) {
    throw new RangeError("Calendar day offsets must be whole numbers.");
  }
  return fromEpochDay(toEpochDay(value) + days);
}

/**
 * Adds calendar months while retaining end-of-month meaning. For example,
 * January 31 plus one month is February 28 (or 29), and February 28, 2025
 * plus one month is March 31.
 */
export function addCalendarMonths(value: string, months: number): string {
  if (!Number.isInteger(months)) {
    throw new RangeError("Calendar month offsets must be whole numbers.");
  }

  const source = parseIsoDate(value);
  const absoluteMonth = source.year * 12 + source.month - 1 + months;
  const targetYear = Math.floor(absoluteMonth / 12);
  const targetMonth = (((absoluteMonth % 12) + 12) % 12) + 1;
  const sourceIsMonthEnd = source.day === daysInMonth(source.year, source.month);
  const targetDay = sourceIsMonthEnd
    ? daysInMonth(targetYear, targetMonth)
    : Math.min(source.day, daysInMonth(targetYear, targetMonth));

  return formatIsoDate({ year: targetYear, month: targetMonth, day: targetDay });
}

export function addCalendarYears(value: string, years: number): string {
  if (!Number.isInteger(years)) {
    throw new RangeError("Calendar year offsets must be whole numbers.");
  }

  const source = parseIsoDate(value);
  const targetYear = source.year + years;
  const targetDay = Math.min(source.day, daysInMonth(targetYear, source.month));
  return formatIsoDate({ year: targetYear, month: source.month, day: targetDay });
}

export function addDuration(value: string, duration: Duration): string {
  if (!Number.isInteger(duration.value) || duration.value <= 0) {
    throw new RangeError("Durations must use a positive whole-number value.");
  }

  switch (duration.unit) {
    case "days":
      return addCalendarDays(value, duration.value);
    case "weeks":
      return addCalendarDays(value, duration.value * 7);
    case "months":
      return addCalendarMonths(value, duration.value);
    case "years":
      return addCalendarYears(value, duration.value);
  }
}

export function normalizeDateRange(
  value: string | null,
  precision: DateRange["precision"],
): DateRange {
  if (precision === "unknown") {
    if (value !== null && value.trim() !== "") {
      throw new RangeError("Unknown dates cannot include a value.");
    }
    return { start: null, end: null, precision };
  }

  if (value === null) {
    throw new RangeError("A value is required for a known date.");
  }

  if (precision === "day") {
    parseIsoDate(value);
    return { start: value, end: value, precision };
  }

  if (precision === "month") {
    const match = ISO_MONTH_PATTERN.exec(value);
    if (match === null) {
      throw new RangeError("Month precision requires YYYY-MM.");
    }
    const year = Number(match[1]);
    const month = Number(match[2]);
    const endDay = daysInMonth(year, month);
    return {
      start: formatIsoDate({ year, month, day: 1 }),
      end: formatIsoDate({ year, month, day: endDay }),
      precision,
    };
  }

  const match = ISO_YEAR_PATTERN.exec(value);
  if (match === null) {
    throw new RangeError("Year precision requires YYYY.");
  }
  const year = Number(match[1]);
  return {
    start: formatIsoDate({ year, month: 1, day: 1 }),
    end: formatIsoDate({ year, month: 12, day: 31 }),
    precision,
  };
}

export function addDurationToRange(range: DateRange, duration: Duration): DateRange {
  if (range.start === null || range.end === null) {
    return { start: null, end: null, precision: "unknown" };
  }

  return {
    start: addDuration(range.start, duration),
    end: addDuration(range.end, duration),
    precision: range.precision,
  };
}

export function exactDateRange(value: string): DateRange {
  parseIsoDate(value);
  return { start: value, end: value, precision: "day" };
}

export function boundedDateRange(
  start: string,
  end: string,
  precision: DateRange["precision"],
): DateRange {
  parseIsoDate(start);
  parseIsoDate(end);
  if (start > end || precision === "unknown") {
    throw new RangeError("A bounded range requires ordered, known dates.");
  }
  return { start, end, precision };
}

export function yearOf(value: string): number {
  return parseIsoDate(value).year;
}

export function monthOf(value: string): number {
  return parseIsoDate(value).month;
}

export function startOfMonth(value: string): string {
  const { year, month } = parseIsoDate(value);
  return formatIsoDate({ year, month, day: 1 });
}

export function endOfMonth(value: string): string {
  const { year, month } = parseIsoDate(value);
  return formatIsoDate({ year, month, day: daysInMonth(year, month) });
}

export function startOfYear(value: string): string {
  return `${String(yearOf(value)).padStart(4, "0")}-01-01`;
}

export function endOfYear(value: string): string {
  return `${String(yearOf(value)).padStart(4, "0")}-12-31`;
}
