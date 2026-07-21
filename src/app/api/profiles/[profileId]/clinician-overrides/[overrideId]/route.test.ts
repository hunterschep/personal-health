// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireProfileAccess: vi.fn(),
  transaction: vi.fn(),
  overrideFindFirst: vi.fn(),
  overrideUpdate: vi.fn(),
  overrideUpdateMany: vi.fn(),
  overrideCreate: vi.fn(),
  auditCreate: vi.fn(),
  recommendationFindFirst: vi.fn(),
  rebuildRecommendations: vi.fn(),
}));

vi.mock("@/server/auth/csrf", () => ({ assertSameOrigin: vi.fn() }));
vi.mock("@/server/authorization/profile", () => ({
  requireProfileAccess: mocks.requireProfileAccess,
}));
vi.mock("@/server/db/client", () => ({ prisma: { $transaction: mocks.transaction } }));
vi.mock("@/server/recommendations", () => ({
  rebuildRecommendations: mocks.rebuildRecommendations,
}));

import { PATCH } from "./route";

const context = {
  params: Promise.resolve({ profileId: "profile-1", overrideId: "override-1" }),
};

describe("clinician override lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireProfileAccess.mockResolvedValue({
      session: { user: { id: "user-1" } },
      profile: { id: "profile-1", householdId: "household-1" },
    });
    mocks.overrideFindFirst.mockResolvedValue({
      id: "override-1",
      profileId: "profile-1",
      serviceId: "service-1",
      methodId: null,
      replacesGeneralGuideline: true,
    });
    mocks.overrideUpdate.mockResolvedValue({ id: "override-1" });
    mocks.overrideUpdateMany.mockResolvedValue({ count: 0 });
    mocks.overrideCreate.mockResolvedValue({ id: "override-2" });
    mocks.auditCreate.mockResolvedValue({});
    mocks.recommendationFindFirst.mockResolvedValue({ id: "recommendation-2" });
    mocks.rebuildRecommendations.mockResolvedValue({});
    mocks.transaction.mockImplementation(async (callback: (database: unknown) => unknown) =>
      callback({
        clinicianOverride: {
          findFirst: mocks.overrideFindFirst,
          update: mocks.overrideUpdate,
          updateMany: mocks.overrideUpdateMany,
          create: mocks.overrideCreate,
        },
        auditLog: { create: mocks.auditCreate },
        recommendationInstance: { findFirst: mocks.recommendationFindFirst },
      }),
    );
  });

  it("pauses an instruction without ending or deleting its history", async () => {
    const response = await PATCH(
      new Request("http://localhost/api/profiles/profile-1/clinician-overrides/override-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "pause" }),
      }),
      context,
    );

    expect(response.status).toBe(200);
    expect(mocks.overrideUpdate).toHaveBeenCalledWith({
      where: { id: "override-1" },
      data: { pausedAt: expect.any(Date) },
    });
    expect(mocks.auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "clinician_override.paused",
          metadataJson: {},
        }),
      }),
    );
  });

  it("resumes one replacing instruction while pausing a competing active version", async () => {
    const response = await PATCH(
      new Request("http://localhost/api/profiles/profile-1/clinician-overrides/override-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resume" }),
      }),
      context,
    );

    expect(response.status).toBe(200);
    expect(mocks.overrideUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: { not: "override-1" }, pausedAt: null }),
        data: { pausedAt: expect.any(Date) },
      }),
    );
    expect(mocks.overrideUpdate).toHaveBeenCalledWith({
      where: { id: "override-1" },
      data: { pausedAt: null },
    });
  });

  it("edits by ending the prior row and creating a new version", async () => {
    const response = await PATCH(
      new Request("http://localhost/api/profiles/profile-1/clinician-overrides/override-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "replace",
          input: {
            serviceId: "service-1",
            type: "exact_next_date",
            nextDueStart: "2026-10-01",
            nextDueEnd: "2026-10-03",
            instructionReceivedDate: "2026-07-20",
            clinicianName: "Synthetic Clinician",
            practiceName: "Synthetic Practice",
            reason: "Synthetic instruction",
            reviewDate: "2026-09-01",
            replacesGeneralGuideline: true,
          },
        }),
      }),
      context,
    );

    expect(response.status).toBe(200);
    expect(mocks.overrideUpdate).toHaveBeenCalledWith({
      where: { id: "override-1" },
      data: { active: false },
    });
    expect(mocks.overrideCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        profileId: "profile-1",
        serviceId: "service-1",
        overrideType: "exact_next_date",
        active: true,
        pausedAt: null,
        createdByUserId: "user-1",
      }),
    });
    expect(await response.json()).toMatchObject({
      overrideId: "override-2",
      activeRecommendationId: "recommendation-2",
    });
  });

  it("binds the override identifier to the authorized profile", async () => {
    mocks.overrideFindFirst.mockResolvedValue(null);

    const response = await PATCH(
      new Request("http://localhost/api/profiles/profile-1/clinician-overrides/foreign", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "pause" }),
      }),
      { params: Promise.resolve({ profileId: "profile-1", overrideId: "foreign" }) },
    );

    expect(response.status).toBe(404);
    expect(mocks.overrideFindFirst).toHaveBeenCalledWith({
      where: { id: "foreign", profileId: "profile-1", active: true },
    });
    expect(mocks.overrideUpdate).not.toHaveBeenCalled();
  });
});
