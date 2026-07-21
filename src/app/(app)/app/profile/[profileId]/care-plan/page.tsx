import { CircleHelp, Filter, Printer, Search, Sparkles } from "lucide-react";
import Link from "next/link";
import {
  CarePlanViewSelect,
  PrintCarePlanButton,
  type CarePlanView,
} from "@/components/care-plan/care-plan-view-controls";
import {
  RecommendationCard,
  type RecommendationCardData,
} from "@/components/care-plan/recommendation-card";
import { PageHeader } from "@/components/shared/page-header";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Select } from "@/components/ui/form";
import { StatusBadge } from "@/components/ui/status-badge";
import type { RecommendationStatus } from "@/contracts";
import { loadProfileCarePlan } from "@/server/read-models";
import { filterCarePlanRecommendations } from "@/server/read-models/care-plan-filters";

const sections: Array<{
  id: string;
  eyebrow: string;
  title: string;
  tone: string;
  statuses: RecommendationStatus[];
}> = [
  {
    id: "attention",
    eyebrow: "Start here",
    title: "Needs attention",
    tone: "text-accent",
    statuses: ["overdue", "due_now", "needs_date_confirmation"],
  },
  {
    id: "this-year",
    eyebrow: "Organize",
    title: "Recommended this year",
    tone: "text-sky",
    statuses: ["due_soon", "due_this_year"],
  },
  {
    id: "unknown",
    eyebrow: "Improve the plan",
    title: "Unknown history",
    tone: "text-ink-soft",
    statuses: ["unknown_history"],
  },
  {
    id: "discussion",
    eyebrow: "Use judgment",
    title: "Discuss with a clinician",
    tone: "text-sky",
    statuses: ["discuss_with_clinician", "clinician_managed", "not_routinely_recommended"],
  },
  {
    id: "current",
    eyebrow: "On track",
    title: "Up to date and complete",
    tone: "text-brand",
    statuses: ["up_to_date", "completed_once"],
  },
  {
    id: "coming",
    eyebrow: "Looking ahead",
    title: "Coming up",
    tone: "text-brand",
    statuses: ["future"],
  },
  {
    id: "not-applicable",
    eyebrow: "Reference",
    title: "Not applicable",
    tone: "text-ink-soft",
    statuses: ["not_applicable"],
  },
];

type CarePlanItem = Awaited<ReturnType<typeof loadProfileCarePlan>>["recommendations"][number];

function CompactCarePlan({ profileId, items }: { profileId: string; items: CarePlanItem[] }) {
  return (
    <Card>
      <CardContent className="p-0">
        <ul className="divide-line divide-y" aria-label="Compact care plan">
          {items.map((item) => (
            <li
              key={item.id}
              className="grid gap-3 p-4 sm:grid-cols-[minmax(12rem,1fr)_auto_auto] sm:items-center"
            >
              <div className="min-w-0">
                <p className="font-semibold">{item.service}</p>
                <p className="text-ink-soft mt-1 truncate text-xs">
                  {item.category} · {item.sourceOrganization}
                </p>
              </div>
              <div className="sm:text-right">
                <StatusBadge status={item.status} />
                <p className="text-ink-soft mt-1 text-xs">{item.timing}</p>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/app/profile/${profileId}/care-plan/${item.id}`}>Details</Link>
              </Button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function SourceComparison({ profileId, items }: { profileId: string; items: CarePlanItem[] }) {
  const bySource = new Map<string, CarePlanItem[]>();
  for (const item of items) {
    bySource.set(item.sourceOrganization, [...(bySource.get(item.sourceOrganization) ?? []), item]);
  }
  return (
    <div className="grid gap-4 xl:grid-cols-2" aria-label="Care plan by source organization">
      {[...bySource.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([source, sourceItems]) => (
          <Card key={source}>
            <CardContent>
              <p className="text-sky text-xs font-bold tracking-wider uppercase">Source</p>
              <h2 className="font-editorial mt-1 text-2xl font-semibold">{source}</h2>
              <ul className="divide-line mt-4 divide-y">
                {sourceItems.map((item) => (
                  <li
                    key={item.id}
                    className="grid gap-2 py-3 first:pt-0 last:pb-0 sm:grid-cols-[1fr_auto]"
                  >
                    <div>
                      <Link
                        href={`/app/profile/${profileId}/care-plan/${item.id}`}
                        className="font-semibold hover:underline"
                      >
                        {item.service}
                      </Link>
                      <p className="text-ink-soft mt-1 text-xs">
                        {item.recommendationClass.replaceAll("-", " ")} · {item.timing}
                      </p>
                    </div>
                    <StatusBadge status={item.status} />
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
    </div>
  );
}

function PrintSummary({ profileName, items }: { profileName: string; items: CarePlanItem[] }) {
  return (
    <section aria-labelledby="print-summary-heading">
      <div className="mb-4 flex items-center justify-between gap-3 print:hidden">
        <div>
          <p className="text-brand text-xs font-bold tracking-wider uppercase">Print view</p>
          <h2 id="print-summary-heading" className="font-editorial text-3xl font-semibold">
            Concise care-plan summary
          </h2>
        </div>
        <PrintCarePlanButton />
      </div>
      <div className="border-line bg-surface rounded-card border p-5">
        <h2 className="font-editorial text-2xl font-semibold">{profileName}&apos;s care plan</h2>
        <p className="text-ink-soft mt-1 text-xs">
          Organizer summary. Source-backed status and uncertainty are preserved.
        </p>
        <ol className="divide-line mt-5 divide-y">
          {items.map((item) => (
            <li key={item.id} className="grid gap-2 py-3 first:pt-0 sm:grid-cols-[1fr_auto]">
              <div>
                <p className="font-semibold">{item.service}</p>
                <p className="text-ink-soft mt-1 text-xs">
                  {item.category} · {item.source} · {item.history}
                </p>
              </div>
              <div className="sm:text-right">
                <StatusBadge status={item.status} />
                <p className="text-ink-soft mt-1 text-xs">{item.timing}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export default async function CarePlanPage({
  params,
  searchParams,
}: {
  params: Promise<{ profileId: string }>;
  searchParams: Promise<{
    query?: string;
    status?: string;
    category?: string;
    year?: string;
    recommendationClass?: string;
    source?: string;
    planned?: string;
    history?: string;
    view?: string;
  }>;
}) {
  const { profileId } = await params;
  const filters = await searchParams;
  const { profile, recommendations, capabilities, viewerUserId } =
    await loadProfileCarePlan(profileId);
  const filtered = filterCarePlanRecommendations(recommendations, filters);
  const view: CarePlanView = ["compact", "source", "print"].includes(filters.view ?? "")
    ? (filters.view as CarePlanView)
    : "grouped";
  const categories = [...new Set(recommendations.map(({ categoryKey }) => categoryKey))].sort();
  const years = [
    ...new Set(
      recommendations.flatMap(({ dueStart }) =>
        dueStart === null ? [] : [dueStart.getUTCFullYear()],
      ),
    ),
  ].sort();
  const classes = [
    ...new Set(recommendations.map(({ recommendationClass }) => recommendationClass)),
  ].sort();
  const sources = [
    ...new Set(recommendations.map(({ sourceOrganization }) => sourceOrganization)),
  ].sort();
  const queryString = new URLSearchParams(
    Object.entries(filters).flatMap(([key, value]) =>
      value === undefined ? [] : [[key, value] as [string, string]],
    ),
  ).toString();

  return (
    <div className="space-y-7">
      <div className="no-print">
        <PageHeader
          eyebrow="Personalized plan"
          title={`${profile.displayName}'s care plan`}
          description="Routine actions, uncertain history, personal clinician instructions, and discussion items stay distinct."
          actions={
            <>
              <Button variant="secondary" asChild>
                <Link href={`/app/profile/${profile.id}/maintenance`}>
                  <Sparkles aria-hidden="true" /> Custom maintenance
                </Link>
              </Button>
              <Button variant="secondary" asChild>
                <Link href={`/app/profile/${profile.id}/care-plan?view=print`}>
                  <Printer aria-hidden="true" /> Print summary
                </Link>
              </Button>
            </>
          }
        />
      </div>

      <div className="no-print">
        <Alert tone="info" title="Guidance can differ">
          Reputable organizations sometimes recommend different starting ages, intervals, or
          methods. A selected variant changes how CareCadence organizes this plan; it does not
          replace a decision with a clinician.
        </Alert>
      </div>

      <form className="no-print rounded-card border-line bg-surface space-y-3 border p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(14rem,1fr)_repeat(3,minmax(10rem,.35fr))_auto]">
          <label className="relative">
            <span className="sr-only">Search care plan by service</span>
            <Search
              aria-hidden="true"
              className="text-ink-soft absolute top-1/2 left-3.5 size-4 -translate-y-1/2"
            />
            <Input
              name="query"
              defaultValue={filters.query}
              placeholder="Search services"
              className="pl-10"
            />
          </label>
          <label>
            <span className="sr-only">Filter by status</span>
            <Select name="status" defaultValue={filters.status ?? "all"}>
              <option value="all">All statuses</option>
              <option value="attention">Needs attention</option>
              <option value="this-year">This year</option>
              <option value="unknown">Unknown history</option>
              <option value="discussion">Discussion</option>
              <option value="current">Up to date</option>
              <option value="coming">Coming up</option>
              <option value="not-applicable">Not applicable</option>
            </Select>
          </label>
          <label>
            <span className="sr-only">Filter by category</span>
            <Select name="category" defaultValue={filters.category ?? "all"}>
              <option value="all">All categories</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category.replaceAll("_", " ")}
                </option>
              ))}
            </Select>
          </label>
          <CarePlanViewSelect
            value={view}
            preferenceKey={`care-plan-view:${viewerUserId}`}
            explicit={filters.view !== undefined}
            queryString={queryString}
          />
          <Button variant="secondary" type="submit">
            <Filter aria-hidden="true" /> Apply
          </Button>
        </div>
        <details className="border-line border-t pt-3">
          <summary className="text-ink-soft cursor-pointer text-sm font-semibold">
            More filters
          </summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <Select
              name="year"
              aria-label="Filter by due year"
              defaultValue={filters.year ?? "all"}
            >
              <option value="all">All due years</option>
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
              <option value="unknown">Timing unknown</option>
            </Select>
            <Select
              name="recommendationClass"
              aria-label="Filter by recommendation class"
              defaultValue={filters.recommendationClass ?? "all"}
            >
              <option value="all">All recommendation classes</option>
              {classes.map((recommendationClass) => (
                <option key={recommendationClass} value={recommendationClass}>
                  {recommendationClass.replaceAll("-", " ")}
                </option>
              ))}
            </Select>
            <Select
              name="source"
              aria-label="Filter by source"
              defaultValue={filters.source ?? "all"}
            >
              <option value="all">All source organizations</option>
              {sources.map((source) => (
                <option key={source} value={source}>
                  {source}
                </option>
              ))}
            </Select>
            <Select
              name="planned"
              aria-label="Filter by plan state"
              defaultValue={filters.planned ?? "all"}
            >
              <option value="all">Planned and unplanned</option>
              <option value="planned">Planned only</option>
              <option value="unplanned">Unplanned only</option>
            </Select>
            <Select
              name="history"
              aria-label="Filter by history state"
              defaultValue={filters.history ?? "all"}
            >
              <option value="all">Known and unknown history</option>
              <option value="known">With known history</option>
              <option value="unknown">Without known history</option>
            </Select>
          </div>
        </details>
      </form>

      {recommendations.length === 0 ? (
        <EmptyState
          icon={CircleHelp}
          title="The plan is ready for reviewed rules"
          description="No active source-backed rules are available for this profile yet. An operator can seed or activate the reviewed rule catalog without changing profile history."
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No matching care-plan items"
          description="Clear one or more filters to see the full plan."
        />
      ) : view === "compact" ? (
        <CompactCarePlan profileId={profile.id} items={filtered} />
      ) : view === "source" ? (
        <SourceComparison profileId={profile.id} items={filtered} />
      ) : view === "print" ? (
        <PrintSummary profileName={profile.displayName} items={filtered} />
      ) : (
        sections.map((section) => {
          const items = filtered.filter(({ status }) => section.statuses.includes(status));
          if (items.length === 0) return null;
          return (
            <section key={section.id} aria-labelledby={`${section.id}-heading`}>
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className={`text-xs font-bold tracking-[0.1em] uppercase ${section.tone}`}>
                    {section.eyebrow}
                  </p>
                  <h2
                    id={`${section.id}-heading`}
                    className="font-editorial text-3xl font-semibold"
                  >
                    {section.title}
                  </h2>
                </div>
                <p className="text-ink-soft text-sm">
                  {items.length} {items.length === 1 ? "item" : "items"}
                </p>
              </div>
              <div className="space-y-3">
                {items.map((recommendation) => (
                  <RecommendationCard
                    key={recommendation.id}
                    profileId={profile.id}
                    recommendation={recommendation as RecommendationCardData}
                    editable={capabilities.canEdit}
                  />
                ))}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}
