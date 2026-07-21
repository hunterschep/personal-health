import { CalendarCheck, FileClock, ShieldCheck } from "lucide-react";
import { PrivacyIndicator } from "@/components/shared/privacy-indicator";
import { SourceCitation } from "@/components/shared/source-citation";
import { SourceMetadataPanel } from "@/components/sources/source-metadata-panel";
import { Alert } from "@/components/ui/alert";
import { EvidenceClassBadge, SourceBadge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, StatCard } from "@/components/ui/card";
import {
  CalendarMonth,
  GuidelinesDifferPanel,
  PrintOnly,
  ProfileAvatar,
  ProgressRing,
  ResponsiveTimeline,
  type CalendarDay,
} from "@/components/ui/data-display";
import { OfflineBanner } from "@/components/ui/feedback";
import { Breadcrumbs, DataTable, Pagination } from "@/components/ui/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { recommendationStatusSchema } from "@/contracts";
import type { PublicSourceMetadata } from "@/server/sources/types";

const missingDateSource: PublicSourceMetadata = {
  slug: "gallery-source",
  organization: "Example guideline organization",
  title: "Preventive care guidance with an intentionally missing publication date",
  canonicalUrl: "https://example.org/guideline",
  sourceType: "specialty_guideline",
  evidenceClass: "specialty_society_guideline",
  jurisdiction: "US",
  publishedAt: null,
  effectiveAt: null,
  lastVerifiedAt: "2026-07-21",
  sourceVersion: "Current web publication",
  contentHash: null,
  licenseOrTermsUrl: null,
  attribution: {
    required: false,
    text: null,
    logoUrl: null,
    destinationUrl: null,
    contentMustRemainUnaltered: false,
  },
  lifecycle: "current",
  active: true,
  serviceSlugs: ["gallery-service"],
  relatedUrls: [],
};

const calendarDays: CalendarDay[] = Array.from({ length: 35 }, (_, index) => {
  const date = new Date(Date.UTC(2026, 5, 28 + index));
  const dateText = date.toISOString().slice(0, 10);
  const dayNumber = date.getUTCDate();
  const inJuly = date.getUTCMonth() === 6;
  return {
    date: dateText,
    dayNumber,
    outsideMonth: !inJuly,
    today: dateText === "2026-07-21",
    events:
      dateText === "2026-07-08"
        ? [{ id: "visit", label: "Primary care visit", tone: "cool" as const }]
        : dateText === "2026-07-21"
          ? [{ id: "review", label: "Plan review", tone: "brand" as const }]
          : [],
  };
});

export function GalleryStatusFixtures() {
  return (
    <section aria-labelledby="gallery-statuses" className="space-y-6">
      <div>
        <p className="text-brand text-xs font-bold tracking-[0.12em] uppercase">Frozen contract</p>
        <h2 id="gallery-statuses" className="font-editorial mt-1 text-3xl font-semibold">
          Every recommendation status
        </h2>
      </div>
      <div className="flex flex-wrap gap-2">
        {recommendationStatusSchema.options.map((status) => (
          <StatusBadge key={status} status={status} />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="max-w-[20rem]" data-testid="mobile-wrapping-card">
          <CardHeader>
            <CardTitle>
              Counseling and shared decision-making for an unusually long preventive service name
            </CardTitle>
          </CardHeader>
          <CardContent>
            <StatusBadge status="due_this_year" />
            <p className="text-ink-soft mt-3 text-sm leading-6">
              This narrow fixture verifies natural mobile wrapping without truncating meaning.
            </p>
          </CardContent>
        </Card>
        <div className="dark bg-background text-ink rounded-card border-line border p-5">
          <p className="text-brand text-xs font-bold tracking-[0.1em] uppercase">
            Dark mode fixture
          </p>
          <h3 className="font-editorial mt-2 text-2xl font-semibold">The same calm hierarchy</h3>
          <div className="mt-4 flex flex-wrap gap-2">
            <StatusBadge status="up_to_date" />
            <StatusBadge status="unknown_history" />
            <PrivacyIndicator />
          </div>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Plan complete"
          value="68%"
          icon={<ShieldCheck aria-hidden="true" className="size-5" />}
        />
        <StatCard
          label="History items"
          value="12"
          detail="Two dates remain approximate."
          icon={<FileClock aria-hidden="true" className="size-5" />}
        />
        <Card>
          <CardContent className="flex items-center gap-5">
            <ProgressRing value={68} />
            <div>
              <p className="font-semibold">Care-plan completion</p>
              <p className="text-ink-soft mt-1 text-sm leading-5">
                Progress uses a number and label, not color alone.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <EvidenceClassBadge evidenceClass="uspstf_final" />
        <SourceBadge>USPSTF</SourceBadge>
        <ProfileAvatar name="Alex Example" />
        <PrivacyIndicator label="Selected sharing" />
      </div>
    </section>
  );
}

export function GallerySourceFixtures() {
  return (
    <section aria-labelledby="gallery-sources" className="space-y-6">
      <div>
        <p className="text-brand text-xs font-bold tracking-[0.12em] uppercase">
          Transparent evidence
        </p>
        <h2 id="gallery-sources" className="font-editorial mt-1 text-3xl font-semibold">
          Sources and guideline differences
        </h2>
      </div>
      <SourceMetadataPanel source={missingDateSource} />
      <SourceCitation
        organization="Example federal source"
        title="Preventive services guidance"
        url="https://example.org/source"
        verifiedAt="July 21, 2026"
      />
      <GuidelinesDifferPanel
        variants={[
          {
            id: "federal",
            source: "Federal task force",
            title: "Routine population recommendation",
            timing: "Begin at the population guideline age.",
            evidenceClass: "uspstf_final",
          },
          {
            id: "specialty",
            source: "Specialty society",
            title: "Individual risk discussion",
            timing: "Consider earlier timing after a clinician discussion.",
            evidenceClass: "specialty_society_guideline",
            note: "The app presents this as a competing variant, not an automatic override.",
          },
        ]}
      />
    </section>
  );
}

export function GalleryFeedbackFixtures() {
  return (
    <section aria-labelledby="gallery-feedback" className="space-y-4">
      <div>
        <p className="text-brand text-xs font-bold tracking-[0.12em] uppercase">
          State communication
        </p>
        <h2 id="gallery-feedback" className="font-editorial mt-1 text-3xl font-semibold">
          Error, offline, loading, and print
        </h2>
      </div>
      <Alert tone="error" title="This example needs review">
        The message identifies the problem without using color as its only signal.
      </Alert>
      <OfflineBanner forceOffline />
      <div role="status" className="border-line bg-surface rounded-xl border p-5">
        <span className="sr-only">Loading care-plan card</span>
        <Skeleton className="h-5 w-36" />
        <Skeleton className="mt-4 h-4 w-full" />
        <Skeleton className="mt-2 h-4 w-2/3" />
      </div>
      <PrintOnly>
        <h2>Print-only care-plan note</h2>
        <p>This section is hidden on screen and included in readable print output.</p>
      </PrintOnly>
    </section>
  );
}

export function GalleryNavigationAndData() {
  return (
    <section aria-labelledby="gallery-data" className="space-y-7">
      <div>
        <p className="text-brand text-xs font-bold tracking-[0.12em] uppercase">Structured views</p>
        <h2 id="gallery-data" className="font-editorial mt-1 text-3xl font-semibold">
          Navigation, bulk data, timeline, and calendar
        </h2>
      </div>
      <Breadcrumbs
        items={[
          { label: "Overview", href: "/" },
          { label: "Care plan", href: "/" },
          { label: "Service detail" },
        ]}
      />
      <Pagination
        currentPage={4}
        totalPages={12}
        hrefForPage={(page) => `?page=${page}`}
        label="Gallery pages"
      />
      <DataTable
        caption="Bulk-entry fixture"
        columns={[
          { id: "service", header: "Service", cell: (row) => row.service },
          { id: "date", header: "Date", cell: (row) => row.date },
          { id: "source", header: "Source", cell: (row) => row.source },
        ]}
        rows={[
          { id: "1", service: "Blood pressure review", date: "2026-05", source: "Patient record" },
          { id: "2", service: "Seasonal influenza vaccine", date: "2025", source: "Memory" },
        ]}
        rowKey={(row) => row.id}
      />
      <ResponsiveTimeline
        label="Example preventive-care timeline"
        items={[
          {
            id: "record",
            date: "May 2026",
            title: "Blood pressure review recorded",
            description: "Month-level precision is preserved.",
            icon: CalendarCheck,
            meta: <SourceBadge>Personal record</SourceBadge>,
          },
          {
            id: "future",
            date: "Autumn 2026",
            title: "Plan seasonal vaccine",
            description: "Future planning remains separate from a medical due date.",
            icon: FileClock,
            meta: <StatusBadge status="due_this_year" />,
          },
        ]}
      />
      <div className="overflow-x-auto">
        <CalendarMonth monthLabel="July 2026" days={calendarDays} />
      </div>
    </section>
  );
}
