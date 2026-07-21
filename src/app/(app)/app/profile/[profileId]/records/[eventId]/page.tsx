import { ArrowLeft, FileText } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RecordActions } from "@/components/records/record-actions";
import { DocumentActions } from "@/components/records/document-actions";
import { PageHeader } from "@/components/shared/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireProfilePageAccess } from "@/server/authorization/profile-page";
import { prisma } from "@/server/db/client";
import { displayDateRange } from "@/server/read-models";

export default async function RecordDetailPage({
  params,
}: {
  params: Promise<{ profileId: string; eventId: string }>;
}) {
  const { profileId, eventId } = await params;
  const { profile, capabilities } = await requireProfilePageAccess(profileId, "view");
  const event = await prisma.careEvent.findFirst({
    where: { id: eventId, profileId: profile.id, deletedAt: null },
    include: {
      service: { include: { methods: { where: { active: true }, orderBy: { name: "asc" } } } },
      method: true,
      documentLinks: { where: { document: { deletedAt: null } }, include: { document: true } },
    },
  });
  if (event === null) notFound();
  const timing =
    event.datePrecision === "unknown"
      ? "Completed, date unknown"
      : displayDateRange(event.performedStart, event.performedEnd);
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Button variant="ghost" size="sm" asChild className="-ml-3">
        <Link href={`/app/profile/${profile.id}/records`}>
          <ArrowLeft aria-hidden="true" /> Back to records
        </Link>
      </Button>
      <PageHeader
        eyebrow="Care record"
        title={event.method?.name ?? event.service.name}
        description={`${event.service.name} · ${timing}`}
      />
      {event.result === "abnormal" || event.result === "inconclusive" ? (
        <Alert tone="warning" title="Routine timing may not apply">
          Follow the personal plan from a clinician. CareCadence does not interpret the result or
          infer follow-up.
        </Alert>
      ) : null}
      <Card>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2">
            {[
              ["Date precision", event.datePrecision.replaceAll("_", " ")],
              ["Result category", event.result.replaceAll("_", " ")],
              ["Provider", event.providerName ?? "Not recorded"],
              ["Location", event.locationName ?? "Not recorded"],
              ["Source", event.source.replaceAll("_", " ")],
            ].map(([label, value]) => (
              <div key={label} className="border-line rounded-xl border p-4">
                <dt className="text-ink-soft text-xs font-bold tracking-wider uppercase">
                  {label}
                </dt>
                <dd className="mt-1 font-semibold capitalize">{value}</dd>
              </div>
            ))}
          </dl>
          {event.notes !== null ? (
            <div className="bg-surface-muted mt-4 rounded-xl p-4">
              <p className="text-xs font-bold tracking-wider uppercase">Notes</p>
              <p className="text-ink-soft mt-2 text-sm leading-6 whitespace-pre-wrap">
                {event.notes}
              </p>
            </div>
          ) : null}
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <h2 className="font-editorial text-2xl font-semibold">Private documents</h2>
          <div className="mt-4 space-y-2">
            {event.documentLinks.length === 0 ? (
              <p className="text-ink-soft text-sm">No document is linked to this record.</p>
            ) : (
              event.documentLinks.map(({ document }) => (
                <div
                  key={document.id}
                  className="border-line flex items-center justify-between gap-3 rounded-xl border p-3"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <FileText aria-hidden="true" className="text-brand size-4 shrink-0" />
                    <span className="truncate text-sm font-semibold">{document.safeFilename}</span>
                    <Badge>{document.mimeType}</Badge>
                  </span>
                  <DocumentActions
                    documentId={document.id}
                    filename={document.safeFilename}
                    editable={capabilities.canEdit}
                  />
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
      {capabilities.canEdit ? (
        <RecordActions
          profileId={profile.id}
          eventId={event.id}
          serviceName={event.service.name}
          methods={event.service.methods.map(({ id, name }) => ({ id, name }))}
          initialValue={{
            methodId: event.methodId ?? "",
            performedDate:
              event.performedStart === null
                ? ""
                : event.datePrecision === "day"
                  ? event.performedStart.toISOString().slice(0, 10)
                  : event.datePrecision === "month"
                    ? event.performedStart.toISOString().slice(0, 7)
                    : event.datePrecision === "year"
                      ? event.performedStart.toISOString().slice(0, 4)
                      : "",
            datePrecision: event.datePrecision,
            result: event.result,
            providerName: event.providerName ?? "",
            locationName: event.locationName ?? "",
            notes: event.notes ?? "",
            source: event.source,
          }}
        />
      ) : null}
    </div>
  );
}
