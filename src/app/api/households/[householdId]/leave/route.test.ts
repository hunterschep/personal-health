// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const database = {
    householdMember: { updateMany: vi.fn() },
    profile: { updateMany: vi.fn() },
    profileAccessGrant: { deleteMany: vi.fn() },
    auditLog: { create: vi.fn() },
  };
  return {
    assertSameOrigin: vi.fn(),
    requireHouseholdAccess: vi.fn(),
    transaction: vi.fn(async (callback: (transactionDatabase: unknown) => unknown) =>
      callback(database),
    ),
    database,
  };
});

vi.mock("@/server/auth/csrf", () => ({ assertSameOrigin: mocks.assertSameOrigin }));
vi.mock("@/server/authorization/household", () => ({
  requireHouseholdAccess: mocks.requireHouseholdAccess,
}));
vi.mock("@/server/db/client", () => ({ prisma: { $transaction: mocks.transaction } }));

import { POST } from "./route";

describe("household leave privacy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireHouseholdAccess.mockResolvedValue({
      session: { user: { id: "departing-user" } },
      membership: { id: "membership-id", role: "member" },
      household: { id: "household-id" },
    });
    mocks.database.householdMember.updateMany.mockResolvedValue({ count: 1 });
    mocks.database.profile.updateMany.mockResolvedValue({ count: 2 });
    mocks.database.profileAccessGrant.deleteMany.mockResolvedValue({ count: 5 });
    mocks.database.auditLog.create.mockResolvedValue({ id: "audit-id" });
  });

  it("makes owned profiles private and revokes both sides of sharing transactionally", async () => {
    const response = await POST(new Request("http://localhost/api/leave", { method: "POST" }), {
      params: Promise.resolve({ householdId: "household-id" }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      protectedProfileCount: 2,
      revokedGrantCount: 5,
    });
    expect(mocks.database.profile.updateMany).toHaveBeenCalledWith({
      where: {
        householdId: "household-id",
        ownerUserId: "departing-user",
        deletedAt: null,
      },
      data: { visibility: "owner_only" },
    });
    expect(mocks.database.profileAccessGrant.deleteMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { userId: "departing-user", profile: { householdId: "household-id" } },
          {
            profile: { householdId: "household-id", ownerUserId: "departing-user" },
          },
        ],
      },
    });
    expect(mocks.database.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        metadataJson: { protectedProfileCount: 2, revokedGrantCount: 5 },
      }),
    });
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
  });

  it("keeps the final owner in place", async () => {
    mocks.requireHouseholdAccess.mockResolvedValue({
      session: { user: { id: "owner-user" } },
      membership: { id: "membership-id", role: "owner" },
      household: { id: "household-id" },
    });

    const response = await POST(new Request("http://localhost/api/leave", { method: "POST" }), {
      params: Promise.resolve({ householdId: "household-id" }),
    });

    expect(response.status).toBe(409);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
