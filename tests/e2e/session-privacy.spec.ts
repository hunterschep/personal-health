import { expect, test } from "@playwright/test";
import { BLAIR_PROFILE_ID, DEMO_PROFILE_ID, signInAsDemo } from "./support/fixtures";

test.beforeEach(async ({ page }) => {
  await signInAsDemo(page);
});

test("switching profiles updates the current route and persists after reload", async ({ page }) => {
  await page.goto(`/app/profile/${DEMO_PROFILE_ID}/care-plan`);
  await expect(page.getByRole("heading", { name: /Alex Example's care plan/i })).toBeVisible();

  const profileSwitcher = page.locator("header select");
  await profileSwitcher.selectOption(BLAIR_PROFILE_ID);

  await expect(page).toHaveURL(`/app/profile/${BLAIR_PROFILE_ID}/care-plan`);
  await expect(page.getByRole("heading", { name: /Blair Example's care plan/i })).toBeVisible();
  await expect(profileSwitcher).toHaveValue(BLAIR_PROFILE_ID);

  await page.reload();
  await expect(page.locator("header select")).toHaveValue(BLAIR_PROFILE_ID);
  await expect(page.getByRole("heading", { name: /Blair Example's care plan/i })).toBeVisible();
});

test("signing out protects authenticated pages from direct and back-button access", async ({
  page,
}) => {
  const recordsUrl = `/app/profile/${DEMO_PROFILE_ID}/records`;
  await page.goto(recordsUrl);
  await expect(page.getByRole("heading", { name: /Alex Example's records/i })).toBeVisible();

  await page.getByRole("button", { name: "Open user menu" }).click();
  await page
    .getByRole("navigation", { name: "User menu" })
    .getByRole("link", { name: "Security" })
    .click();
  await expect(page.getByRole("heading", { name: "Security", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Sign out this device" }).click();

  await expect(page).toHaveURL(/\/sign-in$/);
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(/\/sign-in\?reason=session-required$/);
  await expect(page.getByRole("heading", { name: "Security", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();

  await page.goto(recordsUrl);
  await expect(page).toHaveURL(/\/sign-in\?reason=session-required$/);
  await expect(page.getByRole("heading", { name: /Alex Example's records/i })).toHaveCount(0);
});
