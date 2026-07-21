// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const database = {
    householdMember: { updateMany: vi.fn(), update: vi.fn() },
    profile: { updateMany: vi.fn() },
    profileAccessGrant: { deleteMany: vi.fn() },
    auditLog: { create: vi.fn() },
  };
  return {
    assertSameOrigin: vi.fn(),
    requireHouseholdAccess: vi.fn(),
    memberFindFirst: vi.fn(),
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
vi.mock("@/server/db/client", () => ({
  prisma: {
    householdMember: { findFirst: mocks.memberFindFirst },
    $transaction: mocks.transaction,
  },
}));

import { DELETE } from "./route";

describe("household member removal privacy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireHouseholdAccess.mockResolvedValue({
      session: { user: { id: "actor-user" } },
      household: { id: "household-id" },
    });
    mocks.memberFindFirst.mockResolvedValue({
      id: "member-id",
      userId: "removed-user",
      role: "member",
    });
    mocks.database.householdMember.updateMany.mockResolvedValue({ count: 1 });
    mocks.database.profile.updateMany.mockResolvedValue({ count: 1 });
    mocks.database.profileAccessGrant.deleteMany.mockResolvedValue({ count: 3 });
    mocks.database.auditLog.create.mockResolvedValue({ id: "audit-id" });
  });

  it("preserves ownership while closing all household sharing", async () => {
    const response = await DELETE(
      new Request("http://localhost/api/member", { method: "DELETE" }),
      {
        params: Promise.resolve({ householdId: "household-id", memberId: "member-id" }),
      },
    );

    expect(response.status).toBe(200);
    expect(mocks.database.profile.updateMany).toHaveBeenCalledWith({
      where: {
        householdId: "household-id",
        ownerUserId: "removed-user",
        deletedAt: null,
      },
      data: { visibility: "owner_only" },
    });
    expect(mocks.database.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorUserId: "actor-user",
        metadataJson: { protectedProfileCount: 1, revokedGrantCount: 3 },
      }),
    });
  });

  it("does not let a manager remove themselves through the member route", async () => {
    mocks.memberFindFirst.mockResolvedValue({
      id: "member-id",
      userId: "actor-user",
      role: "admin",
    });

    const response = await DELETE(
      new Request("http://localhost/api/member", { method: "DELETE" }),
      {
        params: Promise.resolve({ householdId: "household-id", memberId: "member-id" }),
      },
    );

    expect(response.status).toBe(409);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
