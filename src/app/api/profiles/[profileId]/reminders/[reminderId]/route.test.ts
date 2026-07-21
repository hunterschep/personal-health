// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireProfileAccess: vi.fn(),
  findFirst: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/config/env", () => ({
  getServerEnv: () => ({ REMINDER_OVERDUE_SNOOZE_MAX_DAYS: 14 }),
}));
vi.mock("@/server/auth/csrf", () => ({ assertSameOrigin: vi.fn() }));
vi.mock("@/server/authorization/profile", () => ({
  requireProfileAccess: mocks.requireProfileAccess,
}));
vi.mock("@/server/db/client", () => ({
  prisma: { reminder: { findFirst: mocks.findFirst, update: mocks.update } },
}));

import { PATCH } from "./route";

const profileId = "10000000-0000-4000-8000-000000000001";
const reminderId = "10000000-0000-4000-8000-000000000002";
const originalDue = new Date("2026-07-20T16:00:00.000Z");

function request(body: unknown): Request {
  return new Request(`http://localhost/api/profiles/${profileId}/reminders/${reminderId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("reminder snooze lifecycle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-21T16:00:00.000Z"));
    vi.clearAllMocks();
    mocks.requireProfileAccess.mockResolvedValue({ profile: { id: profileId } });
    mocks.update.mockResolvedValue({ id: reminderId });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("stores original timing and restores it when a snooze is cancelled", async () => {
    const snoozedUntil = new Date("2026-07-28T16:00:00.000Z");
    mocks.findFirst
      .mockResolvedValueOnce({
        id: reminderId,
        status: "pending",
        remindAt: originalDue,
        snoozedFrom: null,
        snoozedUntil: null,
        recommendation: { status: "overdue" },
      })
      .mockResolvedValueOnce({
        id: reminderId,
        status: "pending",
        remindAt: snoozedUntil,
        snoozedFrom: originalDue,
        snoozedUntil,
        recommendation: { status: "overdue" },
      });

    const snoozeResponse = await PATCH(
      request({ action: "snooze", snoozeUntil: snoozedUntil.toISOString() }),
      { params: Promise.resolve({ profileId, reminderId }) },
    );
    const cancelResponse = await PATCH(request({ action: "cancel_snooze" }), {
      params: Promise.resolve({ profileId, reminderId }),
    });

    expect(snoozeResponse.status).toBe(200);
    expect(cancelResponse.status).toBe(200);
    expect(mocks.update).toHaveBeenNthCalledWith(1, {
      where: { id: reminderId },
      data: expect.objectContaining({
        status: "pending",
        remindAt: snoozedUntil,
        snoozedFrom: originalDue,
        snoozedUntil,
      }),
    });
    expect(mocks.update).toHaveBeenNthCalledWith(2, {
      where: { id: reminderId },
      data: expect.objectContaining({
        status: "pending",
        remindAt: originalDue,
        snoozedFrom: null,
        snoozedUntil: null,
      }),
    });
  });

  it("enforces the configured overdue maximum", async () => {
    mocks.findFirst.mockResolvedValue({
      id: reminderId,
      status: "pending",
      remindAt: originalDue,
      snoozedFrom: null,
      snoozedUntil: null,
      recommendation: { status: "overdue" },
    });

    const response = await PATCH(
      request({ action: "snooze", snoozeUntil: "2026-08-05T16:00:00.000Z" }),
      { params: Promise.resolve({ profileId, reminderId }) },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: expect.stringContaining("14 days") });
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
