import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { HistoryAssertions } from "./history-assertions";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("HistoryAssertions", () => {
  it("shows a saved unsure answer and resets only that service", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, count: 1 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const onResetComplete = vi.fn();
    const user = userEvent.setup();

    render(
      <HistoryAssertions
        profileId="profile-1"
        assertions={[
          {
            serviceId: "10000000-0000-4000-8000-000000000001",
            service: "Colorectal screening",
            state: "unsure",
            reason: null,
            recordedAt: "2026-07-20T12:00:00.000Z",
          },
        ]}
        onResetComplete={onResetComplete}
      />,
    );

    expect(screen.getByText(/Not sure · The plan keeps this service/i)).toBeVisible();
    await user.click(
      screen.getByRole("button", {
        name: "Reset Colorectal screening answer and ask again",
      }),
    );

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/profiles/profile-1/backfill?serviceId=10000000-0000-4000-8000-000000000001",
        { method: "DELETE" },
      ),
    );
    expect(onResetComplete).toHaveBeenCalledWith("10000000-0000-4000-8000-000000000001");
    expect(screen.queryByText("Colorectal screening")).not.toBeInTheDocument();
  });
});
