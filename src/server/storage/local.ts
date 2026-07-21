import { createHash, randomBytes } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, rename, stat, unlink } from "node:fs/promises";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { getServerEnv } from "@/config/env";
import type { PrivateStorage } from "./private-storage";

function safeStoragePath(root: string, storageKey: string): string {
  if (!/^[a-f0-9]{2}\/[a-f0-9]{2}\/[a-f0-9]{60}$/.test(storageKey)) {
    throw new Error("INVALID_STORAGE_KEY");
  }
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, storageKey);
  if (!resolved.startsWith(`${resolvedRoot}${path.sep}`)) throw new Error("INVALID_STORAGE_KEY");
  return resolved;
}

function toNodeStream(
  stream: ReadableStream<Uint8Array> | NodeJS.ReadableStream,
): NodeJS.ReadableStream {
  if (typeof (stream as ReadableStream<Uint8Array>).getReader === "function") {
    const webStream = stream as ReadableStream<Uint8Array>;
    return Readable.from(
      (async function* chunks() {
        const reader = webStream.getReader();
        try {
          while (true) {
            const result = await reader.read();
            if (result.done) return;
            yield result.value;
          }
        } finally {
          reader.releaseLock();
        }
      })(),
    );
  }
  return stream as NodeJS.ReadableStream;
}

export class LocalPrivateStorage implements PrivateStorage {
  readonly #root: string;

  constructor(root = getServerEnv().UPLOAD_DIR) {
    this.#root = path.resolve(root);
  }

  async put(input: {
    stream: ReadableStream<Uint8Array> | NodeJS.ReadableStream;
    contentType: string;
    size: number;
  }): Promise<{ storageKey: string; sha256: string }> {
    const token = randomBytes(32).toString("hex");
    const storageKey = `${token.slice(0, 2)}/${token.slice(2, 4)}/${token.slice(4)}`;
    const destination = safeStoragePath(this.#root, storageKey);
    const temporary = `${destination}.partial-${randomBytes(6).toString("hex")}`;
    await mkdir(path.dirname(destination), { recursive: true, mode: 0o700 });

    const hash = createHash("sha256");
    let written = 0;
    const verifier = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        written += chunk.length;
        hash.update(chunk);
        callback(null, chunk);
      },
    });

    try {
      await pipeline(
        toNodeStream(input.stream),
        verifier,
        createWriteStream(temporary, { flags: "wx", mode: 0o600 }),
      );
      if (written !== input.size) throw new Error("UPLOAD_SIZE_MISMATCH");
      await rename(temporary, destination);
      return { storageKey, sha256: hash.digest("hex") };
    } catch (error) {
      await unlink(temporary).catch(() => undefined);
      throw error;
    }
  }

  async get(
    storageKey: string,
  ): Promise<{ stream: NodeJS.ReadableStream; contentType: string; size: number }> {
    const filePath = safeStoragePath(this.#root, storageKey);
    const metadata = await stat(filePath);
    return {
      stream: createReadStream(filePath),
      contentType: "application/octet-stream",
      size: metadata.size,
    };
  }

  async delete(storageKey: string): Promise<void> {
    try {
      await unlink(safeStoragePath(this.#root, storageKey));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
}

export const privateStorage = new LocalPrivateStorage();
