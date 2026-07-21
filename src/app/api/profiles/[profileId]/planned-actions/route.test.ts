// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const ids = {
  profile: "10000000-0000-4000-8000-000000000001",
  user: "10000000-0000-4000-8000-000000000002",
  household: "10000000-0000-4000-8000-000000000003",
  service: "10000000-0000-4000-8000-000000000004",
  action: "10000000-0000-4000-8000-000000000005",
};

const mocks = vi.hoisted(() => ({
  assertSameOrigin: vi.fn(),
  requireProfileAccess: vi.fn(),
  serviceFindFirst: vi.fn(),
  recommendationFindFirst: vi.fn(),
  preferenceFindUnique: vi.fn(),
  transaction: vi.fn(),
  actionCreate: vi.fn(),
  reminderCreate: vi.fn(),
  auditCreate: vi.fn(),
}));

vi.mock("@/server/auth/csrf", () => ({ assertSameOrigin: mocks.assertSameOrigin }));
vi.mock("@/server/authorization/profile", () => ({
  requireProfileAccess: mocks.requireProfileAccess,
}));
vi.mock("@/server/db/client", () => ({
  prisma: {
    serviceCatalog: { findFirst: mocks.serviceFindFirst },
    recommendationInstance: { findFirst: mocks.recommendationFindFirst },
    reminderPreference: { findUnique: mocks.preferenceFindUnique },
    $transaction: mocks.transaction,
  },
}));

import { POST } from "./route";

describe("POST /api/profiles/:profileId/planned-actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireProfileAccess.mockResolvedValue({
      session: { user: { id: ids.user } },
      profile: {
        id: ids.profile,
        householdId: ids.household,
        timezone: "America/Los_Angeles",
      },
    });
    mocks.serviceFindFirst.mockResolvedValue({ id: ids.service });
    mocks.actionCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: ids.action,
      ...data,
    }));
    mocks.auditCreate.mockResolvedValue({ id: "audit" });
    mocks.preferenceFindUnique.mockResolvedValue(null);
    mocks.reminderCreate.mockResolvedValue({ id: "reminder-1" });
    const database = {
      plannedAction: { create: mocks.actionCreate },
      reminder: { create: mocks.reminderCreate },
      auditLog: { create: mocks.auditCreate },
    };
    mocks.transaction.mockImplementation(
      async (callback: (client: typeof database) => Promise<unknown>) => callback(database),
    );
  });

  it("creates a stable in-app reminder from a user-selected appointment offset", async () => {
    const response = await post({
      ...validPayload(),
      appointmentStart: "2026-12-15T09:30",
      appointmentEnd: "2026-12-15T10:15",
      reminderDaysBefore: 2,
    });

    expect(response.status).toBe(201);
    expect(mocks.reminderCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        profileId: ids.profile,
        plannedActionId: ids.action,
        channel: "in_app",
        remindAt: new Date("2026-12-13T17:30:00.000Z"),
        dedupeKey: `planned-action:${ids.action}:appointment:2026-12-15T17:30:00.000Z:days-before:2`,
      }),
    });
  });

  it("does not create an appointment reminder when in-app reminders are disabled", async () => {
    mocks.preferenceFindUnique.mockResolvedValue({ inAppEnabled: false });

    const response = await post({
      ...validPayload(),
      appointmentStart: "2026-07-21T09:30",
      appointmentEnd: "2026-07-21T10:15",
      reminderDaysBefore: 2,
    });

    expect(response.status).toBe(400);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("converts local wall times with the profile timezone and ignores a client timezone", async () => {
    const response = await post({
      ...validPayload(),
      appointmentStart: "2026-07-21T09:30",
      appointmentEnd: "2026-07-21T10:15",
      timezone: "Pacific/Kiritimati",
    });

    expect(response.status).toBe(201);
    expect(mocks.actionCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        appointmentStart: new Date("2026-07-21T16:30:00.000Z"),
        appointmentEnd: new Date("2026-07-21T17:15:00.000Z"),
        timezone: "America/Los_Angeles",
        location: "Clinic",
        notes: "Bring records",
        status: "scheduled",
      }),
    });
  });

  it("rejects a daylight-saving gap before writing", async () => {
    const response = await post({
      ...validPayload(),
      appointmentStart: "2026-03-08T02:30",
      appointmentEnd: "2026-03-08T03:30",
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: expect.stringContaining("does not exist in this timezone"),
    });
    expect(mocks.serviceFindFirst).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("rejects incomplete and decreasing appointment ranges", async () => {
    const incomplete = await post({
      ...validPayload(),
      appointmentStart: "2026-07-21T09:30",
      appointmentEnd: null,
    });
    const decreasing = await post({
      ...validPayload(),
      appointmentStart: "2026-07-21T10:30",
      appointmentEnd: "2026-07-21T09:30",
    });

    expect(incomplete.status).toBe(400);
    expect(decreasing.status).toBe(400);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});

function validPayload() {
  return {
    recommendationInstanceId: null,
    serviceId: ids.service,
    title: "Annual checkup",
    plannedMonth: "2026-07-01",
    appointmentStart: null,
    appointmentEnd: null,
    location: " Clinic ",
    notes: " Bring records ",
  };
}

function post(body: Record<string, unknown>) {
  return POST(
    new Request(`http://localhost/api/profiles/${ids.profile}/planned-actions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ profileId: ids.profile }) },
  );
}
