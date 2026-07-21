// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireProfileAccess: vi.fn(),
  findMany: vi.fn(),
}));

vi.mock("@/server/authorization/profile", () => ({
  requireProfileAccess: mocks.requireProfileAccess,
}));
vi.mock("@/server/db/client", () => ({
  prisma: { profileClaimInvite: { findMany: mocks.findMany } },
}));

import { GET } from "./route";

describe("profile claim invitation listing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireProfileAccess.mockResolvedValue({ profile: { id: "profile-id" } });
    mocks.findMany.mockResolvedValue([
      {
        id: "invite-id",
        emailNormalized: "invited@example.com",
        expiresAt: new Date("2026-08-01T12:00:00.000Z"),
        createdAt: new Date("2026-07-21T12:00:00.000Z"),
      },
    ]);
  });

  it("lists active metadata without returning token hashes", async () => {
    const response = await GET(new Request("http://localhost/api/claim-invites"), {
      params: Promise.resolve({ profileId: "profile-id" }),
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.requireProfileAccess).toHaveBeenCalledWith("profile-id", "manage");
    expect(payload).toEqual({
      invites: [
        {
          id: "invite-id",
          email: "invited@example.com",
          expiresAt: "2026-08-01T12:00:00.000Z",
          createdAt: "2026-07-21T12:00:00.000Z",
        },
      ],
    });
    expect(JSON.stringify(payload)).not.toContain("token");
  });
});
