import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { signInAsDemo } from "./support/fixtures";

async function deleteProfile(
  owner: Page,
  origin: string,
  profileId: string,
  profileName: string,
): Promise<void> {
  const response = await owner.request.post(`${origin}/api/profiles/${profileId}/delete`, {
    headers: { Accept: "application/json", Origin: origin },
    form: { confirmation: profileName },
  });
  expect(response.ok()).toBe(true);
}

async function deleteAccount(owner: Page, origin: string, password: string): Promise<void> {
  const response = await owner.request.post(`${origin}/api/account/delete`, {
    headers: { Accept: "application/json", Origin: origin },
    form: { password, confirmation: "DELETE MY ACCOUNT" },
  });
  const body = await response.text();
  expect(response.ok(), `Account cleanup failed with ${response.status()}: ${body}`).toBe(true);
}

test("claiming an adult profile resets access until the owner grants and revokes view-only sharing", async ({
  browser,
  page,
}) => {
  const suffix = `${Date.now()}-${test.info().retry}`;
  const profileName = `Claim Privacy ${suffix}`;
  const ownerName = `Claim Owner ${suffix}`;
  const ownerEmail = `claim-owner-${suffix}@example.test`;
  const ownerPassword = "correct-horse-battery-staple";
  let profileId: string | undefined;
  let ownerContext: BrowserContext | undefined;
  let ownerPage: Page | undefined;
  let ownerRegistered = false;
  let claimed = false;

  await signInAsDemo(page);
  const origin = new URL(page.url()).origin;

  try {
    const profileResponse = await page.request.post(`${origin}/api/profiles/onboarding`, {
      headers: { Origin: origin },
      data: {
        status: "complete",
        step: 5,
        data: {
          displayName: profileName,
          relationshipLabel: "Adult family member",
          dateOfBirth: "1986-05-20",
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
      },
    });
    expect(profileResponse.status()).toBe(201);
    const profileResult = (await profileResponse.json()) as { profileId?: string };
    profileId = profileResult.profileId;
    if (profileId === undefined) throw new Error("The unclaimed profile was not created.");

    await page.goto(`/app/profile/${profileId}/care-plan`);
    await expect(
      page.getByRole("heading", { level: 1, name: `${profileName}'s care plan` }),
    ).toBeVisible();

    await page.goto("/app/family/invites");
    await page.getByLabel("Unclaimed profile").selectOption(profileId);
    await page.getByLabel("Recipient email").fill(ownerEmail);
    await page.getByRole("button", { name: "Create claim invitation" }).click();
    const linkNotice = page
      .getByRole("status")
      .filter({ hasText: "One-time invitation link created" });
    const inviteUrl = (await linkNotice.locator("p.break-all").textContent())?.trim();
    if (inviteUrl === undefined || !inviteUrl.includes("/invite/profile/")) {
      throw new Error("The one-time profile claim link was not displayed.");
    }

    ownerContext = await browser.newContext();
    ownerPage = await ownerContext.newPage();
    await ownerPage.goto(inviteUrl);
    await expect(
      ownerPage.getByRole("heading", { name: "Claim your private adult profile" }),
    ).toBeVisible();
    await ownerPage.getByRole("button", { name: "Create account" }).click();
    await expect(ownerPage).toHaveURL(`${origin}/register`, { timeout: 20_000 });
    await expect(ownerPage.getByRole("heading", { name: "Create your private space" })).toBeVisible(
      { timeout: 20_000 },
    );

    await ownerPage.getByLabel("Name").fill(ownerName);
    await ownerPage.getByLabel("Email").fill(ownerEmail);
    await ownerPage.getByLabel("Password", { exact: true }).fill(ownerPassword);
    await ownerPage.getByLabel("Confirm password").fill(ownerPassword);
    await ownerPage.getByRole("checkbox", { name: /does not replace medical advice/i }).check();
    await ownerPage.getByRole("button", { name: "Create account" }).click();

    await expect(
      ownerPage.getByRole("heading", { name: "Claim your private adult profile" }),
    ).toBeVisible();
    ownerRegistered = true;
    await expect(ownerPage.getByText(profileName, { exact: true })).toBeVisible();
    await ownerPage.getByRole("button", { name: "Claim this profile" }).click();
    claimed = true;
    await expect(ownerPage).toHaveURL(new RegExp(`/app/profile/${profileId}/care-plan$`));
    await expect(
      ownerPage.getByRole("heading", { level: 1, name: `${profileName}'s care plan` }),
    ).toBeVisible();

    await page.goto(`/app/profile/${profileId}/care-plan`);
    await expect(page.getByRole("heading", { name: "This page is not available" })).toBeVisible();
    await expect(page.getByText(profileName, { exact: true })).toHaveCount(0);

    await ownerPage.goto(`${origin}/app/profile/${profileId}/sharing`);
    await ownerPage.getByRole("button", { name: /Selected members/ }).click();
    const organizerAccess = ownerPage.getByRole("checkbox", { name: /Demo Organizer/ });
    await organizerAccess.check();
    await ownerPage.getByLabel("Demo Organizer permission").selectOption("view");
    const grantResponse = ownerPage.waitForResponse(
      (response) =>
        response.request().method() === "PUT" &&
        new URL(response.url()).pathname === `/api/profiles/${profileId}/sharing`,
    );
    await ownerPage.getByRole("button", { name: "Save sharing settings" }).click();
    expect((await grantResponse).ok()).toBe(true);

    await page.goto(`/app/profile/${profileId}/care-plan`);
    await expect(
      page.getByRole("heading", { level: 1, name: `${profileName}'s care plan` }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Plan", exact: true })).toHaveCount(0);
    await page.goto(`/app/profile/${profileId}/records/new`);
    await expect(page.getByRole("heading", { name: "This page is not available" })).toBeVisible();

    await organizerAccess.uncheck();
    const revokeResponse = ownerPage.waitForResponse(
      (response) =>
        response.request().method() === "PUT" &&
        new URL(response.url()).pathname === `/api/profiles/${profileId}/sharing`,
    );
    await ownerPage.getByRole("button", { name: "Save sharing settings" }).click();
    expect((await revokeResponse).ok()).toBe(true);

    await page.goto(`/app/profile/${profileId}/care-plan`);
    await expect(page.getByRole("heading", { name: "This page is not available" })).toBeVisible();
    await expect(page.getByText(profileName, { exact: true })).toHaveCount(0);
  } finally {
    if (profileId !== undefined) {
      if (claimed && ownerPage !== undefined) {
        await deleteProfile(ownerPage, origin, profileId, profileName);
      } else {
        await deleteProfile(page, origin, profileId, profileName);
      }
    }
    if (ownerRegistered && ownerPage !== undefined) {
      await deleteAccount(ownerPage, origin, ownerPassword);
    }
    await ownerContext?.close();
  }
});
