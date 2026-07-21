import type { ExternalContentCache, Prisma, SourceSyncLog } from "@/generated/prisma/client";

import { prisma } from "../db/client";
import type { DatabaseClient } from "../db/transactions";
import { normalizeNullableText, normalizeText } from "./normalize";

export type UpsertSourceCacheRecord = {
  sourceId: string;
  cacheKey: string;
  payloadJson: Prisma.InputJsonValue;
  contentHash: string;
  fetchedAt: Date;
  expiresAt: Date;
  lastSuccessfulAt: Date;
};

export type StartSourceSyncRecord = {
  sourceId: string;
  startedAt: Date;
  status: string;
};

export type FinishSourceSyncRecord = {
  finishedAt: Date;
  status: string;
  httpStatus: number | null;
  contentHash: string | null;
  changed: boolean;
  message: string | null;
};

export interface SourceCacheRepository {
  getFresh(sourceId: string, cacheKey: string, now: Date): Promise<ExternalContentCache | null>;
  getLastSuccessful(sourceId: string, cacheKey: string): Promise<ExternalContentCache | null>;
  upsert(input: UpsertSourceCacheRecord): Promise<ExternalContentCache>;
  createSyncLog(input: StartSourceSyncRecord): Promise<SourceSyncLog>;
  finishSyncLog(id: string, input: FinishSourceSyncRecord): Promise<SourceSyncLog>;
}

export function createSourceCacheRepository(
  database: DatabaseClient = prisma,
): SourceCacheRepository {
  return {
    getFresh(sourceId, cacheKey, now) {
      return database.externalContentCache.findFirst({
        where: { sourceId, cacheKey, expiresAt: { gt: now } },
      });
    },

    getLastSuccessful(sourceId, cacheKey) {
      return database.externalContentCache.findUnique({
        where: { sourceId_cacheKey: { sourceId, cacheKey } },
      });
    },

    upsert(input) {
      const cacheKey = normalizeText(input.cacheKey);
      const data = {
        payloadJson: input.payloadJson,
        contentHash: input.contentHash,
        fetchedAt: input.fetchedAt,
        expiresAt: input.expiresAt,
        lastSuccessfulAt: input.lastSuccessfulAt,
      };

      return database.externalContentCache.upsert({
        where: { sourceId_cacheKey: { sourceId: input.sourceId, cacheKey } },
        create: { sourceId: input.sourceId, cacheKey, ...data },
        update: data,
      });
    },

    createSyncLog(input) {
      return database.sourceSyncLog.create({
        data: {
          sourceId: input.sourceId,
          startedAt: input.startedAt,
          status: normalizeText(input.status),
        },
      });
    },

    finishSyncLog(id, input) {
      return database.sourceSyncLog.update({
        where: { id },
        data: {
          finishedAt: input.finishedAt,
          status: normalizeText(input.status),
          httpStatus: input.httpStatus,
          contentHash: normalizeNullableText(input.contentHash),
          changed: input.changed,
          message: normalizeNullableText(input.message),
        },
      });
    },
  };
}

export const sourceCacheRepository = createSourceCacheRepository();
