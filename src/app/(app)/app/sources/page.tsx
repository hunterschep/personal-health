import {
  ArrowRight,
  BookOpenText,
  Filter,
  GitCompareArrows,
  Library,
  Search,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { SourceDate, SourceFreshnessBadge } from "@/components/sources";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Select } from "@/components/ui/form";
import {
  filterSourceCenterRows,
  loadSourceCenter,
  type SourceCenterFilters,
} from "@/server/read-models/source-transparency";
import { humanizeIdentifier } from "@/server/read-models/transparency-format";

function summaryCard(label: string, value: number, detail: string) {
  return (
    <Card>
      <CardContent>
        <p className="text-ink-soft text-xs font-bold tracking-[0.1em] uppercase">{label}</p>
        <p className="font-editorial mt-2 text-4xl font-semibold">{value}</p>
        <p className="text-ink-soft mt-1 text-xs leading-5">{detail}</p>
      </CardContent>
    </Card>
  );
}

export default async function SourcesPage({
  searchParams,
}: {
  searchParams: Promise<SourceCenterFilters>;
}) {
  const filters = await searchParams;
  const inventory = await loadSourceCenter();
  const rows = filterSourceCenterRows(inventory.rows, filters);
  const activeRules = inventory.rows.reduce((total, row) => total + row.activeRuleCount, 0);
  const reviewDue = inventory.rows.filter((row) => row.freshness === "review_due").length;

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Evidence register"
        title="Sources"
        description="Inspect the organizations, dated guidance, reviewed rule versions, and services behind the care plan. Conflicting sources remain separate."
        actions={
          <Button variant="secondary" asChild>
            <Link href="/app/sources/changes">
              <GitCompareArrows aria-hidden="true" /> Source activity
            </Link>
          </Button>
        }
      />

      <Alert tone="info" title="A source and a rule are different things">
        Official guidance provides the evidence. CareCadence uses a reviewed, versioned rule to turn
        that guidance into deterministic organizer timing. A source revision never silently changes
        an active care plan.
      </Alert>

      <section
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
        aria-label="Source inventory summary"
      >
        {summaryCard(
          "Registered sources",
          inventory.rows.length,
          "Current, future, draft, and retired metadata",
        )}
        {summaryCard("Active reviewed rules", activeRules, `Evaluated as of ${inventory.asOfDate}`)}
        {summaryCard(
          "Current reviews",
          inventory.rows.filter((row) => row.freshness === "current").length,
          "Within the source-class review window",
        )}
        {summaryCard("Review due", reviewDue, "Rules continue from their last reviewed versions")}
      </section>

      <form className="rounded-card border-line bg-surface grid gap-3 border p-4 md:grid-cols-2 xl:grid-cols-4">
        <label className="relative md:col-span-2">
          <span className="sr-only">Search sources</span>
          <Search
            aria-hidden="true"
            className="text-ink-soft absolute top-1/2 left-3.5 size-4 -translate-y-1/2"
          />
          <Input
            name="query"
            defaultValue={filters.query}
            placeholder="Search sources or services"
            className="pl-10"
          />
        </label>
        <label>
          <span className="sr-only">Organization</span>
          <Select name="organization" defaultValue={filters.organization ?? "all"}>
            <option value="all">All organizations</option>
            {inventory.organizations.map((organization) => (
              <option key={organization} value={organization}>
                {organization}
              </option>
            ))}
          </Select>
        </label>
        <label>
          <span className="sr-only">Service category</span>
          <Select name="category" defaultValue={filters.category ?? "all"}>
            <option value="all">All service categories</option>
            {inventory.categories.map((category) => (
              <option key={category} value={category}>
                {humanizeIdentifier(category)}
              </option>
            ))}
          </Select>
        </label>
        <label>
          <span className="sr-only">Freshness</span>
          <Select name="freshness" defaultValue={filters.freshness ?? "all"}>
            <option value="all">All review states</option>
            <option value="current">Review current</option>
            <option value="review_due">Review due</option>
            <option value="future">Future effective</option>
            <option value="inactive">Inactive</option>
          </Select>
        </label>
        <label>
          <span className="sr-only">Evidence class</span>
          <Select name="evidence" defaultValue={filters.evidence ?? "all"}>
            <option value="all">All evidence classes</option>
            {inventory.evidenceClasses.map((evidenceClass) => (
              <option key={evidenceClass} value={evidenceClass}>
                {humanizeIdentifier(evidenceClass)}
              </option>
            ))}
          </Select>
        </label>
        <label>
          <span className="sr-only">Variant role</span>
          <Select name="variant" defaultValue={filters.variant ?? "all"}>
            <option value="all">Baseline and alternatives</option>
            <option value="baseline">Federal baseline sources</option>
            <option value="alternative">Alternative variant sources</option>
          </Select>
        </label>
        <label>
          <span className="sr-only">Source activity</span>
          <Select name="activity" defaultValue={filters.activity ?? "all"}>
            <option value="all">Active and inactive</option>
            <option value="active">Active sources</option>
            <option value="retired">Inactive or retired rules</option>
          </Select>
        </label>
        <div className="flex gap-2 md:col-span-2 xl:col-span-4 xl:justify-end">
          <Button variant="ghost" asChild>
            <Link href="/app/sources">Clear</Link>
          </Button>
          <Button variant="secondary" type="submit">
            <Filter aria-hidden="true" /> Apply filters
          </Button>
        </div>
      </form>

      <section aria-labelledby="source-results-heading">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-brand text-xs font-bold tracking-[0.1em] uppercase">
              Source register
            </p>
            <h2 id="source-results-heading" className="font-editorial text-3xl font-semibold">
              {rows.length} {rows.length === 1 ? "source" : "sources"}
            </h2>
          </div>
          <p className="text-ink-soft max-w-xl text-sm">
            “Review due” is a maintenance reminder, not a judgment that the source is invalid.
          </p>
        </div>

        {rows.length === 0 ? (
          <EmptyState
            icon={Search}
            title="No sources match these filters"
            description="Clear one or more filters to return to the full reviewed source register."
          />
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {rows.map((row) => {
              const sourceDate = row.metadata.effectiveAt ?? row.metadata.publishedAt;
              return (
                <Card key={row.metadata.slug} className="group overflow-hidden">
                  <CardContent className="flex h-full flex-col">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-brand text-xs font-bold tracking-[0.08em] uppercase">
                          {row.metadata.organization}
                        </p>
                        <h3 className="font-editorial mt-2 text-2xl leading-tight font-semibold">
                          <Link
                            href={`/app/sources/${row.metadata.slug}`}
                            className="decoration-brand/30 hover:decoration-brand underline-offset-4 hover:underline"
                          >
                            {row.metadata.title}
                          </Link>
                        </h3>
                      </div>
                      <SourceFreshnessBadge state={row.freshness} />
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <Badge>{humanizeIdentifier(row.metadata.sourceType)}</Badge>
                      <Badge tone={row.metadata.lifecycle === "future" ? "cool" : "neutral"}>
                        {humanizeIdentifier(row.metadata.evidenceClass)}
                      </Badge>
                      {row.hasBaseline ? <Badge tone="brand">Baseline</Badge> : null}
                      {row.hasAlternative ? <Badge tone="cool">Alternative</Badge> : null}
                      {row.metadata.attribution.required ? (
                        <Badge tone="warm">Attribution required</Badge>
                      ) : null}
                    </div>

                    <dl className="border-line mt-5 grid grid-cols-2 gap-4 border-y py-4 text-sm sm:grid-cols-3">
                      <div>
                        <dt className="text-ink-soft">Active rules</dt>
                        <dd className="mt-1 font-semibold">{row.activeRuleCount}</dd>
                      </div>
                      <div>
                        <dt className="text-ink-soft">Source date</dt>
                        <dd className="mt-1 font-semibold">
                          {sourceDate === null ? "Not stated" : <SourceDate value={sourceDate} />}
                        </dd>
                      </div>
                      <div className="col-span-2 sm:col-span-1">
                        <dt className="text-ink-soft">Last verified</dt>
                        <dd className="mt-1 font-semibold">
                          <SourceDate value={row.metadata.lastVerifiedAt} />
                        </dd>
                      </div>
                    </dl>

                    <div className="mt-4 flex-1">
                      <p className="text-ink-soft text-xs font-bold tracking-[0.08em] uppercase">
                        Used by
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {row.services.length === 0 ? (
                          <span className="text-ink-soft text-sm">Consumer enrichment only</span>
                        ) : (
                          row.services.slice(0, 4).map((service) => (
                            <Link
                              key={service.slug}
                              href={`/app/sources/services/${service.slug}`}
                              className="border-line bg-surface-muted hover:border-brand rounded-full border px-3 py-1.5 text-xs font-semibold transition"
                            >
                              {service.name}
                            </Link>
                          ))
                        )}
                        {row.services.length > 4 ? (
                          <span className="text-ink-soft px-2 py-1.5 text-xs font-semibold">
                            +{row.services.length - 4} more
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-5 flex items-center justify-between gap-3">
                      <span className="text-ink-soft inline-flex items-center gap-2 text-xs">
                        {row.metadata.active ? (
                          <ShieldCheck aria-hidden="true" className="text-brand size-4" />
                        ) : (
                          <BookOpenText aria-hidden="true" className="size-4" />
                        )}
                        {row.metadata.active ? "Available to reviewed rules" : "Inspect only"}
                      </span>
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/app/sources/${row.metadata.slug}`}>
                          Inspect <ArrowRight aria-hidden="true" />
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <div className="border-line bg-surface-muted/50 flex items-start gap-3 rounded-xl border p-4 text-sm">
        <Library aria-hidden="true" className="text-brand mt-0.5 size-5 shrink-0" />
        <p className="text-ink-soft leading-6">
          The register shows metadata and reviewed rule links. It does not copy full guideline text,
          and it never sends profile facts to a source website.
        </p>
      </div>
    </div>
  );
}
