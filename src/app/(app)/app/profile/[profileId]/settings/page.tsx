import { ProfileEditor } from "@/components/profile/profile-editor";
import { PageHeader } from "@/components/shared/page-header";
import { requireProfilePageAccess } from "@/server/authorization/profile-page";
import { loadProfileSettingsContext } from "@/server/read-models";

export default async function ProfileSettingsPage({
  params,
}: {
  params: Promise<{ profileId: string }>;
}) {
  const { profileId } = await params;
  const { profile } = await requireProfilePageAccess(profileId, "edit");
  const settings = await loadProfileSettingsContext(profile.id);
  const anatomy = settings.anatomy;
  const conditions = settings.healthContext.conditions;

  return (
    <div className="mx-auto max-w-5xl space-y-7">
      <PageHeader
        eyebrow="Profile inputs"
        title={`Edit ${profile.displayName}`}
        description="Changes to age, anatomy, risk context, health history, timezone, or care-plan mode rebuild the plan once in the same transaction."
      />
      <ProfileEditor
        profileId={profile.id}
        initialValue={{
          displayName: profile.displayName,
          relationshipLabel: profile.relationshipLabel,
          dateOfBirth: profile.dateOfBirth.toISOString().slice(0, 10),
          sexAssignedAtBirth: profile.sexAssignedAtBirth,
          genderIdentity: profile.genderIdentity ?? "",
          timezone: profile.timezone,
          carePlanMode: profile.carePlanMode,
          anatomy: {
            cervix: anatomy.cervix ?? "unknown",
            breast_tissue: anatomy.breast_tissue ?? "unknown",
            prostate: anatomy.prostate ?? "unknown",
            uterus: anatomy.uterus ?? "unknown",
            ovaries: anatomy.ovaries ?? "unknown",
          },
          healthContext: {
            tobaccoStatus: settings.healthContext.tobaccoStatus,
            smokingStartYear: settings.healthContext.smokingStartYear,
            smokingEndYear: settings.healthContext.smokingEndYear,
            packsPerDay: settings.healthContext.packsPerDay,
            heightInches: settings.healthContext.heightInches,
            weightPounds: settings.healthContext.weightPounds,
            pregnancyStatus: settings.healthContext.pregnancyStatus,
            immunocompromised: settings.healthContext.immunocompromised,
            alcoholAssessmentPreference: settings.healthContext.alcoholAssessmentPreference,
            fallConcern: settings.healthContext.fallConcern,
            sexualHealthRisk: settings.healthContext.sexualHealthRisk,
            conditions: {
              hypertension: conditions.hypertension ?? false,
              diabetes: conditions.diabetes ?? false,
              cardiovascularDisease: conditions.cardiovascularDisease ?? false,
              priorCancer: conditions.priorCancer ?? false,
              priorAbnormalScreening: conditions.priorAbnormalScreening ?? false,
              osteoporosisFragility: conditions.osteoporosisFragility ?? false,
            },
            familyHistoryNote: settings.healthContext.familyHistoryNote,
            surgeryNote: settings.healthContext.surgeryNote,
            surgeryAnatomyKey: settings.healthContext.surgeryAnatomyKey,
            surgeryAnatomyState: settings.healthContext.surgeryAnatomyState,
            confirmSurgeryAnatomy: settings.healthContext.confirmSurgeryAnatomy,
          },
        }}
      />
    </div>
  );
}
