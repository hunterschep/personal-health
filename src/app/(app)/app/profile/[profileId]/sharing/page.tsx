import { SharingControls } from "@/components/family/sharing-controls";
import { PageHeader } from "@/components/shared/page-header";
import { requireProfilePageAccess } from "@/server/authorization/profile-page";
import { prisma } from "@/server/db/client";

export default async function SharingPage({ params }: { params: Promise<{ profileId: string }> }) {
  const { profileId } = await params;
  const { profile } = await requireProfilePageAccess(profileId, "manage");
  const [members, grants] = await Promise.all([
    prisma.householdMember.findMany({
      where: {
        householdId: profile.householdId,
        removedAt: null,
        ...(profile.ownerUserId === null ? {} : { userId: { not: profile.ownerUserId } }),
      },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { joinedAt: "asc" },
    }),
    prisma.profileAccessGrant.findMany({ where: { profileId: profile.id } }),
  ]);
  const grantByUser = new Map(grants.map((grant) => [grant.userId, grant.permission]));
  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Adult privacy"
        title={`${profile.displayName}'s sharing`}
        description="Choose exactly who can view, edit, or manage this profile. Revocation applies immediately."
      />
      <SharingControls
        profileId={profile.id}
        initialVisibility={profile.visibility}
        initialMembers={members.map(({ user }) => ({
          id: user.id,
          name: user.name ?? user.email,
          email: user.email,
          enabled: grantByUser.has(user.id),
          permission: grantByUser.get(user.id) ?? "view",
        }))}
      />
    </div>
  );
}
