import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  CalendarCheck,
  CalendarClock,
  CalendarPlus,
  CheckCircle2,
  CircleHelp,
  FileClock,
  FilePlus2,
  Filter,
  GitCommitVertical,
  GitCompareArrows,
  History,
  Repeat2,
  Stethoscope,
} from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Select } from "@/components/ui/form";
import {
  filterTimelineEntries,
  loadProfileTimeline,
  type TimelineEntryKind,
  type TimelineFilters,
} from "@/server/read-models/timeline";
import { humanizeIdentifier } from "@/server/read-models/transparency-format";

const kindMetadata: Record<
  TimelineEntryKind,
  { icon: LucideIcon; label: string; tone: "brand" | "warm" | "cool" | "neutral" }
> = {
  care_event: { icon: CalendarCheck, label: "Care record", tone: "brand" },
  recommendation: { icon: CalendarClock, label: "Care-plan state", tone: "warm" },
  planned_action: { icon: CalendarPlus, label: "Planned action", tone: "cool" },
  appointment: { icon: Stethoscope, label: "Appointment", tone: "cool" },
  clinician_override: { icon: Stethoscope, label: "Clinician instruction", tone: "cool" },
  guideline_selection: { icon: GitCompareArrows, label: "Variant selection", tone: "cool" },
  rule_update: { icon: GitCommitVertical, label: "Guideline update", tone: "neutral" },
  milestone: { icon: FileClock, label: "Future milestone", tone: "warm" },
  custom_maintenance: { icon: Repeat2, label: "Personal cadence", tone: "cool" },
  document: { icon: FilePlus2, label: "Document", tone: "neutral" },
  history: { icon: History, label: "History clarified", tone: "brand" },
};

const toneClasses = {
  brand: "bg-brand-soft text-brand",
  warm: "bg-accent-soft text-accent",
  cool: "bg-sky-soft text-sky",
  neutral: "bg-surface-muted text-ink-soft",
} as const;

export default async function TimelinePage({
  params,
  searchParams,
}: {
  params: Promise<{ profileId: string }>;
  searchParams: Promise<TimelineFilters>;
}) {
  const { profileId } = await params;
  const filters = await searchParams;
  const timeline = await loadProfileTimeline(profileId);
  const entries = filterTimelineEntries(timeline.entries, filters, timeline.asOfDate);
  const currentCount = timeline.entries.filter((entry) => entry.current).length;
  const futureCount = timeline.entries.filter((entry) => entry.future).length;
  const approximateCount = timeline.entries.filter((entry) => entry.approximate).length;

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Past, present, and future"
        title={`${timeline.profile.displayName}'s timeline`}
        description="Recorded care, plan calculations, personal instructions, source updates, and future age or personal-cadence milestones in one authorized longitudinal view."
      />

      <section className="grid gap-3 sm:grid-cols-3" aria-label="Timeline summary">
        <Card>
          <CardContent>
            <CheckCircle2 aria-hidden="true" className="text-brand size-5" />
            <p className="text-ink-soft mt-4 text-xs font-bold tracking-wider uppercase">
              Recorded entries
            </p>
            <p className="font-editorial mt-1 text-4xl font-semibold">{timeline.entries.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <CalendarClock aria-hidden="true" className="text-accent size-5" />
            <p className="text-ink-soft mt-4 text-xs font-bold tracking-wider uppercase">
              Current plan states
            </p>
            <p className="font-editorial mt-1 text-4xl font-semibold">{currentCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <FileClock aria-hidden="true" className="text-sky size-5" />
            <p className="text-ink-soft mt-4 text-xs font-bold tracking-wider uppercase">
              Future entries
            </p>
            <p className="font-editorial mt-1 text-4xl font-semibold">{futureCount}</p>
          </CardContent>
        </Card>
      </section>

      <form className="rounded-card border-line bg-surface grid gap-3 border p-4 md:grid-cols-3 xl:grid-cols-[1fr_1fr_1fr_auto_auto]">
        <label>
          <span className="sr-only">Timeline period</span>
          <Select name="period" defaultValue={filters.period ?? "all"}>
            <option value="all">Entire timeline</option>
            <option value="past-five">Past 5 years</option>
            <option value="current">Current year</option>
            <option value="future-five">Next 5 years</option>
          </Select>
        </label>
        <label>
          <span className="sr-only">Timeline entry type</span>
          <Select name="type" defaultValue={filters.type ?? "all"}>
            <option value="all">All entry types</option>
            {Object.entries(kindMetadata).map(([kind, metadata]) => (
              <option key={kind} value={kind}>
                {metadata.label}
              </option>
            ))}
          </Select>
        </label>
        <label>
          <span className="sr-only">Timeline category</span>
          <Select name="category" defaultValue={filters.category ?? "all"}>
            <option value="all">All service categories</option>
            {timeline.categories.map((category) => (
              <option key={category} value={category}>
                {humanizeIdentifier(category)}
              </option>
            ))}
          </Select>
        </label>
        <Button variant="ghost" asChild>
          <Link href={`/app/profile/${timeline.profile.id}/timeline`}>Clear</Link>
        </Button>
        <Button variant="secondary" type="submit">
          <Filter aria-hidden="true" /> Apply
        </Button>
      </form>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_21rem]">
        {entries.length === 0 ? (
          <EmptyState
            icon={CircleHelp}
            title={
              timeline.entries.length === 0
                ? "No timeline entries yet"
                : "No entries match these filters"
            }
            description={
              timeline.entries.length === 0
                ? "Care records, plans, source versions, and future milestones will appear here as this profile is organized."
                : "Clear one or more filters to return to the full longitudinal view."
            }
          />
        ) : (
          <Card>
            <CardContent className="sm:p-8">
              <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-brand text-xs font-bold tracking-[0.1em] uppercase">
                    Chronological record
                  </p>
                  <h2 className="font-editorial text-3xl font-semibold">
                    {entries.length} {entries.length === 1 ? "entry" : "entries"}
                  </h2>
                </div>
                <p className="text-ink-soft max-w-md text-xs leading-5">
                  Approximate dates retain their recorded precision. Unknown medical dates are
                  positioned by when the record was added and labeled as unknown.
                </p>
              </div>
              <ol className="border-line relative ml-4 border-l sm:ml-20">
                {entries.map((item) => {
                  const metadata = kindMetadata[item.kind];
                  const Icon = metadata.icon;
                  return (
                    <li key={item.id} className="relative pb-9 pl-8 last:pb-0 sm:pl-12">
                      <span
                        className={`border-surface absolute top-0 -left-[1.15rem] grid size-9 place-items-center rounded-full border-4 ${toneClasses[metadata.tone]}`}
                      >
                        <Icon aria-hidden="true" className="size-4" />
                      </span>
                      <div className="sm:grid sm:grid-cols-[6.5rem_1fr] sm:gap-5">
                        <div className="mb-2 sm:-ml-[11rem] sm:text-right">
                          <p className="font-editorial text-lg font-semibold">{item.yearLabel}</p>
                          <p className="text-ink-soft text-xs">{item.dateLabel}</p>
                          {item.approximate ? (
                            <span className="sr-only">
                              Date precision is {humanizeIdentifier(item.precision)}.
                            </span>
                          ) : null}
                        </div>
                        <article className="border-line bg-surface-muted/40 rounded-xl border p-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-semibold">{item.title}</h3>
                            <Badge tone={metadata.tone}>{metadata.label}</Badge>
                            {item.current ? <Badge tone="warm">Current plan</Badge> : null}
                            {item.approximate ? <Badge>Approximate date</Badge> : null}
                            {item.future && !item.current ? (
                              <Badge tone="cool">Future</Badge>
                            ) : null}
                          </div>
                          <p className="text-ink-soft mt-2 text-sm leading-6">{item.description}</p>
                          {item.href === null ? null : (
                            <Button variant="ghost" size="sm" asChild className="mt-2 -ml-3">
                              <Link href={item.href}>
                                View details <ArrowRight aria-hidden="true" />
                              </Link>
                            </Button>
                          )}
                        </article>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </CardContent>
          </Card>
        )}

        <aside className="space-y-4">
          <Card className="border-accent/25 bg-accent-soft/60">
            <CardContent>
              <CalendarClock aria-hidden="true" className="text-accent size-5" />
              <h2 className="font-editorial mt-3 text-xl font-semibold">Next milestone</h2>
              {timeline.nextMilestone === null ? (
                <p className="text-ink-soft mt-2 text-sm leading-6">
                  No future age, clinician-review, or personal-cadence milestone is generated from
                  the current plan.
                </p>
              ) : (
                <>
                  <p className="mt-1 text-sm font-semibold">{timeline.nextMilestone.title}</p>
                  <p className="text-ink-soft mt-1 text-xs">{timeline.nextMilestone.dateLabel}</p>
                  <p className="text-ink-soft mt-2 text-sm leading-6">
                    {timeline.nextMilestone.description}
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <History aria-hidden="true" className="text-brand size-5" />
              <h2 className="font-editorial mt-3 text-xl font-semibold">Dates stay honest</h2>
              <p className="text-ink-soft mt-2 text-sm leading-6">
                {approximateCount} {approximateCount === 1 ? "entry preserves" : "entries preserve"}{" "}
                month-only, year-only, ranged, or unknown timing instead of guessing an exact day.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <GitCommitVertical aria-hidden="true" className="text-sky size-5" />
              <h2 className="font-editorial mt-3 text-xl font-semibold">Guidance history</h2>
              <p className="text-ink-soft mt-2 text-sm leading-6">
                Rule updates show the effective version and source organization, without exposing
                reviewer credentials or implementation diagnostics.
              </p>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
