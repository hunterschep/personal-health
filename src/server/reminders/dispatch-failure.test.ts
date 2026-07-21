import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  transaction: vi.fn(),
  updateMany: vi.fn(),
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

const reminderId = "10000000-0000-4000-8000-000000000001";

describe("email reminder dispatch failures", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findMany.mockResolvedValue([{ id: reminderId }]);
    mocks.updateMany.mockResolvedValue({ count: 1 });
    const database = {
      $queryRaw: vi.fn(async () => [{ locked: true }]),
      reminder: {
        findFirst: vi.fn(async () => ({
          id: reminderId,
          profileId: "10000000-0000-4000-8000-000000000002",
          dedupeKey: "recommendation:test",
          profile: {
            deletedAt: null,
            owner: {
              id: "10000000-0000-4000-8000-000000000003",
              email: "owner@example.test",
              deletedAt: null,
            },
            reminderPreferences: [
              {
                userId: "10000000-0000-4000-8000-000000000003",
                emailEnabled: true,
                digestMode: "individual",
              },
            ],
          },
          recommendation: {
            recommendationClass: "routine",
            status: "due_now",
            service: { shortName: "Care item" },
            activeOverride: null,
          },
          plannedAction: null,
        })),
        findMany: vi.fn(),
        updateMany: mocks.updateMany,
      },
    };
    mocks.transaction.mockImplementation(
      async (callback: (client: typeof database) => Promise<unknown>) => callback(database),
    );
  });

  it("reports only the failed ID and leaves the pending row untouched", async () => {
    const mailer: ReminderMailer = {
      verify: vi.fn(async () => undefined),
      send: vi.fn(async () => {
        throw new Error("synthetic SMTP failure containing private infrastructure detail");
      }),
    };

    const result = await dispatchDueReminders({
      mailer,
      baseUrl: "https://care.example.test",
    });

    expect(result).toMatchObject({ failedIds: [reminderId], sentIds: [], unavailable: false });
    expect(mocks.updateMany).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain("synthetic SMTP failure");
  });

  it("returns an unavailable result when live SMTP verification fails", async () => {
    const mailer: ReminderMailer = {
      verify: vi.fn(async () => {
        throw new Error("synthetic credential detail");
      }),
      send: vi.fn(),
    };

    const result = await dispatchDueReminders({
      mailer,
      baseUrl: "https://care.example.test",
    });

    expect(result).toMatchObject({
      scanned: 1,
      failedIds: [reminderId],
      sentIds: [],
      unavailable: true,
    });
    expect(mailer.send).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain("credential detail");
  });
});
