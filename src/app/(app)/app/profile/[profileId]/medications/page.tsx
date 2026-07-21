import { MedicationManager } from "@/components/medications/medication-manager";
import { PageHeader } from "@/components/shared/page-header";
import { requireProfilePageAccess } from "@/server/authorization/profile-page";
import { prisma } from "@/server/db/client";

function timingInput(
  value: Date | null,
  precision: "day" | "month" | "year" | "unknown" | null,
): string {
  if (value === null || precision === null || precision === "unknown") return "";
  const iso = value.toISOString().slice(0, 10);
  return precision === "day" ? iso : precision === "month" ? iso.slice(0, 7) : iso.slice(0, 4);
}

export default async function MedicationsPage({
  params,
}: {
  params: Promise<{ profileId: string }>;
}) {
  const { profileId } = await params;
  const { profile, capabilities } = await requireProfilePageAccess(profileId, "view");
  const medications = await prisma.medication.findMany({
    where: { profileId: profile.id, deletedAt: null },
    include: {
      documentLinks: {
        where: { document: { deletedAt: null } },
        include: { document: true },
      },
    },
    orderBy: [{ status: "asc" }, { name: "asc" }],
  });
  const initialMedications = medications.map((medication) => ({
    id: medication.id,
    name: medication.name,
    dose: medication.dose ?? "",
    frequency: medication.frequency ?? "",
    prescriber: medication.prescriber ?? "",
    reason: medication.reason ?? "",
    status: medication.status,
    monitoring: medication.monitoringInstructions ?? "",
    nextReview: medication.nextReviewDate?.toISOString().slice(0, 10) ?? "",
    startedDate: timingInput(medication.startedStart, medication.startedDatePrecision),
    startedPrecision: medication.startedDatePrecision,
    endedDate: timingInput(medication.endedStart, medication.endedDatePrecision),
    endedPrecision: medication.endedDatePrecision ?? "unknown",
    notes: medication.notes ?? "",
    classCodes: Array.isArray(medication.classCodesJson)
      ? medication.classCodesJson.filter((value): value is string => typeof value === "string")
      : [],
    documents: medication.documentLinks.map(({ document }) => ({
      id: document.id,
      filename: document.safeFilename,
      mimeType: document.mimeType,
    })),
  }));
  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Clinical context"
        title={`${profile.displayName}'s medications`}
        description="Keep an accurate list and represent only monitoring instructions a clinician actually provided."
      />
      <MedicationManager
        profileId={profile.id}
        initialMedications={initialMedications}
        editable={capabilities.canEdit}
      />
    </div>
  );
}
