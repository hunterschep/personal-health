import type { DateRange, ExplanationToken, Expression, HistoryAssertion } from "@/contracts";
import {
  addCalendarYears,
  addDurationToRange,
  dateAtAge,
  endOfMonth,
  exactDateRange,
  normalizeDateRange,
  parseIsoDate,
  startOfMonth,
  yearOf,
} from "@/domain/dates";
import type {
  EvaluationRule,
  NormalizedCareEvent,
  QualifiedEventSet,
  ScheduleCalculation,
} from "./types";

function token(
  code: string,
  label: string,
  value?: string | number | boolean | null,
  sourceFact?: string,
): ExplanationToken {
  return {
    code,
    label,
    ...(value === undefined ? {} : { value }),
    ...(sourceFact === undefined ? {} : { sourceFact }),
  };
}

function eventRange(event: NormalizedCareEvent): DateRange {
  return {
    start: event.performedStart,
    end: event.performedEnd,
    precision: event.datePrecision,
  };
}

function initialCalculation(events: QualifiedEventSet): ScheduleCalculation {
  return {
    dueRange: null,
    generalGuidelineDueRange: null,
    lastQualifyingEvent: events.latestQualifying,
    completedOnce: false,
    historyStatus: "none",
    rangeRepresentsUncertainty: false,
    currentSeasonComplete: false,
    doseSeriesComplete: false,
    routineSatisfied: false,
    tokens: [],
    trace: [],
  };
}

export function minimumAgeConstraint(expression: Expression): number | null {
  if (expression.op === "age_between") return expression.min ?? null;
  if (expression.op === "all") {
    const minimums = expression.children
      .map(minimumAgeConstraint)
      .filter((value): value is number => value !== null);
    return minimums.length === 0 ? null : Math.max(...minimums);
  }
  return null;
}

export function maximumAgeConstraint(expression: Expression): number | null {
  if (expression.op === "age_between") return expression.max ?? null;
  if (expression.op === "all") {
    const maximums = expression.children
      .map(maximumAgeConstraint)
      .filter((value): value is number => value !== null);
    return maximums.length === 0 ? null : Math.min(...maximums);
  }
  return null;
}

export function withoutAgeConstraints(expression: Expression): Expression {
  if (expression.op === "age_between") return { op: "constant", value: true };
  if (expression.op === "all" || expression.op === "any") {
    return {
      op: expression.op,
      children: expression.children.map(withoutAgeConstraints),
    };
  }
  if (expression.op === "not") {
    return { op: "not", child: withoutAgeConstraints(expression.child) };
  }
  return expression;
}

function eligibilityDate(rule: EvaluationRule, dateOfBirth: string, asOfDate: string): string {
  const scheduleAge =
    rule.schedule.kind === "age_based" || rule.schedule.kind === "shared_decision"
      ? rule.schedule.startAge
      : undefined;
  const startAge = scheduleAge ?? minimumAgeConstraint(rule.appliesWhen);
  return startAge === null || startAge === undefined ? asOfDate : dateAtAge(dateOfBirth, startAge);
}

function historyNeedsConfirmation(events: QualifiedEventSet, asOfDate: string): boolean {
  return (
    events.unknownDate !== null ||
    events.unknownMethod !== null ||
    events.unknownResult !== null ||
    events.futureOrOverlapping.some(
      (event) =>
        event.performedStart !== null &&
        event.performedEnd !== null &&
        event.performedStart <= asOfDate &&
        event.performedEnd > asOfDate,
    )
  );
}

function ambiguityCouldSupersede(
  events: QualifiedEventSet,
  latest: NormalizedCareEvent | null,
  asOfDate: string,
): boolean {
  if (events.unknownDate !== null) return true;
  if (
    events.futureOrOverlapping.some(
      (event) =>
        event.performedStart !== null &&
        event.performedEnd !== null &&
        event.performedStart <= asOfDate &&
        event.performedEnd > asOfDate,
    )
  ) {
    return true;
  }
  const ambiguous = [events.unknownMethod, events.unknownResult].filter(
    (event): event is NormalizedCareEvent => event !== null,
  );
  return ambiguous.some(
    (event) =>
      latest === null ||
      event.performedEnd === null ||
      latest.performedEnd === null ||
      event.performedEnd >= latest.performedEnd,
  );
}

function noHistoryState(
  assertion: HistoryAssertion | undefined,
  dueByDesign: boolean,
): "due" | "unknown" {
  if (assertion === "never_completed" || assertion === "declined") return "due";
  if (assertion === "unsure" || assertion === "completed_date_unknown") return "unknown";
  return dueByDesign ? "due" : "unknown";
}

function calculateAgeBased(
  rule: EvaluationRule,
  events: QualifiedEventSet,
  dateOfBirth: string,
  asOfDate: string,
  assertion: HistoryAssertion | undefined,
): ScheduleCalculation {
  if (rule.schedule.kind !== "age_based") throw new Error("Expected an age-based schedule.");
  const calculation = initialCalculation(events);
  const latest = events.latestQualifying;

  if (ambiguityCouldSupersede(events, latest, asOfDate)) {
    calculation.historyStatus = "needs_confirmation";
    return calculation;
  }

  if (latest !== null && latest.performedStart !== null && latest.performedEnd !== null) {
    if (rule.schedule.interval === undefined) {
      calculation.routineSatisfied = true;
      calculation.tokens.push(
        token("last_event_recorded", "A qualifying event is recorded", latest.id),
      );
      return calculation;
    }
    calculation.dueRange = addDurationToRange(eventRange(latest), rule.schedule.interval);
    calculation.generalGuidelineDueRange = calculation.dueRange;
    calculation.rangeRepresentsUncertainty = latest.datePrecision !== "day";
    calculation.tokens.push(
      token(
        latest.datePrecision === "day" ? "last_event_date_exact" : "last_event_date_approximate",
        latest.datePrecision === "day"
          ? "The latest qualifying event has an exact date"
          : "The latest qualifying event has an approximate date",
        latest.id,
      ),
    );
    calculation.trace.push({
      step: "age_based_interval",
      outcome: "Added the source interval to the latest qualifying event range.",
      values: {
        eventId: latest.id,
        dueStart: calculation.dueRange.start,
        dueEnd: calculation.dueRange.end,
      },
    });
    return calculation;
  }

  if (historyNeedsConfirmation(events, asOfDate)) {
    calculation.historyStatus = "needs_confirmation";
    return calculation;
  }
  if (noHistoryState(assertion, true) === "unknown") {
    calculation.historyStatus = "unknown";
    return calculation;
  }

  const eligibleOn = eligibilityDate(rule, dateOfBirth, asOfDate);
  calculation.dueRange =
    rule.schedule.initialDue === "calendar_year"
      ? normalizeDateRange(String(yearOf(eligibleOn)), "year")
      : exactDateRange(eligibleOn);
  calculation.generalGuidelineDueRange = calculation.dueRange;
  calculation.tokens.push(token("due_on_eligibility", "Due when eligibility begins", eligibleOn));
  return calculation;
}

function calculateInterval(
  rule: EvaluationRule,
  events: QualifiedEventSet,
  dateOfBirth: string,
  asOfDate: string,
  assertion: HistoryAssertion | undefined,
): ScheduleCalculation {
  if (rule.schedule.kind !== "interval") throw new Error("Expected an interval schedule.");
  const calculation = initialCalculation(events);
  const latest = events.latestQualifying;
  if (ambiguityCouldSupersede(events, latest, asOfDate)) {
    calculation.historyStatus = "needs_confirmation";
    return calculation;
  }
  if (
    rule.schedule.anchor === "last_qualifying_event" &&
    latest !== null &&
    latest.performedStart !== null &&
    latest.performedEnd !== null
  ) {
    calculation.dueRange = addDurationToRange(eventRange(latest), rule.schedule.interval);
    calculation.generalGuidelineDueRange = calculation.dueRange;
    calculation.rangeRepresentsUncertainty = latest.datePrecision !== "day";
    return calculation;
  }
  if (rule.schedule.anchor === "last_qualifying_event") {
    if (historyNeedsConfirmation(events, asOfDate)) {
      calculation.historyStatus = "needs_confirmation";
    } else if (noHistoryState(assertion, false) === "unknown") {
      calculation.historyStatus = "unknown";
    } else {
      calculation.dueRange = exactDateRange(eligibilityDate(rule, dateOfBirth, asOfDate));
      calculation.generalGuidelineDueRange = calculation.dueRange;
    }
    return calculation;
  }

  const anchor = exactDateRange(eligibilityDate(rule, dateOfBirth, asOfDate));
  calculation.dueRange = addDurationToRange(anchor, rule.schedule.interval);
  calculation.generalGuidelineDueRange = calculation.dueRange;
  return calculation;
}

function calculateOneTime(
  rule: EvaluationRule,
  events: QualifiedEventSet,
  dateOfBirth: string,
  asOfDate: string,
  assertion: HistoryAssertion | undefined,
): ScheduleCalculation {
  if (rule.schedule.kind !== "one_time") throw new Error("Expected a one-time schedule.");
  const calculation = initialCalculation(events);
  if (events.qualifying.length > 0) {
    calculation.completedOnce = true;
    calculation.routineSatisfied = true;
    calculation.tokens.push(
      token(
        "one_time_completed",
        "A qualifying one-time event is recorded",
        events.qualifying[0]?.id,
      ),
    );
    return calculation;
  }
  if (events.unknownResult !== null || events.unknownMethod !== null) {
    calculation.historyStatus = "needs_confirmation";
    return calculation;
  }
  const state = noHistoryState(assertion, rule.schedule.dueOnEligibility);
  if (state === "unknown") {
    calculation.historyStatus = "unknown";
    return calculation;
  }
  calculation.dueRange = exactDateRange(eligibilityDate(rule, dateOfBirth, asOfDate));
  calculation.generalGuidelineDueRange = calculation.dueRange;
  return calculation;
}

type Season = { start: string; end: string };

function seasonForYear(startMonth: number, endMonth: number, year: number): Season {
  const start = `${year}-${String(startMonth).padStart(2, "0")}-01`;
  const endYear = endMonth < startMonth ? year + 1 : year;
  const endSeed = `${endYear}-${String(endMonth).padStart(2, "0")}-01`;
  return { start: startOfMonth(start), end: endOfMonth(endSeed) };
}

function currentOrNextSeason(
  startMonth: number,
  endMonth: number,
  asOfDate: string,
): { season: Season; active: boolean } {
  const year = yearOf(asOfDate);
  const candidates = [
    seasonForYear(startMonth, endMonth, year - 1),
    seasonForYear(startMonth, endMonth, year),
    seasonForYear(startMonth, endMonth, year + 1),
  ];
  const current = candidates.find(
    (candidate) => candidate.start <= asOfDate && candidate.end >= asOfDate,
  );
  if (current !== undefined) return { season: current, active: true };
  const next = candidates.find((candidate) => candidate.start > asOfDate);
  if (next === undefined) throw new RangeError("Could not calculate the next season.");
  return { season: next, active: false };
}

function calculateSeasonal(
  rule: EvaluationRule,
  events: QualifiedEventSet,
  asOfDate: string,
): ScheduleCalculation {
  if (rule.schedule.kind !== "seasonal") throw new Error("Expected a seasonal schedule.");
  const calculation = initialCalculation(events);
  if (!rule.schedule.repeatsAnnually) {
    const season = seasonForYear(
      rule.schedule.seasonStartMonth,
      rule.schedule.seasonEndMonth,
      yearOf(rule.effectiveFrom),
    );
    calculation.dueRange = { start: season.start, end: season.end, precision: "month" };
    calculation.generalGuidelineDueRange = calculation.dueRange;
    const completed = events.qualifying.some(
      (event) =>
        event.performedStart !== null &&
        event.performedEnd !== null &&
        event.performedStart >= season.start &&
        event.performedEnd <= season.end,
    );
    if (completed) {
      calculation.completedOnce = true;
      calculation.routineSatisfied = true;
      calculation.dueRange = null;
      calculation.generalGuidelineDueRange = null;
    } else if (
      events.qualifying.some(
        (event) =>
          event.performedStart === null ||
          event.performedEnd === null ||
          (event.performedStart <= season.end && event.performedEnd >= season.start),
      )
    ) {
      calculation.historyStatus = "needs_confirmation";
    }
    return calculation;
  }
  const { season, active } = currentOrNextSeason(
    rule.schedule.seasonStartMonth,
    rule.schedule.seasonEndMonth,
    asOfDate,
  );
  calculation.dueRange = { start: season.start, end: season.end, precision: "month" };
  calculation.generalGuidelineDueRange = calculation.dueRange;
  if (active) {
    const completed = events.qualifying.some(
      (event) =>
        event.performedStart !== null &&
        event.performedEnd !== null &&
        event.performedStart >= season.start &&
        event.performedEnd <= season.end,
    );
    if (completed) {
      calculation.currentSeasonComplete = true;
      calculation.routineSatisfied = true;
      if (rule.schedule.repeatsAnnually) {
        const next = seasonForYear(
          rule.schedule.seasonStartMonth,
          rule.schedule.seasonEndMonth,
          yearOf(season.start) + 1,
        );
        calculation.dueRange = { start: next.start, end: next.end, precision: "month" };
        calculation.generalGuidelineDueRange = calculation.dueRange;
      }
    } else if (
      events.qualifying.some(
        (event) =>
          event.performedStart === null ||
          event.performedEnd === null ||
          (event.performedStart <= season.end && event.performedEnd >= season.start),
      )
    ) {
      calculation.historyStatus = "needs_confirmation";
    }
  }
  return calculation;
}

function calculateMethodDependent(
  rule: EvaluationRule,
  events: QualifiedEventSet,
  dateOfBirth: string,
  asOfDate: string,
  assertion: HistoryAssertion | undefined,
): ScheduleCalculation {
  if (rule.schedule.kind !== "method_dependent") {
    throw new Error("Expected a method-dependent schedule.");
  }
  const calculation = initialCalculation(events);
  const latest = events.latestQualifying;
  if (ambiguityCouldSupersede(events, latest, asOfDate)) {
    calculation.historyStatus = "needs_confirmation";
    return calculation;
  }
  if (latest !== null) {
    if (
      latest.methodId === null ||
      latest.performedStart === null ||
      latest.performedEnd === null
    ) {
      calculation.historyStatus = "needs_confirmation";
      return calculation;
    }
    const method = rule.schedule.methods.find(
      (candidate) => candidate.methodId === latest.methodId,
    );
    if (method === undefined) {
      calculation.historyStatus = "needs_confirmation";
      return calculation;
    }
    calculation.dueRange = addDurationToRange(eventRange(latest), method.interval);
    calculation.generalGuidelineDueRange = calculation.dueRange;
    calculation.rangeRepresentsUncertainty = latest.datePrecision !== "day";
    calculation.tokens.push(
      token("last_event_method", "The latest completed method sets the interval", latest.methodId),
    );
    return calculation;
  }
  if (historyNeedsConfirmation(events, asOfDate)) {
    calculation.historyStatus = "needs_confirmation";
    return calculation;
  }
  const state = noHistoryState(assertion, rule.schedule.defaultMethodPrompt);
  if (state === "unknown") {
    calculation.historyStatus = "unknown";
    return calculation;
  }
  calculation.dueRange = exactDateRange(eligibilityDate(rule, dateOfBirth, asOfDate));
  calculation.generalGuidelineDueRange = calculation.dueRange;
  calculation.tokens.push(
    token("method_choice_needed", "Choose an accepted method when recording completion"),
  );
  return calculation;
}

function oldestFirst(left: NormalizedCareEvent, right: NormalizedCareEvent): number {
  if (left.performedStart !== right.performedStart) {
    return (left.performedStart ?? "").localeCompare(right.performedStart ?? "");
  }
  return left.id.localeCompare(right.id);
}

function calculateDoseSeries(
  rule: EvaluationRule,
  events: QualifiedEventSet,
  asOfDate: string,
): ScheduleCalculation {
  if (rule.schedule.kind !== "dose_series") throw new Error("Expected a dose-series schedule.");
  const schedule = rule.schedule;
  const calculation = initialCalculation(events);
  if (ambiguityCouldSupersede(events, events.latestQualifying, asOfDate)) {
    calculation.historyStatus = "needs_confirmation";
    return calculation;
  }
  const seriesEvents = events.qualifying
    .filter((event) => event.seriesKey == null || event.seriesKey === schedule.seriesKey)
    .sort(oldestFirst);
  if (seriesEvents.length === 0) {
    calculation.dueRange = exactDateRange(asOfDate);
    calculation.generalGuidelineDueRange = calculation.dueRange;
    return calculation;
  }

  const valid: NormalizedCareEvent[] = [];
  let uncertainInterval = false;
  for (const event of seriesEvents) {
    const expectedDose = schedule.doses[valid.length];
    if (expectedDose === undefined) break;
    if (event.doseOrdinal !== null && event.doseOrdinal !== undefined) {
      if (event.doseOrdinal <= valid.length) continue;
      if (event.doseOrdinal !== valid.length + 1) {
        uncertainInterval = true;
        break;
      }
    }
    if (valid.length === 0 || expectedDose.minimumIntervalFromPrior === undefined) {
      valid.push(event);
      continue;
    }
    const prior = valid[valid.length - 1];
    if (
      prior === undefined ||
      prior.performedStart === null ||
      prior.performedEnd === null ||
      event.performedStart === null ||
      event.performedEnd === null
    ) {
      uncertainInterval = true;
      break;
    }
    const minimumRange = addDurationToRange(
      eventRange(prior),
      expectedDose.minimumIntervalFromPrior,
    );
    if (minimumRange.start === null || minimumRange.end === null) {
      uncertainInterval = true;
      break;
    }
    if (event.performedEnd < minimumRange.start) {
      calculation.tokens.push(
        token("dose_too_early", "A recorded dose was before the minimum interval", event.id),
      );
      continue;
    }
    if (event.performedStart < minimumRange.end) {
      uncertainInterval = true;
      break;
    }
    valid.push(event);
  }

  if (uncertainInterval) {
    calculation.historyStatus = "needs_confirmation";
    return calculation;
  }
  const lastValid = valid[valid.length - 1] ?? null;
  calculation.lastQualifyingEvent = lastValid;
  if (valid.length >= schedule.doses.length) {
    calculation.doseSeriesComplete = true;
    calculation.routineSatisfied = true;
    if (schedule.boosters === undefined || lastValid === null) {
      calculation.completedOnce = true;
      return calculation;
    }
    calculation.completedOnce = false;
    calculation.routineSatisfied = false;
    calculation.dueRange = addDurationToRange(eventRange(lastValid), schedule.boosters.interval);
    calculation.generalGuidelineDueRange = calculation.dueRange;
    calculation.rangeRepresentsUncertainty = lastValid.datePrecision !== "day";
    return calculation;
  }

  const nextDose = schedule.doses[valid.length];
  if (nextDose === undefined || lastValid === null) {
    calculation.dueRange = exactDateRange(asOfDate);
  } else {
    const interval = nextDose.recommendedIntervalFromPrior ?? nextDose.minimumIntervalFromPrior;
    calculation.dueRange =
      interval === undefined
        ? exactDateRange(asOfDate)
        : addDurationToRange(eventRange(lastValid), interval);
    calculation.rangeRepresentsUncertainty = lastValid.datePrecision !== "day";
  }
  calculation.generalGuidelineDueRange = calculation.dueRange;
  calculation.tokens.push(
    token("dose_series_progress", "Recorded valid doses in this series", valid.length),
  );
  return calculation;
}

function calculateSharedDecision(
  rule: EvaluationRule,
  events: QualifiedEventSet,
  dateOfBirth: string,
  asOfDate: string,
): ScheduleCalculation {
  if (rule.schedule.kind !== "shared_decision") {
    throw new Error("Expected a shared-decision schedule.");
  }
  const calculation = initialCalculation(events);
  const latest = events.latestQualifying;
  if (
    latest !== null &&
    latest.performedStart !== null &&
    latest.performedEnd !== null &&
    rule.schedule.repeatConversationAfter !== undefined
  ) {
    calculation.dueRange = addDurationToRange(
      eventRange(latest),
      rule.schedule.repeatConversationAfter,
    );
    calculation.rangeRepresentsUncertainty = latest.datePrecision !== "day";
  } else {
    const start = eligibilityDate(rule, dateOfBirth, asOfDate);
    const end =
      rule.schedule.stopAge === undefined
        ? start
        : addCalendarYears(dateAtAge(dateOfBirth, rule.schedule.stopAge), 1);
    calculation.dueRange = {
      start,
      end,
      precision: start === end ? "day" : "year",
    };
  }
  calculation.generalGuidelineDueRange = calculation.dueRange;
  return calculation;
}

export function calculateSchedule(
  rule: EvaluationRule,
  events: QualifiedEventSet,
  dateOfBirth: string,
  asOfDate: string,
  assertion?: HistoryAssertion,
): ScheduleCalculation {
  parseIsoDate(dateOfBirth);
  parseIsoDate(asOfDate);
  switch (rule.schedule.kind) {
    case "age_based":
      return calculateAgeBased(rule, events, dateOfBirth, asOfDate, assertion);
    case "interval":
      return calculateInterval(rule, events, dateOfBirth, asOfDate, assertion);
    case "one_time":
      return calculateOneTime(rule, events, dateOfBirth, asOfDate, assertion);
    case "seasonal":
      return calculateSeasonal(rule, events, asOfDate);
    case "method_dependent":
      return calculateMethodDependent(rule, events, dateOfBirth, asOfDate, assertion);
    case "dose_series":
      return calculateDoseSeries(rule, events, asOfDate);
    case "shared_decision":
      return calculateSharedDecision(rule, events, dateOfBirth, asOfDate);
    case "custom": {
      const calculation = initialCalculation(events);
      calculation.historyStatus = "unknown";
      calculation.tokens.push(
        token("custom_cadence_needed", "Choose a personal or clinician-defined cadence"),
      );
      return calculation;
    }
  }
}
