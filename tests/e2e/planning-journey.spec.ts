import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { DEMO_PROFILE_ID, signInAsDemo } from "./support/fixtures";

test.beforeEach(async ({ page }) => {
  await signInAsDemo(page);
});

test("guided backfill saves a skipped answer without inventing history", async ({ page }) => {
  const origin = new URL(page.url()).origin;
  let skipped = false;

  try {
    await page.goto(`/app/profile/${DEMO_PROFILE_ID}/records/backfill`);
    await expect(page.getByRole("heading", { name: "Fill the highest-impact gaps" })).toBeVisible();

    const firstQuestion = page.getByRole("heading", { name: /^Have you completed/ });
    const firstQuestionText = await firstQuestion.textContent();
    expect(firstQuestionText).not.toBeNull();

    await page.getByLabel("Skip for now").check();
    const saveResponse = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).pathname === `/api/profiles/${DEMO_PROFILE_ID}/backfill`,
    );
    await page.getByRole("button", { name: "Skip" }).click();
    expect((await saveResponse).ok()).toBe(true);
    skipped = true;

    await expect(firstQuestion).not.toHaveText(firstQuestionText ?? "");
  } finally {
    if (skipped) {
      const reset = await page.request.delete(
        `${origin}/api/profiles/${DEMO_PROFILE_ID}/backfill`,
        { headers: { Origin: origin } },
      );
      expect(reset.ok()).toBe(true);
    }
  }
});

test("a recommendation can become an appointment and export a private calendar file", async ({
  page,
}) => {
  const origin = new URL(page.url()).origin;
  let actionId: string | undefined;

  try {
    await page.goto(`/app/profile/${DEMO_PROFILE_ID}/calendar`);
    await expect(page.getByRole("heading", { name: "Alex Example's calendar" })).toBeVisible();

    await page
      .getByRole("button", { name: /^Medical timing:/ })
      .first()
      .click();
    const dialog = page.getByRole("dialog");
    const dialogTitle = await dialog.getByRole("heading").textContent();
    const planTitle = dialogTitle?.replace(/^Plan /, "").trim();
    if (planTitle === undefined || planTitle === "") {
      throw new Error("The selected recommendation did not expose a planning title.");
    }

    await dialog.getByLabel("Planned month").selectOption("11");
    await dialog.getByLabel("Appointment start (optional)").fill("2026-12-15T10:00");
    await dialog.getByLabel("Appointment end (optional)").fill("2026-12-15T10:30");
    await dialog.getByLabel("Location (optional)").fill("E2E Preventive Clinic");

    const saveResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).pathname === `/api/profiles/${DEMO_PROFILE_ID}/planned-actions`,
    );
    await dialog.getByRole("button", { name: "Save plan" }).click();
    const saveResponse = await saveResponsePromise;
    expect(saveResponse.ok()).toBe(true);
    const saveResult = (await saveResponse.json()) as { action?: { id?: string } };
    actionId = saveResult.action?.id;
    expect(actionId).toBeTruthy();
    await expect(dialog).toBeHidden();

    const appointment = page
      .getByRole("button", { name: /^Appointment:/ })
      .filter({ hasText: planTitle })
      .first();
    await expect(appointment).toBeVisible();
    await appointment.click();

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("dialog").getByRole("link", { name: "Calendar file" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("carecadence-planned-action.ics");
    const downloadPath = await download.path();
    if (downloadPath === null) throw new Error("The calendar export had no local download path.");
    const calendar = await readFile(downloadPath, "utf8");
    expect(calendar).toContain("BEGIN:VCALENDAR");
    expect(calendar).toContain("SUMMARY:Health appointment");
    expect(calendar).not.toContain(`SUMMARY:${planTitle}`);
    expect(calendar).toContain("DTSTART:20261215T150000Z");
    expect(calendar).toContain("LOCATION:E2E Preventive Clinic");

    const cancelResponse = page.waitForResponse(
      (response) =>
        response.request().method() === "DELETE" &&
        new URL(response.url()).pathname ===
          `/api/profiles/${DEMO_PROFILE_ID}/planned-actions/${actionId}`,
    );
    await page.getByRole("dialog").getByRole("button", { name: "Cancel plan" }).click();
    expect((await cancelResponse).ok()).toBe(true);
    actionId = undefined;
  } finally {
    if (actionId !== undefined) {
      await page.request.delete(
        `${origin}/api/profiles/${DEMO_PROFILE_ID}/planned-actions/${actionId}`,
        { headers: { Origin: origin } },
      );
    }
  }
});

test("the doctor-visit agenda preserves selected content in print mode", async ({ page }) => {
  await page.addInitScript(() => {
    window.print = () => {
      document.documentElement.dataset.printRequested = "true";
    };
  });
  await page.goto(`/app/profile/${DEMO_PROFILE_ID}/visit-prep`);
  await expect(page.getByRole("heading", { name: "Prepare for a doctor visit" })).toBeVisible();

  const question = `Can we review the E2E care plan ${Date.now()}?`;
  await page.getByPlaceholder("Add a question").fill(question);
  await page.getByRole("button", { name: "Add question" }).click();
  const agenda = page.getByRole("article", { name: "Doctor visit agenda preview" });
  await expect(agenda.getByText(question, { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Print" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-print-requested", "true");

  await page.emulateMedia({ media: "print" });
  await expect(agenda).toBeVisible();
  await expect(agenda.getByText(question, { exact: true })).toBeVisible();
  await expect
    .poll(() =>
      page.locator("aside.no-print").evaluate((element) => getComputedStyle(element).display),
    )
    .toBe("none");
});
