import { ConflictError, NotFoundError } from "@/domain/shared/errors";
import { hashOpaqueToken } from "@/server/auth/tokens";
import { requireVerifiedEmailForInvitation } from "@/server/auth/identity-flows";
import { prisma } from "@/server/db/client";

export async function acceptHouseholdInvitation(
  token: string,
  user: { id: string; email: string },
) {
  await requireVerifiedEmailForInvitation(user.id);
  const hash = hashOpaqueToken(token);
  return prisma.$transaction(async (database) => {
    const invite = await database.householdInvite.findFirst({
      where: {
        tokenHash: hash,
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    if (
      invite === null ||
      invite.role === "owner" ||
      invite.emailNormalized !== user.email.toLocaleLowerCase("en-US")
    ) {
      throw new NotFoundError();
    }
    const active = await database.householdMember.findFirst({
      where: { householdId: invite.householdId, userId: user.id, removedAt: null },
    });
    if (active !== null) throw new ConflictError("You already belong to this household.");
    const removed = await database.householdMember.findFirst({
      where: {
        householdId: invite.householdId,
        userId: user.id,
        removedAt: { not: null },
      },
      orderBy: { joinedAt: "desc" },
    });
    const joined =
      removed === null
        ? await database.householdMember.create({
            data: {
              householdId: invite.householdId,
              userId: user.id,
              role: invite.role,
            },
          })
        : await database.householdMember.update({
            where: { id: removed.id },
            data: { role: invite.role, joinedAt: new Date(), removedAt: null },
          });
    await database.householdInvite.update({
      where: { id: invite.id },
      data: { acceptedAt: new Date() },
    });
    await database.auditLog.create({
      data: {
        householdId: invite.householdId,
        actorUserId: user.id,
        action: "household.invite_accepted",
        entityType: "HouseholdInvite",
        entityId: invite.id,
        metadataJson: { role: invite.role },
      },
    });
    return joined;
  });
}

export async function acceptProfileClaimInvitation(
  token: string,
  user: { id: string; email: string },
) {
  await requireVerifiedEmailForInvitation(user.id);
  const hash = hashOpaqueToken(token);
  return prisma.$transaction(
    async (database) => {
      const invite = await database.profileClaimInvite.findFirst({
        where: {
          tokenHash: hash,
          acceptedAt: null,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        include: { profile: true },
      });
      if (invite === null || invite.emailNormalized !== user.email.toLocaleLowerCase("en-US")) {
        throw new NotFoundError();
      }
      const changed = await database.profile.updateMany({
        where: { id: invite.profileId, ownerUserId: null, claimedAt: null, deletedAt: null },
        data: {
          ownerUserId: user.id,
          claimedAt: new Date(),
          visibility: "owner_only",
        },
      });
      if (changed.count !== 1) {
        throw new ConflictError("This profile has already been claimed.");
      }
      await database.profileClaimInvite.update({
        where: { id: invite.id },
        data: { acceptedAt: new Date() },
      });
      const removedGrants = await database.profileAccessGrant.deleteMany({
        where: { profileId: invite.profileId },
      });
      const existingMembership = await database.householdMember.findFirst({
        where: {
          householdId: invite.profile.householdId,
          userId: user.id,
        },
        orderBy: { joinedAt: "desc" },
      });
      if (existingMembership === null) {
        await database.householdMember.create({
          data: {
            householdId: invite.profile.householdId,
            userId: user.id,
            role: "member",
          },
        });
      } else if (existingMembership.removedAt !== null) {
        await database.householdMember.update({
          where: { id: existingMembership.id },
          data: { removedAt: null, role: "member", joinedAt: new Date() },
        });
      }
      await database.profileClaimInvite.updateMany({
        where: {
          profileId: invite.profileId,
          id: { not: invite.id },
          acceptedAt: null,
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });
      await database.auditLog.create({
        data: {
          householdId: invite.profile.householdId,
          profileId: invite.profileId,
          actorUserId: user.id,
          action: "profile.claimed",
          entityType: "Profile",
          entityId: invite.profileId,
          metadataJson: { resetGrantCount: removedGrants.count },
        },
      });
      return database.profile.findUniqueOrThrow({ where: { id: invite.profileId } });
    },
    { isolationLevel: "Serializable" },
  );
}
