import { expect, test } from "@playwright/test";
import { expectNoAxeViolations } from "./support/accessibility";
import { expectNoHorizontalOverflow, signInAsDemo } from "./support/fixtures";

test("mobile navigation has contained focus and works at 390 and 320 pixels", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signInAsDemo(page);

  const mobileNavigation = page.getByRole("navigation", { name: "Mobile navigation" });
  await expect(mobileNavigation).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Main navigation" })).toBeHidden();
  for (const label of ["Overview", "Care Plan", "Timeline", "Records", "More"]) {
    await expect(mobileNavigation.getByText(label, { exact: true })).toBeVisible();
  }
  await expectNoHorizontalOverflow(page);

  const moreButton = mobileNavigation.getByRole("button", { name: "More" });
  await moreButton.tap();
  const dialog = page.getByRole("dialog", { name: "More navigation" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("link", { name: "Calendar" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(moreButton).toBeFocused();

  await page.setViewportSize({ width: 320, height: 720 });
  await expect(page.getByRole("heading", { name: /Welcome back/i })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await expectNoAxeViolations(page, "320-pixel mobile overview");
});
