import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import { MedicationManager } from "./medication-manager";

describe("MedicationManager", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("validates with the form schema and submits explicit normalized class codes", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn<typeof fetch>(async (_input, init) => {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return Response.json({ id: "medication-1", ...body, documents: [] }, { status: 201 });
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<MedicationManager profileId="profile-1" />);

    await user.click(screen.getByRole("button", { name: "Add medication" }));
    await user.click(screen.getByRole("button", { name: "Save medication" }));

    expect(await screen.findByText("Enter a medication name.")).toBeVisible();
    expect(fetchMock).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText("Medication name"), "Reviewed medicine");
    await user.type(
      screen.getByLabelText("Normalized medication class codes (optional)"),
      "Statin, bad code!",
    );
    await user.click(screen.getByRole("button", { name: "Save medication" }));

    expect(await screen.findByText("Use up to 20 comma-separated normalized codes.")).toBeVisible();
    expect(fetchMock).not.toHaveBeenCalled();

    await user.clear(screen.getByLabelText("Normalized medication class codes (optional)"));
    await user.type(
      screen.getByLabelText("Normalized medication class codes (optional)"),
      "Statin, ace_inhibitor",
    );
    await user.type(screen.getByLabelText("Notes (optional)"), "Patient-entered timing note");
    await user.click(screen.getByRole("button", { name: "Save medication" }));

    expect(fetchMock).toHaveBeenCalledOnce();
    const request = fetchMock.mock.calls[0];
    expect(request?.[0]).toBe("/api/profiles/profile-1/medications");
    expect(JSON.parse(String(request?.[1]?.body))).toMatchObject({
      name: "Reviewed medicine",
      notes: "Patient-entered timing note",
      classCodes: ["statin", "ace_inhibitor"],
      startedPrecision: "unknown",
    });
  });
});
