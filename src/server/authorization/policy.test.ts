import { describe, expect, it } from "vitest";
import type { ProfileAuthorizationContext } from "./policy";
import {
  canAccessProfileResource,
  canEditProfile,
  canManageProfileSharing,
  canViewProfile,
  profileCapabilities,
  type ProfileResource,
} from "./policy";

function context(
  overrides: Partial<ProfileAuthorizationContext> = {},
): ProfileAuthorizationContext {
  return {
    userId: "member",
    profile: {
      ownerUserId: "adult-owner",
      createdByUserId: "organizer",
      visibility: "owner_only",
      claimedAt: new Date("2026-01-01"),
      deletedAt: null,
    },
    membership: { role: "member", removedAt: null },
    grant: null,
    ...overrides,
  };
}

describe("adult profile authorization", () => {
  it("does not let a household owner bypass a claimed owner-only profile", () => {
    const input = context({ membership: { role: "owner", removedAt: null } });
    expect(canViewProfile(input)).toBe(false);
    expect(canEditProfile(input)).toBe(false);
  });

  it("honors view-only grants without allowing edits", () => {
    const input = context({ grant: { permission: "view" } });
    expect(canViewProfile(input)).toBe(true);
    expect(canEditProfile(input)).toBe(false);
    expect(canManageProfileSharing(input)).toBe(false);
    expect(profileCapabilities(input)).toEqual({
      canEdit: false,
      canManage: false,
      canExport: false,
      canDelete: false,
    });
  });

  it("lets the profile owner manage sharing", () => {
    const input = context({ userId: "adult-owner" });
    expect(canViewProfile(input)).toBe(true);
    expect(canEditProfile(input)).toBe(true);
    expect(canManageProfileSharing(input)).toBe(true);
  });

  it("lets an organizer manage an unclaimed profile until claim", () => {
    const input = context({
      userId: "organizer",
      profile: {
        ownerUserId: null,
        createdByUserId: "organizer",
        visibility: "owner_only",
        claimedAt: null,
        deletedAt: null,
      },
    });
    expect(canViewProfile(input)).toBe(true);
    expect(canManageProfileSharing(input)).toBe(true);
  });

  it("revokes access when membership is removed", () => {
    const input = context({
      profile: { ...context().profile, visibility: "household" },
      membership: { role: "member", removedAt: new Date() },
      grant: { permission: "manage" },
    });
    expect(canViewProfile(input)).toBe(false);
  });

  const resources: ProfileResource[] = [
    "profile",
    "care_event",
    "medication",
    "override",
    "planned_action",
    "reminder",
    "document",
    "export",
    "invite",
    "activity",
    "source_admin_diagnostics",
  ];
  const ordinaryResources = new Set<ProfileResource>([
    "profile",
    "care_event",
    "medication",
    "override",
    "planned_action",
    "reminder",
    "document",
  ]);

  const householdProfile = {
    ownerUserId: "adult-owner",
    createdByUserId: "organizer",
    visibility: "household" as const,
    claimedAt: new Date("2026-01-01"),
    deletedAt: null,
  };
  const actors: Array<{
    name: string;
    input: ProfileAuthorizationContext | null;
    read: Set<ProfileResource>;
    mutate: Set<ProfileResource>;
  }> = [
    { name: "anonymous", input: null, read: new Set(), mutate: new Set() },
    {
      name: "authenticated stranger",
      input: context({ membership: null, profile: householdProfile }),
      read: new Set(),
      mutate: new Set(),
    },
    {
      name: "household member",
      input: context({ profile: householdProfile }),
      read: new Set([...ordinaryResources, "activity"]),
      mutate: new Set(),
    },
    {
      name: "household admin",
      input: context({
        profile: householdProfile,
        membership: { role: "admin", removedAt: null },
      }),
      read: new Set([...ordinaryResources, "activity"]),
      mutate: new Set(),
    },
    {
      name: "profile view grantee",
      input: context({ profile: householdProfile, grant: { permission: "view" } }),
      read: new Set([...ordinaryResources, "activity"]),
      mutate: new Set(),
    },
    {
      name: "profile edit grantee",
      input: context({ profile: householdProfile, grant: { permission: "edit" } }),
      read: new Set([...ordinaryResources, "activity"]),
      mutate: new Set(ordinaryResources),
    },
    {
      name: "profile manager",
      input: context({ profile: householdProfile, grant: { permission: "manage" } }),
      read: new Set([...ordinaryResources, "export", "invite", "activity"]),
      mutate: new Set([...ordinaryResources, "invite"]),
    },
    {
      name: "profile owner",
      input: context({ userId: "adult-owner", profile: householdProfile }),
      read: new Set([...ordinaryResources, "export", "invite", "activity"]),
      mutate: new Set([...ordinaryResources, "invite"]),
    },
    {
      name: "household owner",
      input: context({
        profile: householdProfile,
        membership: { role: "owner", removedAt: null },
      }),
      read: new Set([...ordinaryResources, "activity"]),
      mutate: new Set(),
    },
    {
      name: "former member",
      input: context({
        profile: householdProfile,
        membership: { role: "member", removedAt: new Date("2026-07-01") },
        grant: { permission: "manage" },
      }),
      read: new Set(),
      mutate: new Set(),
    },
  ];

  describe("required actor and resource matrix", () => {
    for (const actor of actors) {
      it(`${actor.name} has the expected read and mutation boundary for every resource`, () => {
        for (const resource of resources) {
          expect(canAccessProfileResource(actor.input, resource, "read"), `${resource}:read`).toBe(
            actor.read.has(resource),
          );
          expect(
            canAccessProfileResource(actor.input, resource, "mutate"),
            `${resource}:mutate`,
          ).toBe(actor.mutate.has(resource));
        }
      });
    }
  });
});
