import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireProfileAccess: vi.fn(),
  rebuildRecommendations: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/server/auth/csrf", () => ({ assertSameOrigin: vi.fn() }));
vi.mock("@/server/authorization/profile", () => ({
  requireProfileAccess: mocks.requireProfileAccess,
}));
vi.mock("@/server/db/client", () => ({ prisma: { $transaction: mocks.transaction } }));
vi.mock("@/server/recommendations", () => ({
  rebuildRecommendations: mocks.rebuildRecommendations,
}));

import { DELETE } from "./route";

describe("backfill assertion reset", () => {
  beforeEach(() => {
    mocks.requireProfileAccess.mockResolvedValue({
      session: { user: { id: "10000000-0000-4000-8000-000000000002" } },
      profile: {
        id: "10000000-0000-4000-8000-000000000001",
        householdId: "10000000-0000-4000-8000-000000000003",
      },
    });
    mocks.rebuildRecommendations.mockResolvedValue({});
  });

  it("removes only reversible answers for the requested service and rebuilds once", async () => {
    const database = {
      profileServiceHistoryState: { deleteMany: vi.fn(async () => ({ count: 1 })) },
      auditLog: { create: vi.fn(async () => ({ id: "audit" })) },
    };
    mocks.transaction.mockImplementation(
      async (callback: (client: typeof database) => Promise<unknown>) => callback(database),
    );
    const serviceId = "10000000-0000-4000-8000-000000000004";

    const response = await DELETE(
      new Request(`http://localhost/api/profiles/profile/backfill?serviceId=${serviceId}`, {
        method: "DELETE",
      }),
      { params: Promise.resolve({ profileId: "10000000-0000-4000-8000-000000000001" }) },
    );

    expect(response.status).toBe(200);
    expect(database.profileServiceHistoryState.deleteMany).toHaveBeenCalledWith({
      where: {
        profileId: "10000000-0000-4000-8000-000000000001",
        serviceId,
        state: { in: ["never_completed", "unsure", "not_applicable_claim"] },
      },
    });
    expect(mocks.rebuildRecommendations).toHaveBeenCalledTimes(1);
    expect(database.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "care_history.assertion_reset",
        entityType: "ServiceCatalog",
        entityId: serviceId,
        metadataJson: { count: 1 },
      }),
    });
    await expect(response.json()).resolves.toEqual({ ok: true, count: 1 });
  });
});
