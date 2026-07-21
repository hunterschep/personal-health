import { Readable } from "node:stream";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { LocalPrivateStorage } from "./local";

describe("LocalPrivateStorage", () => {
  it("uses opaque keys and verifies written bytes", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "carecadence-storage-"));
    const storage = new LocalPrivateStorage(root);
    const bytes = Buffer.from("synthetic document");
    const result = await storage.put({
      stream: Readable.from(bytes),
      contentType: "application/pdf",
      size: bytes.length,
    });
    expect(result.storageKey).toMatch(/^[a-f0-9]{2}\/[a-f0-9]{2}\/[a-f0-9]{60}$/);
    expect(await readFile(path.join(root, result.storageKey), "utf8")).toBe("synthetic document");
    await storage.delete(result.storageKey);
    await expect(storage.delete(result.storageKey)).resolves.toBeUndefined();
  });

  it("rejects traversal keys", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "carecadence-storage-"));
    const storage = new LocalPrivateStorage(root);
    await expect(storage.get("../../etc/passwd")).rejects.toThrow("INVALID_STORAGE_KEY");
  });

  it("treats an already-missing blob as an idempotent successful deletion", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "carecadence-storage-"));
    const storage = new LocalPrivateStorage(root);
    const missingKey = `aa/bb/${"c".repeat(60)}`;

    await expect(storage.delete(missingKey)).resolves.toBeUndefined();
  });
});
