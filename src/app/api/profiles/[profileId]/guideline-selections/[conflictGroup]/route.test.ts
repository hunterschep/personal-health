import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const database = {
    profileGuidelineSelection: { upsert: vi.fn(), delete: vi.fn() },
    recommendationInstance: { findFirst: vi.fn() },
    auditLog: { create: vi.fn() },
  };
  return {
    assertSameOrigin: vi.fn(),
    requireProfileAccess: vi.fn(),
    guidelineRules: vi.fn(),
    previousRecommendation: vi.fn(),
    findSelection: vi.fn(),
    database,
    transaction: vi.fn(async (callback: (transaction: typeof database) => unknown) =>
      callback(database),
    ),
    rebuildRecommendations: vi.fn(),
  };
});

vi.mock("@/server/auth/csrf", () => ({ assertSameOrigin: mocks.assertSameOrigin }));
vi.mock("@/server/authorization/profile", () => ({
  requireProfileAccess: mocks.requireProfileAccess,
}));
vi.mock("@/server/db/client", () => ({
  prisma: {
    guidelineRule: { findMany: mocks.guidelineRules },
    recommendationInstance: { findFirst: mocks.previousRecommendation },
    profileGuidelineSelection: { findUnique: mocks.findSelection },
    $transaction: mocks.transaction,
  },
}));
vi.mock("@/server/recommendations", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/recommendations")>();
  return { ...actual, rebuildRecommendations: mocks.rebuildRecommendations };
});

import { PUT } from "./route";

describe("guideline variant selection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireProfileAccess.mockResolvedValue({
      session: { user: { id: "user-1" } },
      profile: {
        id: "profile-1",
        householdId: "household-1",
        timezone: "America/Los_Angeles",
        countryCode: "US",
      },
    });
    mocks.guidelineRules.mockResolvedValue([{ id: "rule-2", serviceId: "service-1" }]);
    mocks.previousRecommendation.mockResolvedValue({
      id: "recommendation-before",
      variantId: "baseline",
      status: "due_this_year",
      dueStart: new Date("2026-01-01T00:00:00.000Z"),
      dueEnd: new Date("2026-12-31T00:00:00.000Z"),
    });
    mocks.database.profileGuidelineSelection.upsert.mockResolvedValue({
      id: "selection-1",
      variantId: "alternative",
    });
    mocks.database.recommendationInstance.findFirst.mockResolvedValue({
      id: "recommendation-after",
      variantId: "alternative",
      status: "due_soon",
      dueStart: new Date("2026-09-01T00:00:00.000Z"),
      dueEnd: new Date("2026-09-30T00:00:00.000Z"),
    });
    mocks.rebuildRecommendations.mockResolvedValue({
      createdIds: ["recommendation-after"],
      retiredIds: ["recommendation-before"],
      unchangedIds: ["recommendation-unchanged"],
      changes: [
        {
          type: "source_variant_changed",
          previousId: "recommendation-before",
          nextId: "recommendation-after",
          serviceId: "service-1",
        },
        {
          type: "status_changed",
          previousId: "recommendation-before",
          nextId: "recommendation-after",
          serviceId: "service-1",
        },
        {
          type: "due_range_changed",
          previousId: "recommendation-before",
          nextId: "recommendation-after",
          serviceId: "service-1",
        },
      ],
    });
  });

  it("returns a concrete classified before-and-after summary from the rebuild", async () => {
    const response = await PUT(
      new Request("http://localhost/api/selection", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variantId: "alternative" }),
      }),
      {
        params: Promise.resolve({
          profileId: "profile-1",
          conflictGroup: "screening-guideline",
        }),
      },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      selectedVariantId: "alternative",
      activeRecommendationId: "recommendation-after",
      recommendationChanges: {
        before: {
          id: "recommendation-before",
          variantId: "baseline",
          status: "due_this_year",
          dueStart: "2026-01-01",
          dueEnd: "2026-12-31",
        },
        after: {
          id: "recommendation-after",
          variantId: "alternative",
          status: "due_soon",
          dueStart: "2026-09-01",
          dueEnd: "2026-09-30",
        },
        byType: {
          source_variant_changed: 1,
          status_changed: 1,
          due_range_changed: 1,
        },
        created: 1,
        retired: 1,
        unchanged: 1,
      },
    });
  });
});
