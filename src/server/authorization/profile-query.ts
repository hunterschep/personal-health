import type { Prisma } from "@/generated/prisma/client";

/**
 * Mirrors the profile view policy at the database boundary.
 *
 * Explicit grants only apply while the recipient remains an active member of
 * the profile's household. Keeping that condition in the query prevents stale
 * grants from putting private profile data into a read-model payload.
 */
export function accessibleProfileWhere(userId: string): Prisma.ProfileWhereInput {
  const activeMembership: Prisma.ProfileWhereInput = {
    household: {
      members: { some: { userId, removedAt: null } },
    },
  };

  return {
    deletedAt: null,
    OR: [
      { ownerUserId: userId },
      {
        AND: [{ accessGrants: { some: { userId } } }, activeMembership],
      },
      {
        visibility: "household",
        ...activeMembership,
      },
      {
        claimedAt: null,
        AND: [
          activeMembership,
          {
            OR: [
              { createdByUserId: userId },
              {
                household: {
                  members: {
                    some: { userId, role: "owner", removedAt: null },
                  },
                },
              },
            ],
          },
        ],
      },
    ],
  };
}
