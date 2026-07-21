// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  householdFindFirst: vi.fn(),
  profileClaimFindFirst: vi.fn(),
}));

vi.mock("@/server/db/client", () => ({
  prisma: {
    householdInvite: { findFirst: mocks.householdFindFirst },
    profileClaimInvite: { findFirst: mocks.profileClaimFindFirst },
  },
}));

import { loadHouseholdInvitePreview, loadProfileClaimInvitePreview } from "./preview";

describe("privacy-limited invitation previews", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns only household, inviter, and role identity to the invited email", async () => {
    mocks.householdFindFirst.mockResolvedValue({
      role: "member",
      household: { name: "River Household" },
      invitedBy: { name: "Morgan" },
    });

    await expect(loadHouseholdInvitePreview("raw-token", "INVITED@EXAMPLE.COM")).resolves.toEqual({
      householdName: "River Household",
      inviterName: "Morgan",
      role: "member",
    });
    expect(mocks.householdFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ emailNormalized: "invited@example.com" }),
        select: {
          role: true,
          household: { select: { name: true } },
          invitedBy: { select: { name: true } },
        },
      }),
    );
  });

  it("returns only profile, household, and inviter identity for a claim", async () => {
    mocks.profileClaimFindFirst.mockResolvedValue({
      profile: { displayName: "Alex", household: { name: "River Household" } },
      createdBy: { name: "Morgan" },
    });

    await expect(
      loadProfileClaimInvitePreview("raw-token", "invited@example.com"),
    ).resolves.toEqual({
      profileName: "Alex",
      householdName: "River Household",
      inviterName: "Morgan",
    });
    expect(mocks.profileClaimFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        select: {
          profile: {
            select: {
              displayName: true,
              household: { select: { name: true } },
            },
          },
          createdBy: { select: { name: true } },
        },
      }),
    );
  });

  it("reveals no identity when the token and signed-in email do not match", async () => {
    mocks.profileClaimFindFirst.mockResolvedValue(null);
    await expect(
      loadProfileClaimInvitePreview("raw-token", "wrong@example.com"),
    ).resolves.toBeNull();
  });
});
