import { expect, test } from "@playwright/test";
import { expectNoAxeViolations } from "./support/accessibility";

test("the development gallery renders every required fixture without console errors", async ({
  page,
}) => {
  test.skip(
    Boolean(process.env.CI),
    "The component gallery is intentionally disabled in production.",
  );
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));

  const response = await page.goto("/dev/components");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1, name: "Component gallery" })).toBeVisible();
  await expect(page.getByText("Coming later", { exact: true })).toBeVisible();
  await expect(page.getByText("Follow personal clinician plan", { exact: true })).toBeVisible();
  await expect(page.getByText("Not stated", { exact: true })).toHaveCount(2);
  await expect(page.getByRole("heading", { name: "Guidelines differ" })).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "You’re offline" })).toBeVisible();
  await expect(page.getByRole("group", { name: "When did this happen?" })).toBeVisible();
  await expect(page.locator(".dark").getByText("The same calm hierarchy")).toBeVisible();

  const wrappingCard = page.getByTestId("mobile-wrapping-card");
  expect(await wrappingCard.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
    true,
  );

  const dialogTrigger = page.getByRole("button", { name: "Open modal dialog" });
  await dialogTrigger.click();
  const dialog = page.getByRole("dialog", { name: "Review this plan detail" });
  await expect(dialog).toBeVisible();
  for (let index = 0; index < 4; index += 1) {
    await page.keyboard.press("Tab");
    expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(dialogTrigger).toBeFocused();

  await expectNoAxeViolations(page, "Component gallery");
  expect(consoleErrors).toEqual([]);
});
