import type {
  Household,
  HouseholdInvite,
  HouseholdMember,
  HouseholdRole,
} from "@/generated/prisma/client";

import { prisma } from "../db/client";
import type { DatabaseClient } from "../db/transactions";
import { normalizeCountryCode, normalizeEmail, normalizeText } from "./normalize";

export type CreateHouseholdRecord = {
  name: string;
  ownerUserId: string;
  timezone: string;
  countryCode: string;
};

export type CreateHouseholdInviteRecord = {
  householdId: string;
  email: string;
  role: Exclude<HouseholdRole, "owner">;
  tokenHash: string;
  expiresAt: Date;
  invitedByUserId: string;
  createdAt: Date;
};

export interface HouseholdRepository {
  createWithOwner(input: CreateHouseholdRecord): Promise<Household>;
  findActiveById(id: string): Promise<Household | null>;
  listActiveForUser(userId: string): Promise<Household[]>;
  findActiveMembership(householdId: string, userId: string): Promise<HouseholdMember | null>;
  addMember(
    householdId: string,
    userId: string,
    role: HouseholdRole,
    joinedAt: Date,
  ): Promise<HouseholdMember>;
  removeMember(id: string, removedAt: Date): Promise<HouseholdMember>;
  createInvite(input: CreateHouseholdInviteRecord): Promise<HouseholdInvite>;
  findPendingInviteByTokenHash(tokenHash: string, now: Date): Promise<HouseholdInvite | null>;
  revokeInvite(id: string, revokedAt: Date): Promise<HouseholdInvite>;
}

export function createHouseholdRepository(database: DatabaseClient = prisma): HouseholdRepository {
  return {
    async createWithOwner(input) {
      return database.household.create({
        data: {
          name: normalizeText(input.name),
          ownerUserId: input.ownerUserId,
          timezone: normalizeText(input.timezone),
          countryCode: normalizeCountryCode(input.countryCode),
          members: {
            create: {
              userId: input.ownerUserId,
              role: "owner",
            },
          },
        },
      });
    },

    findActiveById(id) {
      return database.household.findFirst({ where: { id, deletedAt: null } });
    },

    async listActiveForUser(userId) {
      const memberships = await database.householdMember.findMany({
        where: {
          userId,
          removedAt: null,
          household: { deletedAt: null },
        },
        include: { household: true },
        orderBy: { joinedAt: "asc" },
      });

      return memberships.map(({ household }) => household);
    },

    findActiveMembership(householdId, userId) {
      return database.householdMember.findFirst({
        where: { householdId, userId, removedAt: null },
      });
    },

    addMember(householdId, userId, role, joinedAt) {
      return database.householdMember.create({
        data: { householdId, userId, role, joinedAt },
      });
    },

    removeMember(id, removedAt) {
      return database.householdMember.update({ where: { id }, data: { removedAt } });
    },

    createInvite(input) {
      return database.householdInvite.create({
        data: {
          householdId: input.householdId,
          emailNormalized: normalizeEmail(input.email),
          role: input.role,
          tokenHash: input.tokenHash,
          expiresAt: input.expiresAt,
          invitedByUserId: input.invitedByUserId,
          createdAt: input.createdAt,
        },
      });
    },

    findPendingInviteByTokenHash(tokenHash, now) {
      return database.householdInvite.findFirst({
        where: {
          tokenHash,
          acceptedAt: null,
          revokedAt: null,
          expiresAt: { gt: now },
        },
      });
    },

    revokeInvite(id, revokedAt) {
      return database.householdInvite.update({ where: { id }, data: { revokedAt } });
    },
  };
}

export const householdRepository = createHouseholdRepository();
