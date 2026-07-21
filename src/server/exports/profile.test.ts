import { Readable } from "node:stream";
import JSZip from "jszip";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findProfile: vi.fn(),
  getDocument: vi.fn(),
}));

vi.mock("@/server/db/client", () => ({
  prisma: { profile: { findFirst: mocks.findProfile } },
}));

vi.mock("@/server/storage", () => ({
  privateStorage: { get: mocks.getDocument },
}));

import { createProfileExport } from "./profile";

describe("profile ZIP export", () => {
  beforeEach(() => {
    mocks.findProfile.mockReset();
    mocks.getDocument.mockReset();
  });

  it("contains the documented files and private document bytes", async () => {
    const documentBytes = Buffer.from("private document bytes");
    mocks.findProfile.mockResolvedValue({
      id: "profile-1",
      householdId: "household-1",
      displayName: "Taylor",
      relationshipLabel: "Self",
      dateOfBirth: new Date("1980-05-03T00:00:00.000Z"),
      sexAssignedAtBirth: "unknown",
      genderIdentity: null,
      countryCode: "US",
      timezone: "America/Los_Angeles",
      carePlanMode: "evidence_based",
      visibility: "owner_only",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-02T00:00:00.000Z"),
      anatomy: [],
      riskFactors: [],
      conditions: [],
      familyHistory: [],
      surgeries: [],
      serviceHistoryStates: [],
      careEvents: [],
      medications: [],
      clinicianOverrides: [],
      plannedActions: [],
      recommendations: [],
      documents: [
        {
          id: "document-1",
          storageKey: "aa/bb/cccc",
          safeFilename: "record.pdf",
          mimeType: "application/pdf",
          sizeBytes: BigInt(documentBytes.length),
          sha256: "a".repeat(64),
          createdAt: new Date("2026-01-03T00:00:00.000Z"),
        },
      ],
    });
    mocks.getDocument.mockResolvedValue({
      stream: Readable.from(documentBytes),
      contentType: "application/pdf",
      size: documentBytes.length,
    });

    const archive = await createProfileExport("profile-1", new Date("2026-07-21T12:00:00.000Z"));
    const zip = await JSZip.loadAsync(archive);
    expect(Object.keys(zip.files).sort()).toEqual([
      "README.txt",
      "care-events.csv",
      "clinician-overrides.csv",
      "documents/",
      "documents/001-record.pdf",
      "medications.csv",
      "planned-actions.csv",
      "profile.json",
      "sources.csv",
    ]);
    expect(await zip.file("documents/001-record.pdf")?.async("nodebuffer")).toEqual(documentBytes);
    const profile = JSON.parse((await zip.file("profile.json")?.async("string")) ?? "null") as {
      schemaVersion: string;
      profile: { displayName: string };
    };
    expect(profile).toMatchObject({
      schemaVersion: "1.0",
      profile: { displayName: "Taylor" },
    });
  });
});
