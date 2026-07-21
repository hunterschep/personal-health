import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ReminderCenter } from "./reminder-center";

const reminders = [
  {
    id: "pending-reminder",
    title: "Planning reminder",
    detail: "A care-plan item is ready to review.",
    remindAt: "2026-07-21T16:00:00.000Z",
    channel: "in_app",
    status: "pending",
    snoozedUntil: null,
    section: "today",
  },
  {
    id: "dismissed-reminder",
    title: "Dismissed reminder",
    detail: "A reminder was dismissed.",
    remindAt: "2026-07-20T16:00:00.000Z",
    channel: "in_app",
    status: "dismissed",
    snoozedUntil: null,
    section: "dismissed",
  },
] as const;

describe("ReminderCenter", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps reminders readable without exposing profile mutations", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(async () =>
        Response.json({ editable: false, smtpAvailable: false, smtpStatus: "disabled", reminders }),
      ),
    );

    render(<ReminderCenter />);

    expect(await screen.findByText("View-only access")).toBeVisible();
    expect(screen.getByText("Planning reminder")).toBeVisible();
    expect(screen.getByRole("link", { name: "Reminder settings" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Refresh reminders" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Snooze 7 days" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Dismiss" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("tab", { name: "Dismissed (1)" }));

    expect(screen.getByText("Dismissed reminder")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Restore" })).not.toBeInTheDocument();
  });

  it("shows snoozed reminders separately and can cancel the snooze", async () => {
    const snoozed = {
      id: "snoozed-reminder",
      title: "Snoozed reminder",
      detail: "A care-plan item will return later.",
      remindAt: "2026-07-28T16:00:00.000Z",
      snoozedUntil: "2026-07-28T16:00:00.000Z",
      channel: "in_app",
      status: "pending",
      section: "snoozed",
    };
    const fetchMock = vi.fn<typeof fetch>(async (_input, init) =>
      init?.method === "PATCH"
        ? Response.json({ ok: true })
        : Response.json({
            editable: true,
            smtpAvailable: false,
            smtpStatus: "disabled",
            reminders: [snoozed],
          }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<ReminderCenter />);

    await user.click(await screen.findByRole("tab", { name: "Snoozed (1)" }));
    expect(screen.getByText("Snoozed reminder")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Cancel snooze" }));

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/profiles/active/reminders/snoozed-reminder",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ action: "cancel_snooze" }),
      }),
    );
  });
});
