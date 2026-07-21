import { CsvImport } from "@/components/records/csv-import";
import { PageHeader } from "@/components/shared/page-header";
import { requireProfilePageAccess } from "@/server/authorization/profile-page";

export default async function ImportPage({ params }: { params: Promise<{ profileId: string }> }) {
  const { profileId } = await params;
  const { profile } = await requireProfilePageAccess(profileId, "edit");
  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Two-phase import"
        title="Import care history"
        description="Validate service names, methods, date precision, duplicates, and errors before any data is saved."
      />
      <CsvImport profileId={profile.id} />
    </div>
  );
}
