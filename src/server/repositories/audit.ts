import type { AuditLog, Prisma } from "@/generated/prisma/client";

import { prisma } from "../db/client";
import type { DatabaseClient } from "../db/transactions";
import { normalizeNullableText, normalizeText } from "./normalize";

export type AuditRecord = {
  householdId: string | null;
  profileId: string | null;
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  metadataJson: Prisma.InputJsonValue;
  ipHash: string | null;
  userAgentFamily: string | null;
  createdAt: Date;
};

export interface AuditRepository {
  append(input: AuditRecord): Promise<AuditLog>;
  listForHousehold(householdId: string, limit: number): Promise<AuditLog[]>;
  listForProfile(profileId: string, limit: number): Promise<AuditLog[]>;
}

export function createAuditRepository(database: DatabaseClient = prisma): AuditRepository {
  return {
    append(input) {
      return database.auditLog.create({
        data: {
          householdId: input.householdId,
          profileId: input.profileId,
          actorUserId: input.actorUserId,
          action: normalizeText(input.action),
          entityType: normalizeText(input.entityType),
          entityId: normalizeText(input.entityId),
          metadataJson: input.metadataJson,
          ipHash: normalizeNullableText(input.ipHash),
          userAgentFamily: normalizeNullableText(input.userAgentFamily),
          createdAt: input.createdAt,
        },
      });
    },

    listForHousehold(householdId, limit) {
      return database.auditLog.findMany({
        where: { householdId },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: limit,
      });
    },

    listForProfile(profileId, limit) {
      return database.auditLog.findMany({
        where: { profileId },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: limit,
      });
    },
  };
}

export const auditRepository = createAuditRepository();
