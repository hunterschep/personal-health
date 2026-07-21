import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { OnboardingWizard } from "./onboarding-wizard";

describe("OnboardingWizard", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("saves a draft at the next step and advances without navigating away", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      void input;
      void init;

      return new Response(JSON.stringify({ ok: true, step: 1 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    render(
      <OnboardingWizard
        initialState={{
          displayName: "Alex",
          relationshipLabel: "Self",
          dateOfBirth: "1980-05-12",
          sexAssignedAtBirth: "female",
          timezone: "America/Los_Angeles",
          visibility: "owner_only",
          ownership: "self",
        }}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /save and continue/i }));

    expect(await screen.findByRole("heading", { name: "Relevant anatomy" })).toBeVisible();
    const request = fetchMock.mock.calls[0]?.[1];
    expect(request).toBeDefined();
    expect(JSON.parse(String(request?.body))).toMatchObject({
      status: "draft",
      step: 0,
      intent: "continue",
    });
  });

  it("previews pack-years and shows only relevant bounded risk questions", () => {
    render(
      <OnboardingWizard
        initialStep={2}
        initialState={{
          dateOfBirth: "1950-05-12",
          anatomy_uterus: "present",
          tobaccoStatus: "former",
          smokingStartYear: "2000",
          smokingEndYear: "2010",
          packsPerDay: "0.5",
        }}
      />,
    );

    expect(screen.getByText("About 5 pack-years")).toBeVisible();
    expect(screen.getByLabelText("Pregnancy status")).toBeVisible();
    expect(screen.getByLabelText("Any fall history or concern?")).toBeVisible();
    expect(screen.getByLabelText("Include an alcohol-use check-in?")).toBeVisible();
    expect(screen.getByLabelText("Consent-based sexual health risk context")).toBeVisible();
  });

  it("includes medication reason and precision-preserving start timing in the draft contract", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      void input;
      void init;
      return new Response(JSON.stringify({ ok: true, step: 5 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    render(
      <OnboardingWizard initialStep={4} initialState={{ medicationName: "Example medicine" }} />,
    );

    await userEvent.type(screen.getByLabelText("Reason (optional)"), "Blood pressure");
    await userEvent.selectOptions(screen.getByLabelText("How precise is the date?"), "month");
    await userEvent.type(screen.getByLabelText("Month and year"), "2024-05");
    await userEvent.click(screen.getByRole("button", { name: /save and continue/i }));

    const request = fetchMock.mock.calls[0]?.[1];
    expect(request).toBeDefined();
    expect(JSON.parse(String(request?.body))).toMatchObject({
      status: "draft",
      step: 4,
      data: {
        medicationReason: "Blood pressure",
        medicationStartedDate: "2024-05",
        medicationStartedPrecision: "month",
      },
    });
  });
});
