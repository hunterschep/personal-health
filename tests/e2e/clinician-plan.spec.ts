import { expect, test, type Locator, type Page } from "@playwright/test";
import { DEMO_PROFILE_ID, signInAsDemo } from "./support/fixtures";

function definitionValue(card: Locator, label: string): Locator {
  return card.locator("dt").filter({ hasText: label }).locator("..").locator("dd");
}

async function openBloodPressureDetail(page: Page): Promise<void> {
  await page.goto(
    `/app/profile/${DEMO_PROFILE_ID}/care-plan?query=${encodeURIComponent("Blood pressure screening")}`,
  );
  const card = page
    .locator("[data-card]")
    .filter({
      has: page.getByRole("heading", { name: "Blood pressure screening", exact: true }),
    })
    .last();
  await card.getByRole("link", { name: /Details/ }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Blood pressure screening" }),
  ).toBeVisible();
}

async function clearBloodPressureOverrides(page: Page, origin: string): Promise<void> {
  const response = await page.request.get(
    `${origin}/api/profiles/${DEMO_PROFILE_ID}/clinician-overrides`,
  );
  if (!response.ok()) return;
  const overrides = (await response.json()) as Array<{
    id: string;
    service?: { slug?: string };
  }>;
  for (const override of overrides) {
    if (override.service?.slug !== "blood-pressure-screening") continue;
    await page.request.delete(
      `${origin}/api/profiles/${DEMO_PROFILE_ID}/clinician-overrides/${override.id}`,
      { headers: { Origin: origin } },
    );
  }
}

test("an exact clinician date takes precedence while baseline context remains visible", async ({
  page,
}) => {
  await signInAsDemo(page);
  const origin = new URL(page.url()).origin;
  let overrideId: string | undefined;

  try {
    await clearBloodPressureOverrides(page, origin);
    await openBloodPressureDetail(page);
    const organizerPanel = page.getByText("Organizer timing", { exact: true }).locator("..");
    const baselineOrganizer = (await organizerPanel.locator("p").nth(1).textContent())?.trim();
    if (baselineOrganizer === undefined || baselineOrganizer === "") {
      throw new Error("The baseline organizer timing was not rendered.");
    }
    const timingCard = page.locator("[data-card]").filter({
      has: page.getByRole("heading", { name: "Timing and uncertainty" }),
    });
    const baselineGuideline = (
      await definitionValue(timingCard, "General guideline").textContent()
    )?.trim();
    if (baselineGuideline === undefined || baselineGuideline === "") {
      throw new Error("The general guideline timing was not rendered.");
    }

    await page.getByRole("link", { name: "Add clinician instruction" }).click();
    await page.getByLabel("Next due date").fill("2026-12-17");
    await page.getByLabel("Date the instruction was received").fill("2026-07-21");
    await page.getByLabel("Clinician (optional)").fill("Dr. E2E Rivera");
    await page
      .getByLabel("Instruction or reason (optional)")
      .fill("Use the exact follow-up date supplied during the test visit.");
    await page.getByLabel("Replace active timing").check();
    await page.getByRole("button", { name: /Preview change/ }).click();
    await expect(
      page.getByText("control the primary timing while baseline guidance stays visible", {
        exact: false,
      }),
    ).toBeVisible();

    const createResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).pathname === `/api/profiles/${DEMO_PROFILE_ID}/clinician-overrides`,
    );
    await page.getByRole("button", { name: "Confirm clinician plan" }).click();
    const createResponse = await createResponsePromise;
    expect(createResponse.ok()).toBe(true);

    await expect(
      page.getByRole("heading", { level: 1, name: "Blood pressure screening" }),
    ).toBeVisible();
    const activeOverridesResponse = await page.request.get(
      `${origin}/api/profiles/${DEMO_PROFILE_ID}/clinician-overrides`,
    );
    expect(activeOverridesResponse.ok()).toBe(true);
    const activeOverrides = (await activeOverridesResponse.json()) as Array<{
      id: string;
      clinicianName: string | null;
    }>;
    overrideId = activeOverrides.find(
      ({ clinicianName }) => clinicianName === "Dr. E2E Rivera",
    )?.id;
    expect(overrideId).toBeTruthy();
    await expect(page.getByText("Personal clinician plan", { exact: true }).first()).toBeVisible();
    const overriddenOrganizer = page.getByText("Organizer timing", { exact: true }).locator("..");
    await expect(overriddenOrganizer.locator("p").nth(1)).toHaveText("Dec 17, 2026");

    const overriddenTimingCard = page.locator("[data-card]").filter({
      has: page.getByRole("heading", { name: "Timing and uncertainty" }),
    });
    await expect(definitionValue(overriddenTimingCard, "General guideline")).toHaveText(
      baselineGuideline,
    );
    await expect(definitionValue(overriddenTimingCard, "Personal timing")).toHaveText(
      "Dec 17, 2026",
    );

    page.once("dialog", (dialog) => dialog.accept());
    const endResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === "DELETE" &&
        new URL(response.url()).pathname ===
          `/api/profiles/${DEMO_PROFILE_ID}/clinician-overrides/${overrideId}`,
    );
    await page.getByRole("button", { name: "End instruction" }).click();
    expect((await endResponsePromise).ok()).toBe(true);
    overrideId = undefined;

    await expect(
      page.getByRole("heading", { level: 1, name: "Blood pressure screening" }),
    ).toBeVisible();
    await expect(page.getByText("No personal instruction or plan is active")).toBeVisible();
    const restoredOrganizer = page.getByText("Organizer timing", { exact: true }).locator("..");
    await expect(restoredOrganizer.locator("p").nth(1)).toHaveText(baselineOrganizer);
    const restoredTimingCard = page.locator("[data-card]").filter({
      has: page.getByRole("heading", { name: "Timing and uncertainty" }),
    });
    await expect(definitionValue(restoredTimingCard, "General guideline")).toHaveText(
      baselineGuideline,
    );
  } finally {
    if (overrideId !== undefined) {
      await page.request.delete(
        `${origin}/api/profiles/${DEMO_PROFILE_ID}/clinician-overrides/${overrideId}`,
        { headers: { Origin: origin } },
      );
    }
    await clearBloodPressureOverrides(page, origin);
  }
});
