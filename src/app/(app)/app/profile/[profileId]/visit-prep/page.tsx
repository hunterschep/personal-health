import { VisitPrep } from "@/components/documents/visit-prep";
import { PageHeader } from "@/components/shared/page-header";
import { loadVisitPrepData } from "@/server/read-models/visit-prep";

export default async function VisitPrepPage({
  params,
}: {
  params: Promise<{ profileId: string }>;
}) {
  const { profileId } = await params;
  const visitPrep = await loadVisitPrepData(profileId);

  return (
    <div className="space-y-7">
      <div className="no-print">
        <PageHeader
          eyebrow="One-page agenda"
          title="Prepare for a doctor visit"
          description="Choose what to include, add questions, print a concise agenda, or copy a neutral plain-text summary."
        />
      </div>
      <VisitPrep
        profileId={visitPrep.profileId}
        data={visitPrep.data}
        exportable={visitPrep.canExport}
        initialDraft={visitPrep.draft}
        savable={visitPrep.canSave}
      />
    </div>
  );
}
