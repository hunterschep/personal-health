// @vitest-environment node

import { File } from "node:buffer";

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  put: vi.fn(),
}));

vi.mock("@/config/env", () => ({
  getServerEnv: () => ({ MAX_UPLOAD_BYTES: 1_024 }),
}));

vi.mock("./local", () => ({
  privateStorage: { put: mocks.put },
}));

import { storeValidatedDocument } from "./upload";

const syntheticPdf = Buffer.from(
  "%PDF-1.4\n% Synthetic CareCadence upload test\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n",
);

describe("private document upload validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.put.mockResolvedValue({
      storageKey: `aa/bb/${"c".repeat(60)}`,
      sha256: "d".repeat(64),
    });
  });

  it("rejects a declared PDF whose bytes do not have a supported signature", async () => {
    const spoofed = new File([Buffer.from("not really a PDF")], "record.pdf", {
      type: "application/pdf",
    });

    await expect(storeValidatedDocument(spoofed)).rejects.toThrow(
      "Only genuine PDF, JPEG, and PNG documents are accepted.",
    );
    expect(mocks.put).not.toHaveBeenCalled();
  });

  it("rejects an upload over the configured byte limit before storage", async () => {
    const oversized = new File([Buffer.alloc(1_025)], "large.pdf", {
      type: "application/pdf",
    });

    await expect(storeValidatedDocument(oversized)).rejects.toThrow(
      "Documents must be between 1 and 1024 bytes.",
    );
    expect(mocks.put).not.toHaveBeenCalled();
  });

  it("accepts genuine bytes while replacing a hostile display filename", async () => {
    const upload = new File([syntheticPdf], "../../unsafe\u0000record.pdf", {
      type: "application/pdf",
    });

    await expect(storeValidatedDocument(upload)).resolves.toMatchObject({
      originalFilename: "../../unsafe\u0000record.pdf",
      safeFilename: ".._.._unsafe_record.pdf",
      mimeType: "application/pdf",
      sizeBytes: syntheticPdf.length,
    });
    expect(mocks.put).toHaveBeenCalledWith(
      expect.objectContaining({ contentType: "application/pdf", size: syntheticPdf.length }),
    );
  });
});
