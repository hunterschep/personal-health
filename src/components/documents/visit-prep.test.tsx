import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { VisitPrep, type VisitPrepData } from "./visit-prep";

const data: VisitPrepData = {
  profileName: "Alex",
  age: 46,
  generatedOn: "July 21, 2026",
  appointments: [
    {
      title: "Primary care visit",
      timing: "Tuesday, July 28, 2026 at 9:30 AM PDT until 10:15 AM PDT",
      timezone: "America/Los_Angeles",
      location: "Downtown clinic",
    },
    {
      title: "Follow-up visit",
      timing: "Friday, August 14, 2026 at 2:00 PM PDT",
      timezone: "America/Los_Angeles",
      location: null,
    },
  ],
  medications: ["Atorvastatin · 10 mg · daily"],
  conditions: ["Hypertension"],
  attention: ["Blood pressure: due now."],
  thisYear: ["Influenza vaccine: due this fall."],
  unknown: ["Colorectal screening: history unknown."],
  discussion: ["Prostate cancer screening: discuss with a clinician."],
  clinician: ["Lipid panel: exact next date · Sep 1–30, 2026"],
  recentEvents: [
    "Colorectal cancer screening · Colonoscopy: Inconclusive result recorded · Jun 2026. No interpretation added.",
  ],
  personalNotes: ["Ask about travel timing."],
  sourceLinks: [{ label: "Reviewed guidance", url: "https://example.test/guidance" }],
  suggestedQuestions: ["Which item should we discuss first?", "Should any timing change?"],
};

const originalClipboard = Object.getOwnPropertyDescriptor(navigator, "clipboard");
const originalExecCommand = Object.getOwnPropertyDescriptor(document, "execCommand");

function restoreProperty(
  target: object,
  property: string,
  descriptor: PropertyDescriptor | undefined,
): void {
  if (descriptor === undefined) {
    delete (target as Record<string, unknown>)[property];
  } else {
    Object.defineProperty(target, property, descriptor);
  }
}

describe("VisitPrep", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    restoreProperty(navigator, "clipboard", originalClipboard);
    restoreProperty(document, "execCommand", originalExecCommand);
  });

  it("keeps print and copy available without exposing protected exports", () => {
    render(<VisitPrep profileId="profile-1" data={data} exportable={false} />);

    expect(screen.getByRole("button", { name: "Print" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Copy" })).toBeVisible();
    expect(screen.queryByRole("link", { name: "Calendar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Export" })).not.toBeInTheDocument();
  });

  it("shows profile exports only with export access", () => {
    render(<VisitPrep profileId="profile-1" data={data} exportable />);

    expect(screen.getByRole("link", { name: "Calendar" })).toHaveAttribute(
      "href",
      "/api/profiles/profile-1/calendar.ics",
    );
    expect(screen.getByRole("link", { name: "Export" })).toHaveAttribute(
      "href",
      "/api/profiles/profile-1/export",
    );
  });

  it("defaults to a concise agenda and exposes every item in extended mode", async () => {
    const user = userEvent.setup();
    render(<VisitPrep profileId="profile-1" data={data} exportable={false} />);
    const preview = screen.getByRole("article", { name: "Doctor visit agenda preview" });

    expect(preview).toHaveAttribute("data-mode", "concise");
    expect(within(preview).getByText("Primary care visit")).toBeVisible();
    expect(within(preview).queryByText("Follow-up visit")).not.toBeInTheDocument();
    expect(within(preview).getByRole("heading", { name: "Major conditions" })).toBeVisible();
    expect(
      within(preview).getByRole("heading", {
        name: "Recent abnormal or inconclusive records",
      }),
    ).toBeVisible();

    await user.click(screen.getByLabelText(/^Extended/));

    expect(preview).toHaveAttribute("data-mode", "extended");
    expect(within(preview).getByText("Follow-up visit")).toBeVisible();
  });

  it("lets a user exclude sections and add, remove, and reorder questions", async () => {
    const user = userEvent.setup();
    render(<VisitPrep profileId="profile-1" data={data} exportable={false} />);
    const preview = screen.getByRole("article", { name: "Doctor visit agenda preview" });

    await user.click(screen.getByRole("checkbox", { name: "Major conditions" }));
    expect(
      within(preview).queryByRole("heading", { name: "Major conditions" }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Move Should any timing change? up" }));
    const questionSection = within(preview)
      .getByRole("heading", { name: "Questions to bring" })
      .closest("section");
    if (questionSection === null) throw new Error("Expected the printable question section.");
    expect(
      within(questionSection)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual(["Should any timing change?", "Which item should we discuss first?"]);

    await user.type(screen.getByLabelText("New visit question"), "Should I bring prior records?");
    await user.click(screen.getByRole("button", { name: "Add question" }));
    expect(within(questionSection).getAllByRole("listitem").at(-1)).toHaveTextContent(
      "Should I bring prior records?",
    );

    await user.click(screen.getByRole("button", { name: "Remove Should I bring prior records?" }));
    expect(
      within(questionSection).queryByText("Should I bring prior records?"),
    ).not.toBeInTheDocument();
  });

  it("shows a usable error when both browser copy methods are blocked", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error("Denied")) },
    });
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: vi.fn().mockReturnValue(false),
    });
    render(<VisitPrep profileId="profile-1" data={data} exportable={false} />);

    fireEvent.click(screen.getByRole("button", { name: "Copy" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Copy did not work");
    expect(screen.getByRole("alert")).toHaveTextContent("Select the agenda text manually");
  });
});
