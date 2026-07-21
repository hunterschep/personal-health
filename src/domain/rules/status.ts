import {
  statusPriority,
  type CarePlanMode,
  type DateRange,
  type RecommendationClass,
  type RecommendationStatus,
} from "@/contracts";
import { differenceInCalendarDays, yearOf } from "@/domain/dates";
import type { ScheduleCalculation, TriState } from "./types";

export function highestPrecedenceStatus(
  statuses: readonly RecommendationStatus[],
): RecommendationStatus {
  if (statuses.length === 0) {
    throw new RangeError("At least one status is required.");
  }
  return [...statuses].sort(
    (left, right) => statusPriority[left] - statusPriority[right],
  )[0] as RecommendationStatus;
}

export function timingStatus(
  dueRange: DateRange,
  asOfDate: string,
  carePlanMode: CarePlanMode,
  rangeRepresentsUncertainty: boolean,
): RecommendationStatus {
  if (dueRange.start === null || dueRange.end === null) {
    return "unknown_history";
  }

  if (rangeRepresentsUncertainty && dueRange.start !== dueRange.end) {
    if (asOfDate < dueRange.start) return "up_to_date";
    if (asOfDate <= dueRange.end) return "needs_date_confirmation";
    return "overdue";
  }

  if (asOfDate > dueRange.end) return "overdue";
  if (asOfDate >= dueRange.start) return "due_now";

  const daysUntilDue = differenceInCalendarDays(dueRange.start, asOfDate);
  const planningWindow = carePlanMode === "extra_attentive" ? 180 : 90;
  if (daysUntilDue <= planningWindow) return "due_soon";
  if (yearOf(dueRange.start) === yearOf(asOfDate)) return "due_this_year";
  return "future";
}

export type StatusDecisionInput = {
  applies: TriState;
  excluded: TriState;
  stopped: TriState;
  recommendationClass: RecommendationClass;
  schedule: ScheduleCalculation;
  asOfDate: string;
  carePlanMode: CarePlanMode;
  individualizedHistory: boolean;
  managedOverride: boolean;
  personalTimingOverride: boolean;
};

export function determineRecommendationStatus(input: StatusDecisionInput): RecommendationStatus {
  if (input.managedOverride || input.individualizedHistory || input.excluded === true) {
    return "clinician_managed";
  }
  if (input.personalTimingOverride && input.schedule.dueRange !== null) {
    return timingStatus(
      input.schedule.dueRange,
      input.asOfDate,
      input.carePlanMode,
      input.schedule.rangeRepresentsUncertainty,
    );
  }
  if (!input.personalTimingOverride && input.stopped === true) {
    return "not_routinely_recommended";
  }
  if (input.applies === false) {
    return "not_applicable";
  }
  if (input.applies === "unknown" || input.stopped === "unknown") {
    return "unknown_history";
  }
  if (input.excluded === "unknown") {
    return "unknown_history";
  }
  if (!input.personalTimingOverride && input.recommendationClass === "not-recommended") {
    return "not_routinely_recommended";
  }
  if (input.schedule.completedOnce) {
    return "completed_once";
  }
  if (
    !input.personalTimingOverride &&
    (input.recommendationClass === "shared-decision" ||
      input.recommendationClass === "selective" ||
      input.recommendationClass === "insufficient-evidence" ||
      input.recommendationClass === "custom-maintenance")
  ) {
    return "discuss_with_clinician";
  }
  if (input.schedule.historyStatus === "unknown") {
    return "unknown_history";
  }
  if (input.schedule.historyStatus === "needs_confirmation") {
    return "needs_date_confirmation";
  }
  if (input.schedule.currentSeasonComplete || input.schedule.routineSatisfied) {
    return "up_to_date";
  }
  if (input.schedule.dueRange === null) {
    return "unknown_history";
  }
  return timingStatus(
    input.schedule.dueRange,
    input.asOfDate,
    input.carePlanMode,
    input.schedule.rangeRepresentsUncertainty,
  );
}
