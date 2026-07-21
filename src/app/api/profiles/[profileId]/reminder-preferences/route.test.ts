// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assertSameOrigin: vi.fn(),
  requireProfileAccess: vi.fn(),
  preferenceFindUnique: vi.fn(),
  preferenceUpsert: vi.fn(),
  reminderDeleteMany: vi.fn(),
}));

vi.mock("@/server/auth/csrf", () => ({ assertSameOrigin: mocks.assertSameOrigin }));
vi.mock("@/server/authorization/profile", () => ({
  requireProfileAccess: mocks.requireProfileAccess,
}));
vi.mock("@/server/db/client", () => ({
  prisma: {
    reminderPreference: {
      findUnique: mocks.preferenceFindUnique,
      upsert: mocks.preferenceUpsert,
    },
    reminder: { deleteMany: mocks.reminderDeleteMany },
  },
}));
vi.mock("@/server/reminders", () => ({
  smtpSettings: vi.fn(() => null),
  smtpDeliveryStatus: vi.fn(() => ({ status: "disabled", checkedAt: null })),
}));

import { GET, PUT } from "./route";

const preferences = {
  inAppEnabled: true,
  emailEnabled: false,
  unknownHistoryPrompts: true,
  quietDays: [],
  quietHoursStart: null,
  quietHoursEnd: null,
  dueSoonWindowDays: 90,
  householdActivityDetail: false,
  timezone: "America/Los_Angeles",
  digestMode: "individual",
} as const;

describe("profile reminder preferences capability gating", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireProfileAccess.mockResolvedValue({
      session: { user: { id: "editor-1" } },
      profile: {
        id: "profile-1",
        ownerUserId: "owner-1",
        timezone: "America/Los_Angeles",
      },
      capabilities: { canEdit: true, canManage: false, canExport: false, canDelete: false },
    });
    mocks.preferenceFindUnique.mockResolvedValue(null);
    mocks.preferenceUpsert.mockResolvedValue({
      ...preferences,
      quietDaysJson: [],
    });
    mocks.reminderDeleteMany.mockResolvedValue({ count: 0 });
  });

  it("reports view-only settings as non-editable", async () => {
    mocks.requireProfileAccess.mockResolvedValueOnce({
      session: { user: { id: "viewer-1" } },
      profile: {
        id: "profile-1",
        ownerUserId: "owner-1",
        timezone: "America/Los_Angeles",
      },
      capabilities: { canEdit: false, canManage: false, canExport: false, canDelete: false },
    });

    const response = await GET(
      new Request("http://localhost/api/profiles/profile-1/reminder-preferences"),
      { params: Promise.resolve({ profileId: "profile-1" }) },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ editable: false });
    expect(mocks.requireProfileAccess).toHaveBeenCalledWith("profile-1", "view");
  });

  it("requires edit access and does not let a non-owner clear owner email reminders", async () => {
    const response = await PUT(
      new Request("http://localhost/api/profiles/profile-1/reminder-preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(preferences),
      }),
      { params: Promise.resolve({ profileId: "profile-1" }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.requireProfileAccess).toHaveBeenCalledWith("profile-1", "edit");
    expect(mocks.preferenceUpsert).toHaveBeenCalledTimes(1);
    expect(mocks.reminderDeleteMany).not.toHaveBeenCalled();
  });
});
