import { describe, expect, it } from "vitest";

import { profileSwitchDestination } from "./profile-switcher";

describe("profileSwitchDestination", () => {
  it.each([
    ["/app/profile/old-id/care-plan", "/app/profile/new-id/care-plan"],
    ["/app/profile/old-id/records/backfill", "/app/profile/new-id/records/backfill"],
    ["/app/profile/old-id/maintenance", "/app/profile/new-id/maintenance"],
  ])("preserves profile-scoped collection routes", (pathname, expected) => {
    expect(profileSwitchDestination(pathname, "new-id")).toBe(expected);
  });

  it.each([
    ["/app/profile/old-id/care-plan/old-recommendation", "/app/profile/new-id/care-plan"],
    ["/app/profile/old-id/care-plan/old-recommendation/override", "/app/profile/new-id/care-plan"],
    ["/app/profile/old-id/records/old-event", "/app/profile/new-id/records"],
  ])("drops entity identifiers that belong to the prior profile", (pathname, expected) => {
    expect(profileSwitchDestination(pathname, "new-id")).toBe(expected);
  });

  it("returns null outside profile-scoped pages", () => {
    expect(profileSwitchDestination("/app/sources", "new-id")).toBeNull();
  });
});
