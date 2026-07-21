import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ReminderPreferences } from "./reminder-preferences";

const response = {
  editable: false,
  smtpAvailable: false,
  smtpStatus: "disabled",
  emailOwnerControlled: true,
  canManageEmail: false,
  preferences: {
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
  },
};

describe("ReminderPreferences", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders profile reminder settings read-only without a save action", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(async () => Response.json(response)),
    );

    render(<ReminderPreferences />);

    expect(await screen.findByText("View-only access")).toBeVisible();
    expect(screen.getByRole("switch", { name: "In-app reminders" })).toBeDisabled();
    expect(screen.getByLabelText("Timezone")).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Save preferences" })).not.toBeInTheDocument();
  });

  it("surfaces SMTP startup verification failure without disabling in-app reminders", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(async () => Response.json({ ...response, smtpStatus: "unavailable" })),
    );

    render(<ReminderPreferences />);

    expect(await screen.findByText(/startup verification failed/i)).toBeVisible();
    expect(screen.getByRole("switch", { name: "In-app reminders" })).toBeChecked();
  });
});
