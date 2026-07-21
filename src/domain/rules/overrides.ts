import type { DateRange, ExplanationToken } from "@/contracts";
import { addDurationToRange, exactDateRange, parseIsoDate } from "@/domain/dates";
import type {
  CalculationTraceStep,
  NormalizedClinicianOverride,
  ScheduleCalculation,
} from "./types";

export type AppliedOverride = {
  schedule: ScheduleCalculation;
  activeOverrideId: string | null;
  personalDueRange: DateRange | null;
  managedOverride: boolean;
  personalTimingOverride: boolean;
  tokens: ExplanationToken[];
  trace: CalculationTraceStep[];
};

function activeOverrides(
  overrides: NormalizedClinicianOverride[],
  profileId: string,
  serviceId: string,
  asOfDate: string,
): NormalizedClinicianOverride[] {
  return overrides
    .filter(
      (override) =>
        override.profileId === profileId &&
        override.serviceId === serviceId &&
        override.active &&
        override.instructionReceivedDate <= asOfDate &&
        (override.effectiveTo == null || override.effectiveTo >= asOfDate),
    )
    .sort((left, right) => {
      if (left.instructionReceivedDate !== right.instructionReceivedDate) {
        return right.instructionReceivedDate.localeCompare(left.instructionReceivedDate);
      }
      return left.id.localeCompare(right.id);
    });
}

function overrideDueRange(
  override: NormalizedClinicianOverride,
  schedule: ScheduleCalculation,
): DateRange | null {
  if (override.overrideType === "exact_next_date") {
    if (override.nextDueStart === null || override.nextDueEnd === null) {
      throw new RangeError("An exact-date override requires a due range.");
    }
    parseIsoDate(override.nextDueStart);
    parseIsoDate(override.nextDueEnd);
    if (override.nextDueStart > override.nextDueEnd) {
      throw new RangeError("A clinician override due range is reversed.");
    }
    const precision =
      override.nextDueStart === override.nextDueEnd
        ? "day"
        : override.nextDuePrecision === undefined || override.nextDuePrecision === "unknown"
          ? "month"
          : override.nextDuePrecision;
    return { start: override.nextDueStart, end: override.nextDueEnd, precision };
  }
  if (override.overrideType === "recurring_interval") {
    if (override.interval === null) {
      throw new RangeError("A recurring override requires an interval.");
    }
    const event = schedule.lastQualifyingEvent;
    const anchor =
      event !== null && event.performedStart !== null && event.performedEnd !== null
        ? {
            start: event.performedStart,
            end: event.performedEnd,
            precision: event.datePrecision,
          }
        : exactDateRange(override.instructionReceivedDate);
    return addDurationToRange(anchor, override.interval);
  }
  return null;
}

export function applyClinicianOverrides(
  schedule: ScheduleCalculation,
  overrides: NormalizedClinicianOverride[],
  profileId: string,
  serviceId: string,
  asOfDate: string,
): AppliedOverride {
  const active = activeOverrides(overrides, profileId, serviceId, asOfDate);
  const replacing = active.filter((override) => override.replacesGeneralGuideline);
  if (replacing.length > 1) {
    throw new RangeError(`Service ${serviceId} has multiple active replacing clinician overrides.`);
  }

  const selected = replacing[0] ?? active[0] ?? null;
  if (selected === null) {
    return {
      schedule,
      activeOverrideId: null,
      personalDueRange: null,
      managedOverride: false,
      personalTimingOverride: false,
      tokens: [],
      trace: [],
    };
  }

  const personalDueRange = overrideDueRange(selected, schedule);
  const tokens: ExplanationToken[] = [
    {
      code: "clinician_override_active",
      label: selected.replacesGeneralGuideline
        ? "A personal clinician plan replaces routine timing"
        : "A personal clinician plan supplements routine guidance",
      value: selected.overrideType,
      sourceFact: `override.${selected.id}`,
    },
  ];
  const trace: CalculationTraceStep[] = [
    {
      step: "clinician_override",
      outcome: selected.replacesGeneralGuideline
        ? "Applied the active replacing clinician instruction."
        : "Kept the general guideline and attached a supplemental clinician instruction.",
      values: { overrideId: selected.id, overrideType: selected.overrideType },
    },
  ];

  if (!selected.replacesGeneralGuideline) {
    return {
      schedule,
      activeOverrideId: selected.id,
      personalDueRange,
      managedOverride: false,
      personalTimingOverride: false,
      tokens,
      trace,
    };
  }

  if (
    selected.overrideType === "clinician_managed" ||
    selected.overrideType === "no_longer_needed"
  ) {
    return {
      schedule: { ...schedule, dueRange: null },
      activeOverrideId: selected.id,
      personalDueRange: null,
      managedOverride: true,
      personalTimingOverride: false,
      tokens,
      trace,
    };
  }

  if (personalDueRange === null) {
    throw new RangeError("A timing override did not produce a personal due range.");
  }
  return {
    schedule: {
      ...schedule,
      dueRange: personalDueRange,
      rangeRepresentsUncertainty:
        selected.overrideType === "recurring_interval" &&
        schedule.lastQualifyingEvent !== null &&
        schedule.lastQualifyingEvent.datePrecision !== "day",
      completedOnce: false,
      routineSatisfied: false,
      historyStatus: "none",
    },
    activeOverrideId: selected.id,
    personalDueRange,
    managedOverride: false,
    personalTimingOverride: true,
    tokens,
    trace,
  };
}
