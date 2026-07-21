import {
  ArrowLeft,
  ArrowRight,
  Beaker,
  BookOpenText,
  GitCompareArrows,
  History,
  Layers3,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { SourceDate, SourceFreshnessBadge } from "@/components/sources";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { loadServiceProvenance } from "@/server/read-models/source-transparency";
import { humanizeIdentifier } from "@/server/read-models/transparency-format";

function dateLabel(value: Date | null): string {
  if (value === null) return "Open-ended";
  return value.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default async function ServiceProvenancePage({
  params,
}: {
  params: Promise<{ serviceSlug: string }>;
}) {
  const { serviceSlug } = await params;
  const detail = await loadServiceProvenance(serviceSlug);
  if (detail === null) notFound();

  const variantGroups = [
    ...new Map(
      detail.currentRules.map((rule) => [
        rule.variantId,
        detail.currentRules.filter((candidate) => candidate.variantId === rule.variantId),
      ]),
    ).entries(),
  ].map(([variantId, rules]) => ({
    variantId,
    rules,
    baseline: rules.some((rule) => rule.baseline),
    conflictGroup: rules.find((rule) => rule.conflictGroup !== null)?.conflictGroup ?? null,
    source: rules.find((rule) => rule.source !== null)?.source ?? null,
  }));

  return (
    <div className="space-y-7">
      <Button variant="ghost" size="sm" asChild className="-ml-3">
        <Link href="/app/sources">
          <ArrowLeft aria-hidden="true" /> Back to sources
        </Link>
      </Button>
      <PageHeader
        eyebrow={humanizeIdentifier(detail.service.category)}
        title={detail.service.name}
        description={detail.service.description}
      />

      <Alert tone="info" title="Variants remain separate">
        Baseline and specialty alternatives are shown side by side. Their ages, methods, and
        intervals are never blended into a new schedule. A profile can explicitly select a variant
        where a conflict group exists.
      </Alert>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent>
            <Layers3 aria-hidden="true" className="text-brand size-5" />
            <p className="text-ink-soft mt-4 text-xs font-bold tracking-wider uppercase">
              Current variants
            </p>
            <p className="font-editorial mt-1 text-4xl font-semibold">{variantGroups.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <BookOpenText aria-hidden="true" className="text-sky size-5" />
            <p className="text-ink-soft mt-4 text-xs font-bold tracking-wider uppercase">
              Rule versions
            </p>
            <p className="font-editorial mt-1 text-4xl font-semibold">
              {detail.currentRules.length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Beaker aria-hidden="true" className="text-accent size-5" />
            <p className="text-ink-soft mt-4 text-xs font-bold tracking-wider uppercase">
              Recorded methods
            </p>
            <p className="font-editorial mt-1 text-4xl font-semibold">
              {detail.methods.filter((method) => method.active).length}
            </p>
          </CardContent>
        </Card>
      </div>

      <section aria-labelledby="variants-heading">
        <div className="mb-4">
          <p className="text-brand text-xs font-bold tracking-[0.1em] uppercase">
            Source comparison
          </p>
          <h2 id="variants-heading" className="font-editorial text-3xl font-semibold">
            Active guideline variants
          </h2>
          <p className="text-ink-soft mt-2 max-w-3xl text-sm leading-6">
            “Active” means the reviewed rule is effective on {detail.asOfDate}. It does not mean
            every rule applies to every profile.
          </p>
        </div>

        {variantGroups.length === 0 ? (
          <Card>
            <CardContent className="text-ink-soft text-sm leading-6">
              No currently effective reviewed rule exists for this service. Its method catalog and
              prior rule versions remain visible below.
            </CardContent>
          </Card>
        ) : (
          <div className="grid items-start gap-4 xl:grid-cols-2">
            {variantGroups.map((group) => (
              <Card
                key={group.variantId}
                className={group.baseline ? "border-brand/35 ring-brand/10 ring-2" : undefined}
              >
                <CardContent>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap gap-2">
                        <Badge tone={group.baseline ? "brand" : "cool"}>
                          {group.baseline ? "Federal baseline" : "Alternative"}
                        </Badge>
                        {group.conflictGroup === null ? null : (
                          <Badge>{humanizeIdentifier(group.conflictGroup)}</Badge>
                        )}
                      </div>
                      <h3 className="font-editorial mt-3 text-3xl font-semibold">
                        {humanizeIdentifier(group.variantId)}
                      </h3>
                      <p className="text-ink-soft mt-1 text-sm font-semibold">
                        {group.source?.metadata.organization ?? "Registered reviewed source"}
                      </p>
                    </div>
                    {group.source === null ? null : (
                      <SourceFreshnessBadge state={group.source.freshness} />
                    )}
                  </div>

                  <div className="mt-5 space-y-3">
                    {group.rules.map((rule) => (
                      <article
                        key={rule.id}
                        className="border-line bg-surface-muted/45 rounded-xl border p-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-semibold">{rule.consumerSummary}</p>
                          <Badge>Rule v{rule.version}</Badge>
                        </div>
                        <dl className="mt-4 space-y-3 text-sm">
                          <div>
                            <dt className="text-ink-soft font-semibold">Eligible population</dt>
                            <dd className="mt-1 leading-6">{rule.eligibility}</dd>
                          </div>
                          {rule.exclusions === null ? null : (
                            <div>
                              <dt className="text-ink-soft font-semibold">Exclusions</dt>
                              <dd className="mt-1 leading-6">{rule.exclusions}</dd>
                            </div>
                          )}
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
                              <dt className="text-ink-soft">Evidence grade</dt>
                              <dd className="mt-1 font-semibold">
                                {rule.evidenceGrade ?? "Not stated"}
                              </dd>
                            </div>
                          </div>
                        </dl>
                        {rule.methods.length > 0 ? (
                          <div className="border-line mt-4 border-t pt-4">
                            <p className="text-ink-soft text-xs font-bold tracking-wider uppercase">
                              Methods
                            </p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {rule.methods.map((method) => (
                                <Badge key={method.slug}>
                                  {method.name}
                                  {method.interval === null ? "" : ` · ${method.interval}`}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </article>
                    ))}
                  </div>

                  {group.source === null ? null : (
                    <div className="border-line mt-5 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
                      <div className="text-ink-soft text-xs">
                        <p>
                          Source{" "}
                          {group.source.metadata.publishedAt === null ? (
                            "date not stated"
                          ) : (
                            <SourceDate value={group.source.metadata.publishedAt} />
                          )}
                        </p>
                        <p className="mt-1">
                          Last verified <SourceDate value={group.source.metadata.lastVerifiedAt} />
                        </p>
                      </div>
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/app/sources/${group.source.metadata.slug}`}>
                          Source detail <ArrowRight aria-hidden="true" />
                        </Link>
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Card>
          <CardContent>
            <div className="flex items-center gap-3">
              <Beaker aria-hidden="true" className="text-brand size-5" />
              <div>
                <h2 className="font-editorial text-2xl font-semibold">Service method catalog</h2>
                <p className="text-ink-soft mt-1 text-sm">
                  The completed method can control future timing when the reviewed rule says so.
                </p>
              </div>
            </div>
            {detail.methods.length === 0 ? (
              <p className="text-ink-soft mt-5 text-sm">
                This service is a discussion or review without a recorded test method.
              </p>
            ) : (
              <div className="border-line mt-5 divide-y rounded-xl border">
                {detail.methods.map((method) => (
                  <div
                    key={method.slug}
                    className="grid gap-2 p-4 sm:grid-cols-[12rem_1fr_auto] sm:items-start"
                  >
                    <p className="font-semibold">{method.name}</p>
                    <p className="text-ink-soft text-sm leading-6">{method.description}</p>
                    <Badge tone={method.active ? "brand" : "neutral"}>
                      {method.active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardContent>
            <GitCompareArrows aria-hidden="true" className="text-sky size-5" />
            <h2 className="font-editorial mt-3 text-xl font-semibold">How to read this page</h2>
            <ul className="text-ink-soft mt-3 space-y-3 text-sm leading-6">
              <li>Baseline marks the default reviewed federal variant for a conflict group.</li>
              <li>Alternative sources stay visible without being blended into the baseline.</li>
              <li>Rule versions are immutable snapshots with explicit effective dates.</li>
            </ul>
          </CardContent>
        </Card>
      </section>

      {detail.inactiveRules.length > 0 ? (
        <section aria-labelledby="retired-rules-heading">
          <div className="mb-4 flex items-center gap-3">
            <History aria-hidden="true" className="text-ink-soft size-5" />
            <div>
              <p className="text-ink-soft text-xs font-bold tracking-[0.1em] uppercase">
                Version archive
              </p>
              <h2 id="retired-rules-heading" className="font-editorial text-3xl font-semibold">
                Inactive and retired rules
              </h2>
            </div>
          </div>
          <Card>
            <CardContent className="p-0 sm:p-0">
              <div className="divide-line divide-y">
                {detail.inactiveRules.map((rule) => (
                  <div
                    key={rule.id}
                    className="grid gap-3 p-4 sm:grid-cols-[1fr_auto] sm:items-center sm:px-6"
                  >
                    <div>
                      <p className="font-semibold">
                        {humanizeIdentifier(rule.variantId)} · {rule.stableKey} v{rule.version}
                      </p>
                      <p className="text-ink-soft mt-1 text-sm">
                        {rule.source?.metadata.organization ?? "Registered source"} ·{" "}
                        {rule.schedule}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge>{humanizeIdentifier(rule.reviewStatus)}</Badge>
                      <Badge>{dateLabel(rule.effectiveFrom)}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>
      ) : null}
    </div>
  );
}
