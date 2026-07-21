import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BulkEntry } from "./bulk-entry";

const catalog = [
  {
    slug: "colorectal-screening",
    name: "Colorectal screening",
    methods: [{ slug: "fit", name: "FIT" }],
  },
];

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("BulkEntry", () => {
  it("saves checked valid rows while preserving edits on errored rows", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            token: "t".repeat(40),
            rows: [
              {
                row: 2,
                status: "valid",
                message: "Ready to import.",
                errors: [],
                warnings: [],
              },
              {
                row: 3,
                status: "error",
                message: "Service was not recognized.",
                errors: ["Service was not recognized."],
                warnings: [],
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true, importedCount: 1 }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<BulkEntry profileId="profile-1" catalog={catalog} />);

    await user.type(screen.getByLabelText("Row 1 service"), "colorectal-screening");
    await user.type(screen.getByLabelText("Row 1 method"), "fit");
    await user.selectOptions(screen.getByLabelText("Row 1 precision"), "year");
    await user.type(screen.getByLabelText("Row 1 date"), "2024");
    await user.click(screen.getByRole("button", { name: "Duplicate row 1" }));
    await user.clear(screen.getByLabelText("Row 2 service"));
    await user.type(screen.getByLabelText("Row 2 service"), "not-a-service");

    await user.click(screen.getByRole("button", { name: "Check rows" }));
    expect(await screen.findByText("Service was not recognized.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Save 1 valid row" })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "Save 1 valid row" }));
    expect(await screen.findByText(/1 record saved/i)).toBeVisible();
    expect(screen.getByLabelText("Row 1 service")).toHaveValue("not-a-service");

    const commitCall = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(commitCall[0]).toBe("/api/profiles/profile-1/import/commit");
    expect(JSON.parse(String(commitCall[1].body))).toMatchObject({ includeRowNumbers: [2] });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Save 0 valid rows" })).toBeDisabled(),
    );
  });

  it("keeps edits made while a server preview is in flight", async () => {
    let resolvePreview: (response: Response) => void = () => undefined;
    const previewResponse = new Promise<Response>((resolve) => {
      resolvePreview = resolve;
    });
    const fetchMock = vi.fn(() => previewResponse);
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<BulkEntry profileId="profile-1" catalog={catalog} />);

    await user.type(screen.getByLabelText("Row 1 service"), "colorectal-screening");
    await user.selectOptions(screen.getByLabelText("Row 1 precision"), "year");
    await user.type(screen.getByLabelText("Row 1 date"), "2024");
    await user.click(screen.getByRole("button", { name: "Check rows" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await user.type(screen.getByLabelText("Row 1 provider"), "Edited while checking");

    resolvePreview(
      new Response(
        JSON.stringify({
          token: "t".repeat(40),
          rows: [
            {
              row: 2,
              status: "valid",
              message: "Ready to import.",
              errors: [],
              warnings: [],
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    await waitFor(() => expect(screen.getByRole("button", { name: "Check rows" })).toBeEnabled());
    expect(screen.getByLabelText("Row 1 provider")).toHaveValue("Edited while checking");
    expect(screen.getByText("Not checked yet")).toBeVisible();
    expect(screen.getByRole("button", { name: "Save 0 valid rows" })).toBeDisabled();
  });
});
