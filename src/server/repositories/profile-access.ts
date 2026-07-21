import type { ProfileAccessGrant, ProfilePermission } from "@/generated/prisma/client";

import { prisma } from "../db/client";
import type { DatabaseClient } from "../db/transactions";

export interface ProfileAccessRepository {
  findGrant(profileId: string, userId: string): Promise<ProfileAccessGrant | null>;
  listForProfile(profileId: string): Promise<ProfileAccessGrant[]>;
  grant(
    profileId: string,
    userId: string,
    permission: ProfilePermission,
    grantedByUserId: string,
  ): Promise<ProfileAccessGrant>;
  revoke(profileId: string, userId: string): Promise<ProfileAccessGrant>;
}

export function createProfileAccessRepository(
  database: DatabaseClient = prisma,
): ProfileAccessRepository {
  return {
    findGrant(profileId, userId) {
      return database.profileAccessGrant.findUnique({
        where: { profileId_userId: { profileId, userId } },
      });
    },

    listForProfile(profileId) {
      return database.profileAccessGrant.findMany({
        where: { profileId },
        orderBy: [{ permission: "desc" }, { createdAt: "asc" }],
      });
    },

    grant(profileId, userId, permission, grantedByUserId) {
      return database.profileAccessGrant.upsert({
        where: { profileId_userId: { profileId, userId } },
        create: { profileId, userId, permission, grantedByUserId },
        update: { permission, grantedByUserId },
      });
    },

    revoke(profileId, userId) {
      return database.profileAccessGrant.delete({
        where: { profileId_userId: { profileId, userId } },
      });
    },
  };
}

export const profileAccessRepository = createProfileAccessRepository();
