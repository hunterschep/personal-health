import { describe, expect, it, vi } from "vitest";

const findHousehold = vi.hoisted(() => vi.fn());

vi.mock("@/server/db/client", () => ({
  prisma: { household: { findFirst: findHousehold } },
}));

import { resolveHouseholdExportProfiles } from "./household";

describe("household export privacy", () => {
  it("does not let household ownership bypass a claimed private profile", async () => {
    findHousehold.mockResolvedValue({
      members: [{ role: "owner", removedAt: null }],
      profiles: [
        {
          id: "owned-profile",
          ownerUserId: "requesting-user",
          createdByUserId: "requesting-user",
          visibility: "owner_only",
          claimedAt: new Date("2026-01-01T00:00:00.000Z"),
          deletedAt: null,
          accessGrants: [],
        },
        {
          id: "private-adult-profile",
          ownerUserId: "another-user",
          createdByUserId: "requesting-user",
          visibility: "owner_only",
          claimedAt: new Date("2026-01-01T00:00:00.000Z"),
          deletedAt: null,
          accessGrants: [],
        },
      ],
    });

    await expect(resolveHouseholdExportProfiles("household-1", "requesting-user")).resolves.toEqual(
      {
        authorizedProfileIds: ["owned-profile"],
        omittedProfileIds: ["private-adult-profile"],
      },
    );
  });
});
