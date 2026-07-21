import { FileUp, Filter, History, ListPlus, Plus, Search, Sparkles } from "lucide-react";
import Link from "next/link";
import { dateInTimeZone } from "@/domain/dates";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Select } from "@/components/ui/form";
import { displayDateRange, loadProfileRecords } from "@/server/read-models";
import { filterProfileRecords } from "@/server/read-models/record-filters";

const precisionLabels = {
  day: "Exact date",
  month: "Month and year",
  year: "Year only",
  unknown: "Date unknown",
} as const;

const sourceLabels = {
  user_memory: "User memory",
  medical_record: "Medical record",
  clinician: "Clinician",
  pharmacy: "Pharmacy",
  csv_import: "CSV import",
} as const;

function eventDate(event: {
  performedStart: Date | null;
  performedEnd: Date | null;
  datePrecision: keyof typeof precisionLabels;
}) {
  if (event.datePrecision === "unknown") return "Date unknown";
  if (event.datePrecision === "year")
    return String(event.performedStart?.getUTCFullYear() ?? "Unknown");
  if (event.datePrecision === "month" && event.performedStart !== null) {
    return new Intl.DateTimeFormat("en-US", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(event.performedStart);
  }
  return displayDateRange(event.performedStart, event.performedEnd);
}

export default async function RecordsPage({
  params,
  searchParams,
}: {
  params: Promise<{ profileId: string }>;
  searchParams: Promise<{ query?: string; year?: string; state?: string; category?: string }>;
}) {
  const { profileId } = await params;
  const filters = await searchParams;
  const { profile, records, capabilities } = await loadProfileRecords(profileId);
  const currentYear = Number(dateInTimeZone(new Date(), profile.timezone).slice(0, 4));
  const visibleRecords = filterProfileRecords(records, filters, currentYear);
  const categories = [...new Set(records.map(({ service }) => service.category))].sort();

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Longitudinal history"
        title={`${profile.displayName}'s records`}
        description="Keep exact dates exact and approximate history honest. Every relevant change recalculates the care plan."
        actions={
          capabilities.canEdit ? (
            <>
              <Button variant="secondary" asChild>
                <Link href={`/app/profile/${profile.id}/records/import`}>
                  <FileUp aria-hidden="true" /> Import CSV
                </Link>
              </Button>
              <Button asChild>
                <Link href={`/app/profile/${profile.id}/records/new`}>
                  <Plus aria-hidden="true" /> Add record
                </Link>
              </Button>
            </>
          ) : undefined
        }
      />

      {capabilities.canEdit ? (
        <div className="grid gap-3 md:grid-cols-2">
          <Link href={`/app/profile/${profile.id}/records/backfill`}>
            <Card className="border-brand/25 bg-brand-soft/65 h-full transition hover:-translate-y-0.5">
              <CardContent className="flex items-start gap-4">
                <span className="bg-brand grid size-11 shrink-0 place-items-center rounded-2xl text-white">
                  <Sparkles aria-hidden="true" className="size-5" />
                </span>
                <div>
                  <h2 className="font-editorial text-xl font-semibold">Continue guided backfill</h2>
                  <p className="text-ink-soft mt-1 text-sm leading-6">
                    Answer high-impact history questions without inventing dates.
                  </p>
                </div>
              </CardContent>
            </Card>
          </Link>
          <Link href={`/app/profile/${profile.id}/records/bulk`}>
            <Card className="hover:border-line-strong h-full transition hover:-translate-y-0.5">
              <CardContent className="flex items-start gap-4">
                <span className="bg-surface-muted text-ink-soft grid size-11 shrink-0 place-items-center rounded-2xl">
                  <ListPlus aria-hidden="true" className="size-5" />
                </span>
                <div>
                  <h2 className="font-editorial text-xl font-semibold">Bulk history entry</h2>
                  <p className="text-ink-soft mt-1 text-sm leading-6">
                    Enter several records through the validated import preview.
                  </p>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>
      ) : null}

      <form className="rounded-card border-line bg-surface grid gap-3 border p-4 lg:grid-cols-[minmax(14rem,1fr)_repeat(3,minmax(10rem,.35fr))_auto]">
        <label className="relative">
          <span className="sr-only">Search history</span>
          <Search
            aria-hidden="true"
            className="text-ink-soft absolute top-1/2 left-3.5 size-4 -translate-y-1/2"
          />
          <Input
            name="query"
            defaultValue={filters.query}
            placeholder="Search service, method, provider, or year"
            className="pl-10"
          />
        </label>
        <label>
          <span className="sr-only">Filter history by category</span>
          <Select name="category" defaultValue={filters.category ?? "all"}>
            <option value="all">All categories</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category.replaceAll("_", " ")}
              </option>
            ))}
          </Select>
        </label>
        <label>
          <span className="sr-only">Filter history by year</span>
          <Select name="year" defaultValue={filters.year ?? "all"}>
            <option value="all">All years</option>
            <option value={String(currentYear)}>{currentYear}</option>
            <option value={String(currentYear - 1)}>{currentYear - 1}</option>
            <option value="older">Earlier</option>
          </Select>
        </label>
        <label>
          <span className="sr-only">Filter history by record state</span>
          <Select name="state" defaultValue={filters.state ?? "all"}>
            <option value="all">All records</option>
            <option value="missing-date">Missing dates</option>
            <option value="abnormal-clinician">Abnormal or clinician-managed</option>
            <option value="imported">Imported</option>
            <option value="documents">With documents</option>
          </Select>
        </label>
        <Button type="submit" variant="secondary">
          <Filter aria-hidden="true" /> Apply
        </Button>
      </form>

      <section aria-labelledby="history-heading">
        <div className="mb-4 flex items-end justify-between">
          <h2 id="history-heading" className="font-editorial text-3xl font-semibold">
            Care history
          </h2>
          <p className="text-ink-soft text-sm">
            {visibleRecords.length} {visibleRecords.length === 1 ? "record" : "records"}
          </p>
        </div>
        {records.length === 0 ? (
          <EmptyState
            icon={History}
            title="No care records yet"
            description="Add a record at the precision you know, or use guided backfill for unsure and never-completed answers."
          />
        ) : visibleRecords.length === 0 ? (
          <EmptyState
            icon={Search}
            title="No matching records"
            description="Clear one or more filters to see the full care history."
          />
        ) : (
          <div className="space-y-3">
            {visibleRecords.map((record) => (
              <Card key={record.id}>
                <CardContent className="grid gap-4 sm:grid-cols-[9rem_minmax(0,1fr)_auto] sm:items-center">
                  <div>
                    <p className="font-editorial text-xl font-semibold">{eventDate(record)}</p>
                    <p className="text-ink-soft mt-1 text-[0.68rem] font-bold tracking-wider uppercase">
                      {precisionLabels[record.datePrecision]}
                    </p>
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">
                        {record.method?.name ?? record.service.name}
                      </h3>
                      <Badge
                        tone={
                          record.result === "normal"
                            ? "brand"
                            : record.result === "abnormal"
                              ? "warm"
                              : "neutral"
                        }
                      >
                        {record.result.replaceAll("_", " ")}
                      </Badge>
                      {record.documentLinks.length > 0 ? <Badge>Document</Badge> : null}
                    </div>
                    <p className="text-ink-soft mt-1 text-sm">
                      {record.service.name} · {sourceLabels[record.source]}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/app/profile/${profile.id}/records/${record.id}`}>
                      View record
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
