import { Check, GitCompareArrows } from "lucide-react";
import Link from "next/link";
import { SourceFreshnessBadge } from "@/components/sources";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { PublicSourceMetadata, SourceFreshnessState } from "@/server/sources/types";
import { humanizeIdentifier } from "@/server/read-models/transparency-format";

export type ReadOnlyGuidelineVariant = {
  id: string;
  stableKey: string;
  version: number;
  variantId: string;
  conflictGroup: string | null;
  baseline: boolean;
  selected: boolean;
  current: boolean;
  reviewStatus: string;
  evidenceGrade: string | null;
  recommendationClass: string;
  consumerSummary: string;
  eligibility: string;
  schedule: string;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  source: { metadata: PublicSourceMetadata; freshness: SourceFreshnessState } | null;
};

function dateLabel(value: Date | null): string {
  if (value === null) return "Open-ended";
  return value.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function ReadOnlyGuidelineVariants({ variants }: { variants: ReadOnlyGuidelineVariant[] }) {
  const current = variants.filter((variant) => variant.current);
  const groups = [
    ...new Map(
      current.map((variant) => [
        variant.variantId,
        current.filter((candidate) => candidate.variantId === variant.variantId),
      ]),
    ).entries(),
  ];

  if (groups.length === 0) {
    return (
      <p className="text-ink-soft text-sm">No other currently effective variant is registered.</p>
    );
  }

  return (
    <div className="grid items-start gap-4 lg:grid-cols-2">
      {groups.map(([variantId, rules]) => {
        const selected = rules.some((rule) => rule.selected);
        const baseline = rules.some((rule) => rule.baseline);
        const source = rules.find((rule) => rule.source !== null)?.source ?? null;
        return (
          <Card
            key={variantId}
            className={selected ? "border-brand/40 ring-brand/10 ring-2" : undefined}
          >
            <CardContent>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap gap-2">
                    <Badge tone={baseline ? "brand" : "cool"}>
                      {baseline ? "Federal baseline" : "Alternative"}
                    </Badge>
                    {selected ? <Badge tone="brand">Selected for this profile</Badge> : null}
                  </div>
                  <h3 className="font-editorial mt-3 text-2xl font-semibold">
                    {humanizeIdentifier(variantId)}
                  </h3>
                  <p className="text-ink-soft mt-1 text-sm font-semibold">
                    {source?.metadata.organization ?? "Registered reviewed source"}
                  </p>
                </div>
                {selected ? (
                  <span
                    className="bg-brand grid size-9 shrink-0 place-items-center rounded-full text-white"
                    aria-label="Currently selected variant"
                  >
                    <Check aria-hidden="true" className="size-4" />
                  </span>
                ) : source === null ? null : (
                  <SourceFreshnessBadge state={source.freshness} />
                )}
              </div>

              <div className="mt-5 space-y-3">
                {rules.map((rule) => (
                  <div
                    key={rule.id}
                    className="border-line bg-surface-muted/45 rounded-xl border p-4"
                  >
                    <p className="leading-6 font-semibold">{rule.consumerSummary}</p>
                    <dl className="mt-3 space-y-2 text-sm">
                      <div>
                        <dt className="text-ink-soft font-semibold">Eligible population</dt>
                        <dd className="mt-1 leading-6">{rule.eligibility}</dd>
                      </div>
                      <div>
                        <dt className="text-ink-soft font-semibold">Timing</dt>
                        <dd className="mt-1 leading-6">{rule.schedule}</dd>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <dt className="text-ink-soft">Class</dt>
                          <dd className="mt-1 font-semibold">{rule.recommendationClass}</dd>
                        </div>
                        <div>
                          <dt className="text-ink-soft">Evidence</dt>
                          <dd className="mt-1 font-semibold">
                            {rule.evidenceGrade ?? "Not stated"}
                          </dd>
                        </div>
                      </div>
                    </dl>
                    <p className="text-ink-soft border-line mt-3 border-t pt-3 text-xs">
                      Rule v{rule.version} · effective {dateLabel(rule.effectiveFrom)} –{" "}
                      {dateLabel(rule.effectiveTo)}
                    </p>
                  </div>
                ))}
              </div>

              {source === null ? null : (
                <Link
                  href={`/app/sources/${source.metadata.slug}`}
                  className="text-brand-strong border-line mt-4 inline-flex items-center gap-2 border-t pt-4 text-sm font-semibold underline underline-offset-4"
                >
                  <GitCompareArrows aria-hidden="true" className="size-4" />
                  Inspect {source.metadata.organization} provenance
                </Link>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
