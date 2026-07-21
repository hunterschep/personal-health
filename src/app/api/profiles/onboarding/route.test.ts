import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const database = {
    householdMember: { findFirst: vi.fn() },
    household: { create: vi.fn(), findUniqueOrThrow: vi.fn() },
    profile: { create: vi.fn() },
    profileAnatomy: { createMany: vi.fn() },
    medication: { create: vi.fn() },
    onboardingDraft: { deleteMany: vi.fn() },
    auditLog: { create: vi.fn() },
  };
  return {
    assertSameOrigin: vi.fn(),
    requireSession: vi.fn(),
    upsert: vi.fn(),
    database,
    transaction: vi.fn(async (callback: (transaction: typeof database) => unknown) =>
      callback(database),
    ),
    synchronizeProfileHealthContext: vi.fn(),
    rebuildRecommendations: vi.fn(),
  };
});

vi.mock("@/server/auth/csrf", () => ({ assertSameOrigin: mocks.assertSameOrigin }));
vi.mock("@/server/auth/session", () => ({ requireSession: mocks.requireSession }));
vi.mock("@/server/profiles", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/profiles")>();
  return {
    ...actual,
    synchronizeProfileHealthContext: mocks.synchronizeProfileHealthContext,
  };
});
vi.mock("@/server/recommendations", () => ({
  rebuildRecommendations: mocks.rebuildRecommendations,
}));
vi.mock("@/server/db/client", () => ({
  prisma: {
    $transaction: mocks.transaction,
    onboardingDraft: { upsert: mocks.upsert, findUnique: vi.fn() },
  },
}));

import { POST } from "./route";

describe("onboarding drafts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.upsert.mockResolvedValue({ userId: "user-1" });
    mocks.database.householdMember.findFirst.mockResolvedValue(null);
    mocks.database.household.create.mockResolvedValue({
      id: "household-1",
      timezone: "America/Los_Angeles",
    });
    mocks.database.profile.create.mockResolvedValue({
      id: "profile-1",
      householdId: "household-1",
    });
    mocks.synchronizeProfileHealthContext.mockResolvedValue({
      riskFactorCount: 0,
      conditionCount: 0,
      narrativeContextCount: 0,
    });
    mocks.rebuildRecommendations.mockResolvedValue({});
  });

  it("validates the current step and persists the next resume step", async () => {
    const response = await POST(
      request({
        status: "draft",
        step: 0,
        intent: "continue",
        data: {
          displayName: "Alex",
          relationshipLabel: "Self",
          dateOfBirth: "1980-05-12",
          sexAssignedAtBirth: "female",
          countryCode: "US",
          timezone: "America/Los_Angeles",
          visibility: "owner_only",
          ownership: "self",
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, step: 1 });
    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ step: 1 }),
        update: expect.objectContaining({ step: 1 }),
      }),
    );
  });

  it("rejects unvalidated extras without storing a draft", async () => {
    const response = await POST(
      request({
        status: "draft",
        step: 0,
        intent: "save_exit",
        data: { displayName: "Alex", arbitraryRisk: "yes" },
      }),
    );

    expect(response.status).toBe(400);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("persists medication reason and normalized start precision on completion", async () => {
    const response = await POST(
      request({
        status: "complete",
        step: 5,
        data: {
          displayName: "Alex",
          relationshipLabel: "Self",
          dateOfBirth: "1980-05-12",
          sexAssignedAtBirth: "female",
          countryCode: "US",
          timezone: "America/Los_Angeles",
          visibility: "owner_only",
          ownership: "self",
          medicationName: "Example medicine",
          medicationReason: "Blood pressure",
          medicationStartedDate: "2024-05",
          medicationStartedPrecision: "month",
        },
      }),
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ profileId: "profile-1" });
    expect(mocks.database.medication.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        reason: "Blood pressure",
        startedStart: new Date("2024-05-01T00:00:00.000Z"),
        startedEnd: new Date("2024-05-31T00:00:00.000Z"),
        startedDatePrecision: "month",
      }),
    });
  });
});

function request(body: unknown) {
  return new Request("http://localhost/api/profiles/onboarding", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
