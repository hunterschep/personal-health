// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const ids = {
  profile: "40000000-0000-4000-8000-000000000001",
  user: "40000000-0000-4000-8000-000000000002",
  household: "40000000-0000-4000-8000-000000000003",
  action: "40000000-0000-4000-8000-000000000004",
  recommendation: "40000000-0000-4000-8000-000000000005",
  reminder: "40000000-0000-4000-8000-000000000006",
  maintenance: "40000000-0000-4000-8000-000000000007",
};

const mocks = vi.hoisted(() => ({
  requireProfileAccess: vi.fn(),
  actionFindMany: vi.fn(),
  recommendationFindMany: vi.fn(),
  reminderFindMany: vi.fn(),
  maintenanceFindMany: vi.fn(),
  auditCreate: vi.fn(),
}));

vi.mock("@/config/env", () => ({ getServerEnv: () => ({ APP_BASE_URL: undefined }) }));
vi.mock("@/server/authorization/profile", () => ({
  requireProfileAccess: mocks.requireProfileAccess,
}));
vi.mock("@/server/custom-maintenance", () => ({
  customMaintenanceVisibilityWhere: () => ({}),
  isProfileOwnerOrOrganizer: () => true,
}));
vi.mock("@/server/db/client", () => ({
  prisma: {
    plannedAction: { findMany: mocks.actionFindMany },
    recommendationInstance: { findMany: mocks.recommendationFindMany },
    reminder: { findMany: mocks.reminderFindMany },
    customMaintenance: { findMany: mocks.maintenanceFindMany },
    auditLog: { create: mocks.auditCreate },
  },
}));

import { GET } from "./route";

describe("GET /api/profiles/:profileId/calendar.ics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireProfileAccess.mockResolvedValue({
      session: { user: { id: ids.user } },
      profile: {
        id: ids.profile,
        ownerUserId: ids.user,
        createdByUserId: ids.user,
        householdId: ids.household,
        timezone: "America/Los_Angeles",
      },
    });
    mocks.actionFindMany.mockResolvedValue([]);
    mocks.recommendationFindMany.mockResolvedValue([]);
    mocks.reminderFindMany.mockResolvedValue([
      {
        id: ids.reminder,
        profileId: ids.profile,
        remindAt: new Date("2026-08-10T16:00:00.000Z"),
        updatedAt: new Date("2026-07-21T12:00:00.000Z"),
      },
    ]);
    mocks.maintenanceFindMany.mockResolvedValue([
      {
        id: ids.maintenance,
        profileId: ids.profile,
        nextDate: new Date("2026-09-14T00:00:00.000Z"),
        updatedAt: new Date("2026-07-21T12:00:00.000Z"),
      },
    ]);
    mocks.auditCreate.mockResolvedValue({ id: "audit" });
  });

  it("exports only the typed annual-roadmap selection", async () => {
    const query = new URLSearchParams([
      ["item", `reminder:${ids.reminder}`],
      ["item", `maintenance:${ids.maintenance}`],
    ]);
    const response = await GET(
      new Request(`http://localhost/api/profiles/${ids.profile}/calendar.ics?${query}`),
      { params: Promise.resolve({ profileId: ids.profile }) },
    );
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(mocks.actionFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: { in: [] } }) }),
    );
    expect(mocks.recommendationFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: { in: [] } }) }),
    );
    expect(mocks.reminderFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: { in: [ids.reminder] } }),
      }),
    );
    expect(mocks.maintenanceFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: { in: [ids.maintenance] } }),
      }),
    );
    expect(body).toContain("SUMMARY:Care reminder");
    expect(body).toContain("SUMMARY:Personal care cadence");
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ metadataJson: { format: "ics", itemCount: 2 } }),
    });
  });

  it("keeps the legacy selected-ID contract for planned actions and recommendations", async () => {
    mocks.reminderFindMany.mockResolvedValue([]);
    mocks.maintenanceFindMany.mockResolvedValue([]);
    const response = await GET(
      new Request(
        `http://localhost/api/profiles/${ids.profile}/calendar.ics?id=${ids.action}&id=${ids.recommendation}`,
      ),
      { params: Promise.resolve({ profileId: ids.profile }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.actionFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: { in: [ids.action, ids.recommendation] } }),
      }),
    );
    expect(mocks.recommendationFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: { in: [ids.action, ids.recommendation] } }),
      }),
    );
  });

  it("includes reminders and personal cadences in the unfiltered profile export", async () => {
    const response = await GET(
      new Request(`http://localhost/api/profiles/${ids.profile}/calendar.ics`),
      { params: Promise.resolve({ profileId: ids.profile }) },
    );
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(mocks.reminderFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.not.objectContaining({ id: expect.anything() }) }),
    );
    expect(mocks.maintenanceFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.not.objectContaining({ id: expect.anything() }) }),
    );
    expect(body).toContain("SUMMARY:Care reminder");
    expect(body).toContain("SUMMARY:Personal care cadence");
  });
});
