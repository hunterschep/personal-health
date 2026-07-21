import { readFile } from "node:fs/promises";

import { expect, test, type Page } from "@playwright/test";

import { signInAsDemo } from "./support/fixtures";

const CASEY_PROFILE_ID = "30000000-0000-4000-8000-000000000003";
const CSV_HEADER = "service,method,date,date_precision,result,provider,location,source,notes";

test.describe.configure({ mode: "serial" });

function csvFile(name: string, rows: readonly string[]) {
  return {
    name,
    mimeType: "text/csv",
    buffer: Buffer.from([CSV_HEADER, ...rows].join("\r\n"), "utf8"),
  };
}

async function removeImportedEvents(page: Page, marker: string): Promise<void> {
  const statuses = await page.evaluate(
    async ({ profileId, note }) => {
      const listResponse = await fetch(`/api/profiles/${profileId}/care-events`);
      if (!listResponse.ok) return [listResponse.status];
      const events = (await listResponse.json()) as Array<{ id: string; notes: string | null }>;
      const matching = events.filter((event) => event.notes === note);
      return Promise.all(
        matching.map(async (event) => {
          const response = await fetch(`/api/profiles/${profileId}/care-events/${event.id}`, {
            method: "DELETE",
          });
          return response.status;
        }),
      );
    },
    { profileId: CASEY_PROFILE_ID, note: marker },
  );
  expect(statuses.every((status) => status === 200 || status === 404)).toBe(true);
}

test("CSV import recovers from an invalid row, accepts a duplicate warning, and recalculates", async ({
  page,
}) => {
  const suffix = `${Date.now()}-${test.info().retry}`;
  const provider = `CSV Journey Clinic ${suffix}`;
  const marker = `CSV journey ${suffix}`;

  await signInAsDemo(page);
  try {
    await page.goto(`/app/profile/${CASEY_PROFILE_ID}/care-plan?query=Colorectal`);
    await expect(page.getByText("Past the recommended window", { exact: true })).toBeVisible();

    await page.goto(`/app/profile/${CASEY_PROFILE_ID}/records/import`);
    await expect(page.getByRole("heading", { name: "Import care history" })).toBeVisible();

    const templateDownload = page.waitForEvent("download");
    await page.getByRole("link", { name: "Template" }).click();
    const template = await templateDownload;
    expect(template.suggestedFilename()).toBe("carecadence-care-events-template.csv");
    const templatePath = await template.path();
    if (templatePath === null) throw new Error("The CSV template download had no local path.");
    const templateText = await readFile(templatePath, "utf8");
    expect(templateText.split(/\r?\n/, 1)[0]).toBe(CSV_HEADER);
    expect(templateText).toContain("colorectal-screening,fit");

    const fileInput = page.getByLabel("CSV file");
    await fileInput.setInputFiles(
      csvFile(`invalid-import-${suffix}.csv`, [
        `colorectal-cancer-screening,colonoscopy,2024-04-10,day,normal,${provider},E2E Center,csv_import,${marker}`,
        `not-a-real-service,,2024-01-15,day,normal,${provider},E2E Center,csv_import,${marker}`,
      ]),
    );
    await page.getByRole("button", { name: "Preview import" }).click();
    await expect(page.getByRole("heading", { name: "2. Review every row" })).toBeVisible();
    await expect(page.getByText("1 valid", { exact: true })).toBeVisible();
    await expect(page.getByText("0 warnings", { exact: true })).toBeVisible();
    await expect(page.getByText("1 errors", { exact: true })).toBeVisible();
    await expect(
      page.getByText("Service was not recognized. Use a catalog slug or exact display name."),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Import selected rows" })).toBeDisabled();

    await fileInput.setInputFiles(
      csvFile(`resolved-import-${suffix}.csv`, [
        `colorectal-cancer-screening,colonoscopy,2024-04-10,day,normal,${provider},E2E Center,csv_import,${marker}`,
        `influenza-vaccine,dose-record,2025-10-12,day,normal,Demo Care Team,Synthetic Clinic,csv_import,${marker}`,
      ]),
    );
    await page.getByRole("button", { name: "Preview import" }).click();
    await expect(page.getByText("1 valid", { exact: true })).toBeVisible();
    await expect(page.getByText("1 warnings", { exact: true })).toBeVisible();
    await expect(page.getByText("0 errors", { exact: true })).toBeVisible();
    await expect(
      page.getByText("A similar care event already exists for this profile."),
    ).toBeVisible();

    await page.getByLabel("Include warning row 3").check();
    await page.getByRole("button", { name: "Import selected rows" }).click();
    await expect(page).toHaveURL(`/app/profile/${CASEY_PROFILE_ID}/records?imported=true`);
    const search = page.getByRole("textbox", { name: "Search history" });
    await search.fill(provider);
    await search.press("Enter");
    await expect(page.getByText("1 record", { exact: true })).toBeVisible();
    await expect(page.getByText(/Colorectal cancer screening · CSV import/i)).toBeVisible();

    await page.goto(`/app/profile/${CASEY_PROFILE_ID}/care-plan?query=Colorectal`);
    await expect(
      page.getByRole("heading", { name: "Colorectal cancer screening" }).first(),
    ).toBeVisible();
    await expect(page.getByText("Coming later", { exact: true })).toBeVisible();
    await expect(page.getByText("Past the recommended window", { exact: true })).toHaveCount(0);
  } finally {
    await removeImportedEvents(page, marker);
  }
});
