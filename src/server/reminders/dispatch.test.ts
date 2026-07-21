import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ status: "pending" as "pending" | "sent", lockHeld: false }));
const findMany = vi.hoisted(() => vi.fn());
const transaction = vi.hoisted(() => vi.fn());

vi.mock("@/server/db/client", () => ({
  prisma: {
    reminder: { findMany },
    $transaction: transaction,
  },
}));

vi.mock("./links", () => ({
  signReminderLink: vi.fn(async () => "signed-token"),
}));

import type { ReminderMailer } from "./email";
import { dispatchDueReminders } from "./dispatch";

describe("email reminder dispatch", () => {
  it("uses a database lock so concurrent dispatchers send once", async () => {
    state.status = "pending";
    state.lockHeld = false;
    findMany.mockImplementation(async () =>
      state.status === "pending" ? [{ id: "10000000-0000-4000-8000-000000000001" }] : [],
    );
    transaction.mockImplementation(
      async (
        callback: (client: {
          $queryRaw: () => Promise<{ locked: boolean }[]>;
          reminder: {
            findFirst: () => Promise<unknown>;
            updateMany: () => Promise<{ count: number }>;
          };
        }) => Promise<unknown>,
      ) => {
        let acquired = false;
        const database = {
          $queryRaw: async () => {
            if (state.lockHeld) return [{ locked: false }];
            state.lockHeld = true;
            acquired = true;
            return [{ locked: true }];
          },
          reminder: {
            findFirst: async () =>
              state.status === "pending"
                ? {
                    id: "10000000-0000-4000-8000-000000000001",
                    profile: {
                      deletedAt: null,
                      owner: {
                        id: "10000000-0000-4000-8000-000000000002",
                        email: "owner@example.test",
                        deletedAt: null,
                      },
                      reminderPreferences: [
                        {
                          userId: "10000000-0000-4000-8000-000000000002",
                          emailEnabled: true,
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
                  }
                : null,
            updateMany: async () => {
              if (state.status !== "pending") return { count: 0 };
              state.status = "sent";
              return { count: 1 };
            },
          },
        };
        try {
          return await callback(database);
        } finally {
          if (acquired) state.lockHeld = false;
        }
      },
    );
    const send = vi.fn(async () => {
      await Promise.resolve();
    });
    const mailer: ReminderMailer = { verify: vi.fn(async () => undefined), send };

    const [first, second] = await Promise.all([
      dispatchDueReminders({ mailer, baseUrl: "https://care.example.test" }),
      dispatchDueReminders({ mailer, baseUrl: "https://care.example.test" }),
    ]);

    expect([...first.failedIds, ...second.failedIds]).toEqual([]);
    expect(send).toHaveBeenCalledTimes(1);
    expect(first.sentIds.length + second.sentIds.length).toBe(1);
    expect(first.skippedIds.length + second.skippedIds.length).toBe(1);
    await expect(
      dispatchDueReminders({ mailer, baseUrl: "https://care.example.test" }),
    ).resolves.toMatchObject({ scanned: 0, sentIds: [] });
  });
});
