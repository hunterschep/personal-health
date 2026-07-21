import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { ExternalSourceError } from "@/domain/shared/errors";
import {
  createMyHealthfinderCacheKey,
  MyHealthfinderClient,
  type AnonymousMyHealthfinderInput,
} from "./myhealthfinder";
import { myHealthfinderPayloadSchema, type MyHealthfinderPayload } from "./sanitize";
import { sourceChangeStateSchema, type SourceChangeState } from "./types";

export const MYHEALTHFINDER_SOURCE_SLUG = "myhealthfinder-consumer-content-v4" as const;

const cachedRevisionSchema = z
  .object({
    payload: myHealthfinderPayloadSchema,
    contentHash: z.string().regex(/^[a-f0-9]{64}$/),
    fetchedAt: z.iso.datetime(),
    expiresAt: z.iso.datetime(),
    lastSuccessfulAt: z.iso.datetime(),
  })
  .strict();
export type CachedSourceRevision = z.infer<typeof cachedRevisionSchema>;

export const sourceReviewDecisionSchema = z
  .object({
    decision: z.enum(["approved", "rejected", "acknowledged"]),
    reviewer: z.string().trim().min(1).max(160),
    reviewedAt: z.iso.datetime(),
    note: z.string().trim().min(1).max(1_000).nullable(),
  })
  .strict();
export type SourceReviewDecision = z.infer<typeof sourceReviewDecisionSchema>;

export const cachedSourceRecordSchema = z
  .object({
    sourceSlug: z.string().min(1),
    cacheKey: z.string().min(1),
    current: cachedRevisionSchema,
    priorRevisions: z.array(cachedRevisionSchema).max(5),
    changeState: sourceChangeStateSchema,
    reviewDecision: sourceReviewDecisionSchema.nullable().default(null),
  })
  .strict();
export type CachedSourceRecord = z.infer<typeof cachedSourceRecordSchema>;

export type SourceSyncLogEntry = {
  sourceSlug: string;
  cacheKey: string;
  startedAt: string;
  finishedAt: string;
  status: "success" | "fallback" | "failed";
  httpStatus: number | null;
  contentHash: string | null;
  changed: boolean;
  message: string | null;
};

export interface SourceCacheStorage {
  get(sourceSlug: string, cacheKey: string): Promise<CachedSourceRecord | null>;
  put(record: CachedSourceRecord): Promise<void>;
  appendSyncLog(entry: SourceSyncLogEntry): Promise<void>;
  markReviewed(sourceSlug: string, cacheKey: string): Promise<void>;
  recordReview(sourceSlug: string, cacheKey: string, decision: SourceReviewDecision): Promise<void>;
}

function reviewedRecord(
  record: CachedSourceRecord,
  decision: SourceReviewDecision,
): CachedSourceRecord {
  if (record.changeState !== "changed_unreviewed") {
    throw new Error("Only changed, unreviewed source content can receive a review decision.");
  }
  return cachedSourceRecordSchema.parse({
    ...record,
    changeState: "changed_reviewed",
    reviewDecision: sourceReviewDecisionSchema.parse(decision),
  });
}

function cloneRecord(record: CachedSourceRecord): CachedSourceRecord {
  return cachedSourceRecordSchema.parse(structuredClone(record));
}

export class InMemorySourceCacheStorage implements SourceCacheStorage {
  private readonly records = new Map<string, CachedSourceRecord>();
  readonly syncLogs: SourceSyncLogEntry[] = [];

  private key(sourceSlug: string, cacheKey: string): string {
    return `${sourceSlug}\u0000${cacheKey}`;
  }

  async get(sourceSlug: string, cacheKey: string): Promise<CachedSourceRecord | null> {
    const record = this.records.get(this.key(sourceSlug, cacheKey));
    return record === undefined ? null : cloneRecord(record);
  }

  async put(record: CachedSourceRecord): Promise<void> {
    const parsed = cachedSourceRecordSchema.parse(record);
    this.records.set(this.key(parsed.sourceSlug, parsed.cacheKey), cloneRecord(parsed));
  }

  async appendSyncLog(entry: SourceSyncLogEntry): Promise<void> {
    this.syncLogs.push(structuredClone(entry));
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
    const key = this.key(sourceSlug, cacheKey);
    const record = this.records.get(key);
    if (record === undefined) throw new Error("Cached source content was not found.");
    this.records.set(key, reviewedRecord(record, decision));
  }
}

const fileStorageSchema = z
  .object({
    version: z.literal(1),
    records: z.array(cachedSourceRecordSchema),
    syncLogs: z.array(
      z
        .object({
          sourceSlug: z.string(),
          cacheKey: z.string(),
          startedAt: z.iso.datetime(),
          finishedAt: z.iso.datetime(),
          status: z.enum(["success", "fallback", "failed"]),
          httpStatus: z.number().int().nullable(),
          contentHash: z.string().nullable(),
          changed: z.boolean(),
          message: z.string().nullable(),
        })
        .strict(),
    ),
  })
  .strict();
type FileStorageState = z.infer<typeof fileStorageSchema>;

const EMPTY_FILE_STATE: FileStorageState = { version: 1, records: [], syncLogs: [] };

export class JsonFileSourceCacheStorage implements SourceCacheStorage {
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(private readonly filePath: string) {
    if (!path.isAbsolute(filePath)) {
      throw new TypeError("Source cache file path must be absolute.");
    }
  }

  private async readState(): Promise<FileStorageState> {
    try {
      const raw = await readFile(this.filePath, "utf8");
      return fileStorageSchema.parse(JSON.parse(raw) as unknown);
    } catch (error) {
      if (
        error !== null &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        return structuredClone(EMPTY_FILE_STATE);
      }
      throw error;
    }
  }

  private enqueueMutation(mutate: (state: FileStorageState) => void): Promise<void> {
    const operation = this.writeQueue.then(async () => {
      const state = await this.readState();
      mutate(state);
      const validated = fileStorageSchema.parse(state);
      await mkdir(path.dirname(this.filePath), { recursive: true, mode: 0o700 });
      const temporaryPath = `${this.filePath}.${randomUUID()}.tmp`;
      await writeFile(temporaryPath, `${JSON.stringify(validated, null, 2)}\n`, {
        encoding: "utf8",
        mode: 0o600,
      });
      await rename(temporaryPath, this.filePath);
    });
    this.writeQueue = operation.catch(() => undefined);
    return operation;
  }

  async get(sourceSlug: string, cacheKey: string): Promise<CachedSourceRecord | null> {
    await this.writeQueue;
    const state = await this.readState();
    const record = state.records.find(
      (candidate) => candidate.sourceSlug === sourceSlug && candidate.cacheKey === cacheKey,
    );
    return record === undefined ? null : cloneRecord(record);
  }

  async put(record: CachedSourceRecord): Promise<void> {
    const parsed = cachedSourceRecordSchema.parse(record);
    return this.enqueueMutation((state) => {
      const index = state.records.findIndex(
        (candidate) =>
          candidate.sourceSlug === parsed.sourceSlug && candidate.cacheKey === parsed.cacheKey,
      );
      if (index === -1) state.records.push(parsed);
      else state.records[index] = parsed;
    });
  }

  async appendSyncLog(entry: SourceSyncLogEntry): Promise<void> {
    return this.enqueueMutation((state) => {
      state.syncLogs.push(structuredClone(entry));
      if (state.syncLogs.length > 2_000) state.syncLogs.splice(0, state.syncLogs.length - 2_000);
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
    return this.enqueueMutation((state) => {
      const record = state.records.find(
        (candidate) => candidate.sourceSlug === sourceSlug && candidate.cacheKey === cacheKey,
      );
      if (record === undefined) throw new Error("Cached source content was not found.");
      const index = state.records.indexOf(record);
      state.records[index] = reviewedRecord(record, decision);
    });
  }
}

export type CachedContentStatus = "live" | "cache_fresh" | "cache_fallback";

export type MyHealthfinderContentResult = {
  payload: MyHealthfinderPayload;
  contentHash: string;
  fetchedAt: string;
  expiresAt: string;
  status: CachedContentStatus;
  stale: boolean;
  changeState: SourceChangeState;
};

export type LoadMyHealthfinderContentOptions = {
  input: AnonymousMyHealthfinderInput;
  client: MyHealthfinderClient;
  storage: SourceCacheStorage;
  now?: Date;
  ttlMs?: number;
  forceRefresh?: boolean;
};

function isExpired(record: CachedSourceRecord, now: Date): boolean {
  return Date.parse(record.current.expiresAt) <= now.getTime();
}

function resultFromCache(
  record: CachedSourceRecord,
  status: "cache_fresh" | "cache_fallback",
  now: Date,
): MyHealthfinderContentResult {
  return {
    payload: record.current.payload,
    contentHash: record.current.contentHash,
    fetchedAt: record.current.fetchedAt,
    expiresAt: record.current.expiresAt,
    status,
    stale: isExpired(record, now),
    changeState: record.changeState,
  };
}

export async function loadMyHealthfinderContent({
  input,
  client,
  storage,
  now = new Date(),
  ttlMs = 24 * 60 * 60 * 1_000,
  forceRefresh = false,
}: LoadMyHealthfinderContentOptions): Promise<MyHealthfinderContentResult> {
  if (ttlMs <= 0) throw new RangeError("Source cache TTL must be positive.");

  const cacheKey = createMyHealthfinderCacheKey(input);
  const cached = await storage.get(MYHEALTHFINDER_SOURCE_SLUG, cacheKey);
  if (!forceRefresh && cached !== null && !isExpired(cached, now)) {
    return resultFromCache(cached, "cache_fresh", now);
  }

  const startedAt = now.toISOString();
  try {
    const fetched = await client.fetch(input);
    const changed = cached !== null && cached.current.contentHash !== fetched.contentHash;
    const nextRevision: CachedSourceRevision = {
      payload: fetched.payload,
      contentHash: fetched.contentHash,
      fetchedAt: fetched.fetchedAt,
      expiresAt: new Date(Date.parse(fetched.fetchedAt) + ttlMs).toISOString(),
      lastSuccessfulAt: fetched.fetchedAt,
    };
    const record: CachedSourceRecord = {
      sourceSlug: MYHEALTHFINDER_SOURCE_SLUG,
      cacheKey,
      current: nextRevision,
      priorRevisions:
        changed && cached !== null
          ? [cached.current, ...cached.priorRevisions].slice(0, 5)
          : (cached?.priorRevisions ?? []),
      changeState: changed ? "changed_unreviewed" : (cached?.changeState ?? "unchanged"),
      reviewDecision: changed ? null : (cached?.reviewDecision ?? null),
    };
    await storage.put(record);
    await storage.appendSyncLog({
      sourceSlug: MYHEALTHFINDER_SOURCE_SLUG,
      cacheKey,
      startedAt,
      finishedAt: fetched.fetchedAt,
      status: "success",
      httpStatus: fetched.httpStatus,
      contentHash: fetched.contentHash,
      changed,
      message: changed ? "Source content changed and requires review." : null,
    });
    return {
      payload: fetched.payload,
      contentHash: fetched.contentHash,
      fetchedAt: fetched.fetchedAt,
      expiresAt: nextRevision.expiresAt,
      status: "live",
      stale: false,
      changeState: record.changeState,
    };
  } catch (error) {
    const finishedAt = new Date().toISOString();
    await storage.appendSyncLog({
      sourceSlug: MYHEALTHFINDER_SOURCE_SLUG,
      cacheKey,
      startedAt,
      finishedAt,
      status: cached === null ? "failed" : "fallback",
      httpStatus: null,
      contentHash: cached?.current.contentHash ?? null,
      changed: false,
      message:
        cached === null
          ? "Live source unavailable and no cached content exists."
          : "Live source unavailable; returned the last successful cached content.",
    });
    if (cached !== null) return resultFromCache(cached, "cache_fallback", now);
    throw error instanceof ExternalSourceError
      ? error
      : new ExternalSourceError("Source content is temporarily unavailable.", { cause: error });
  }
}
