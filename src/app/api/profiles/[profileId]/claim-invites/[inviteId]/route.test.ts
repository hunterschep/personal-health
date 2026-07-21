// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotFoundError } from "@/domain/shared/errors";

const mocks = vi.hoisted(() => {
  const database = {
    profileClaimInvite: { updateMany: vi.fn() },
    auditLog: { create: vi.fn() },
  };
  return {
    assertSameOrigin: vi.fn(),
    requireProfileAccess: vi.fn(),
    transaction: vi.fn(async (callback: (transactionDatabase: unknown) => unknown) =>
      callback(database),
    ),
    database,
  };
});

vi.mock("@/server/auth/csrf", () => ({ assertSameOrigin: mocks.assertSameOrigin }));
vi.mock("@/server/authorization/profile", () => ({
  requireProfileAccess: mocks.requireProfileAccess,
}));
vi.mock("@/server/db/client", () => ({ prisma: { $transaction: mocks.transaction } }));

import { DELETE } from "./route";

describe("profile claim invitation revocation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireProfileAccess.mockResolvedValue({
      session: { user: { id: "organizer-id" } },
      profile: { id: "profile-id", householdId: "household-id" },
    });
    mocks.database.profileClaimInvite.updateMany.mockResolvedValue({ count: 1 });
    mocks.database.auditLog.create.mockResolvedValue({ id: "audit-id" });
  });

  it("revokes an active invite only after manage authorization", async () => {
    const response = await DELETE(
      new Request("http://localhost/api/claim-invite", { method: "DELETE" }),
      {
        params: Promise.resolve({ profileId: "profile-id", inviteId: "invite-id" }),
      },
    );

    expect(response.status).toBe(200);
    expect(mocks.requireProfileAccess).toHaveBeenCalledWith("profile-id", "manage");
    expect(mocks.database.profileClaimInvite.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: "invite-id",
        profileId: "profile-id",
        acceptedAt: null,
        revokedAt: null,
      }),
      data: { revokedAt: expect.any(Date) },
    });
    expect(mocks.database.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "profile.claim_invite_revoked",
        metadataJson: {},
      }),
    });
  });

  it("does not touch storage without profile manage access", async () => {
    mocks.requireProfileAccess.mockRejectedValue(new NotFoundError());

    const response = await DELETE(
      new Request("http://localhost/api/claim-invite", { method: "DELETE" }),
      {
        params: Promise.resolve({ profileId: "profile-id", inviteId: "invite-id" }),
      },
    );

    expect(response.status).toBe(404);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
