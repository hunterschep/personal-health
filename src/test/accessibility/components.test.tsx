import axe from "axe-core";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { CareEventForm } from "@/components/records/care-event-form";
import { SharingControls } from "@/components/family/sharing-controls";
import { ApproximateDateInput } from "@/components/ui/approximate-date-input";

async function expectComponentToBeAccessible(container: HTMLElement): Promise<void> {
  const results = await axe.run(container, {
    rules: {
      // JSDOM has no layout or canvas implementation, so contrast remains in the
      // full-browser Playwright scans instead of this structural component pass.
      "color-contrast": { enabled: false },
      // These components are rendered without the page landmarks that contain
      // them in production.
      region: { enabled: false },
    },
  });
  const report = results.violations
    .map(
      (violation) =>
        `${violation.id}: ${violation.help}\n${violation.nodes
          .map((node) => `  ${node.target.join(" ")}: ${node.failureSummary ?? "failed"}`)
          .join("\n")}`,
    )
    .join("\n\n");
  expect(results.violations, report).toEqual([]);
}

describe("accessible form components", () => {
  it("keeps approximate date precision explicit and keyboard-operable", async () => {
    const user = userEvent.setup();
    const { container } = render(<ApproximateDateInput />);

    expect(screen.getByRole("group", { name: "When did this happen?" })).toBeVisible();
    const precision = screen.getByRole("combobox", { name: "How precise is the date?" });
    expect(precision).toHaveValue("day");
    expect(screen.getByLabelText("Date", { selector: "input" })).toHaveAttribute("type", "date");

    await user.selectOptions(precision, "year");
    expect(screen.getByRole("spinbutton", { name: "Year" })).toBeRequired();
    await user.selectOptions(precision, "unknown");
    expect(screen.queryByLabelText("Date", { selector: "input" })).not.toBeInTheDocument();
    expect(screen.getByText(/without a guessed date/i)).toBeVisible();

    await expectComponentToBeAccessible(container);
  });

  it("names sharing choices and member permissions", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <SharingControls
        profileId="30000000-0000-4000-8000-000000000001"
        initialVisibility="owner_only"
        initialMembers={[
          {
            id: "10000000-0000-4000-8000-000000000002",
            name: "Household Member",
            email: "member@example.test",
            enabled: false,
            permission: "view",
          },
        ]}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Selected members/i }));
    const member = screen.getByRole("checkbox", { name: /Household Member/i });
    const permission = screen.getByRole("combobox", { name: "Household Member permission" });
    expect(permission).toBeDisabled();
    await user.click(member);
    expect(permission).toBeEnabled();
    await user.selectOptions(permission, "edit");
    expect(permission).toHaveValue("edit");

    await expectComponentToBeAccessible(container);
  });

  it("associates care-record controls with visible labels", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <CareEventForm profileId="30000000-0000-4000-8000-000000000001" />,
    );

    expect(screen.getByRole("combobox", { name: "Service" })).toBeRequired();
    expect(screen.getByRole("combobox", { name: "Method" })).toBeVisible();
    expect(screen.getByLabelText("Private document (optional)")).toHaveAttribute(
      "accept",
      "application/pdf,image/jpeg,image/png",
    );

    await user.selectOptions(screen.getByRole("combobox", { name: "Result category" }), "abnormal");
    expect(screen.getByRole("status")).toHaveTextContent("Routine timing may no longer apply");

    await expectComponentToBeAccessible(container);
  });
});
