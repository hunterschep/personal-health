// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireProfileAccess: vi.fn(),
  recommendationFindFirst: vi.fn(),
  transaction: vi.fn(),
  historyUpsert: vi.fn(),
  historyDeleteMany: vi.fn(),
  auditCreate: vi.fn(),
  rebuildRecommendations: vi.fn(),
}));

vi.mock("@/server/auth/csrf", () => ({ assertSameOrigin: vi.fn() }));
vi.mock("@/server/authorization/profile", () => ({
  requireProfileAccess: mocks.requireProfileAccess,
}));
vi.mock("@/server/db/client", () => ({
  prisma: {
    recommendationInstance: { findFirst: mocks.recommendationFindFirst },
    $transaction: mocks.transaction,
  },
}));
vi.mock("@/server/recommendations", () => ({
  rebuildRecommendations: mocks.rebuildRecommendations,
}));

import { DELETE, POST } from "./route";

const context = {
  params: Promise.resolve({ profileId: "profile-1", serviceId: "service-1" }),
};

describe("care-plan personal response route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireProfileAccess.mockResolvedValue({
      session: { user: { id: "user-1" } },
      profile: { id: "profile-1", householdId: "household-1" },
    });
    mocks.recommendationFindFirst.mockResolvedValue({ serviceId: "service-1" });
    mocks.historyUpsert.mockResolvedValue({ id: "response-1" });
    mocks.historyDeleteMany.mockResolvedValue({ count: 1 });
    mocks.auditCreate.mockResolvedValue({});
    mocks.rebuildRecommendations.mockResolvedValue({});
    mocks.transaction.mockImplementation(async (callback: (database: unknown) => unknown) =>
      callback({
        profileServiceHistoryState: {
          upsert: mocks.historyUpsert,
          deleteMany: mocks.historyDeleteMany,
        },
        auditLog: { create: mocks.auditCreate },
      }),
    );
  });

  it.each(["declined", "not_applicable_claim"] as const)(
    "records a reversible %s organizer response without health values in audit metadata",
    async (state) => {
      const response = await POST(
        new Request("http://localhost/api/profiles/profile-1/service-history/service-1", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ state, reason: "A personal organizer choice" }),
        }),
        context,
      );

      expect(response.status).toBe(200);
      expect(mocks.requireProfileAccess).toHaveBeenCalledWith("profile-1", "edit");
      expect(mocks.historyUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            state,
            reason: "A personal organizer choice",
            recordedByUserId: "user-1",
          }),
          update: expect.objectContaining({
            state,
            reason: "A personal organizer choice",
            recordedByUserId: "user-1",
          }),
        }),
      );
      expect(mocks.auditCreate).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ metadataJson: {} }) }),
      );
      expect(mocks.rebuildRecommendations).toHaveBeenCalledWith(
        expect.any(Object),
        "profile-1",
        undefined,
        { actorUserId: "user-1", reason: "care_event_edited" },
      );
    },
  );

  it("clears only non-medical organizer responses", async () => {
    const response = await DELETE(
      new Request("http://localhost/api/profiles/profile-1/service-history/service-1", {
        method: "DELETE",
      }),
      context,
    );

    expect(response.status).toBe(200);
    expect(mocks.historyDeleteMany).toHaveBeenCalledWith({
      where: {
        profileId: "profile-1",
        serviceId: "service-1",
        state: { in: ["declined", "not_applicable_claim"] },
      },
    });
  });

  it("does not write a response for a service outside the active profile plan", async () => {
    mocks.recommendationFindFirst.mockResolvedValue(null);

    const response = await POST(
      new Request("http://localhost/api/profiles/profile-1/service-history/other-service", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state: "declined", reason: "Personal choice" }),
      }),
      {
        params: Promise.resolve({ profileId: "profile-1", serviceId: "other-service" }),
      },
    );

    expect(response.status).toBe(404);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
