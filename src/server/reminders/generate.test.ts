// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  profileFindFirst: vi.fn(),
  reminderCreateMany: vi.fn(),
  reminderDeleteMany: vi.fn(),
}));

vi.mock("@/server/db/client", () => ({
  prisma: {
    profile: { findFirst: mocks.profileFindFirst },
    reminder: {
      createMany: mocks.reminderCreateMany,
      deleteMany: mocks.reminderDeleteMany,
    },
  },
}));

vi.mock("./email", () => ({ smtpSettings: vi.fn(() => null) }));

import { generateRemindersForProfile } from "./generate";

const now = new Date("2026-07-21T12:00:00.000Z");

function profile(remindersEnabled = true) {
  return {
    id: "profile-1",
    ownerUserId: "owner-1",
    createdByUserId: "owner-1",
    timezone: "America/Los_Angeles",
    recommendations: [],
    plannedActions: [],
    customMaintenance: [
      {
        id: "maintenance-1",
        profileId: "profile-1",
        status: "active",
        nextDate: new Date("2026-08-15T00:00:00.000Z"),
        reminderEnabled: true,
        reminderDaysBefore: 14,
      },
    ],
    medications: [
      {
        id: "medication-1",
        profileId: "profile-1",
        status: "active",
        nextReviewDate: new Date("2026-09-01T00:00:00.000Z"),
        deletedAt: null,
      },
    ],
    clinicianOverrides: [
      {
        id: "override-1",
        profileId: "profile-1",
        active: true,
        reviewDate: new Date("2026-10-15T00:00:00.000Z"),
      },
    ],
    reminderPreferences: [
      {
        userId: "owner-1",
        inAppEnabled: remindersEnabled,
        emailEnabled: false,
        unknownHistoryPrompts: true,
        quietDaysJson: [],
        quietHoursStart: null,
        quietHoursEnd: null,
        timezone: "America/Los_Angeles",
      },
    ],
  };
}

describe("profile reminder generation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.profileFindFirst.mockResolvedValue(profile());
    mocks.reminderDeleteMany.mockResolvedValue({ count: 0 });
    mocks.reminderCreateMany.mockResolvedValue({ count: 3 });
  });

  it("creates only neutral in-app records for explicit personal review dates", async () => {
    await expect(generateRemindersForProfile("profile-1", now)).resolves.toEqual({
      candidateCount: 3,
      createdCount: 3,
    });

    expect(mocks.profileFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          customMaintenance: expect.objectContaining({
            where: expect.objectContaining({ visibility: "profile_access" }),
          }),
        }),
      }),
    );
    const create = mocks.reminderCreateMany.mock.calls[0]?.[0] as {
      data: Array<{ channel: string; dedupeKey: string }>;
      skipDuplicates: boolean;
    };
    expect(create.skipDuplicates).toBe(true);
    expect(create.data).toHaveLength(3);
    expect(create.data.every(({ channel }) => channel === "in_app")).toBe(true);
    expect(create.data.map(({ dedupeKey }) => dedupeKey)).toEqual([
      "custom-maintenance:maintenance-1:2026-08-15:days-before:14",
      "medication-review:medication-1:2026-09-01",
      "clinician-plan-review:override-1:2026-10-15",
    ]);
    expect(JSON.stringify(create.data)).not.toMatch(/medicine name|diagnosis|instruction/i);
  });

  it("uses stable keys and relies on the unique constraint to make refresh idempotent", async () => {
    mocks.reminderCreateMany
      .mockResolvedValueOnce({ count: 3 })
      .mockResolvedValueOnce({ count: 0 });

    const first = await generateRemindersForProfile("profile-1", now);
    const second = await generateRemindersForProfile("profile-1", now);

    expect(first).toEqual({ candidateCount: 3, createdCount: 3 });
    expect(second).toEqual({ candidateCount: 3, createdCount: 0 });
    expect(mocks.reminderCreateMany.mock.calls[0]?.[0].data).toEqual(
      mocks.reminderCreateMany.mock.calls[1]?.[0].data,
    );
  });

  it("honors disabled in-app preferences and removes obsolete generated prompts", async () => {
    mocks.profileFindFirst.mockResolvedValue(profile(false));

    await expect(generateRemindersForProfile("profile-1", now)).resolves.toEqual({
      candidateCount: 0,
      createdCount: 0,
    });

    expect(mocks.reminderCreateMany).not.toHaveBeenCalled();
    expect(mocks.reminderDeleteMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        profileId: "profile-1",
        channel: "in_app",
        status: "pending",
      }),
    });
  });
});
