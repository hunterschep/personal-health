import { describe, expect, it } from "vitest";
import { accessibleProfileWhere } from "./profile-query";

describe("accessible profile database filter", () => {
  it("requires an active household membership for an explicit grant", () => {
    const where = accessibleProfileWhere("member-id");
    expect(where.OR?.[1]).toEqual({
      AND: [
        { accessGrants: { some: { userId: "member-id" } } },
        {
          household: {
            members: { some: { userId: "member-id", removedAt: null } },
          },
        },
      ],
    });
  });

  it("does not expose an unclaimed profile to its creator after membership removal", () => {
    const where = accessibleProfileWhere("creator-id");
    const unclaimedBranch = where.OR?.[3];
    expect(unclaimedBranch).toMatchObject({ claimedAt: null });
    const conditions =
      typeof unclaimedBranch === "object" &&
      unclaimedBranch !== null &&
      "AND" in unclaimedBranch &&
      Array.isArray(unclaimedBranch.AND)
        ? unclaimedBranch.AND
        : [];
    expect(conditions[0]).toEqual({
      household: {
        members: { some: { userId: "creator-id", removedAt: null } },
      },
    });
  });
});
