import { addCalendarYears, compareIsoDates, parseIsoDate } from "./calendar";

/**
 * Feb. 29 birthdays use Feb. 28 as the anniversary in non-leap years. This
 * matches calendar-year addition used elsewhere by the engine.
 */
export function ageOnDate(dateOfBirth: string, asOfDate: string): number {
  parseIsoDate(dateOfBirth);
  parseIsoDate(asOfDate);
  if (compareIsoDates(dateOfBirth, asOfDate) > 0) {
    throw new RangeError("Date of birth cannot be after the evaluation date.");
  }

  const birthYear = parseIsoDate(dateOfBirth).year;
  const asOfYear = parseIsoDate(asOfDate).year;
  let age = asOfYear - birthYear;
  if (compareIsoDates(asOfDate, addCalendarYears(dateOfBirth, age)) < 0) {
    age -= 1;
  }
  return age;
}

export function dateAtAge(dateOfBirth: string, age: number): string {
  if (!Number.isInteger(age) || age < 0 || age > 130) {
    throw new RangeError("Age must be a whole number from 0 through 130.");
  }
  return addCalendarYears(dateOfBirth, age);
}
