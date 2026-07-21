import { CustomMaintenanceManager } from "@/components/maintenance/custom-maintenance-manager";
import { PageHeader } from "@/components/shared/page-header";
import { requireProfilePageAccess } from "@/server/authorization/profile-page";
import {
  isProfileOwnerOrOrganizer,
  listCustomMaintenance,
  listMaintenanceTemplates,
} from "@/server/custom-maintenance";
import { prisma } from "@/server/db/client";

export default async function CustomMaintenancePage({
  params,
}: {
  params: Promise<{ profileId: string }>;
}) {
  const { profileId } = await params;
  const { session, profile, capabilities } = await requireProfilePageAccess(profileId, "view");
  const canUseOwnerOnly = isProfileOwnerOrOrganizer(profile, session.user.id);
  const [items, templates] = await Promise.all([
    listCustomMaintenance(prisma, profile.id, canUseOwnerOnly),
    listMaintenanceTemplates(prisma, profile.id, canUseOwnerOnly),
  ]);

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Personal and clinician-defined"
        title={`${profile.displayName}'s custom maintenance`}
        description="Keep chosen routines and clinician instructions organized without turning them into universal medical guidance."
      />
      <CustomMaintenanceManager
        profileId={profile.id}
        profileName={profile.displayName}
        initialItems={items}
        initialTemplates={templates}
        canEdit={capabilities.canEdit}
        canUseOwnerOnly={canUseOwnerOnly}
      />
    </div>
  );
}
