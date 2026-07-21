// @vitest-environment node

import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { checkDatabase, checkStorage } from "./checks";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true })),
  );
});

describe("health dependency checks", () => {
  it("reports database success without returning query data", async () => {
    const query = vi.fn().mockResolvedValue([{ ok: 1 }]);

    await expect(checkDatabase({ $queryRawUnsafe: query })).resolves.toBe("ok");
    expect(query).toHaveBeenCalledWith("SELECT 1 AS ok");
  });

  it("converts database failures into a neutral status", async () => {
    await expect(
      checkDatabase({ $queryRawUnsafe: vi.fn().mockRejectedValue(new Error("secret detail")) }),
    ).resolves.toBe("error");
  });

  it("probes a storage directory and removes its temporary file", async () => {
    const parent = await mkdtemp(path.join(os.tmpdir(), "carecadence-health-"));
    temporaryDirectories.push(parent);
    const uploadDirectory = path.join(parent, "uploads");

    await expect(checkStorage(uploadDirectory)).resolves.toBe("ok");
    await expect(readdir(uploadDirectory)).resolves.toEqual([]);
  });

  it("reports an unwritable storage target without exposing internals", async () => {
    const parent = await mkdtemp(path.join(os.tmpdir(), "carecadence-health-"));
    temporaryDirectories.push(parent);
    const filePath = path.join(parent, "not-a-directory");
    await writeFile(filePath, "occupied");

    await expect(checkStorage(filePath)).resolves.toBe("error");
  });
});
