import { hashOpaqueToken } from "@/server/auth/tokens";
import { prisma } from "@/server/db/client";

export type HouseholdInvitePreview = {
  householdName: string;
  inviterName: string;
  role: "admin" | "member";
};

export type ProfileClaimInvitePreview = {
  householdName: string;
  profileName: string;
  inviterName: string;
};

export async function loadHouseholdInvitePreview(
  token: string,
  email: string,
): Promise<HouseholdInvitePreview | null> {
  const invite = await prisma.householdInvite.findFirst({
    where: {
      tokenHash: hashOpaqueToken(token),
      emailNormalized: email.toLocaleLowerCase("en-US"),
      acceptedAt: null,
      revokedAt: null,
      expiresAt: { gt: new Date() },
      household: { deletedAt: null },
    },
    select: {
      role: true,
      household: { select: { name: true } },
      invitedBy: { select: { name: true } },
    },
  });
  if (invite === null || invite.role === "owner") return null;
  return {
    householdName: invite.household.name,
    inviterName: invite.invitedBy.name ?? "Household organizer",
    role: invite.role,
  };
}

export async function loadProfileClaimInvitePreview(
  token: string,
  email: string,
): Promise<ProfileClaimInvitePreview | null> {
  const invite = await prisma.profileClaimInvite.findFirst({
    where: {
      tokenHash: hashOpaqueToken(token),
      emailNormalized: email.toLocaleLowerCase("en-US"),
      acceptedAt: null,
      revokedAt: null,
      expiresAt: { gt: new Date() },
      profile: {
        ownerUserId: null,
        claimedAt: null,
        deletedAt: null,
        household: { deletedAt: null },
      },
    },
    select: {
      profile: {
        select: {
          displayName: true,
          household: { select: { name: true } },
        },
      },
      createdBy: { select: { name: true } },
    },
  });
  if (invite === null) return null;
  return {
    householdName: invite.profile.household.name,
    profileName: invite.profile.displayName,
    inviterName: invite.createdBy.name ?? "Household organizer",
  };
}
