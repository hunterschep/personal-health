import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ProfileQuickActions } from "./profile-quick-actions";

describe("ProfileQuickActions", () => {
  it("links authorized viewers to useful profile-scoped reads", () => {
    render(<ProfileQuickActions profileId="profile-1" displayName="Alex" canEdit={false} />);

    expect(screen.getByRole("link", { name: "View Alex's care plan" })).toHaveAttribute(
      "href",
      "/app/profile/profile-1/care-plan",
    );
    expect(screen.getByRole("link", { name: "View Alex's timeline" })).toHaveAttribute(
      "href",
      "/app/profile/profile-1/timeline",
    );
    expect(screen.queryByRole("link", { name: "Add a record for Alex" })).not.toBeInTheDocument();
  });

  it("shows the write action only when the profile capability allows editing", () => {
    render(<ProfileQuickActions profileId="profile-1" displayName="Alex" canEdit />);

    expect(screen.getByRole("link", { name: "Add a record for Alex" })).toHaveAttribute(
      "href",
      "/app/profile/profile-1/records/new",
    );
  });
});
