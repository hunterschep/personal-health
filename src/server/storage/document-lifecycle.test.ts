import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  storageDelete: vi.fn(),
  documentUpdateMany: vi.fn(),
  auditCreateMany: vi.fn(),
}));

vi.mock("@/server/db/client", () => ({
  prisma: {
    document: { updateMany: mocks.documentUpdateMany },
    auditLog: { createMany: mocks.auditCreateMany },
  },
}));
vi.mock("./local", () => ({ privateStorage: { delete: mocks.storageDelete } }));

import { deleteDocumentBlobs, type PendingDocumentBlob } from "./document-lifecycle";

const first: PendingDocumentBlob = {
  id: "50000000-0000-4000-8000-000000000001",
  storageKey: "aa/bb/" + "c".repeat(60),
  householdId: "50000000-0000-4000-8000-000000000002",
  profileId: "50000000-0000-4000-8000-000000000003",
};
const second: PendingDocumentBlob = {
  id: "50000000-0000-4000-8000-000000000004",
  storageKey: "dd/ee/" + "f".repeat(60),
  householdId: first.householdId,
  profileId: first.profileId,
};

describe("deleteDocumentBlobs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.storageDelete.mockResolvedValue(undefined);
    mocks.documentUpdateMany.mockResolvedValue({ count: 1 });
    mocks.auditCreateMany.mockResolvedValue({ count: 0 });
  });

  it("marks durable completion only after physical deletion succeeds", async () => {
    const result = await deleteDocumentBlobs([first]);

    expect(mocks.storageDelete).toHaveBeenCalledWith(first.storageKey);
    expect(mocks.documentUpdateMany).toHaveBeenCalledWith({
      where: {
        id: { in: [first.id] },
        deletedAt: { not: null },
        blobDeletedAt: null,
      },
      data: { blobDeletedAt: expect.any(Date) },
    });
    expect(result).toEqual({ deletedIds: [first.id], failedIds: [] });
    expect(mocks.auditCreateMany).not.toHaveBeenCalled();
  });

  it("keeps failed deletions pending while completing successful ones", async () => {
    mocks.storageDelete
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("storage unavailable"));

    const result = await deleteDocumentBlobs([first, second], "cleanup");

    expect(mocks.documentUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: { in: [first.id] } }) }),
    );
    expect(mocks.auditCreateMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          action: "document.blob_delete_failed",
          entityId: second.id,
          metadataJson: { attempt: "cleanup" },
        }),
      ],
    });
    expect(result).toEqual({ deletedIds: [first.id], failedIds: [second.id] });
  });

  it("does not set a completion marker when every deletion fails", async () => {
    mocks.storageDelete.mockRejectedValue(new Error("read-only filesystem"));

    const result = await deleteDocumentBlobs([first]);

    expect(mocks.documentUpdateMany).not.toHaveBeenCalled();
    expect(result).toEqual({ deletedIds: [], failedIds: [first.id] });
  });
});
