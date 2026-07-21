import { expect, test } from "@playwright/test";
import { expectNoAxeViolations } from "./support/accessibility";

test("a new adult can register, complete onboarding, and open the generated plan", async ({
  page,
}) => {
  const suffix = `${Date.now()}-${test.info().retry}`;
  const name = `Onboarding Check ${suffix}`;

  await page.goto("/register");
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Email").fill(`onboarding-${suffix}@example.test`);
  await page.getByLabel("Password", { exact: true }).fill("correct-horse-battery-staple");
  await page.getByLabel("Confirm password").fill("correct-horse-battery-staple");
  await page.getByRole("checkbox", { name: /does not replace medical advice/i }).check();
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page).toHaveURL(/\/app\/onboarding$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Build a useful plan in minutes" }),
  ).toBeVisible();
  await expectNoAxeViolations(page, "Onboarding basics step");

  await page.getByLabel("Profile display name").fill(name);
  await page.getByLabel("Date of birth").fill("1988-04-12");
  await page.getByLabel("Sex assigned at birth").selectOption("female");
  await page.getByLabel("Timezone").fill("America/Los_Angeles");
  await page.getByRole("button", { name: /Save and continue/i }).click();

  await expect(page.getByRole("heading", { level: 2, name: "Relevant anatomy" })).toBeVisible();
  for (const organ of ["Cervix", "Breast tissue", "Prostate", "Uterus", "Ovaries"]) {
    await page.getByRole("group", { name: organ }).getByLabel("Unsure").check();
  }
  await page.getByRole("button", { name: /Save and continue/i }).click();

  await expect(page.getByRole("heading", { level: 2, name: "Risk context" })).toBeVisible();
  await page.getByLabel("Tobacco history").selectOption("never");
  await page.getByLabel("Immunocompromised status").selectOption("no");
  await page.getByRole("button", { name: /Save and continue/i }).click();

  await expect(page.getByRole("heading", { level: 2, name: "Health history" })).toBeVisible();
  await page.getByRole("button", { name: /Save and continue/i }).click();
  await expect(page.getByRole("heading", { level: 2, name: "Medications" })).toBeVisible();
  await page.getByRole("button", { name: /Save and continue/i }).click();

  await expect(page.getByRole("heading", { level: 2, name: "Review" })).toBeVisible();
  await expect(page.locator("main").getByText(name, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Generate care plan/i }).click();

  await expect(page).toHaveURL(/\/app\/profile\/[0-9a-f-]+\/plan-ready$/);
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: new RegExp(`${name}'s care plan has a starting point`),
    }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Start guided backfill" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open dashboard" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Add clinician or custom plan" })).toBeVisible();
  await page.getByRole("link", { name: "Review care plan" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: new RegExp(`${name}'s care plan`) }),
  ).toBeVisible();
});
