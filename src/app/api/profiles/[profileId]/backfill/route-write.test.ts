// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireProfileAccess: vi.fn(),
  serviceFindFirst: vi.fn(),
  transaction: vi.fn(),
  rebuildRecommendations: vi.fn(),
}));

vi.mock("@/server/auth/csrf", () => ({ assertSameOrigin: vi.fn() }));
vi.mock("@/server/authorization/profile", () => ({
  requireProfileAccess: mocks.requireProfileAccess,
}));
vi.mock("@/server/db/client", () => ({
  prisma: {
    serviceCatalog: { findFirst: mocks.serviceFindFirst },
    $transaction: mocks.transaction,
  },
}));
vi.mock("@/server/recommendations", () => ({
  rebuildRecommendations: mocks.rebuildRecommendations,
}));

import { POST } from "./route";

const profileId = "10000000-0000-4000-8000-000000000001";
const serviceId = "10000000-0000-4000-8000-000000000002";
const context = { params: Promise.resolve({ profileId }) };

function request(body: Record<string, unknown>) {
  return new Request(`http://localhost/api/profiles/${profileId}/backfill`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      serviceId,
      eventId: null,
      methodId: null,
      precision: "unknown",
      date: null,
      result: "normal",
      ...body,
    }),
  });
}

describe("backfill writes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireProfileAccess.mockResolvedValue({
      session: { user: { id: "user-1" } },
      profile: { id: profileId, householdId: "household-1", timezone: "America/Los_Angeles" },
    });
    mocks.serviceFindFirst.mockResolvedValue({ id: serviceId });
    mocks.rebuildRecommendations.mockResolvedValue({});
  });

  it("requires and persists a reasoned not-applicable organizer response", async () => {
    const invalid = await POST(request({ answer: "not_applicable", reason: "" }), context);
    expect(invalid.status).toBe(400);
    expect(mocks.transaction).not.toHaveBeenCalled();

    const upsert = vi.fn(async () => ({ id: "state-1" }));
    const database = {
      profileServiceHistoryState: { upsert },
      auditLog: { create: vi.fn(async () => ({ id: "audit-1" })) },
    };
    mocks.transaction.mockImplementation(
      async (callback: (client: typeof database) => Promise<unknown>) => callback(database),
    );

    const response = await POST(
      request({ answer: "not_applicable", reason: "My clinician said this does not apply" }),
      context,
    );

    expect(response.status).toBe(200);
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          state: "not_applicable_claim",
          reason: "My clinician said this does not apply",
        }),
      }),
    );
  });

  it("stores optional provider and note on a completed unknown-date event", async () => {
    const eventCreate = vi.fn(async () => ({ id: "event-1" }));
    const database = {
      careEvent: { findFirst: vi.fn(async () => null), create: eventCreate },
      profileServiceHistoryState: { upsert: vi.fn(async () => ({ id: "state-1" })) },
      auditLog: { create: vi.fn(async () => ({ id: "audit-1" })) },
    };
    mocks.transaction.mockImplementation(
      async (callback: (client: typeof database) => Promise<unknown>) => callback(database),
    );

    const response = await POST(
      request({
        answer: "completed",
        providerName: "Dr. Rivera",
        note: "Recalled from the portal summary",
      }),
      context,
    );

    expect(response.status).toBe(200);
    expect(eventCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        providerName: "Dr. Rivera",
        notes: "Recalled from the portal summary",
        datePrecision: "unknown",
      }),
    });
  });

  it("preserves provenance while refining an existing event", async () => {
    const eventId = "10000000-0000-4000-8000-000000000003";
    const eventUpdate = vi.fn(async () => ({ id: eventId }));
    const database = {
      careEvent: {
        findFirst: vi.fn(async () => ({
          id: eventId,
          importBatchId: "batch-1",
          createdByUserId: "user-original",
          source: "medical_record" as const,
          locationName: "Community clinic",
        })),
        update: eventUpdate,
      },
      profileServiceHistoryState: { upsert: vi.fn(async () => ({ id: "state-1" })) },
      auditLog: { create: vi.fn(async () => ({ id: "audit-1" })) },
    };
    mocks.transaction.mockImplementation(
      async (callback: (client: typeof database) => Promise<unknown>) => callback(database),
    );

    const response = await POST(
      request({
        answer: "completed",
        eventId,
        precision: "day",
        date: "2024-03-12",
        providerName: "Dr. Rivera",
        note: "Confirmed from the original record",
      }),
      context,
    );

    expect(response.status).toBe(200);
    expect(eventUpdate).toHaveBeenCalledWith({
      where: { id: eventId },
      data: expect.objectContaining({
        source: "medical_record",
        locationName: "Community clinic",
        importBatchId: "batch-1",
        createdByUserId: "user-original",
        providerName: "Dr. Rivera",
        notes: "Confirmed from the original record",
      }),
    });
  });
});
