import { readFile } from "node:fs/promises";

import { expect, test, type Page } from "@playwright/test";
import JSZip from "jszip";

import { signInAsDemo } from "./support/fixtures";

test.describe.configure({ mode: "serial" });

type CreatedProfile = { profileId: string; handoffUrl: string };

async function createDisposableProfile(page: Page, displayName: string): Promise<CreatedProfile> {
  const result = await page.evaluate(async (name) => {
    const response = await fetch("/api/profiles/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "complete",
        step: 5,
        data: {
          displayName: name,
          relationshipLabel: "Other adult",
          dateOfBirth: "1990-05-20",
          sexAssignedAtBirth: "unknown",
          genderIdentity: "",
          countryCode: "US",
          timezone: "America/Los_Angeles",
          visibility: "household",
          ownership: "unclaimed",
          anatomy_cervix: "unknown",
          anatomy_breast_tissue: "unknown",
          anatomy_prostate: "unknown",
          anatomy_uterus: "unknown",
          anatomy_ovaries: "unknown",
          tobaccoStatus: "unknown",
          immunocompromised: "unknown",
        },
      }),
    });
    return {
      status: response.status,
      body: (await response.json()) as { profileId?: string; handoffUrl?: string; error?: string },
    };
  }, displayName);

  expect(result.status, result.body.error).toBe(201);
  if (result.body.profileId === undefined || result.body.handoffUrl === undefined) {
    throw new Error("Profile setup did not return its identifier and handoff URL.");
  }
  return { profileId: result.body.profileId, handoffUrl: result.body.handoffUrl };
}

async function deleteDisposableProfile(
  page: Page,
  profileId: string,
  displayName: string,
): Promise<void> {
  const status = await page.evaluate(
    async ({ id, name }) => {
      const form = new FormData();
      form.set("confirmation", name);
      const response = await fetch(`/api/profiles/${id}/delete`, {
        method: "POST",
        headers: { Accept: "application/json" },
        body: form,
      });
      return response.status;
    },
    { id: profileId, name: displayName },
  );
  expect([200, 404]).toContain(status);
}

test("a disposable profile can be exported, inspected, deleted, and denied without ending the session", async ({
  page,
}) => {
  const displayName = `Data Rights E2E ${Date.now()}-${test.info().retry}`;
  let profile: CreatedProfile | null = null;
  let deleted = false;

  await signInAsDemo(page);
  try {
    profile = await createDisposableProfile(page, displayName);
    await page.goto("/app/family");
    await expect(page.getByRole("heading", { name: displayName })).toBeVisible();

    const profileForm = page.locator(
      `form[action="/api/account/active-profile"]:has(input[value="${profile.profileId}"])`,
    );
    await profileForm.getByRole("button", { name: "Open profile" }).click();
    await expect(page).toHaveURL(`/app/profile/${profile.profileId}/care-plan`);

    await page.goto("/app/settings/data");
    await expect(page.getByRole("heading", { name: "Export and deletion" })).toBeVisible();
    const exportDownload = page.waitForEvent("download");
    await page.getByRole("link", { name: `Export ${displayName}` }).click();
    const download = await exportDownload;
    expect(download.suggestedFilename()).toBe("carecadence-profile-export.zip");
    const archivePath = await download.path();
    if (archivePath === null) throw new Error("The profile export had no local path.");

    const archive = await JSZip.loadAsync(await readFile(archivePath));
    const archiveFiles = Object.keys(archive.files).sort();
    expect(archiveFiles).toEqual(
      [
        "README.txt",
        "care-events.csv",
        "clinician-overrides.csv",
        "medications.csv",
        "planned-actions.csv",
        "profile.json",
        "sources.csv",
      ].sort(),
    );
    const profileManifestText = await archive.file("profile.json")?.async("string");
    if (profileManifestText === undefined) throw new Error("The export omitted profile.json.");
    const profileManifest = JSON.parse(profileManifestText) as {
      schemaVersion: string;
      generatedAt: string;
      profile: { id: string; displayName: string };
    };
    expect(profileManifest).toMatchObject({
      schemaVersion: "1.0",
      profile: { id: profile.profileId, displayName },
    });
    expect(Number.isNaN(Date.parse(profileManifest.generatedAt))).toBe(false);
    await expect(archive.file("README.txt")?.async("string")).resolves.toContain(
      "This archive contains private health information.",
    );
    await expect(archive.file("care-events.csv")?.async("string")).resolves.toContain(
      "date_precision",
    );

    await page.getByLabel(`Type ${displayName} to confirm`).fill(displayName);
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Delete profile" }).click();
    await expect(page).toHaveURL(/\/app\/family\?profileDeleted=1/);
    deleted = true;
    await expect(page.getByRole("heading", { name: "Demo Family" })).toBeVisible();
    await expect(page.getByRole("heading", { name: displayName })).toHaveCount(0);

    await page.goto(`/app/profile/${profile.profileId}/care-plan`);
    await expect(page.getByRole("heading", { name: "This page is not available" })).toBeVisible();
    await expect(page.getByText(displayName, { exact: true })).toHaveCount(0);

    await page.goto("/app/family");
    await expect(page.getByRole("heading", { name: "Demo Family" })).toBeVisible();
    await expect(page).not.toHaveURL(/\/sign-in/);
  } finally {
    if (profile !== null && !deleted) {
      await deleteDisposableProfile(page, profile.profileId, displayName);
    }
  }
});
