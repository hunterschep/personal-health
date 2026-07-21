import type { Prisma } from "@/generated/prisma/client";
import {
  cachedSourceRecordSchema,
  type CachedSourceRecord,
  type SourceReviewDecision,
  type SourceCacheStorage,
  type SourceSyncLogEntry,
} from "./cache";

export interface SourceCachePersistence {
  getLastSuccessful(
    sourceId: string,
    cacheKey: string,
  ): Promise<{ payloadJson: Prisma.JsonValue } | null>;
  upsert(input: {
    sourceId: string;
    cacheKey: string;
    payloadJson: Prisma.InputJsonValue;
    contentHash: string;
    fetchedAt: Date;
    expiresAt: Date;
    lastSuccessfulAt: Date;
  }): Promise<unknown>;
  createSyncLog(input: {
    sourceId: string;
    startedAt: Date;
    status: string;
  }): Promise<{ id: string }>;
  finishSyncLog(
    id: string,
    input: {
      finishedAt: Date;
      status: string;
      httpStatus: number | null;
      contentHash: string | null;
      changed: boolean;
      message: string | null;
    },
  ): Promise<unknown>;
}

export interface SourceMetadataPersistence {
  findSourceBySlug(slug: string): Promise<{ id: string; active: boolean } | null>;
}

const ENVELOPE_VERSION = 1 as const;

function serializeRecord(record: CachedSourceRecord): Prisma.InputJsonObject {
  return {
    envelopeVersion: ENVELOPE_VERSION,
    serializedRecord: JSON.stringify(cachedSourceRecordSchema.parse(record)),
  };
}

function parseRecord(value: Prisma.JsonValue): CachedSourceRecord {
  if (value === null || Array.isArray(value) || typeof value !== "object") {
    throw new TypeError("Stored source cache envelope is malformed.");
  }
  const version = Reflect.get(value, "envelopeVersion");
  const serialized = Reflect.get(value, "serializedRecord");
  if (version !== ENVELOPE_VERSION || typeof serialized !== "string") {
    throw new TypeError("Stored source cache envelope uses an unsupported version.");
  }
  return cachedSourceRecordSchema.parse(JSON.parse(serialized) as unknown);
}

export class RepositorySourceCacheStorage implements SourceCacheStorage {
  constructor(
    private readonly sourceSlug: string,
    private readonly sourceId: string,
    private readonly repository: SourceCachePersistence,
  ) {}

  private matches(sourceSlug: string): boolean {
    return sourceSlug === this.sourceSlug;
  }

  async get(sourceSlug: string, cacheKey: string): Promise<CachedSourceRecord | null> {
    if (!this.matches(sourceSlug)) return null;
    const stored = await this.repository.getLastSuccessful(this.sourceId, cacheKey);
    return stored === null ? null : parseRecord(stored.payloadJson);
  }

  async put(record: CachedSourceRecord): Promise<void> {
    if (!this.matches(record.sourceSlug)) {
      throw new TypeError("Source storage received a record for a different source.");
    }
    const parsed = cachedSourceRecordSchema.parse(record);
    await this.repository.upsert({
      sourceId: this.sourceId,
      cacheKey: parsed.cacheKey,
      payloadJson: serializeRecord(parsed),
      contentHash: parsed.current.contentHash,
      fetchedAt: new Date(parsed.current.fetchedAt),
      expiresAt: new Date(parsed.current.expiresAt),
      lastSuccessfulAt: new Date(parsed.current.lastSuccessfulAt),
    });
  }

  async appendSyncLog(entry: SourceSyncLogEntry): Promise<void> {
    if (!this.matches(entry.sourceSlug)) return;
    const started = await this.repository.createSyncLog({
      sourceId: this.sourceId,
      startedAt: new Date(entry.startedAt),
      status: "running",
    });
    await this.repository.finishSyncLog(started.id, {
      finishedAt: new Date(entry.finishedAt),
      status: entry.status,
      httpStatus: entry.httpStatus,
      contentHash: entry.contentHash,
      changed: entry.changed,
      message: entry.message,
    });
  }

  async markReviewed(sourceSlug: string, cacheKey: string): Promise<void> {
    return this.recordReview(sourceSlug, cacheKey, {
      decision: "acknowledged",
      reviewer: "maintenance-command",
      reviewedAt: new Date().toISOString(),
      note: null,
    });
  }

  async recordReview(
    sourceSlug: string,
    cacheKey: string,
    decision: SourceReviewDecision,
  ): Promise<void> {
    const record = await this.get(sourceSlug, cacheKey);
    if (record === null) throw new Error("Cached source content was not found.");
    if (record.changeState !== "changed_unreviewed") {
      throw new Error("Only changed, unreviewed source content can receive a review decision.");
    }
    await this.put({ ...record, changeState: "changed_reviewed", reviewDecision: decision });
  }
}

export async function createRepositorySourceCacheStorage({
  sourceSlug,
  sourceRepository,
  cacheRepository,
}: {
  sourceSlug: string;
  sourceRepository: SourceMetadataPersistence;
  cacheRepository: SourceCachePersistence;
}): Promise<RepositorySourceCacheStorage> {
  const source = await sourceRepository.findSourceBySlug(sourceSlug);
  if (source === null || !source.active) {
    throw new Error(`Active source is not seeded: ${sourceSlug}.`);
  }
  return new RepositorySourceCacheStorage(sourceSlug, source.id, cacheRepository);
}
