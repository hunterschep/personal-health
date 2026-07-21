import type { Prisma } from "@/generated/prisma/client";

export type MemberDepartureResult = {
  protectedProfileCount: number;
  revokedGrantCount: number;
};

/**
 * Makes an adult's owned profiles private before their household membership
 * ends. Ownership is intentionally preserved, so the adult keeps direct
 * access after leaving the household.
 */
export async function protectProfilesForMemberDeparture(
  database: Prisma.TransactionClient,
  householdId: string,
  userId: string,
): Promise<MemberDepartureResult> {
  const protectedProfiles = await database.profile.updateMany({
    where: { householdId, ownerUserId: userId, deletedAt: null },
    data: { visibility: "owner_only" },
  });
  const revokedGrants = await database.profileAccessGrant.deleteMany({
    where: {
      OR: [{ userId, profile: { householdId } }, { profile: { householdId, ownerUserId: userId } }],
    },
  });
  return {
    protectedProfileCount: protectedProfiles.count,
    revokedGrantCount: revokedGrants.count,
  };
}
