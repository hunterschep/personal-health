import type { AnatomyKey, AnatomyState } from "@/contracts";
import {
  addCalendarYears,
  ageOnDate,
  compareIsoDates,
  differenceInCalendarDays,
  parseIsoDate,
} from "@/domain/dates";
import type {
  CarePlanEvaluationInput,
  DerivedBmi,
  DerivedFacts,
  DerivedPackYears,
  NormalizedFamilyHistory,
  NormalizedRiskFactor,
} from "./types";

const FIRST_DEGREE_RELATIONSHIPS = new Set([
  "biological_child",
  "biological_parent",
  "biological_sibling",
  "brother",
  "child",
  "daughter",
  "father",
  "mother",
  "parent",
  "sibling",
  "sister",
  "son",
]);

type HeightWeightMeasurement = {
  riskFactorId: string | null;
  measuredOn: string;
  heightCentimeters: number | null;
  weightKilograms: number | null;
};

type SmokingPeriod = {
  started: string | null;
  ended: string | null;
  startedYear: number | null;
  endedYear: number | null;
  packsPerDay: number | null;
};

type TobaccoPayload = {
  status: "never" | "current" | "former" | "unknown" | "prefer_not_to_answer";
  periods: SmokingPeriod[];
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readHeightWeight(factor: NormalizedRiskFactor): HeightWeightMeasurement | null {
  if (!isObject(factor.value) || typeof factor.value.measuredOn !== "string") {
    return null;
  }

  try {
    parseIsoDate(factor.value.measuredOn);
  } catch {
    return null;
  }

  const heightCentimeters = finiteNumber(factor.value.heightCentimeters);
  const weightKilograms = finiteNumber(factor.value.weightKilograms);
  if (
    (heightCentimeters === null || heightCentimeters < 60 || heightCentimeters > 280) &&
    (weightKilograms === null || weightKilograms < 20 || weightKilograms > 600)
  ) {
    return null;
  }

  return {
    riskFactorId: factor.id ?? null,
    measuredOn: factor.value.measuredOn,
    heightCentimeters:
      heightCentimeters !== null && heightCentimeters >= 60 && heightCentimeters <= 280
        ? heightCentimeters
        : null,
    weightKilograms:
      weightKilograms !== null && weightKilograms >= 20 && weightKilograms <= 600
        ? weightKilograms
        : null,
  };
}

export function deriveBmi(riskFactors: NormalizedRiskFactor[]): DerivedBmi | null {
  const measurements = riskFactors
    .filter(
      (factor) =>
        factor.type === "height_weight" && factor.deletedAt == null && factor.endedAt == null,
    )
    .map(readHeightWeight)
    .filter((measurement): measurement is HeightWeightMeasurement => measurement !== null);

  const heights = measurements.filter(
    (measurement): measurement is HeightWeightMeasurement & { heightCentimeters: number } =>
      measurement.heightCentimeters !== null,
  );
  const weights = measurements.filter(
    (measurement): measurement is HeightWeightMeasurement & { weightKilograms: number } =>
      measurement.weightKilograms !== null,
  );

  const pairs = heights.flatMap((height) =>
    weights
      .map((weight) => ({
        height,
        weight,
        gap: Math.abs(differenceInCalendarDays(height.measuredOn, weight.measuredOn)),
        newest: height.measuredOn > weight.measuredOn ? height.measuredOn : weight.measuredOn,
      }))
      .filter((pair) => pair.gap <= 365),
  );

  pairs.sort((left, right) => {
    if (left.newest !== right.newest) {
      return left.newest > right.newest ? -1 : 1;
    }
    if (left.gap !== right.gap) {
      return left.gap - right.gap;
    }
    return (left.height.riskFactorId ?? "").localeCompare(right.height.riskFactorId ?? "");
  });

  const pair = pairs[0];
  if (pair === undefined) {
    return null;
  }

  const heightMeters = pair.height.heightCentimeters / 100;
  return {
    value: Math.round((pair.weight.weightKilograms / heightMeters ** 2) * 10) / 10,
    heightCentimeters: pair.height.heightCentimeters,
    weightKilograms: pair.weight.weightKilograms,
    heightMeasuredOn: pair.height.measuredOn,
    weightMeasuredOn: pair.weight.measuredOn,
    heightRiskFactorId: pair.height.riskFactorId,
    weightRiskFactorId: pair.weight.riskFactorId,
  };
}

function readTobaccoPayload(factor: NormalizedRiskFactor): TobaccoPayload | null {
  if (!isObject(factor.value) || !Array.isArray(factor.value.periods)) {
    return null;
  }

  const status = factor.value.status;
  if (
    status !== "never" &&
    status !== "current" &&
    status !== "former" &&
    status !== "unknown" &&
    status !== "prefer_not_to_answer"
  ) {
    return null;
  }

  const periods: SmokingPeriod[] = [];
  for (const period of factor.value.periods) {
    if (!isObject(period)) {
      continue;
    }
    periods.push({
      started: typeof period.started === "string" ? period.started : null,
      ended: typeof period.ended === "string" ? period.ended : null,
      startedYear: Number.isInteger(period.startedYear) ? Number(period.startedYear) : null,
      endedYear: Number.isInteger(period.endedYear) ? Number(period.endedYear) : null,
      packsPerDay: finiteNumber(period.packsPerDay),
    });
  }

  return { status, periods };
}

type DateBounds = { earliest: string; latest: string };

function boundsForDateOrYear(date: string | null, year: number | null): DateBounds | null {
  if (date !== null) {
    try {
      parseIsoDate(date);
      return { earliest: date, latest: date };
    } catch {
      return null;
    }
  }
  if (year === null || year < 1900 || year > 2200) {
    return null;
  }
  return { earliest: `${year}-01-01`, latest: `${year}-12-31` };
}

function decimalYearsBetween(start: string, end: string): number {
  if (compareIsoDates(end, start) <= 0) {
    return 0;
  }

  const startYear = parseIsoDate(start).year;
  const endYear = parseIsoDate(end).year;
  let wholeYears = endYear - startYear;
  let anniversary = addCalendarYears(start, wholeYears);
  if (compareIsoDates(anniversary, end) > 0) {
    wholeYears -= 1;
    anniversary = addCalendarYears(start, wholeYears);
  }
  const nextAnniversary = addCalendarYears(anniversary, 1);
  const fraction =
    differenceInCalendarDays(end, anniversary) /
    differenceInCalendarDays(nextAnniversary, anniversary);
  return wholeYears + fraction;
}

function roundDerived(value: number): number {
  return Math.round(value * 100) / 100;
}

export function derivePackYears(
  riskFactors: NormalizedRiskFactor[],
  asOfDate: string,
): DerivedPackYears {
  parseIsoDate(asOfDate);
  const tobaccoFactors = riskFactors
    .filter(
      (factor) =>
        factor.type === "tobacco_use" && factor.deletedAt == null && factor.endedAt == null,
    )
    .sort((left, right) => {
      if (left.startedAt !== right.startedAt) {
        return (right.startedAt ?? "").localeCompare(left.startedAt ?? "");
      }
      return (left.id ?? "").localeCompare(right.id ?? "");
    });
  const payload = tobaccoFactors.map(readTobaccoPayload).find((item) => item !== null) ?? null;

  if (
    payload === null ||
    payload.status === "unknown" ||
    payload.status === "prefer_not_to_answer"
  ) {
    return {
      minimum: null,
      maximum: null,
      uncertain: true,
      currentSmoker: null,
      yearsSinceQuitMinimum: null,
      yearsSinceQuitMaximum: null,
    };
  }

  if (payload.status === "never") {
    return {
      minimum: 0,
      maximum: 0,
      uncertain: false,
      currentSmoker: false,
      yearsSinceQuitMinimum: null,
      yearsSinceQuitMaximum: null,
    };
  }

  let minimum = 0;
  let maximum = 0;
  let uncertain = false;
  let usablePeriods = 0;
  let latestQuitBounds: DateBounds | null = null;

  for (const period of payload.periods) {
    const start = boundsForDateOrYear(period.started, period.startedYear);
    const end =
      period.ended !== null || period.endedYear !== null
        ? boundsForDateOrYear(period.ended, period.endedYear)
        : payload.status === "current"
          ? { earliest: asOfDate, latest: asOfDate }
          : null;

    if (start === null || end === null || period.packsPerDay === null || period.packsPerDay < 0) {
      uncertain = true;
      continue;
    }

    usablePeriods += 1;
    const minimumYears = decimalYearsBetween(start.latest, end.earliest);
    const maximumYears = decimalYearsBetween(start.earliest, end.latest);
    minimum += period.packsPerDay * minimumYears;
    maximum += period.packsPerDay * maximumYears;
    uncertain ||= start.earliest !== start.latest || end.earliest !== end.latest;

    if (payload.status === "former") {
      if (latestQuitBounds === null || end.latest > latestQuitBounds.latest) {
        latestQuitBounds = end;
      }
    }
  }

  if (usablePeriods === 0) {
    return {
      minimum: null,
      maximum: null,
      uncertain: true,
      currentSmoker: payload.status === "current",
      yearsSinceQuitMinimum: null,
      yearsSinceQuitMaximum: null,
    };
  }

  const yearsSinceQuitMinimum =
    latestQuitBounds === null ? null : decimalYearsBetween(latestQuitBounds.latest, asOfDate);
  const yearsSinceQuitMaximum =
    latestQuitBounds === null ? null : decimalYearsBetween(latestQuitBounds.earliest, asOfDate);

  return {
    minimum: roundDerived(minimum),
    maximum: roundDerived(maximum),
    uncertain,
    currentSmoker: payload.status === "current",
    yearsSinceQuitMinimum:
      yearsSinceQuitMinimum === null ? null : roundDerived(yearsSinceQuitMinimum),
    yearsSinceQuitMaximum:
      yearsSinceQuitMaximum === null ? null : roundDerived(yearsSinceQuitMaximum),
  };
}

export function normalizeRelationship(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

export function isFirstDegreeRelationship(value: string): boolean {
  return FIRST_DEGREE_RELATIONSHIPS.has(normalizeRelationship(value));
}

export function firstDegreeFamilyHistory(
  familyHistory: NormalizedFamilyHistory[],
  conditionCode?: string,
): NormalizedFamilyHistory[] {
  return familyHistory.filter(
    (history) =>
      history.deletedAt == null &&
      isFirstDegreeRelationship(history.relationship) &&
      (conditionCode === undefined || history.conditionCode === conditionCode),
  );
}

export function deriveFacts(input: CarePlanEvaluationInput): DerivedFacts {
  const anatomy = new Map<AnatomyKey, AnatomyState>();
  const orderedAnatomy = [...input.anatomy].sort((left, right) => {
    if (left.key !== right.key) return left.key.localeCompare(right.key);
    if (left.effectiveDate !== right.effectiveDate) {
      return (left.effectiveDate ?? "0000-01-01").localeCompare(
        right.effectiveDate ?? "0000-01-01",
      );
    }
    return left.state.localeCompare(right.state);
  });
  for (const entry of orderedAnatomy) {
    if (entry.effectiveDate == null || entry.effectiveDate <= input.asOfDate) {
      anatomy.set(entry.key, entry.state);
    }
  }

  const activeRiskFactors = input.riskFactors.filter(
    (factor) =>
      factor.deletedAt == null &&
      (factor.startedAt == null || factor.startedAt <= input.asOfDate) &&
      (factor.endedAt == null || factor.endedAt >= input.asOfDate),
  );
  const risksByType = new Map<string, NormalizedRiskFactor[]>();
  for (const factor of activeRiskFactors) {
    const existing = risksByType.get(factor.type) ?? [];
    existing.push(factor);
    risksByType.set(factor.type, existing);
  }

  const conditions = input.conditions.filter((condition) => condition.deletedAt == null);
  const familyHistory = input.familyHistory.filter((history) => history.deletedAt == null);
  const surgeries = input.surgeries.filter(
    (surgery) =>
      surgery.deletedAt == null &&
      (surgery.performedStart == null || surgery.performedStart <= input.asOfDate),
  );
  const medicationClasses = new Set(
    input.medications
      .filter((medication) => medication.deletedAt == null && medication.status === "active")
      .flatMap((medication) => medication.classCodes),
  );

  return {
    age: ageOnDate(input.profile.dateOfBirth, input.asOfDate),
    anatomy,
    risksByType,
    conditions,
    familyHistory,
    surgeries,
    medicationClasses,
    bmi: deriveBmi(activeRiskFactors),
    smoking: derivePackYears(activeRiskFactors, input.asOfDate),
  };
}
