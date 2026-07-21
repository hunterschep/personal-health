import { describe, expect, it } from "vitest";

import { familyActivityLabel } from "./family-activity";

describe("family activity privacy", () => {
  it("keeps the default feed redacted", () => {
    expect(
      familyActivityLabel({
        action: "care_event.created",
        profile: { displayName: "Alex", visibility: "household" },
        detailEnabled: false,
      }),
    ).toBe("A care record was added to a visible profile.");
  });

  it("applies an owner preference only to a shared profile", () => {
    expect(
      familyActivityLabel({
        action: "care_plan.changed",
        profile: { displayName: "Alex", visibility: "selected_members" },
        detailEnabled: true,
      }),
    ).toBe("Alex's shared care plan changed.");
    expect(
      familyActivityLabel({
        action: "care_plan.changed",
        profile: { displayName: "Private Adult", visibility: "owner_only" },
        detailEnabled: true,
      }),
    ).toBe("A shared care plan changed.");
  });

  it("never interpolates unknown event metadata", () => {
    expect(
      familyActivityLabel({
        action: "unknown.action",
        profile: { displayName: "Alex", visibility: "household" },
        detailEnabled: true,
      }),
    ).toBe("A visible household item changed.");
  });
});
