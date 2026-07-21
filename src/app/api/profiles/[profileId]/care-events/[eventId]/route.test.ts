// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const ids = {
  profile: "60000000-0000-4000-8000-000000000001",
  event: "60000000-0000-4000-8000-000000000002",
  document: "60000000-0000-4000-8000-000000000003",
  household: "60000000-0000-4000-8000-000000000004",
  user: "60000000-0000-4000-8000-000000000005",
};

const linkedDocument = {
  id: ids.document,
  storageKey: "aa/bb/" + "c".repeat(60),
  householdId: ids.household,
  profileId: ids.profile,
};

const mocks = vi.hoisted(() => ({
  assertSameOrigin: vi.fn(),
  requireProfileAccess: vi.fn(),
  transaction: vi.fn(),
  eventFindFirst: vi.fn(),
  eventUpdateMany: vi.fn(),
  documentUpdateMany: vi.fn(),
  documentLinkCount: vi.fn(),
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

import { DELETE, POST } from "./route";

describe("care-event document lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireProfileAccess.mockResolvedValue({
      session: { user: { id: ids.user } },
      profile: { id: ids.profile, householdId: ids.household },
    });
    mocks.eventFindFirst.mockResolvedValue({
      documentLinks: [{ document: linkedDocument }],
    });
    mocks.eventUpdateMany.mockResolvedValue({ count: 1 });
    mocks.documentUpdateMany.mockResolvedValue({ count: 1 });
    mocks.documentLinkCount.mockResolvedValue(0);
    mocks.auditCreate.mockResolvedValue({ id: "audit" });
    mocks.rebuildRecommendations.mockResolvedValue({});
    mocks.deleteDocumentBlobs.mockResolvedValue({ deletedIds: [ids.document], failedIds: [] });
    const database = {
      careEvent: {
        findFirst: mocks.eventFindFirst,
        updateMany: mocks.eventUpdateMany,
      },
      document: { updateMany: mocks.documentUpdateMany },
      documentLink: { count: mocks.documentLinkCount },
      auditLog: { create: mocks.auditCreate },
    };
    mocks.transaction.mockImplementation(
      async (callback: (client: typeof database) => Promise<unknown>) => callback(database),
    );
  });

  it("soft-deletes linked documents before attempting physical cleanup", async () => {
    const response = await DELETE(
      new Request(`http://localhost/api/profiles/${ids.profile}/care-events/${ids.event}`, {
        method: "DELETE",
      }),
      { params: Promise.resolve({ profileId: ids.profile, eventId: ids.event }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ restorable: false });
    expect(mocks.documentUpdateMany).toHaveBeenCalledWith({
      where: { id: { in: [ids.document] }, deletedAt: null },
      data: { deletedAt: expect.any(Date) },
    });
    expect(mocks.deleteDocumentBlobs).toHaveBeenCalledWith([linkedDocument]);
  });

  it("refuses to restore an event after its linked private blobs were purged", async () => {
    mocks.documentLinkCount.mockResolvedValue(1);

    const response = await POST(
      new Request(`http://localhost/api/profiles/${ids.profile}/care-events/${ids.event}`, {
        method: "POST",
      }),
      { params: Promise.resolve({ profileId: ids.profile, eventId: ids.event }) },
    );

    expect(response.status).toBe(409);
    expect(mocks.eventUpdateMany).not.toHaveBeenCalled();
  });
});
