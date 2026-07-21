import { InviteManager } from "@/components/family/invite-manager";
import { PageHeader } from "@/components/shared/page-header";
import { requireHouseholdPageAccess } from "@/server/authorization/household-page";
import { prisma } from "@/server/db/client";

export default async function InvitesPage() {
  const { household, membership, session } = await requireHouseholdPageAccess("active", "manage");
  const [invites, profiles] = await Promise.all([
    prisma.householdInvite.findMany({
      where: {
        householdId: household.id,
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.profile.findMany({
      where: {
        householdId: household.id,
        ownerUserId: null,
        claimedAt: null,
        deletedAt: null,
        ...(membership.role === "owner" ? {} : { createdByUserId: session.user.id }),
      },
      orderBy: { displayName: "asc" },
    }),
  ]);
  const claimInvites =
    profiles.length === 0
      ? []
      : await prisma.profileClaimInvite.findMany({
          where: {
            profileId: { in: profiles.map(({ id }) => id) },
            acceptedAt: null,
            revokedAt: null,
            expiresAt: { gt: new Date() },
          },
          include: { profile: { select: { displayName: true } } },
          orderBy: { createdAt: "desc" },
        });
  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Household access"
        title="Invitations and profile claims"
        description="Raw invite tokens are never stored. Claiming an adult profile transfers ownership and resets it to owner-only privacy."
      />
      <InviteManager
        householdId={household.id}
        initialInvites={invites.map((invite) => ({
          id: invite.id,
          email: invite.emailNormalized,
          role: invite.role,
          expiresAt: invite.expiresAt.toISOString(),
        }))}
        claimableProfiles={profiles.map((profile) => ({
          id: profile.id,
          name: profile.displayName,
        }))}
        initialClaimInvites={claimInvites.map((invite) => ({
          id: invite.id,
          profileId: invite.profileId,
          profileName: invite.profile.displayName,
          email: invite.emailNormalized,
          expiresAt: invite.expiresAt.toISOString(),
        }))}
      />
    </div>
  );
}
