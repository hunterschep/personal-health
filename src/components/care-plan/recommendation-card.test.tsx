import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import { RecommendationCard } from "./recommendation-card";

describe("RecommendationCard actions", () => {
  it("keeps completion, planning, clinician, snooze, response, and detail actions reachable", async () => {
    const user = userEvent.setup();
    render(
      <RecommendationCard
        profileId="profile-1"
        recommendation={{
          id: "recommendation-1",
          serviceId: "service-1",
          serviceSlug: "colorectal-screening",
          service: "Colorectal cancer screening",
          category: "Cancer screening",
          status: "due_now",
          timing: "Jul 1, 2026 – Jul 31, 2026",
          reason: "Routine screening applies.",
          history: "No qualifying history recorded",
          source: "USPSTF",
          reminder: { id: "reminder-1", snoozedUntil: null },
        }}
      />,
    );

    expect(screen.getByRole("link", { name: /Add record/i })).toHaveAttribute(
      "href",
      "/app/profile/profile-1/records/new?service=colorectal-screening",
    );
    expect(screen.getByRole("link", { name: /Mark completed/i })).toHaveAttribute(
      "href",
      "/app/profile/profile-1/records/new?service=colorectal-screening&intent=complete",
    );
    expect(screen.getByRole("link", { name: /Plan/i })).toBeVisible();
    expect(screen.getByRole("link", { name: /Details/i })).toBeVisible();
    expect(screen.getByText("Jul 1, 2026 – Jul 31, 2026")).toBeVisible();

    await user.click(screen.getByText("More actions"));
    expect(screen.getByRole("link", { name: /Add clinician instruction/i })).toBeVisible();
    expect(screen.getByRole("button", { name: /Snooze reminder/i })).toBeVisible();
    expect(screen.getByRole("button", { name: /I chose not to do this/i })).toBeVisible();
    expect(screen.getByRole("button", { name: /This does not apply to me/i })).toBeVisible();
  });
});
