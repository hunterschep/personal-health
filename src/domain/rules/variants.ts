import type { EvaluationRule, GuidelineVariantSelection } from "./types";

export type SelectedRuleSet = {
  rules: EvaluationRule[];
  selectedByConflictGroup: Map<string, { variantId: string; explicit: boolean }>;
  unavailableSelections: GuidelineVariantSelection[];
};

function normalizeSelections(
  selections: GuidelineVariantSelection[] | Readonly<Record<string, string>>,
): Map<string, string> {
  if (Array.isArray(selections)) {
    const normalized = new Map<string, string>();
    for (const selection of selections) {
      const existing = normalized.get(selection.conflictGroup);
      if (existing !== undefined && existing !== selection.variantId) {
        throw new RangeError(
          `Conflict group ${selection.conflictGroup} has multiple selected variants.`,
        );
      }
      normalized.set(selection.conflictGroup, selection.variantId);
    }
    return normalized;
  }
  return new Map(Object.entries(selections));
}

export function selectEffectiveRuleVersions(
  rules: EvaluationRule[],
  asOfDate: string,
): EvaluationRule[] {
  const effective = rules.filter(
    (rule) =>
      rule.reviewStatus === "active" &&
      rule.effectiveFrom <= asOfDate &&
      (rule.effectiveTo === null || rule.effectiveTo >= asOfDate),
  );
  const byStableKey = new Map<string, EvaluationRule>();
  for (const rule of effective) {
    const previous = byStableKey.get(rule.stableKey);
    if (
      previous === undefined ||
      rule.version > previous.version ||
      (rule.version === previous.version && rule.id.localeCompare(previous.id) < 0)
    ) {
      byStableKey.set(rule.stableKey, rule);
    }
  }
  return [...byStableKey.values()];
}

export function selectGuidelineVariants(
  rules: EvaluationRule[],
  selections: GuidelineVariantSelection[] | Readonly<Record<string, string>>,
): SelectedRuleSet {
  const requested = normalizeSelections(selections);
  const ungrouped = rules.filter((rule) => rule.conflictGroup === null);
  const grouped = new Map<string, EvaluationRule[]>();
  for (const rule of rules) {
    if (rule.conflictGroup === null) continue;
    const group = grouped.get(rule.conflictGroup) ?? [];
    group.push(rule);
    grouped.set(rule.conflictGroup, group);
  }

  const chosen = [...ungrouped];
  const selectedByConflictGroup = new Map<string, { variantId: string; explicit: boolean }>();
  const unavailableSelections: GuidelineVariantSelection[] = [];

  for (const [conflictGroup, groupRules] of [...grouped.entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    const availableVariants = new Set(groupRules.map((rule) => rule.variantId));
    const requestedVariant = requested.get(conflictGroup);
    let selectedVariant: string;
    let explicit = false;

    if (requestedVariant !== undefined && availableVariants.has(requestedVariant)) {
      selectedVariant = requestedVariant;
      explicit = true;
    } else {
      if (requestedVariant !== undefined) {
        unavailableSelections.push({ conflictGroup, variantId: requestedVariant });
      }
      const baselineVariants = new Set(
        groupRules.filter((rule) => rule.baseline).map((rule) => rule.variantId),
      );
      if (baselineVariants.size !== 1) {
        throw new RangeError(
          `Conflict group ${conflictGroup} must have exactly one active baseline variant.`,
        );
      }
      selectedVariant = [...baselineVariants][0] as string;
    }

    selectedByConflictGroup.set(conflictGroup, { variantId: selectedVariant, explicit });
    chosen.push(...groupRules.filter((rule) => rule.variantId === selectedVariant));
  }

  return { rules: chosen, selectedByConflictGroup, unavailableSelections };
}
