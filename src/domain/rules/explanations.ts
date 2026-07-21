import type {
  DateRange,
  ExplanationToken,
  RecommendationClass,
  RecommendationStatus,
} from "@/contracts";
import type { EvaluationRule, NormalizedCareEvent } from "./types";

export function uniqueExplanationTokens(tokens: ExplanationToken[]): ExplanationToken[] {
  const seen = new Set<string>();
  return tokens.filter((token) => {
    const key = JSON.stringify([token.code, token.value ?? null, token.sourceFact ?? null]);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function coreExplanationTokens(input: {
  rule: EvaluationRule;
  status: RecommendationStatus;
  recommendationClass: RecommendationClass;
  selectedVariantExplicitly: boolean;
  dueRange: DateRange | null;
  lastQualifyingEvent: NormalizedCareEvent | null;
  abnormalEvent: NormalizedCareEvent | null;
  approximateDueRange: boolean;
}): ExplanationToken[] {
  const tokens: ExplanationToken[] = [
    {
      code: "selected_guideline_variant",
      label: input.selectedVariantExplicitly
        ? "This guideline variant was selected for the profile"
        : "This is the active guideline variant",
      value: input.rule.variantId,
      sourceFact: `rule.${input.rule.stableKey}.v${input.rule.version}`,
    },
    {
      code: "recommendation_class",
      label: "Guideline recommendation class",
      value: input.recommendationClass,
    },
    {
      code: "status_assigned",
      label: "Current organizer status",
      value: input.status,
    },
  ];

  if (input.dueRange?.start !== null && input.dueRange?.start !== undefined) {
    tokens.push({
      code: input.approximateDueRange ? "due_range_approximate" : "due_range_calculated",
      label: input.approximateDueRange
        ? "The due range preserves an approximate historical date"
        : "The due range was calculated from the active guideline",
      value:
        input.dueRange.start === input.dueRange.end
          ? input.dueRange.start
          : `${input.dueRange.start}/${input.dueRange.end}`,
    });
  }
  if (input.lastQualifyingEvent !== null) {
    tokens.push({
      code: "last_qualifying_event",
      label: "Latest event that qualifies for this rule",
      value: input.lastQualifyingEvent.id,
      sourceFact: `careEvent.${input.lastQualifyingEvent.id}`,
    });
  }
  if (input.abnormalEvent !== null) {
    tokens.push({
      code: "abnormal_history_requires_follow_up",
      label: "A recorded non-routine result requires individualized follow-up",
      value: input.abnormalEvent.id,
      sourceFact: `careEvent.${input.abnormalEvent.id}`,
    });
  }
  return tokens;
}

function stableValue(value: unknown): string {
  if (value === undefined) return "undefined";
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? String(value);
  }
  if (Array.isArray(value)) return `[${value.map(stableValue).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableValue(item)}`).join(",")}}`;
}

export function deterministicHash(value: unknown): string {
  const serialized = stableValue(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}
