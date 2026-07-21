"use client";

import { Check, GitCompareArrows, LoaderCircle, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { statusLabels, type RecommendationStatus } from "@/contracts";

type Variant = {
  variantId: string;
  baseline: boolean;
  selected: boolean;
  organization: string;
};

type RecommendationSummary = {
  id: string;
  variantId: string;
  status: RecommendationStatus;
  dueStart: string | null;
  dueEnd: string | null;
};

const recommendationChangeTypes = [
  "newly_applicable",
  "no_longer_applicable",
  "status_changed",
  "due_range_changed",
  "source_variant_changed",
  "rule_version_changed",
  "clinician_override_activated",
  "clinician_override_removed",
  "history_uncertainty_resolved",
] as const;

type RecommendationChangeType = (typeof recommendationChangeTypes)[number];

type ChangeSummary = {
  title: string;
  before: RecommendationSummary | null;
  after: RecommendationSummary;
  byType: Record<RecommendationChangeType, number>;
  created: number;
  retired: number;
  unchanged: number;
};

type SelectionResponse = {
  selectedVariantId?: string;
  activeRecommendationId?: string;
  recommendationChanges?: Omit<ChangeSummary, "title"> & {
    after: RecommendationSummary | null;
  };
};

const changeLabels: Record<RecommendationChangeType, string> = {
  newly_applicable: "newly applicable",
  no_longer_applicable: "no longer applicable",
  status_changed: "status",
  due_range_changed: "timing",
  source_variant_changed: "source variant",
  rule_version_changed: "rule version",
  clinician_override_activated: "clinician instruction added",
  clinician_override_removed: "clinician instruction removed",
  history_uncertainty_resolved: "history uncertainty resolved",
};

function label(value: string): string {
  return value.replaceAll("_", " ").replaceAll("-", " ");
}

function dateLabel(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function timingLabel(recommendation: RecommendationSummary): string {
  if (recommendation.dueStart === null && recommendation.dueEnd === null) {
    return "No organizer due range";
  }
  if (recommendation.dueStart === recommendation.dueEnd && recommendation.dueStart !== null) {
    return dateLabel(recommendation.dueStart);
  }
  return `${recommendation.dueStart === null ? "Open" : dateLabel(recommendation.dueStart)} to ${recommendation.dueEnd === null ? "open" : dateLabel(recommendation.dueEnd)}`;
}

function changeSummaryLabel(summary: ChangeSummary): string {
  return (
    recommendationChangeTypes
      .filter((type) => summary.byType[type] > 0)
      .map((type) => `${summary.byType[type]} ${changeLabels[type]}`)
      .join(", ") || "No visible recommendation fields"
  );
}

async function responseError(response: Response): Promise<string> {
  const body = (await response.json().catch(() => null)) as { error?: unknown } | null;
  return typeof body?.error === "string" ? body.error : "The guideline choice could not be saved.";
}

export function GuidelineVariantSelector({
  profileId,
  conflictGroup,
  explicitSelection,
  variants,
}: {
  profileId: string;
  conflictGroup: string;
  explicitSelection: boolean;
  variants: Variant[];
}) {
  const options = useMemo(
    () => [
      ...new Map(
        variants.map((variant) => [
          variant.variantId,
          {
            ...variant,
            baseline: variants.some(
              (candidate) => candidate.variantId === variant.variantId && candidate.baseline,
            ),
            selected: variants.some(
              (candidate) => candidate.variantId === variant.variantId && candidate.selected,
            ),
          },
        ]),
      ).values(),
    ],
    [variants],
  );
  const initial =
    options.find((variant) => variant.selected)?.variantId ?? options[0]?.variantId ?? "";
  const [saved, setSaved] = useState(initial);
  const [preview, setPreview] = useState(initial);
  const [explicit, setExplicit] = useState(explicitSelection);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [changeSummary, setChangeSummary] = useState<ChangeSummary | null>(null);
  const selectedOption = options.find((variant) => variant.variantId === preview);
  const baselineOption = options.find((variant) => variant.baseline);

  async function confirm() {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/profiles/${profileId}/guideline-selections/${encodeURIComponent(conflictGroup)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ variantId: preview }),
        },
      );
      if (!response.ok) throw new Error(await responseError(response));
      const result = (await response.json()) as SelectionResponse;
      if (
        result.activeRecommendationId === undefined ||
        result.recommendationChanges?.after === null ||
        result.recommendationChanges?.after === undefined
      ) {
        throw new Error("The recalculated recommendation could not be opened.");
      }
      const selectedVariantId = result.selectedVariantId ?? preview;
      setSaved(selectedVariantId);
      setPreview(selectedVariantId);
      setExplicit(true);
      setChangeSummary({
        ...result.recommendationChanges,
        after: result.recommendationChanges.after,
        title: "Guideline variant updated",
      });
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "The guideline choice could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function resetToBaseline() {
    if (baselineOption === undefined) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/profiles/${profileId}/guideline-selections/${encodeURIComponent(conflictGroup)}`,
        { method: "DELETE", headers: { Accept: "application/json" } },
      );
      if (!response.ok) throw new Error(await responseError(response));
      const result = (await response.json()) as SelectionResponse;
      if (
        result.activeRecommendationId === undefined ||
        result.recommendationChanges?.after === null ||
        result.recommendationChanges?.after === undefined
      ) {
        throw new Error("The baseline recommendation could not be opened.");
      }
      const selectedVariantId = result.selectedVariantId ?? baselineOption.variantId;
      setSaved(selectedVariantId);
      setPreview(selectedVariantId);
      setExplicit(false);
      setChangeSummary({
        ...result.recommendationChanges,
        after: result.recommendationChanges.after,
        title: "Federal baseline restored",
      });
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "The guideline choice could not be reset.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (options.length < 2) return null;
  return (
    <div className="border-line bg-surface-muted/45 mt-4 rounded-2xl border p-4 sm:p-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <p className="text-sm font-bold">Choose the organizer variant</p>
          <p className="text-ink-soft mt-1 text-xs leading-5">
            Preview the registered schedules above, then confirm one. This choice changes organizer
            timing, not clinical truth.
          </p>
        </div>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Guideline variant">
          {options.map((variant) => (
            <Button
              key={variant.variantId}
              type="button"
              size="sm"
              variant={preview === variant.variantId ? "primary" : "secondary"}
              role="radio"
              aria-checked={preview === variant.variantId}
              disabled={saving}
              onClick={() => {
                setPreview(variant.variantId);
                setError(null);
                setChangeSummary(null);
              }}
            >
              {preview === variant.variantId ? <Check aria-hidden="true" /> : null}
              {variant.organization}
              {variant.baseline ? <Badge tone="neutral">baseline</Badge> : null}
            </Button>
          ))}
        </div>
      </div>
      {error === null ? null : (
        <Alert className="mt-4" tone="warning" title="Choice not saved">
          {error}
        </Alert>
      )}
      {changeSummary === null ? null : (
        <Alert className="mt-4" tone="success" title={changeSummary.title}>
          <div className="space-y-2">
            <p aria-label="Before recommendation">
              <strong>Before:</strong>{" "}
              {changeSummary.before === null
                ? "No active recommendation"
                : `${options.find(({ variantId }) => variantId === changeSummary.before?.variantId)?.organization ?? label(changeSummary.before.variantId)} · ${statusLabels[changeSummary.before.status]} · ${timingLabel(changeSummary.before)}`}
            </p>
            <p aria-label="After recommendation">
              <strong>After:</strong>{" "}
              {`${options.find(({ variantId }) => variantId === changeSummary.after.variantId)?.organization ?? label(changeSummary.after.variantId)} · ${statusLabels[changeSummary.after.status]} · ${timingLabel(changeSummary.after)}`}
            </p>
            <p aria-label="Recommendation changes">
              <strong>Changed:</strong> {changeSummaryLabel(changeSummary)}.{" "}
              {changeSummary.unchanged} other recommendation
              {changeSummary.unchanged === 1 ? " was" : "s were"} unchanged.
            </p>
            <Button asChild size="sm" variant="secondary">
              <a
                href={`/app/profile/${profileId}/care-plan/${changeSummary.after.id}`}
                aria-label="Open recalculated recommendation"
              >
                Open recalculated recommendation
              </a>
            </Button>
          </div>
        </Alert>
      )}
      {preview === saved ? null : (
        <div className="border-accent/30 bg-accent-soft mt-4 flex flex-col justify-between gap-3 rounded-xl border p-4 sm:flex-row sm:items-center">
          <p className="text-sm">
            Previewing{" "}
            <strong className="capitalize">{selectedOption?.organization ?? label(preview)}</strong>
            . Confirming recalculates this profile and preserves prior snapshots.
          </p>
          <Button type="button" size="sm" disabled={saving} onClick={() => void confirm()}>
            {saving ? (
              <LoaderCircle aria-hidden="true" className="animate-spin" />
            ) : (
              <GitCompareArrows aria-hidden="true" />
            )}
            {saving ? "Recalculating…" : "Confirm variant"}
          </Button>
        </div>
      )}
      {!explicit || baselineOption === undefined ? null : (
        <div className="border-line mt-4 flex flex-col justify-between gap-3 border-t pt-4 sm:flex-row sm:items-center">
          <p className="text-ink-soft text-xs leading-5">
            Remove the saved choice and let the reviewed federal baseline organize this profile.
          </p>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={saving}
            onClick={() => void resetToBaseline()}
          >
            <RotateCcw aria-hidden="true" /> Reset to baseline
          </Button>
        </div>
      )}
    </div>
  );
}
