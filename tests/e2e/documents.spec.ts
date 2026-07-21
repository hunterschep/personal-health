import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { DEMO_PROFILE_ID, signInAsDemo } from "./support/fixtures";

test("a private care-record document can be uploaded and downloaded but not opened cross-account", async ({
  browser,
  page,
}) => {
  const suffix = `${Date.now()}-${test.info().retry}`;
  const filename = `synthetic-private-record-${suffix}.pdf`;
  const provider = `Document Test Clinic ${suffix}`;
  const pdfBytes = Buffer.from(
    "%PDF-1.4\n% Synthetic CareCadence browser test document\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n",
  );

  await signInAsDemo(page);
  await page.goto(`/app/profile/${DEMO_PROFILE_ID}/records/new`);
  await page.getByLabel("Service").selectOption("blood-pressure-screening");
  await page.getByLabel("Method").selectOption("clinical-measurement");
  await page.getByLabel("How precise is the date?").selectOption("day");
  await page.getByLabel("Date", { exact: true }).fill("2026-01-16");
  await page.getByLabel("Provider (optional)").fill(provider);
  await page.getByLabel("Where this information came from").selectOption("medical_record");
  await page.getByLabel("Private document (optional)").setInputFiles({
    name: filename,
    mimeType: "application/pdf",
    buffer: pdfBytes,
  });
  await page.getByRole("button", { name: "Save record and recalculate" }).click();

  await expect(page).toHaveURL(`/app/profile/${DEMO_PROFILE_ID}/records`);
  const search = page.getByRole("textbox", { name: "Search history" });
  await search.fill(provider);
  await search.press("Enter");
  await expect(page.getByText("1 record", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "View record" }).click();
  await expect(page.getByText(filename, { exact: true })).toBeVisible();

  const documentUrl = await page.getByRole("link", { name: "Download" }).getAttribute("href");
  expect(documentUrl).not.toBeNull();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe(filename);
  const downloadPath = await download.path();
  if (downloadPath === null) throw new Error("The authorized document download had no local path.");
  await expect(readFile(downloadPath)).resolves.toEqual(pdfBytes);

  const appOrigin = new URL(page.url()).origin;
  const outsiderContext = await browser.newContext();
  try {
    const outsider = await outsiderContext.newPage();
    await outsider.goto(`${appOrigin}/register`);
    await outsider.getByLabel("Name").fill(`Document Privacy Check ${suffix}`);
    await outsider.getByLabel("Email").fill(`document-privacy-${suffix}@example.test`);
    await outsider.getByLabel("Password", { exact: true }).fill("correct-horse-battery-staple");
    await outsider.getByLabel("Confirm password").fill("correct-horse-battery-staple");
    await outsider.getByRole("checkbox", { name: /does not replace medical advice/i }).check();
    await outsider.getByRole("button", { name: "Create account" }).click();
    await expect(outsider).toHaveURL(/\/app\/onboarding$/);

    const denied = await outsider.goto(`${appOrigin}${documentUrl}`);
    expect(denied?.status()).toBe(404);
    if (denied === null) throw new Error("The cross-account request returned no response.");
    const deniedBody = await denied.text();
    expect(deniedBody).toBe(JSON.stringify({ error: "Not found." }));
    expect(deniedBody).not.toContain(filename);
  } finally {
    await outsiderContext.close();
  }
});
