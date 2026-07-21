import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireProfileAccess: vi.fn(),
  verifyImportToken: vi.fn(),
  rebuildRecommendations: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/server/auth/csrf", () => ({ assertSameOrigin: vi.fn() }));
vi.mock("@/server/authorization/profile", () => ({
  requireProfileAccess: mocks.requireProfileAccess,
}));
vi.mock("@/server/db/client", () => ({ prisma: { $transaction: mocks.transaction } }));
vi.mock("@/server/imports", () => ({
  importTokenHash: vi.fn(() => "a".repeat(64)),
  verifyImportToken: mocks.verifyImportToken,
}));
vi.mock("@/server/repositories/care-event", () => ({
  careEventFingerprint: vi.fn(() => "b".repeat(64)),
}));
vi.mock("@/server/recommendations", () => ({
  rebuildRecommendations: mocks.rebuildRecommendations,
}));

import { POST } from "./route";

describe("CSV import commit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireProfileAccess.mockResolvedValue({
      session: { user: { id: "10000000-0000-4000-8000-000000000002" } },
      profile: {
        id: "10000000-0000-4000-8000-000000000001",
        householdId: "10000000-0000-4000-8000-000000000003",
      },
    });
    mocks.verifyImportToken.mockResolvedValue({
      batchId: "10000000-0000-4000-8000-000000000004",
      profileId: "10000000-0000-4000-8000-000000000001",
      userId: "10000000-0000-4000-8000-000000000002",
      rows: [
        {
          rowNumber: 2,
          service: "colorectal-screening",
          method: null,
          date: "2025",
          datePrecision: "year",
          result: "normal",
          provider: null,
          location: null,
          source: "csv_import",
          notes: null,
          performedStart: "2025-01-01",
          performedEnd: "2025-12-31",
          serviceId: "10000000-0000-4000-8000-000000000005",
          methodId: null,
          errors: [],
          warnings: [],
          possibleDuplicateIds: [],
        },
      ],
    });
    mocks.rebuildRecommendations.mockResolvedValue({});
  });

  it("commits once and returns the original result for token retries", async () => {
    let status: "ready" | "committing" | "committed" = "ready";
    let importedCount = 0;
    const createMany = vi.fn(async ({ data }: { data: unknown[] }) => {
      importedCount += data.length;
      return { count: data.length };
    });
    const database = {
      $queryRaw: vi.fn(async () => [{ id: "batch" }]),
      importBatch: {
        findFirst: vi.fn(async () => ({
          id: "10000000-0000-4000-8000-000000000004",
          status,
        })),
        update: vi.fn(async ({ data }: { data: { status: typeof status } }) => {
          status = data.status;
          return { id: "batch", status };
        }),
      },
      careEvent: {
        count: vi.fn(async () => importedCount),
        createMany,
      },
      auditLog: { create: vi.fn(async () => ({ id: "audit" })) },
    };
    mocks.transaction.mockImplementation(
      async (callback: (client: typeof database) => Promise<unknown>) => callback(database),
    );

    const call = () =>
      POST(
        new Request("http://localhost/api/profiles/profile/import/commit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: "x".repeat(40), includeWarningRows: true }),
        }),
        { params: Promise.resolve({ profileId: "10000000-0000-4000-8000-000000000001" }) },
      );
    const first = await call();
    const second = await call();

    expect(await first.json()).toMatchObject({ importedCount: 1, idempotent: false });
    expect(await second.json()).toMatchObject({ importedCount: 1, idempotent: true });
    expect(createMany).toHaveBeenCalledTimes(1);
    expect(mocks.rebuildRecommendations).toHaveBeenCalledTimes(1);
  });

  it("commits explicitly selected valid rows while preserving errored bulk rows", async () => {
    const baseRow = {
      rowNumber: 2,
      service: "colorectal-screening",
      method: null,
      date: "2025",
      datePrecision: "year" as const,
      result: "normal" as const,
      provider: null,
      location: null,
      source: "csv_import" as const,
      notes: null,
      performedStart: "2025-01-01",
      performedEnd: "2025-12-31",
      serviceId: "10000000-0000-4000-8000-000000000005",
      methodId: null,
      errors: [],
      warnings: [],
      possibleDuplicateIds: [],
    };
    mocks.verifyImportToken.mockResolvedValue({
      batchId: "10000000-0000-4000-8000-000000000004",
      profileId: "10000000-0000-4000-8000-000000000001",
      userId: "10000000-0000-4000-8000-000000000002",
      rows: [
        baseRow,
        {
          ...baseRow,
          rowNumber: 3,
          service: "unknown-service",
          serviceId: null,
          errors: ["Service was not recognized."],
        },
      ],
    });
    const createMany = vi.fn(async ({ data }: { data: unknown[] }) => ({ count: data.length }));
    const database = {
      $queryRaw: vi.fn(async () => [{ id: "batch" }]),
      importBatch: {
        findFirst: vi.fn(async () => ({
          id: "10000000-0000-4000-8000-000000000004",
          status: "ready",
        })),
        update: vi.fn(async () => ({ id: "batch" })),
      },
      careEvent: { count: vi.fn(async () => 0), createMany },
      auditLog: { create: vi.fn(async () => ({ id: "audit" })) },
    };
    mocks.transaction.mockImplementation(
      async (callback: (client: typeof database) => Promise<unknown>) => callback(database),
    );

    const response = await POST(
      new Request("http://localhost/api/profiles/profile/import/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: "x".repeat(40), includeRowNumbers: [2] }),
      }),
      { params: Promise.resolve({ profileId: "10000000-0000-4000-8000-000000000001" }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ importedCount: 1, idempotent: false });
    expect(createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ serviceId: baseRow.serviceId })],
    });
    expect(mocks.rebuildRecommendations).toHaveBeenCalledTimes(1);
  });
});
