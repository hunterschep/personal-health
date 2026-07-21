import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireProfileAccess: vi.fn(),
  findMany: vi.fn(),
}));

vi.mock("@/server/auth/csrf", () => ({ assertSameOrigin: vi.fn() }));
vi.mock("@/server/authorization/profile", () => ({
  requireProfileAccess: mocks.requireProfileAccess,
}));
vi.mock("@/server/db/client", () => ({ prisma: { careEvent: { findMany: mocks.findMany } } }));
vi.mock("@/server/recommendations", () => ({ rebuildRecommendations: vi.fn() }));
vi.mock("@/server/storage", () => ({
  privateStorage: { delete: vi.fn() },
  storeValidatedDocument: vi.fn(),
}));

import { GET } from "./route";

describe("care-event list response", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireProfileAccess.mockResolvedValue({ profile: { id: "profile-id" } });
  });

  it("serializes attachment sizes and omits private storage metadata", async () => {
    mocks.findMany.mockResolvedValue([
      {
        id: "event-id",
        performedStart: new Date("2025-01-01T00:00:00.000Z"),
        performedEnd: new Date("2025-12-31T00:00:00.000Z"),
        datePrecision: "year",
        result: "normal",
        providerName: null,
        locationName: null,
        notes: null,
        source: "medical_record",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        service: { id: "service-id", slug: "service", name: "Service", category: "custom" },
        method: null,
        documentLinks: [
          {
            id: "link-id",
            label: "Attachment",
            document: {
              id: "document-id",
              safeFilename: "record.pdf",
              mimeType: "application/pdf",
              sizeBytes: 42n,
              createdAt: new Date("2026-01-01T00:00:00.000Z"),
              deletedAt: null,
              storageKey: "must-not-appear",
              sha256: "must-not-appear",
              uploadedByUserId: "must-not-appear",
              originalFilename: "must-not-appear",
            },
          },
        ],
      },
    ]);

    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ profileId: "profile-id" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body[0].documentLinks[0].document).toEqual({
      id: "document-id",
      filename: "record.pdf",
      mimeType: "application/pdf",
      sizeBytes: 42,
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    expect(JSON.stringify(body)).not.toContain("must-not-appear");
    expect(mocks.requireProfileAccess).toHaveBeenCalledWith("profile-id", "view");
  });

  it("omits soft-deleted documents", async () => {
    mocks.findMany.mockResolvedValue([
      {
        id: "event-id",
        performedStart: null,
        performedEnd: null,
        datePrecision: "unknown",
        result: "unknown",
        providerName: null,
        locationName: null,
        notes: null,
        source: "user_memory",
        createdAt: new Date(),
        updatedAt: new Date(),
        service: { id: "service-id", slug: "service", name: "Service", category: "custom" },
        method: null,
        documentLinks: [
          {
            id: "link-id",
            label: "Attachment",
            document: {
              id: "document-id",
              safeFilename: "deleted.pdf",
              mimeType: "application/pdf",
              sizeBytes: 42n,
              createdAt: new Date(),
              deletedAt: new Date(),
            },
          },
        ],
      },
    ]);

    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ profileId: "profile-id" }),
    });
    const body = await response.json();
    expect(body[0].documentLinks).toEqual([]);
  });
});
