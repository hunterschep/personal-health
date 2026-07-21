import type {
  Prisma,
  RecommendationInstance,
  RecommendationStatus,
} from "@/generated/prisma/client";

import { prisma } from "../db/client";
import type { DatabaseClient } from "../db/transactions";

export type RecommendationSnapshotInput = Prisma.RecommendationInstanceUncheckedCreateInput;

export type SnapshotSyncResult = {
  createdIds: string[];
  unchangedIds: string[];
  retiredIds: string[];
};

export interface RecommendationRepository {
  findActiveById(id: string): Promise<RecommendationInstance | null>;
  listActiveForProfile(profileId: string): Promise<RecommendationInstance[]>;
  listActiveByStatus(
    profileId: string,
    statuses: RecommendationStatus[],
  ): Promise<RecommendationInstance[]>;
  synchronizeActiveSnapshots(
    profileId: string,
    snapshots: RecommendationSnapshotInput[],
    retiredAt: Date,
  ): Promise<SnapshotSyncResult>;
}

export function createRecommendationRepository(
  database: DatabaseClient = prisma,
): RecommendationRepository {
  return {
    findActiveById(id) {
      return database.recommendationInstance.findFirst({
        where: { id, retiredAt: null },
      });
    },

    listActiveForProfile(profileId) {
      return database.recommendationInstance.findMany({
        where: { profileId, retiredAt: null },
        orderBy: [{ dueStart: "asc" }, { serviceId: "asc" }, { id: "asc" }],
      });
    },

    listActiveByStatus(profileId, statuses) {
      if (statuses.length === 0) {
        return Promise.resolve([]);
      }

      return database.recommendationInstance.findMany({
        where: { profileId, retiredAt: null, status: { in: statuses } },
        orderBy: [{ dueStart: "asc" }, { serviceId: "asc" }, { id: "asc" }],
      });
    },

    async synchronizeActiveSnapshots(profileId, snapshots, retiredAt) {
      if (snapshots.some((snapshot) => snapshot.profileId !== profileId)) {
        throw new Error("Every recommendation snapshot must belong to the requested profile.");
      }

      const current = await database.recommendationInstance.findMany({
        where: { profileId, retiredAt: null },
      });
      const currentByRule = new Map(current.map((snapshot) => [snapshot.ruleId, snapshot]));
      const incomingRuleIds = new Set(snapshots.map((snapshot) => snapshot.ruleId));
      const result: SnapshotSyncResult = { createdIds: [], unchangedIds: [], retiredIds: [] };

      for (const snapshot of snapshots) {
        const existing = currentByRule.get(snapshot.ruleId);
        // Databases upgraded from the pre-release CHAR(64) column can return a
        // right-padded value until the corrective migration is applied.
        if (existing?.calculationHash.trimEnd() === snapshot.calculationHash) {
          result.unchangedIds.push(existing.id);
          continue;
        }

        if (existing !== undefined) {
          await database.recommendationInstance.update({
            where: { id: existing.id },
            data: { retiredAt },
          });
          result.retiredIds.push(existing.id);
        }

        const created = await database.recommendationInstance.create({ data: snapshot });
        result.createdIds.push(created.id);
      }

      const staleIds = current
        .filter((snapshot) => !incomingRuleIds.has(snapshot.ruleId))
        .map(({ id }) => id);

      if (staleIds.length > 0) {
        await database.recommendationInstance.updateMany({
          where: { id: { in: staleIds }, retiredAt: null },
          data: { retiredAt },
        });
        result.retiredIds.push(...staleIds);
      }

      return result;
    },
  };
}

export const recommendationRepository = createRecommendationRepository();
