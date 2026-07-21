import { expect, test, type Page } from "@playwright/test";

import { signInAsDemo } from "./support/fixtures";

const CASEY_PROFILE_ID = "30000000-0000-4000-8000-000000000003";

test.describe.configure({ mode: "serial" });

async function removeCareEvent(page: Page, eventId: string): Promise<void> {
  const status = await page.evaluate(
    async ({ profileId, id }) => {
      const response = await fetch(`/api/profiles/${profileId}/care-events/${id}`, {
        method: "DELETE",
      });
      return response.status;
    },
    { profileId: CASEY_PROFILE_ID, id: eventId },
  );
  expect([200, 404]).toContain(status);
}

test("a year-only event asks for confirmation and an exact-date edit resolves it", async ({
  page,
}) => {
  const marker = `Approximate history E2E ${Date.now()}-${test.info().retry}`;
  let eventId: string | null = null;

  await signInAsDemo(page);
  try {
    await page.goto(`/app/profile/${CASEY_PROFILE_ID}/records/new`);
    await page.getByLabel("Service").selectOption("tdap-td-vaccine");
    await page.getByLabel("Method").selectOption("tdap");
    await page.getByLabel("How precise is the date?").selectOption("year");
    await page.getByLabel("Year", { exact: true }).fill("2016");
    await page.getByLabel("Provider (optional)").fill(marker);
    await page.getByRole("button", { name: "Save record and recalculate" }).click();

    await expect(page).toHaveURL(`/app/profile/${CASEY_PROFILE_ID}/records`);
    const search = page.getByRole("textbox", { name: "Search history" });
    await search.fill(marker);
    await search.press("Enter");
    await expect(page.getByText("1 record", { exact: true })).toBeVisible();
    await expect(page.getByText("Year only", { exact: true })).toBeVisible();

    const recordLink = page.getByRole("link", { name: "View record" });
    const recordHref = await recordLink.getAttribute("href");
    if (recordHref === null) throw new Error("The year-only record did not expose a detail link.");
    eventId = new URL(recordHref, page.url()).pathname.split("/").at(-1) ?? null;
    if (eventId === null) throw new Error("The year-only record URL did not contain an event ID.");

    await page.goto(`/app/profile/${CASEY_PROFILE_ID}/care-plan?query=Tdap`);
    await expect(page.getByRole("heading", { name: "Tdap or Td vaccine" })).toBeVisible();
    await expect(page.getByText("Date needs confirmation", { exact: true })).toBeVisible();

    await page.goto(recordHref);
    await page.getByRole("button", { name: "Edit record" }).click();
    const dialog = page.getByRole("dialog", { name: "Edit care record" });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("How precise is the date?").selectOption("day");
    await dialog.getByLabel("Date", { exact: true }).fill("2016-12-31");
    const updateResponse = page.waitForResponse(
      (response) =>
        response.url().endsWith(`/api/profiles/${CASEY_PROFILE_ID}/care-events/${eventId}`) &&
        response.request().method() === "PATCH",
    );
    await dialog.getByRole("button", { name: "Save and recalculate" }).click();
    expect((await updateResponse).ok()).toBe(true);
    await expect(dialog).toBeHidden();

    await page.goto(`/app/profile/${CASEY_PROFILE_ID}/care-plan?query=Tdap`);
    const recommendationCard = page
      .getByRole("heading", { name: "Tdap or Td vaccine" })
      .locator("xpath=ancestor::div[contains(@class, 'grid')][1]");
    await expect(recommendationCard).toBeVisible();
    await expect(
      recommendationCard.getByText("Recommended this year", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("Date needs confirmation", { exact: true })).toHaveCount(0);
  } finally {
    if (eventId !== null) await removeCareEvent(page, eventId);
  }
});
