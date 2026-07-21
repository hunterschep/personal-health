// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireProfileAccess: vi.fn(),
  preferenceFindUnique: vi.fn(),
  reminderFindMany: vi.fn(),
}));

vi.mock("@/server/auth/csrf", () => ({ assertSameOrigin: vi.fn() }));
vi.mock("@/server/authorization/profile", () => ({
  requireProfileAccess: mocks.requireProfileAccess,
}));
vi.mock("@/server/db/client", () => ({
  prisma: {
    reminderPreference: { findUnique: mocks.preferenceFindUnique },
    reminder: { findMany: mocks.reminderFindMany },
  },
}));
vi.mock("@/server/reminders", () => ({
  plannedActionReminderCopy: vi.fn(),
  recommendationReminderCopy: vi.fn(),
  standaloneReminderCopy: vi.fn(),
  smtpSettings: vi.fn(() => null),
  smtpDeliveryStatus: vi.fn(() => ({ status: "disabled", checkedAt: null })),
}));

import { GET } from "./route";

describe("GET /api/profiles/:profileId/reminders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireProfileAccess.mockResolvedValue({
      session: { user: { id: "user-1" } },
      profile: { id: "profile-1", ownerUserId: "owner-1" },
      capabilities: { canEdit: false, canManage: false, canExport: false, canDelete: false },
    });
    mocks.preferenceFindUnique.mockResolvedValue(null);
    mocks.reminderFindMany.mockResolvedValue([]);
  });

  it("returns the edit capability used to suppress mutation controls", async () => {
    const response = await GET(new Request("http://localhost/api/profiles/profile-1/reminders"), {
      params: Promise.resolve({ profileId: "profile-1" }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ editable: false, reminders: [] });
    expect(mocks.requireProfileAccess).toHaveBeenCalledWith("profile-1", "view");
  });
});
