import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  CalendarClock,
  CheckCircle2,
  ExternalLink,
  FileClock,
  GitBranch,
  History,
  Network,
  ShieldAlert,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import {
  AttributionBlock,
  CachedContentNotice,
  SourceFreshnessBadge,
  SourceMetadataPanel,
  StaleSourceWarning,
} from "@/components/sources";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { loadSourceDetail } from "@/server/read-models/source-transparency";
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

function timestampLabel(value: Date): string {
  return value.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

export default async function SourceDetailPage({
  params,
}: {
  params: Promise<{ sourceSlug: string }>;
}) {
  const { sourceSlug } = await params;
  const detail = await loadSourceDetail(sourceSlug);
  if (detail === null) notFound();

  const currentRules = detail.rules.filter((rule) => rule.current);
  const inactiveRules = detail.rules.filter((rule) => !rule.current);
  return (
    <div className="space-y-7">
      <Button variant="ghost" size="sm" asChild className="-ml-3">
        <Link href="/app/sources">
          <ArrowLeft aria-hidden="true" /> Back to sources
        </Link>
      </Button>

      <PageHeader
        eyebrow={detail.metadata.organization}
        title={detail.metadata.title}
        description="Official source metadata, every linked rule version, service coverage, source availability, and revision history."
        actions={
          <Button variant="secondary" asChild>
            <a href={detail.metadata.canonicalUrl} target="_blank" rel="noreferrer">
              Official source <ExternalLink aria-hidden="true" />
            </a>
          </Button>
        }
      />

      {detail.freshness === "review_due" ? <StaleSourceWarning /> : null}
      {detail.metadata.lifecycle === "future" ? (
        <Alert tone="info" title="Future-effective source">
          This source is registered for its stated future boundary. It does not replace a current
          baseline until a reviewed rule version becomes effective.
        </Alert>
      ) : null}
      {detail.metadata.lifecycle === "draft" ? (
        <Alert tone="warning" title="Draft source, not active logic">
          Draft guidance is visible for transparency but cannot back an active recommendation.
        </Alert>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-5">
          <SourceMetadataPanel source={detail.metadata} />
          <AttributionBlock attribution={detail.metadata.attribution} />

          <Card>
            <CardContent>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-brand text-xs font-bold tracking-[0.1em] uppercase">
                    Provenance map
                  </p>
                  <h2 className="font-editorial mt-1 text-2xl font-semibold">
                    Services using this source
                  </h2>
                </div>
                <Badge tone={currentRules.length > 0 ? "brand" : "neutral"}>
                  {currentRules.length} active {currentRules.length === 1 ? "rule" : "rules"}
                </Badge>
              </div>
              {detail.services.length === 0 ? (
                <p className="text-ink-soft mt-4 text-sm leading-6">
                  This source provides consumer enrichment and is not used as eligibility logic.
                </p>
              ) : (
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {detail.services.map((service) => (
                    <Link
                      key={service.slug}
                      href={`/app/sources/services/${service.slug}`}
                      className="border-line bg-surface-muted/50 hover:border-brand group rounded-xl border p-4 transition"
                    >
                      <p className="text-ink-soft text-xs font-bold tracking-wider uppercase">
                        {humanizeIdentifier(service.category)}
                      </p>
                      <p className="mt-1 flex items-center justify-between gap-3 font-semibold">
                        {service.name}
                        <ArrowRight
                          aria-hidden="true"
                          className="text-brand size-4 transition group-hover:translate-x-0.5"
                        />
                      </p>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <section aria-labelledby="active-rules-heading">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-brand text-xs font-bold tracking-[0.1em] uppercase">
                  Reviewed implementation
                </p>
                <h2 id="active-rules-heading" className="font-editorial text-3xl font-semibold">
                  Active rule versions
                </h2>
              </div>
              <SourceFreshnessBadge state={detail.freshness} />
            </div>
            {currentRules.length === 0 ? (
              <Card>
                <CardContent className="text-ink-soft text-sm leading-6">
                  No currently effective rule uses this source. Metadata remains inspectable, and
                  inactive or future versions appear below.
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {currentRules.map((rule) => (
                  <Card key={rule.id}>
                    <CardContent>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-ink-soft text-xs font-bold tracking-wider uppercase">
                            {rule.service.name}
                          </p>
                          <h3 className="font-editorial mt-1 text-2xl font-semibold">
                            {humanizeIdentifier(rule.variantId)}
                          </h3>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {rule.baseline ? (
                            <Badge tone="brand">Baseline</Badge>
                          ) : (
                            <Badge tone="cool">Alternative</Badge>
                          )}
                          <Badge>Rule v{rule.version}</Badge>
                          {rule.evidenceGrade === null ? null : (
                            <Badge tone="warm">{rule.evidenceGrade}</Badge>
                          )}
                        </div>
                      </div>
                      <dl className="mt-5 grid gap-4 text-sm md:grid-cols-2">
                        <div className="border-line rounded-xl border p-4">
                          <dt className="text-ink-soft font-semibold">Eligibility</dt>
                          <dd className="mt-1 leading-6">{rule.eligibility}</dd>
                        </div>
                        <div className="border-line rounded-xl border p-4">
                          <dt className="text-ink-soft font-semibold">Timing</dt>
                          <dd className="mt-1 leading-6">{rule.schedule}</dd>
                        </div>
                        <div>
                          <dt className="text-ink-soft">Effective</dt>
                          <dd className="mt-1 font-semibold">
                            {dateLabel(rule.effectiveFrom)} – {dateLabel(rule.effectiveTo)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-ink-soft">Recommendation class</dt>
                          <dd className="mt-1 font-semibold">{rule.recommendationClass}</dd>
                        </div>
                      </dl>
                      {rule.methods.length > 0 ? (
                        <div className="border-line mt-5 border-t pt-4">
                          <p className="text-ink-soft text-xs font-bold tracking-wider uppercase">
                            Accepted methods
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {rule.methods.map((method) => (
                              <Badge key={method.slug} tone="neutral">
                                {method.name}
                                {method.interval === null ? "" : ` · ${method.interval}`}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      ) : null}
                      {rule.limitations.length > 0 ? (
                        <div className="bg-surface-muted/60 mt-5 rounded-xl p-4">
                          <p className="text-xs font-bold tracking-wider uppercase">
                            Known limitations
                          </p>
                          <ul className="text-ink-soft mt-2 list-disc space-y-1.5 pl-5 text-sm leading-6">
                            {rule.limitations.map((limitation) => (
                              <li key={limitation}>{limitation}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </section>

          {inactiveRules.length > 0 ? (
            <Card>
              <CardContent>
                <div className="flex items-center gap-3">
                  <History aria-hidden="true" className="text-ink-soft size-5" />
                  <div>
                    <h2 className="font-editorial text-2xl font-semibold">Other rule versions</h2>
                    <p className="text-ink-soft mt-1 text-sm">
                      Draft, future, reviewed, or retired versions remain inspectable.
                    </p>
                  </div>
                </div>
                <div className="border-line mt-5 divide-y rounded-xl border">
                  {inactiveRules.map((rule) => (
                    <div
                      key={rule.id}
                      className="grid gap-2 p-4 sm:grid-cols-[1fr_auto] sm:items-center"
                    >
                      <div>
                        <p className="font-semibold">{rule.service.name}</p>
                        <p className="text-ink-soft mt-1 text-xs">
                          {humanizeIdentifier(rule.variantId)} · {rule.stableKey} · v{rule.version}
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
          ) : null}
        </div>

        <aside className="space-y-4">
          <Card className="border-brand/20 bg-brand-soft/50">
            <CardContent>
              <BookOpenCheck aria-hidden="true" className="text-brand size-5" />
              <h2 className="font-editorial mt-3 text-xl font-semibold">Evidence position</h2>
              <dl className="mt-4 space-y-3 text-sm">
                <div>
                  <dt className="text-ink-soft">Evidence class</dt>
                  <dd className="mt-1 font-semibold">
                    {humanizeIdentifier(detail.metadata.evidenceClass)}
                  </dd>
                </div>
                <div>
                  <dt className="text-ink-soft">Lifecycle</dt>
                  <dd className="mt-1 font-semibold">
                    {humanizeIdentifier(detail.metadata.lifecycle)}
                  </dd>
                </div>
                <div>
                  <dt className="text-ink-soft">Variant role</dt>
                  <dd className="mt-1 font-semibold">
                    {detail.rules.some((rule) => rule.baseline)
                      ? "Backs a baseline rule"
                      : detail.rules.length > 0
                        ? "Alternative or contextual"
                        : "Consumer enrichment"}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Network aria-hidden="true" className="text-sky size-5" />
              <h2 className="font-editorial mt-3 text-xl font-semibold">Availability and cache</h2>
              <p className="text-ink-soft mt-2 text-sm leading-6">
                {detail.externalAvailability === "available"
                  ? "The most recent recorded source check succeeded."
                  : detail.externalAvailability === "fallback"
                    ? "The last check used a stored source copy. Reviewed care-plan logic remained available."
                    : detail.externalAvailability === "unavailable"
                      ? "The most recent recorded source check did not succeed. Reviewed care-plan logic remained available."
                      : "No external availability check is recorded. The canonical source link remains available above."}
              </p>
              {detail.latestCheckAt === null ? null : (
                <p className="text-ink-soft mt-3 text-xs">
                  Last check {timestampLabel(detail.latestCheckAt)}
                </p>
              )}
            </CardContent>
          </Card>

          {detail.cache === null ? null : (
            <CachedContentNotice
              fetchedAt={detail.cache.fetchedAt.toISOString()}
              fallback={
                detail.externalAvailability === "fallback" ||
                detail.externalAvailability === "unavailable"
              }
              stale={!detail.cache.fresh}
            />
          )}

          <Card>
            <CardContent>
              <GitBranch aria-hidden="true" className="text-brand size-5" />
              <h2 className="font-editorial mt-3 text-xl font-semibold">Revision identity</h2>
              <p className="text-ink-soft mt-2 text-sm leading-6">
                Source version{" "}
                <span className="text-ink font-semibold">{detail.metadata.sourceVersion}</span>
              </p>
              <p className="text-ink-soft mt-2 font-mono text-xs">
                {detail.revision === null
                  ? "No content hash recorded"
                  : `Revision ${detail.revision}`}
              </p>
            </CardContent>
          </Card>

          {detail.metadata.relatedUrls.length > 0 ? (
            <Card>
              <CardContent>
                <FileClock aria-hidden="true" className="text-accent size-5" />
                <h2 className="font-editorial mt-3 text-xl font-semibold">Related notices</h2>
                <div className="mt-3 space-y-2">
                  {detail.metadata.relatedUrls.map((related) => (
                    <a
                      key={related.url}
                      href={related.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-brand-strong flex items-start gap-2 text-sm font-semibold underline underline-offset-4"
                    >
                      {related.label}{" "}
                      <ExternalLink aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
                    </a>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : null}
        </aside>
      </div>

      <section aria-labelledby="source-history-heading">
        <div className="mb-4">
          <p className="text-brand text-xs font-bold tracking-[0.1em] uppercase">
            Read-only history
          </p>
          <h2 id="source-history-heading" className="font-editorial text-3xl font-semibold">
            Recorded source checks
          </h2>
        </div>
        {detail.changes.length === 0 ? (
          <Card>
            <CardContent className="text-ink-soft flex gap-3 text-sm leading-6">
              <CalendarClock aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
              No external sync history is recorded for this source. Structural source metadata and
              reviewed rules remain available.
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0 sm:p-0">
              <ol className="divide-line divide-y">
                {detail.changes.map((change) => (
                  <li
                    key={change.id}
                    className="grid gap-3 p-4 sm:grid-cols-[auto_1fr_auto] sm:items-center sm:px-6"
                  >
                    {change.changed ? (
                      <ShieldAlert aria-hidden="true" className="text-accent size-5" />
                    ) : (
                      <CheckCircle2 aria-hidden="true" className="text-brand size-5" />
                    )}
                    <div>
                      <p className="font-semibold">
                        {change.changed ? "Revision detected for review" : "Source check recorded"}
                      </p>
                      <p className="text-ink-soft mt-1 text-xs">
                        {timestampLabel(change.finishedAt ?? change.startedAt)} ·{" "}
                        {humanizeIdentifier(change.status)}
                        {change.httpStatus === null ? "" : ` · HTTP ${change.httpStatus}`}
                      </p>
                    </div>
                    <span className="text-ink-soft font-mono text-xs">
                      {change.revision === null ? "No revision" : change.revision}
                    </span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}
