import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CsvImport } from "./csv-import";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("CsvImport", () => {
  it("requires an explicit selection before committing a warning row", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            token: "t".repeat(40),
            rows: [
              {
                row: 2,
                service: "influenza-vaccine",
                date: "2025-10-12",
                status: "warning",
                message: "A similar care event already exists for this profile.",
                errors: [],
                warnings: ["A similar care event already exists for this profile."],
                possibleDuplicateIds: ["event-1"],
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "Stopped for test." }), {
          status: 422,
          headers: { "Content-Type": "application/json" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<CsvImport profileId="profile-1" />);

    await user.upload(
      screen.getByLabelText("CSV file"),
      new File(
        ["service,method,date,date_precision,result,provider,location,source,notes"],
        "history.csv",
        {
          type: "text/csv",
        },
      ),
    );
    await user.click(screen.getByRole("button", { name: "Preview import" }));

    const commit = await screen.findByRole("button", { name: "Import selected rows" });
    expect(commit).toBeDisabled();
    await user.click(screen.getByLabelText("Include warning row 2"));
    expect(commit).toBeEnabled();
    await user.click(commit);

    const commitCall = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(JSON.parse(String(commitCall[1].body))).toEqual({
      token: "t".repeat(40),
      includeWarningRowNumbers: [2],
    });
  });
});
