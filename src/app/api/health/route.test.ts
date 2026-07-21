// @vitest-environment node

import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const query = vi.fn();

vi.mock("@/server/db/client", () => ({
  prisma: { $queryRawUnsafe: query },
}));

import { GET } from "./route";

let uploadDirectory: string;

beforeAll(async () => {
  uploadDirectory = await mkdtemp(path.join(os.tmpdir(), "carecadence-route-health-"));
  process.env.UPLOAD_DIR = uploadDirectory;
  process.env.BUILD_VERSION = "test-build";
});

afterAll(async () => {
  delete process.env.UPLOAD_DIR;
  delete process.env.BUILD_VERSION;
  await rm(uploadDirectory, { recursive: true });
});

describe("GET /api/health", () => {
  it("serves liveness without querying dependencies", async () => {
    const response = await GET(new Request("http://localhost/api/health?mode=liveness"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: "ok",
      mode: "liveness",
      version: "test-build",
    });
    expect(query).not.toHaveBeenCalled();
  });

  it("serves readiness only when database and storage are available", async () => {
    query.mockResolvedValueOnce([{ ok: 1 }]);

    const response = await GET(new Request("http://localhost/api/health?mode=readiness"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: "ok",
      mode: "readiness",
      checks: { database: "ok", storage: "ok" },
    });
  });

  it("returns a neutral 503 when a dependency fails", async () => {
    query.mockRejectedValueOnce(new Error("postgresql://secret@host/database"));

    const response = await GET(new Request("http://localhost/api/health"));
    const body = await response.text();

    expect(response.status).toBe(503);
    expect(response.headers.get("Retry-After")).toBe("10");
    expect(body).toContain('"database":"error"');
    expect(body).not.toContain("secret");
  });

  it("rejects unknown modes instead of reflecting them", async () => {
    const response = await GET(new Request("http://localhost/api/health?mode=debug"));

    expect(response.status).toBe(400);
    expect(await response.text()).not.toContain("debug");
  });
});
