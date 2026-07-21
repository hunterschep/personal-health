// @vitest-environment node

import { createHash } from "node:crypto";
import { Readable } from "node:stream";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NotFoundError } from "@/domain/shared/errors";

const ids = {
  document: "40000000-0000-4000-8000-000000000001",
  profile: "40000000-0000-4000-8000-000000000002",
  household: "40000000-0000-4000-8000-000000000003",
  user: "40000000-0000-4000-8000-000000000004",
};
const contents = Buffer.from("sensitive synthetic document");

const mocks = vi.hoisted(() => ({
  assertSameOrigin: vi.fn(),
  requireProfileAccess: vi.fn(),
  documentFindFirst: vi.fn(),
  documentUpdate: vi.fn(),
  auditCreate: vi.fn(),
  transaction: vi.fn(),
  storageGet: vi.fn(),
  deleteDocumentBlobs: vi.fn(),
}));

vi.mock("@/server/auth/csrf", () => ({ assertSameOrigin: mocks.assertSameOrigin }));
vi.mock("@/server/authorization/profile", () => ({
  requireProfileAccess: mocks.requireProfileAccess,
}));
vi.mock("@/server/db/client", () => ({
  prisma: {
    document: {
      findFirst: mocks.documentFindFirst,
      update: mocks.documentUpdate,
    },
    auditLog: { create: mocks.auditCreate },
    $transaction: mocks.transaction,
  },
}));
vi.mock("@/server/storage", () => ({
  privateStorage: { get: mocks.storageGet },
  deleteDocumentBlobs: mocks.deleteDocumentBlobs,
}));

import { DELETE, GET } from "./route";

describe("document route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.documentFindFirst.mockResolvedValue(documentRecord());
    mocks.requireProfileAccess.mockResolvedValue({ session: { user: { id: ids.user } } });
    mocks.storageGet.mockResolvedValue({
      size: contents.length,
      stream: Readable.from(contents),
      contentType: "application/octet-stream",
    });
    mocks.auditCreate.mockResolvedValue({ id: "audit" });
    mocks.documentUpdate.mockResolvedValue(documentRecord());
    mocks.transaction.mockImplementation(async (operations: Promise<unknown>[]) =>
      Promise.all(operations),
    );
    mocks.deleteDocumentBlobs.mockResolvedValue({ deletedIds: [ids.document], failedIds: [] });
  });

  it("returns the same neutral response for an inaccessible and a missing document", async () => {
    mocks.requireProfileAccess.mockRejectedValueOnce(new NotFoundError());
    const inaccessible = await get();
    mocks.documentFindFirst.mockResolvedValueOnce(null);
    const missing = await get();

    expect(inaccessible.status).toBe(404);
    expect(missing.status).toBe(404);
    expect(await inaccessible.json()).toEqual({ error: "Not found." });
    expect(await missing.json()).toEqual({ error: "Not found." });
    expect(mocks.storageGet).not.toHaveBeenCalled();
    expect(mocks.auditCreate).not.toHaveBeenCalled();
  });

  it("refuses and audits a stored-size mismatch without reading bytes", async () => {
    const stream = Readable.from(contents);
    mocks.storageGet.mockResolvedValue({
      size: contents.length + 1,
      stream,
      contentType: "application/octet-stream",
    });

    const response = await get();

    expect(response.status).toBe(409);
    expect(await response.text()).not.toContain(contents.toString("utf8"));
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "document.integrity_failed",
        entityId: ids.document,
        metadataJson: { reason: "size_mismatch" },
      }),
    });
  });

  it("refuses and audits a stream that exceeds its recorded size", async () => {
    const shortRecord = documentRecord({ sizeBytes: 4n });
    mocks.documentFindFirst.mockResolvedValue(shortRecord);
    mocks.storageGet.mockResolvedValue({
      size: 4,
      stream: Readable.from(Buffer.from("too many bytes")),
      contentType: "application/octet-stream",
    });

    const response = await get();

    expect(response.status).toBe(409);
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ metadataJson: { reason: "size_mismatch" } }),
    });
  });

  it("refuses and audits a hash mismatch without returning document bytes", async () => {
    mocks.documentFindFirst.mockResolvedValue(documentRecord({ sha256: "0".repeat(64) }));

    const response = await get();
    const responseText = await response.text();

    expect(response.status).toBe(409);
    expect(responseText).not.toContain(contents.toString("utf8"));
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ metadataJson: { reason: "hash_mismatch" } }),
    });
  });

  it("soft-deletes the record and attempts physical cleanup", async () => {
    const response = await remove();

    expect(response.status).toBe(204);
    expect(mocks.documentUpdate).toHaveBeenCalledWith({
      where: { id: ids.document },
      data: { deletedAt: expect.any(Date) },
    });
    expect(mocks.deleteDocumentBlobs).toHaveBeenCalledWith([
      {
        id: ids.document,
        storageKey: "aa/bb/" + "c".repeat(60),
        householdId: ids.household,
        profileId: ids.profile,
      },
    ]);
  });
});

function documentRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: ids.document,
    householdId: ids.household,
    profileId: ids.profile,
    storageKey: "aa/bb/" + "c".repeat(60),
    safeFilename: "record.pdf",
    mimeType: "application/pdf",
    sizeBytes: BigInt(contents.length),
    sha256: createHash("sha256").update(contents).digest("hex"),
    ...overrides,
  };
}

function get() {
  return GET(new Request(`http://localhost/api/documents/${ids.document}`), {
    params: Promise.resolve({ documentId: ids.document }),
  });
}

function remove() {
  return DELETE(
    new Request(`http://localhost/api/documents/${ids.document}`, { method: "DELETE" }),
    { params: Promise.resolve({ documentId: ids.document }) },
  );
}
