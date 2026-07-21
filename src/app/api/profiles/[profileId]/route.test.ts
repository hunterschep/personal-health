import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assertSameOrigin: vi.fn(),
  requireProfileAccess: vi.fn(),
  transaction: vi.fn(),
  normalizeHealthContext: vi.fn(),
  synchronizeHealthContext: vi.fn(),
  rebuildRecommendations: vi.fn(),
}));

vi.mock("@/server/auth/csrf", () => ({ assertSameOrigin: mocks.assertSameOrigin }));
vi.mock("@/server/authorization/profile", () => ({
  requireProfileAccess: mocks.requireProfileAccess,
}));
vi.mock("@/server/db/client", () => ({ prisma: { $transaction: mocks.transaction } }));
vi.mock("@/server/profiles", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/server/profiles")>();
  return {
    ...original,
    normalizeProfileHealthContext: mocks.normalizeHealthContext,
    synchronizeProfileHealthContext: mocks.synchronizeHealthContext,
  };
});
vi.mock("@/server/read-models", () => ({ loadProfileSettingsContext: vi.fn() }));
vi.mock("@/server/recommendations", () => ({
  rebuildRecommendations: mocks.rebuildRecommendations,
  recommendationChangeCounts: vi.fn(() => ({
    newly_applicable: 0,
    no_longer_applicable: 0,
    status_changed: 0,
    due_range_changed: 0,
    source_variant_changed: 0,
    rule_version_changed: 0,
    clinician_override_activated: 0,
    clinician_override_removed: 0,
    history_uncertainty_resolved: 0,
  })),
}));

import { PATCH } from "./route";

describe("profile context update", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireProfileAccess.mockResolvedValue({
      session: { user: { id: "user-1" } },
      profile: { id: "profile-1", householdId: "household-1" },
    });
    mocks.normalizeHealthContext.mockReturnValue({ normalized: true });
    mocks.synchronizeHealthContext.mockResolvedValue({
      riskFactorCount: 3,
      conditionCount: 1,
      narrativeContextCount: 1,
    });
    mocks.rebuildRecommendations.mockResolvedValue({ changes: [] });
  });

  it("synchronizes context, rebuilds once, and audits categories and counts only", async () => {
    const database = {
      profile: { update: vi.fn(async () => ({ id: "profile-1" })) },
      profileAnatomy: { upsert: vi.fn(async () => ({ id: "anatomy" })) },
      auditLog: { create: vi.fn(async () => ({ id: "audit" })) },
    };
    mocks.transaction.mockImplementation(
      async (callback: (client: typeof database) => Promise<unknown>) => callback(database),
    );
    const response = await PATCH(
      new Request("http://localhost/api/profiles/profile-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validPayload()),
      }),
      { params: Promise.resolve({ profileId: "profile-1" }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.synchronizeHealthContext).toHaveBeenCalledTimes(1);
    expect(mocks.rebuildRecommendations).toHaveBeenCalledTimes(1);
    expect(database.profile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ sexAssignedAtBirth: "female" }),
      }),
    );
    expect(database.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "profile.updated",
        metadataJson: {
          categories: ["profile", "anatomy", "risk_context", "health_history"],
          counts: {
            anatomy: 5,
            riskFactors: 3,
            conditions: 1,
            narrativeContexts: 1,
          },
        },
      }),
    });
    expect(JSON.stringify(database.auditLog.create.mock.calls)).not.toContain("former");
    expect(JSON.stringify(database.auditLog.create.mock.calls)).not.toContain("Hypertension");
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      planChanges: { newly_applicable: 0, status_changed: 0, due_range_changed: 0 },
    });
  });

  it("applies a confirmed surgery anatomy update in the profile transaction", async () => {
    mocks.normalizeHealthContext.mockReturnValue({
      anatomyUpdate: { key: "uterus", state: "absent" },
    });
    const anatomyUpsert = vi.fn(async () => ({ id: "anatomy" }));
    const database = {
      profile: { update: vi.fn(async () => ({ id: "profile-1" })) },
      profileAnatomy: { upsert: anatomyUpsert },
      auditLog: { create: vi.fn(async () => ({ id: "audit" })) },
    };
    mocks.transaction.mockImplementation(
      async (callback: (client: typeof database) => Promise<unknown>) => callback(database),
    );

    const response = await PATCH(
      new Request("http://localhost/api/profiles/profile-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validPayload()),
      }),
      { params: Promise.resolve({ profileId: "profile-1" }) },
    );

    expect(response.status).toBe(200);
    expect(anatomyUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ anatomyKey: "uterus", state: "absent" }),
        update: { state: "absent" },
      }),
    );
  });
});

function validPayload() {
  return {
    displayName: "Alex",
    relationshipLabel: "Self",
    dateOfBirth: "1980-05-12",
    sexAssignedAtBirth: "female",
    genderIdentity: null,
    timezone: "America/Los_Angeles",
    carePlanMode: "evidence_based",
    anatomy: [
      { key: "cervix", state: "present" },
      { key: "breast_tissue", state: "present" },
      { key: "prostate", state: "absent" },
      { key: "uterus", state: "present" },
      { key: "ovaries", state: "present" },
    ],
    healthContext: {
      tobaccoStatus: "former",
      smokingStartYear: "2000",
      smokingEndYear: "2010",
      packsPerDay: "0.5",
      heightInches: "65",
      weightPounds: "145",
      immunocompromised: "no",
      conditions: { hypertension: true },
      familyHistoryNote: "Parent — colorectal cancer",
      surgeryNote: "Appendectomy",
    },
  };
}
