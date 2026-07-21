import { expect, test } from "@playwright/test";
import { DEMO_PROFILE_ID, PRIVATE_PROFILE_ID, signInAsDemo } from "./support/fixtures";

test.beforeEach(async ({ page }) => {
  await signInAsDemo(page);
});

test("the household dashboard omits an owner-only adult profile", async ({ page }) => {
  await page.goto("/app/family");

  await expect(page.getByRole("heading", { name: "Profiles you can view" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Alex Example" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Blair Example" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Casey Example" })).toBeVisible();
  await expect(page.getByText("Drew Example", { exact: true })).toHaveCount(0);
  await expect(page.getByText("3 visible", { exact: true })).toBeVisible();
});

test("a household owner receives the same neutral denial for private and unknown profiles", async ({
  page,
}) => {
  for (const profileId of [PRIVATE_PROFILE_ID, "ffffffff-ffff-4fff-8fff-ffffffffffff"]) {
    await page.goto(`/app/profile/${profileId}/care-plan`);
    await expect(page.getByRole("heading", { name: "This page is not available" })).toBeVisible();
    await expect(page.getByText(/no longer be shared with this account/i)).toBeVisible();
    await expect(page.getByText("Drew Example", { exact: true })).toHaveCount(0);
  }
});

test("an accessible owner profile remains available after the denial checks", async ({ page }) => {
  await page.goto(`/app/profile/${DEMO_PROFILE_ID}/care-plan`);
  await expect(page.getByRole("heading", { name: /Alex Example's care plan/i })).toBeVisible();
});
