import { describe, expect, it, vi } from "vitest";
import { ExternalSourceError } from "@/domain/shared/errors";
import {
  InMemorySourceCacheStorage,
  loadMyHealthfinderContent,
  MYHEALTHFINDER_SOURCE_SLUG,
} from "./cache";
import {
  createMyHealthfinderCacheKey,
  MyHealthfinderClient,
  type AnonymousMyHealthfinderInput,
} from "./myhealthfinder";
import { jsonResponse, myHealthfinderPayload } from "./test-fixtures.test-helper";

const input: AnonymousMyHealthfinderInput = { age: 45, sex: "male", language: "en" };

function clientFor(
  payload: unknown,
  now = "2026-07-21T12:00:00.000Z",
): { client: MyHealthfinderClient; request: ReturnType<typeof vi.fn> } {
  const request = vi.fn(async () => jsonResponse(payload));
  return {
    request,
    client: new MyHealthfinderClient({
      fetch: request,
      now: () => new Date(now),
      maxRetries: 0,
    }),
  };
}

describe("MyHealthfinder cache service", () => {
  it("stores a successful response and serves a fresh cache without a network request", async () => {
    const storage = new InMemorySourceCacheStorage();
    const firstClient = clientFor(myHealthfinderPayload());
    const first = await loadMyHealthfinderContent({
      input,
      client: firstClient.client,
      storage,
      now: new Date("2026-07-21T12:00:00.000Z"),
      ttlMs: 60_000,
    });
    expect(first.status).toBe("live");

    const secondClient = clientFor(myHealthfinderPayload("Should not be fetched"));
    const second = await loadMyHealthfinderContent({
      input,
      client: secondClient.client,
      storage,
      now: new Date("2026-07-21T12:00:30.000Z"),
      ttlMs: 60_000,
    });
    expect(second.status).toBe("cache_fresh");
    expect(secondClient.request).not.toHaveBeenCalled();
  });

  it("returns the last successful payload when the live source fails", async () => {
    const storage = new InMemorySourceCacheStorage();
    const successful = clientFor(myHealthfinderPayload("Cached title"));
    await loadMyHealthfinderContent({
      input,
      client: successful.client,
      storage,
      now: new Date("2026-07-21T12:00:00.000Z"),
      ttlMs: 1_000,
    });

    const failedRequest = vi.fn(async () => {
      throw new TypeError("network offline");
    });
    const failingClient = new MyHealthfinderClient({ fetch: failedRequest, maxRetries: 0 });
    const fallback = await loadMyHealthfinderContent({
      input,
      client: failingClient,
      storage,
      now: new Date("2026-07-21T12:01:00.000Z"),
      forceRefresh: true,
    });

    expect(fallback.status).toBe("cache_fallback");
    expect(fallback.stale).toBe(true);
    expect(JSON.stringify(fallback.payload)).toContain("Cached title");
    expect(storage.syncLogs.at(-1)).toMatchObject({ status: "fallback", changed: false });
  });

  it("preserves the old revision and flags changed content for review", async () => {
    const storage = new InMemorySourceCacheStorage();
    await loadMyHealthfinderContent({
      input,
      client: clientFor(myHealthfinderPayload("Original")).client,
      storage,
      now: new Date("2026-07-21T12:00:00.000Z"),
      forceRefresh: true,
    });
    const changed = await loadMyHealthfinderContent({
      input,
      client: clientFor(myHealthfinderPayload("Changed"), "2026-07-21T13:00:00.000Z").client,
      storage,
      now: new Date("2026-07-21T13:00:00.000Z"),
      forceRefresh: true,
    });

    expect(changed.changeState).toBe("changed_unreviewed");
    const key = createMyHealthfinderCacheKey(input);
    const record = await storage.get(MYHEALTHFINDER_SOURCE_SLUG, key);
    expect(record?.priorRevisions).toHaveLength(1);
    expect(JSON.stringify(record?.priorRevisions[0]?.payload)).toContain("Original");

    await storage.markReviewed(MYHEALTHFINDER_SOURCE_SLUG, key);
    expect((await storage.get(MYHEALTHFINDER_SOURCE_SLUG, key))?.changeState).toBe(
      "changed_reviewed",
    );
    expect((await storage.get(MYHEALTHFINDER_SOURCE_SLUG, key))?.reviewDecision).toMatchObject({
      decision: "acknowledged",
      reviewer: "maintenance-command",
    });
  });

  it("persists an explicit maintainer decision and prevents re-reviewing stable content", async () => {
    const storage = new InMemorySourceCacheStorage();
    await loadMyHealthfinderContent({
      input,
      client: clientFor(myHealthfinderPayload("Original")).client,
      storage,
      forceRefresh: true,
    });
    await loadMyHealthfinderContent({
      input,
      client: clientFor(myHealthfinderPayload("Changed"), "2026-07-21T13:00:00.000Z").client,
      storage,
      now: new Date("2026-07-21T13:00:00.000Z"),
      forceRefresh: true,
    });
    const key = createMyHealthfinderCacheKey(input);
    await storage.recordReview(MYHEALTHFINDER_SOURCE_SLUG, key, {
      decision: "rejected",
      reviewer: "Synthetic Maintainer",
      reviewedAt: "2026-07-21T14:00:00.000Z",
      note: "No consumer-summary update approved.",
    });

    const reviewed = await storage.get(MYHEALTHFINDER_SOURCE_SLUG, key);
    expect(reviewed).toMatchObject({
      changeState: "changed_reviewed",
      reviewDecision: {
        decision: "rejected",
        reviewer: "Synthetic Maintainer",
        note: "No consumer-summary update approved.",
      },
    });
    await expect(
      storage.recordReview(MYHEALTHFINDER_SOURCE_SLUG, key, {
        decision: "approved",
        reviewer: "Synthetic Maintainer",
        reviewedAt: "2026-07-21T15:00:00.000Z",
        note: null,
      }),
    ).rejects.toThrow("Only changed, unreviewed");
  });

  it("fails safely when neither live nor cached content is available", async () => {
    const storage = new InMemorySourceCacheStorage();
    const client = new MyHealthfinderClient({
      fetch: async () => {
        throw new TypeError("offline");
      },
      maxRetries: 0,
    });
    await expect(
      loadMyHealthfinderContent({ input, client, storage, forceRefresh: true }),
    ).rejects.toBeInstanceOf(ExternalSourceError);
    expect(storage.syncLogs.at(-1)?.status).toBe("failed");
  });
});
