import { expect, test } from "@playwright/test";
import { expectNoAxeViolations } from "./support/accessibility";
import { DEMO_PROFILE_ID, signInAsDemo } from "./support/fixtures";

test.beforeEach(async ({ page }) => {
  await signInAsDemo(page);
});

test("an exact care record can be added and found in longitudinal history", async ({ page }) => {
  const provider = `E2E Clinic ${Date.now()}-${test.info().retry}`;
  await page.goto(`/app/profile/${DEMO_PROFILE_ID}/records/new`);
  await expect(page.getByRole("heading", { name: "Add a care record" })).toBeVisible();
  await expectNoAxeViolations(page, "New care record form");

  await page.getByLabel("Service").selectOption("blood-pressure-screening");
  await page.getByLabel("Method").selectOption("clinical-measurement");
  await page.getByLabel("How precise is the date?").selectOption("day");
  await page.getByLabel("Date", { exact: true }).fill("2026-01-15");
  await page.getByLabel("Result category").selectOption("normal");
  await page.getByLabel("Provider (optional)").fill(provider);
  await page.getByLabel("Where this information came from").selectOption("medical_record");
  await page.getByRole("button", { name: "Save record and recalculate" }).click();

  await expect(page).toHaveURL(`/app/profile/${DEMO_PROFILE_ID}/records`);
  await page.getByRole("textbox", { name: "Search history" }).fill(provider);
  await page.getByRole("textbox", { name: "Search history" }).press("Enter");
  await expect(page.getByText("1 record", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Clinical blood pressure measurement" }),
  ).toBeVisible();
  await expect(page.getByText("Jan 15, 2026", { exact: true })).toBeVisible();
});

test("year-only history stays visibly approximate", async ({ page }) => {
  const provider = `E2E Approximate ${Date.now()}-${test.info().retry}`;
  await page.goto(`/app/profile/${DEMO_PROFILE_ID}/records/new`);
  await page.getByLabel("Service").selectOption("tdap-td-vaccine");
  await page.getByLabel("How precise is the date?").selectOption("year");
  await page.getByLabel("Year", { exact: true }).fill("2021");
  await page.getByLabel("Provider (optional)").fill(provider);
  await page.getByRole("button", { name: "Save record and recalculate" }).click();

  await page.getByRole("textbox", { name: "Search history" }).fill(provider);
  await page.getByRole("textbox", { name: "Search history" }).press("Enter");
  await expect(page.getByText("Year only", { exact: true })).toBeVisible();
  await expect(page.getByText("2021", { exact: true })).toBeVisible();
});
