// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const ids = {
  profile: "70000000-0000-4000-8000-000000000001",
  medication: "70000000-0000-4000-8000-000000000002",
  document: "70000000-0000-4000-8000-000000000003",
  household: "70000000-0000-4000-8000-000000000004",
  user: "70000000-0000-4000-8000-000000000005",
};

const linkedDocument = {
  id: ids.document,
  storageKey: "dd/ee/" + "f".repeat(60),
  householdId: ids.household,
  profileId: ids.profile,
};

const mocks = vi.hoisted(() => ({
  assertSameOrigin: vi.fn(),
  requireProfileAccess: vi.fn(),
  transaction: vi.fn(),
  medicationFindFirst: vi.fn(),
  medicationUpdate: vi.fn(),
  medicationUpdateMany: vi.fn(),
  documentUpdateMany: vi.fn(),
  auditCreate: vi.fn(),
  rebuildRecommendations: vi.fn(),
  deleteDocumentBlobs: vi.fn(),
}));

vi.mock("@/server/auth/csrf", () => ({ assertSameOrigin: mocks.assertSameOrigin }));
vi.mock("@/server/authorization/profile", () => ({
  requireProfileAccess: mocks.requireProfileAccess,
}));
vi.mock("@/server/db/client", () => ({ prisma: { $transaction: mocks.transaction } }));
vi.mock("@/server/recommendations", () => ({
  rebuildRecommendations: mocks.rebuildRecommendations,
}));
vi.mock("@/server/storage", () => ({ deleteDocumentBlobs: mocks.deleteDocumentBlobs }));

import { DELETE, PATCH } from "./route";

describe("medication document lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireProfileAccess.mockResolvedValue({
      session: { user: { id: ids.user } },
      profile: { id: ids.profile, householdId: ids.household },
    });
    mocks.medicationFindFirst.mockResolvedValue({
      documentLinks: [{ document: linkedDocument }],
    });
    mocks.medicationUpdateMany.mockResolvedValue({ count: 1 });
    mocks.medicationUpdate.mockResolvedValue({ id: ids.medication });
    mocks.documentUpdateMany.mockResolvedValue({ count: 1 });
    mocks.auditCreate.mockResolvedValue({ id: "audit" });
    mocks.rebuildRecommendations.mockResolvedValue({});
    mocks.deleteDocumentBlobs.mockResolvedValue({ deletedIds: [ids.document], failedIds: [] });
    const database = {
      medication: {
        findFirst: mocks.medicationFindFirst,
        update: mocks.medicationUpdate,
        updateMany: mocks.medicationUpdateMany,
      },
      document: { updateMany: mocks.documentUpdateMany },
      auditLog: { create: mocks.auditCreate },
    };
    mocks.transaction.mockImplementation(
      async (callback: (client: typeof database) => Promise<unknown>) => callback(database),
    );
  });

  it("soft-deletes linked documents before attempting physical cleanup", async () => {
    const response = await DELETE(
      new Request(`http://localhost/api/profiles/${ids.profile}/medications/${ids.medication}`, {
        method: "DELETE",
      }),
      { params: Promise.resolve({ profileId: ids.profile, medicationId: ids.medication }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.documentUpdateMany).toHaveBeenCalledWith({
      where: { id: { in: [ids.document] }, deletedAt: null },
      data: { deletedAt: expect.any(Date) },
    });
    expect(mocks.deleteDocumentBlobs).toHaveBeenCalledWith([linkedDocument]);
  });

  it("persists notes, approximate timing, and only explicit normalized class codes", async () => {
    mocks.medicationFindFirst.mockResolvedValue({
      id: ids.medication,
      startedStart: null,
      endedStart: null,
      endedEnd: null,
      endedDatePrecision: null,
    });
    const response = await PATCH(
      new Request(`http://localhost/api/profiles/${ids.profile}/medications/${ids.medication}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Reviewed medication",
          status: "ended",
          startedDate: "2024",
          startedPrecision: "year",
          endedDate: "2026-06",
          endedPrecision: "month",
          notes: "Timing confirmed from reviewed record.",
          classCodes: ["statin", "ace_inhibitor", "statin"],
        }),
      }),
      { params: Promise.resolve({ profileId: ids.profile, medicationId: ids.medication }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.medicationUpdate).toHaveBeenCalledWith({
      where: { id: ids.medication },
      data: expect.objectContaining({
        notes: "Timing confirmed from reviewed record.",
        classCodesJson: ["ace_inhibitor", "statin"],
        startedDatePrecision: "year",
        endedDatePrecision: "month",
      }),
    });
    expect(mocks.rebuildRecommendations).toHaveBeenCalled();
  });

  it("clears obsolete end timing when an ended medication becomes active", async () => {
    mocks.medicationFindFirst.mockResolvedValue({
      id: ids.medication,
      startedStart: new Date("2024-01-01T00:00:00.000Z"),
      endedStart: new Date("2025-01-01T00:00:00.000Z"),
      endedEnd: new Date("2025-12-31T00:00:00.000Z"),
      endedDatePrecision: "year",
    });

    const response = await PATCH(
      new Request(`http://localhost/api/profiles/${ids.profile}/medications/${ids.medication}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Restarted medication", status: "active" }),
      }),
      { params: Promise.resolve({ profileId: ids.profile, medicationId: ids.medication }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.medicationUpdate).toHaveBeenCalledWith({
      where: { id: ids.medication },
      data: expect.objectContaining({
        status: "active",
        endedStart: null,
        endedEnd: null,
        endedDatePrecision: null,
      }),
    });
  });
});
