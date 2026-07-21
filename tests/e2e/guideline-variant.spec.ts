import { expect, test, type Page } from "@playwright/test";
import { BLAIR_PROFILE_ID, signInAsDemo } from "./support/fixtures";

const conflictGroup = "breast-screening-guideline";
const baselineVariant = "uspstf_2024";

async function openBreastScreeningDetail(page: Page): Promise<void> {
  await page.goto(
    `/app/profile/${BLAIR_PROFILE_ID}/care-plan?query=${encodeURIComponent("Breast cancer screening")}`,
  );
  const card = page.locator("[data-card]").filter({
    has: page.getByRole("heading", { name: "Breast cancer screening", exact: true }),
  });
  await card.getByRole("link", { name: /Details/ }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Breast cancer screening" }),
  ).toBeVisible();
}

test("a mammography guideline can be compared, changed, and reset to baseline", async ({
  page,
}) => {
  await signInAsDemo(page);
  const origin = new URL(page.url()).origin;
  const endpoint = `${origin}/api/profiles/${BLAIR_PROFILE_ID}/guideline-selections/${conflictGroup}`;

  const baselineSetup = await page.request.put(endpoint, {
    headers: { Origin: origin },
    data: { variantId: baselineVariant },
  });
  expect(baselineSetup.ok()).toBe(true);

  try {
    await openBreastScreeningDetail(page);
    const variants = page.getByRole("region", { name: "Guideline variants" });
    const baselineCard = variants.locator("[data-card]").filter({ hasText: "Federal baseline" });
    const alternativeCard = variants
      .locator("[data-card]")
      .filter({ hasText: "American Cancer Society" });

    await expect(baselineCard).toContainText("Selected for this profile");
    await expect(alternativeCard).not.toContainText("Selected for this profile");
    await expect(baselineCard).toContainText("every two years");
    await expect(alternativeCard).toContainText("may transition to mammography every two years");

    const group = page.getByRole("radiogroup", { name: "Guideline variant" });
    await group.getByRole("radio", { name: /American Cancer Society/ }).click();
    await expect(page.getByText(/Previewing American Cancer Society/i)).toBeVisible();

    const changeResponse = page.waitForResponse(
      (response) =>
        response.request().method() === "PUT" &&
        new URL(response.url()).pathname.endsWith(conflictGroup),
    );
    await page.getByRole("button", { name: "Confirm variant" }).click();
    expect((await changeResponse).ok()).toBe(true);
    await expect(page.getByText("Guideline variant updated")).toBeVisible();
    await expect(page.getByLabel("Before recommendation")).toContainText(
      "U.S. Preventive Services Task Force",
    );
    await expect(page.getByLabel("After recommendation")).toContainText("American Cancer Society");
    await expect(page.getByLabel("Recommendation changes")).toContainText("source variant");
    const changedRecommendation = page.getByRole("link", {
      name: "Open recalculated recommendation",
    });
    const changedHref = await changedRecommendation.getAttribute("href");
    if (changedHref === null) throw new Error("The changed recommendation link was unavailable.");
    await changedRecommendation.click();
    await expect(page).toHaveURL(new URL(changedHref, origin).href);

    const changedVariants = page.getByRole("region", { name: "Guideline variants" });
    await expect(
      changedVariants.locator("[data-card]").filter({ hasText: "American Cancer Society" }),
    ).toContainText("Selected for this profile");
    await expect(page.getByRole("button", { name: "Reset to baseline" })).toBeVisible();

    const resetResponse = page.waitForResponse(
      (response) =>
        response.request().method() === "DELETE" &&
        new URL(response.url()).pathname.endsWith(conflictGroup),
    );
    await page.getByRole("button", { name: "Reset to baseline" }).click();
    expect((await resetResponse).ok()).toBe(true);
    await expect(page.getByText("Federal baseline restored")).toBeVisible();
    await expect(page.getByLabel("Before recommendation")).toContainText("American Cancer Society");
    await expect(page.getByLabel("After recommendation")).toContainText(
      "U.S. Preventive Services Task Force",
    );
    const resetRecommendation = page.getByRole("link", {
      name: "Open recalculated recommendation",
    });
    const resetHref = await resetRecommendation.getAttribute("href");
    if (resetHref === null) throw new Error("The reset recommendation link was unavailable.");
    await resetRecommendation.click();
    await expect(page).toHaveURL(new URL(resetHref, origin).href);

    const resetVariants = page.getByRole("region", { name: "Guideline variants" });
    await expect(
      resetVariants.locator("[data-card]").filter({ hasText: "Federal baseline" }),
    ).toContainText("Selected for this profile");
    await expect(page.getByRole("button", { name: "Reset to baseline" })).toHaveCount(0);
  } finally {
    const reset = await page.request.delete(endpoint, { headers: { Origin: origin } });
    expect(reset.ok()).toBe(true);
  }
});
