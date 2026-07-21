import type { EvaluationRule, NormalizedCareEvent, QualifiedEventSet } from "./types";

function methodAllowed(rule: EvaluationRule, event: NormalizedCareEvent): boolean {
  if (rule.schedule.kind === "method_dependent") {
    return (
      event.methodId !== null &&
      rule.schedule.methods.some((method) => method.methodId === event.methodId)
    );
  }
  return (
    rule.allowedMethods === null ||
    (event.methodId !== null && rule.allowedMethods.includes(event.methodId))
  );
}

function resultQualifies(rule: EvaluationRule, event: NormalizedCareEvent): boolean {
  if (rule.schedule.kind === "method_dependent") {
    const method = rule.schedule.methods.find((candidate) => candidate.methodId === event.methodId);
    return method?.qualifyingResults.includes(event.result) ?? false;
  }
  return event.result === "normal";
}

function eventFingerprint(event: NormalizedCareEvent): string {
  return [
    event.profileId,
    event.serviceId,
    event.eventType,
    event.methodId ?? "",
    event.performedStart ?? "",
    event.performedEnd ?? "",
    event.datePrecision,
    event.result,
    event.seriesKey ?? "",
    event.doseOrdinal ?? "",
  ].join("\u001f");
}

function mostRecentFirst(left: NormalizedCareEvent, right: NormalizedCareEvent): number {
  const leftKnown = left.performedEnd !== null;
  const rightKnown = right.performedEnd !== null;
  if (leftKnown !== rightKnown) {
    return leftKnown ? -1 : 1;
  }
  if (left.performedEnd !== right.performedEnd) {
    return (right.performedEnd ?? "").localeCompare(left.performedEnd ?? "");
  }
  if (left.performedStart !== right.performedStart) {
    return (right.performedStart ?? "").localeCompare(left.performedStart ?? "");
  }
  return left.id.localeCompare(right.id);
}

function deduplicate(events: NormalizedCareEvent[]): NormalizedCareEvent[] {
  const byFingerprint = new Map<string, NormalizedCareEvent>();
  for (const event of [...events].sort((left, right) => left.id.localeCompare(right.id))) {
    if (!byFingerprint.has(eventFingerprint(event))) {
      byFingerprint.set(eventFingerprint(event), event);
    }
  }
  return [...byFingerprint.values()];
}

export function qualifyCareEvents(
  rule: EvaluationRule,
  events: NormalizedCareEvent[],
  profileId: string,
  asOfDate: string,
): QualifiedEventSet {
  const correctedIds = new Set(
    events.map((event) => event.correctsEventId).filter((id): id is string => id != null),
  );
  const relevant = deduplicate(
    events.filter(
      (event) =>
        event.profileId === profileId &&
        event.deletedAt == null &&
        event.supersededByEventId == null &&
        !correctedIds.has(event.id) &&
        (event.serviceId === rule.serviceId || rule.completionEventTypes.includes(event.eventType)),
    ),
  ).sort(mostRecentFirst);

  const futureOrOverlapping = relevant.filter(
    (event) =>
      (event.performedStart !== null && event.performedStart > asOfDate) ||
      (event.performedEnd !== null && event.performedEnd > asOfDate),
  );
  const occurred = relevant.filter((event) => !futureOrOverlapping.includes(event));
  const qualifying = occurred
    .filter((event) => methodAllowed(rule, event) && resultQualifies(rule, event))
    .sort(mostRecentFirst);

  const latest = (predicate: (event: NormalizedCareEvent) => boolean): NormalizedCareEvent | null =>
    occurred.filter(predicate).sort(mostRecentFirst)[0] ?? null;
  const methodSpecific = rule.schedule.kind === "method_dependent" || rule.allowedMethods !== null;

  return {
    relevant,
    qualifying,
    latestQualifying: qualifying[0] ?? null,
    abnormal: latest((event) => event.result === "abnormal"),
    inconclusive: latest((event) => event.result === "inconclusive"),
    unknownResult: latest((event) => event.result === "unknown"),
    unknownDate: latest(
      (event) =>
        methodAllowed(rule, event) &&
        resultQualifies(rule, event) &&
        (event.performedStart === null || event.performedEnd === null),
    ),
    unknownMethod: methodSpecific
      ? latest((event) => event.methodId === null && event.result !== "abnormal")
      : null,
    futureOrOverlapping,
  };
}
