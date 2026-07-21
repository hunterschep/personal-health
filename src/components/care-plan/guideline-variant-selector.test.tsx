import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GuidelineVariantSelector } from "./guideline-variant-selector";

const noChanges = {
  newly_applicable: 0,
  no_longer_applicable: 0,
  status_changed: 0,
  due_range_changed: 0,
  source_variant_changed: 0,
  rule_version_changed: 0,
  clinician_override_activated: 0,
  clinician_override_removed: 0,
  history_uncertainty_resolved: 0,
};

describe("GuidelineVariantSelector", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("shows the classified before-and-after recommendation after rebuilding", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              selectedVariantId: "acs_2024",
              activeRecommendationId: "recommendation-after",
              recommendationChanges: {
                before: {
                  id: "recommendation-before",
                  variantId: "uspstf_2024",
                  status: "due_this_year",
                  dueStart: "2026-01-01",
                  dueEnd: "2026-12-31",
                },
                after: {
                  id: "recommendation-after",
                  variantId: "acs_2024",
                  status: "due_soon",
                  dueStart: "2026-09-01",
                  dueEnd: "2026-09-30",
                },
                byType: {
                  ...noChanges,
                  source_variant_changed: 1,
                  status_changed: 1,
                  due_range_changed: 1,
                },
                created: 1,
                retired: 1,
                unchanged: 12,
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          ),
      ),
    );
    render(
      <GuidelineVariantSelector
        profileId="profile-1"
        conflictGroup="screening-guideline"
        explicitSelection={false}
        variants={[
          {
            variantId: "uspstf_2024",
            baseline: true,
            selected: true,
            organization: "Federal baseline",
          },
          {
            variantId: "acs_2024",
            baseline: false,
            selected: false,
            organization: "American Cancer Society",
          },
        ]}
      />,
    );

    await userEvent.click(screen.getByRole("radio", { name: "American Cancer Society" }));
    await userEvent.click(screen.getByRole("button", { name: "Confirm variant" }));

    expect(await screen.findByText("Guideline variant updated")).toBeVisible();
    expect(screen.getByLabelText("Before recommendation")).toHaveTextContent(
      "Federal baseline · Recommended this year · Jan 1, 2026 to Dec 31, 2026",
    );
    expect(screen.getByLabelText("After recommendation")).toHaveTextContent(
      "American Cancer Society · Due soon · Sep 1, 2026 to Sep 30, 2026",
    );
    expect(screen.getByLabelText("Recommendation changes")).toHaveTextContent(
      "1 status, 1 timing, 1 source variant. 12 other recommendations were unchanged.",
    );
    expect(screen.getByRole("link", { name: "Open recalculated recommendation" })).toHaveAttribute(
      "href",
      "/app/profile/profile-1/care-plan/recommendation-after",
    );
  });
});
