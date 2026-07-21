// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const ids = {
  profile: "20000000-0000-4000-8000-000000000001",
  user: "20000000-0000-4000-8000-000000000002",
  household: "20000000-0000-4000-8000-000000000003",
  action: "20000000-0000-4000-8000-000000000004",
};

const existing = {
  id: ids.action,
  profileId: ids.profile,
  plannedMonth: new Date("2026-07-01T00:00:00.000Z"),
  appointmentStart: new Date("2026-07-21T16:30:00.000Z"),
  appointmentEnd: new Date("2026-07-21T17:15:00.000Z"),
  timezone: "America/Los_Angeles",
  location: "Clinic",
  notes: "Bring records",
  status: "scheduled" as const,
};

const mocks = vi.hoisted(() => ({
  assertSameOrigin: vi.fn(),
  requireProfileAccess: vi.fn(),
  transaction: vi.fn(),
  actionFindFirst: vi.fn(),
  actionUpdate: vi.fn(),
  preferenceFindUnique: vi.fn(),
  reminderFindMany: vi.fn(),
  reminderDeleteMany: vi.fn(),
  reminderCreateMany: vi.fn(),
  auditCreate: vi.fn(),
}));

vi.mock("@/server/auth/csrf", () => ({ assertSameOrigin: mocks.assertSameOrigin }));
vi.mock("@/server/authorization/profile", () => ({
  requireProfileAccess: mocks.requireProfileAccess,
}));
vi.mock("@/server/db/client", () => ({
  prisma: {
    reminderPreference: { findUnique: mocks.preferenceFindUnique },
    $transaction: mocks.transaction,
  },
}));

import { PATCH } from "./route";

describe("PATCH /api/profiles/:profileId/planned-actions/:actionId", () => {
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
    mocks.actionFindFirst.mockResolvedValue(existing);
    mocks.actionUpdate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      ...existing,
      ...data,
    }));
    mocks.auditCreate.mockResolvedValue({ id: "audit" });
    mocks.preferenceFindUnique.mockResolvedValue(null);
    mocks.reminderFindMany.mockResolvedValue([]);
    mocks.reminderDeleteMany.mockResolvedValue({ count: 0 });
    mocks.reminderCreateMany.mockResolvedValue({ count: 0 });
    const database = {
      plannedAction: {
        findFirst: mocks.actionFindFirst,
        update: mocks.actionUpdate,
      },
      reminder: {
        findMany: mocks.reminderFindMany,
        deleteMany: mocks.reminderDeleteMany,
        createMany: mocks.reminderCreateMany,
      },
      auditLog: { create: mocks.auditCreate },
    };
    mocks.transaction.mockImplementation(
      async (callback: (client: typeof database) => Promise<unknown>) => callback(database),
    );
  });

  it("preserves every omitted property", async () => {
    const response = await patch({ notes: " Updated notes " });

    expect(response.status).toBe(200);
    expect(mocks.actionUpdate).toHaveBeenCalledWith({
      where: { id: ids.action },
      data: { notes: "Updated notes" },
    });
  });

  it("converts supplied appointment fields in the profile timezone", async () => {
    const response = await patch({
      appointmentStart: "2026-11-01T09:30",
      appointmentEnd: "2026-11-01T10:15",
      timezone: "UTC",
    });

    expect(response.status).toBe(200);
    expect(mocks.actionUpdate).toHaveBeenCalledWith({
      where: { id: ids.action },
      data: {
        appointmentStart: new Date("2026-11-01T17:30:00.000Z"),
        appointmentEnd: new Date("2026-11-01T18:15:00.000Z"),
        timezone: "America/Los_Angeles",
        status: "scheduled",
      },
    });
  });

  it("moves an existing user-selected reminder offset with a rescheduled appointment", async () => {
    mocks.reminderFindMany.mockResolvedValue([
      {
        dedupeKey: `planned-action:${ids.action}:appointment:2026-07-21T16:30:00.000Z:days-before:7`,
      },
    ]);

    const response = await patch({
      appointmentStart: "2026-11-01T09:30",
      appointmentEnd: "2026-11-01T10:15",
    });

    expect(response.status).toBe(200);
    expect(mocks.reminderDeleteMany).toHaveBeenCalledOnce();
    expect(mocks.reminderCreateMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          plannedActionId: ids.action,
          remindAt: new Date("2026-10-25T16:30:00.000Z"),
          dedupeKey: `planned-action:${ids.action}:appointment:2026-11-01T17:30:00.000Z:days-before:7`,
        }),
      ],
      skipDuplicates: true,
    });
  });

  it("removes an appointment reminder when the user clears the offset", async () => {
    mocks.reminderFindMany.mockResolvedValue([
      {
        dedupeKey: `planned-action:${ids.action}:appointment:2026-07-21T16:30:00.000Z:days-before:7`,
      },
    ]);

    const response = await patch({ reminderDaysBefore: null });

    expect(response.status).toBe(200);
    expect(mocks.reminderDeleteMany).toHaveBeenCalledOnce();
    expect(mocks.reminderCreateMany).not.toHaveBeenCalled();
  });

  it("merges partial appointment updates before validating the range", async () => {
    const response = await patch({ appointmentStart: "2026-07-21T11:00" });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: "Appointment end must be after its start.",
    });
    expect(mocks.actionUpdate).not.toHaveBeenCalled();
  });

  it("rejects a daylight-saving gap without starting a transaction", async () => {
    const response = await patch({
      appointmentStart: "2026-03-08T02:30",
      appointmentEnd: "2026-03-08T03:30",
    });

    expect(response.status).toBe(400);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});

function patch(body: Record<string, unknown>) {
  return PATCH(
    new Request(`http://localhost/api/profiles/${ids.profile}/planned-actions/${ids.action}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ profileId: ids.profile, actionId: ids.action }) },
  );
}
