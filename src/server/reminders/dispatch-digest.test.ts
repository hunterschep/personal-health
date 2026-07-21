import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  transaction: vi.fn(),
  updateMany: vi.fn(),
  preferenceUpdate: vi.fn(),
}));
const digest = vi.hoisted(() => ({
  mode: "daily" as "daily" | "weekly",
  lastSentAt: null as Date | null,
}));

vi.mock("@/server/db/client", () => ({
  prisma: {
    reminder: { findMany: mocks.findMany },
    $transaction: mocks.transaction,
  },
}));
vi.mock("./links", () => ({ signReminderLink: vi.fn(async () => "signed-token") }));

import type { ReminderMailer } from "./email";
import { dispatchDueReminders } from "./dispatch";

const ids = ["10000000-0000-4000-8000-000000000001", "10000000-0000-4000-8000-000000000002"];

function loadedReminder(id: string, shortName: string) {
  return {
    id,
    profileId: "10000000-0000-4000-8000-000000000003",
    dedupeKey: `recommendation:${id}`,
    remindAt: new Date("2026-07-21T16:00:00.000Z"),
    profile: {
      deletedAt: null,
      owner: {
        id: "10000000-0000-4000-8000-000000000004",
        email: "owner@example.test",
        deletedAt: null,
      },
      reminderPreferences: [
        {
          id: "10000000-0000-4000-8000-000000000005",
          userId: "10000000-0000-4000-8000-000000000004",
          emailEnabled: true,
          digestMode: digest.mode,
          timezone: "America/Los_Angeles",
          lastDigestSentAt: digest.lastSentAt,
        },
      ],
    },
    recommendation: {
      recommendationClass: "routine",
      status: "due_now",
      service: { shortName },
      activeOverride: null,
    },
    plannedAction: null,
  };
}

describe("email reminder digest dispatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    digest.mode = "daily";
    digest.lastSentAt = null;
    mocks.findMany.mockResolvedValue(ids.map((id) => ({ id })));
    mocks.updateMany.mockResolvedValue({ count: 2 });
    mocks.preferenceUpdate.mockResolvedValue({});
    const reminders = () => [
      loadedReminder(ids[0]!, "First care item"),
      loadedReminder(ids[1]!, "Second care item"),
    ];
    const database = {
      $queryRaw: vi.fn(async () => [{ locked: true }]),
      reminder: {
        findFirst: vi.fn(async () => reminders()[0]),
        findMany: vi.fn(async () => reminders()),
        updateMany: mocks.updateMany,
      },
      reminderPreference: { update: mocks.preferenceUpdate },
    };
    mocks.transaction.mockImplementation(
      async (callback: (client: typeof database) => Promise<unknown>) => callback(database),
    );
  });

  it("groups due rows for one profile into one digest and marks every row sent", async () => {
    const send = vi.fn(async () => undefined);
    const mailer: ReminderMailer = { verify: vi.fn(async () => undefined), send };

    const result = await dispatchDueReminders({
      mailer,
      now: new Date("2026-07-21T17:00:00.000Z"),
      baseUrl: "https://care.example.test",
    });

    expect(send).toHaveBeenCalledOnce();
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringMatching(/Daily CareCadence reminder digest:[\s\S]*1\.[\s\S]*2\./),
      }),
    );
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ids }, status: "pending" },
      data: { status: "sent", sentAt: new Date("2026-07-21T17:00:00.000Z") },
    });
    expect(result).toMatchObject({ scanned: 2, sentIds: ids, failedIds: [], skippedIds: [] });
    expect(mocks.preferenceUpdate).toHaveBeenCalledWith({
      where: { id: "10000000-0000-4000-8000-000000000005" },
      data: { lastDigestSentAt: new Date("2026-07-21T17:00:00.000Z") },
    });
  });

  it("sends at most one daily digest per profile-local day", async () => {
    digest.lastSentAt = new Date("2026-07-21T16:00:00.000Z");
    const send = vi.fn(async () => undefined);
    const mailer: ReminderMailer = { verify: vi.fn(async () => undefined), send };

    const result = await dispatchDueReminders({
      mailer,
      now: new Date("2026-07-21T17:00:00.000Z"),
      baseUrl: "https://care.example.test",
    });

    expect(send).not.toHaveBeenCalled();
    expect(mocks.updateMany).not.toHaveBeenCalled();
    expect(result).toMatchObject({ sentIds: [], skippedIds: ids });
  });

  it("holds weekly digests until Monday in the profile timezone", async () => {
    digest.mode = "weekly";
    const send = vi.fn(async () => undefined);
    const mailer: ReminderMailer = { verify: vi.fn(async () => undefined), send };

    const result = await dispatchDueReminders({
      mailer,
      now: new Date("2026-07-21T17:00:00.000Z"),
      baseUrl: "https://care.example.test",
    });

    expect(send).not.toHaveBeenCalled();
    expect(mocks.updateMany).not.toHaveBeenCalled();
    expect(result).toMatchObject({ sentIds: [], skippedIds: ids });
  });

  it("sends one grouped weekly digest on Monday", async () => {
    digest.mode = "weekly";
    const send = vi.fn(async () => undefined);
    const mailer: ReminderMailer = { verify: vi.fn(async () => undefined), send };

    const result = await dispatchDueReminders({
      mailer,
      now: new Date("2026-07-20T17:00:00.000Z"),
      baseUrl: "https://care.example.test",
    });

    expect(send).toHaveBeenCalledOnce();
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining("Weekly CareCadence reminder digest"),
      }),
    );
    expect(result).toMatchObject({ sentIds: ids, skippedIds: [] });
  });
});
