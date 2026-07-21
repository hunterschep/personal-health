import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock3,
  GitCompareArrows,
  ShieldAlert,
  WifiOff,
} from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Select } from "@/components/ui/form";
import { loadSourceChanges } from "@/server/read-models/source-transparency";
import { humanizeIdentifier } from "@/server/read-models/transparency-format";

function timestamp(value: Date): string {
  return value.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

export default async function SourceChangesPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const filters = await searchParams;
  const logs = await loadSourceChanges();
  const visible = logs.filter((log) => {
    if (filters.view === "changes") return log.changed;
    if (filters.view === "availability") return log.status !== "success";
    return true;
  });
  const changedCount = logs.filter((log) => log.changed).length;
  const fallbackCount = logs.filter((log) => log.status === "fallback").length;

  return (
    <div className="space-y-7">
      <Button variant="ghost" size="sm" asChild className="-ml-3">
        <Link href="/app/sources">
          <ArrowLeft aria-hidden="true" /> Back to sources
        </Link>
      </Button>
      <PageHeader
        eyebrow="Read-only source activity"
        title="Source revisions and availability"
        description="Recorded sync outcomes explain when a source copy changed or when the last stored copy was used. They do not edit active medical logic."
      />
      <Alert tone="info" title="Detection is not activation">
        When external content changes, CareCadence preserves the prior copy and marks the revision
        for review. Only reviewed, versioned rule changes can update a recommendation calculation.
      </Alert>

      <section className="grid gap-3 sm:grid-cols-3" aria-label="Source activity summary">
        <Card>
          <CardContent>
            <Clock3 aria-hidden="true" className="text-brand size-5" />
            <p className="text-ink-soft mt-4 text-xs font-bold tracking-wider uppercase">
              Recorded checks
            </p>
            <p className="font-editorial mt-1 text-4xl font-semibold">{logs.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <GitCompareArrows aria-hidden="true" className="text-accent size-5" />
            <p className="text-ink-soft mt-4 text-xs font-bold tracking-wider uppercase">
              Revisions detected
            </p>
            <p className="font-editorial mt-1 text-4xl font-semibold">{changedCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <WifiOff aria-hidden="true" className="text-sky size-5" />
            <p className="text-ink-soft mt-4 text-xs font-bold tracking-wider uppercase">
              Cached fallbacks
            </p>
            <p className="font-editorial mt-1 text-4xl font-semibold">{fallbackCount}</p>
          </CardContent>
        </Card>
      </section>

      <form className="border-line bg-surface flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold">Activity view</p>
          <p className="text-ink-soft mt-1 text-xs">
            Operational messages and reviewer identities are not exposed here.
          </p>
        </div>
        <div className="flex gap-2">
          <label>
            <span className="sr-only">Filter source activity</span>
            <Select name="view" defaultValue={filters.view ?? "all"}>
              <option value="all">All recorded checks</option>
              <option value="changes">Detected revisions</option>
              <option value="availability">Fallbacks and failures</option>
            </Select>
          </label>
          <Button type="submit" variant="secondary">
            Apply
          </Button>
        </div>
      </form>

      {visible.length === 0 ? (
        <EmptyState
          icon={GitCompareArrows}
          title={logs.length === 0 ? "No source sync history yet" : "No activity matches this view"}
          description={
            logs.length === 0
              ? "The reviewed source register remains available. External checks appear here after an operator runs an enabled source sync."
              : "Choose all recorded checks to see the available source activity."
          }
        />
      ) : (
        <Card>
          <CardContent className="p-0 sm:p-0">
            <ol className="divide-line divide-y">
              {visible.map((log) => {
                const Icon = log.changed
                  ? ShieldAlert
                  : log.status === "success"
                    ? CheckCircle2
                    : WifiOff;
                return (
                  <li
                    key={log.id}
                    className="grid gap-4 p-4 sm:grid-cols-[auto_1fr_auto] sm:items-center sm:px-6 sm:py-5"
                  >
                    <span
                      className={`grid size-10 place-items-center rounded-xl ${
                        log.changed
                          ? "bg-accent-soft text-accent"
                          : log.status === "success"
                            ? "bg-brand-soft text-brand"
                            : "bg-sky-soft text-sky"
                      }`}
                    >
                      <Icon aria-hidden="true" className="size-5" />
                    </span>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-semibold">{log.source.title}</h2>
                        <Badge
                          tone={log.changed ? "warm" : log.status === "success" ? "brand" : "cool"}
                        >
                          {log.changed ? "Revision detected" : humanizeIdentifier(log.status)}
                        </Badge>
                      </div>
                      <p className="text-ink-soft mt-1 text-sm">{log.source.organization}</p>
                      <p className="text-ink-soft mt-2 text-xs">
                        {timestamp(log.finishedAt ?? log.startedAt)}
                        {log.httpStatus === null ? "" : ` · HTTP ${log.httpStatus}`}
                        {log.revision === null ? "" : ` · revision ${log.revision}`}
                      </p>
                    </div>
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/app/sources/${log.source.slug}`}>
                        Details <ArrowRight aria-hidden="true" />
                      </Link>
                    </Button>
                  </li>
                );
              })}
            </ol>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
