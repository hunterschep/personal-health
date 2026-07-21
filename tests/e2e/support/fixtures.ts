import { expect, type Page } from "@playwright/test";

export const DEMO_PROFILE_ID = "30000000-0000-4000-8000-000000000001";
export const BLAIR_PROFILE_ID = "30000000-0000-4000-8000-000000000002";
export const PRIVATE_PROFILE_ID = "30000000-0000-4000-8000-000000000004";

export function demoCredentials(): { email: string; password: string } {
  return {
    email: process.env.DEMO_USER_EMAIL ?? "demo@carecadence.local",
    password: process.env.DEMO_USER_PASSWORD ?? "carecadence-demo-only",
  };
}

export async function signInAsDemo(page: Page): Promise<void> {
  const credentials = demoCredentials();
  await page.goto("/sign-in");
  await page.locator('form[action="/api/auth/sign-in"]').evaluate((form, input) => {
    if (!(form instanceof HTMLFormElement)) throw new Error("Sign-in form is unavailable.");
    const email = form.elements.namedItem("email");
    const password = form.elements.namedItem("password");
    if (!(email instanceof HTMLInputElement) || !(password instanceof HTMLInputElement)) {
      throw new Error("Sign-in fields are unavailable.");
    }
    email.value = input.email;
    password.value = input.password;
    form.requestSubmit();
  }, credentials);
  await expect(page).toHaveURL(/\/app(?:\?.*)?$/);
  await expect(page.getByRole("heading", { name: /Welcome back/i })).toBeVisible();
}

export async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    )
    .toBe(true);
}
