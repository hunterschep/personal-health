import { expect, test } from "@playwright/test";
import { expectNoAxeViolations } from "./support/accessibility";
import { signInAsDemo } from "./support/fixtures";

test.describe("public and authentication surfaces", () => {
  test("landing page exposes the primary journey and a working skip link", async ({
    browserName,
    page,
  }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });

    await expect(
      page.getByRole("heading", { level: 1, name: /Know what comes next/i }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /Build your care plan/i })).toHaveAttribute(
      "href",
      "/register",
    );

    await page.keyboard.press(browserName === "webkit" ? "Alt+Tab" : "Tab");
    const skipLink = page.getByRole("link", { name: "Skip to content" });
    await expect(skipLink).toBeFocused();
    await skipLink.press("Enter");
    await expect(page).toHaveURL(/#main-content$/);

    await expectNoAxeViolations(page, "Public landing page");
  });

  test("registration and sign-in forms have accessible names", async ({ page }) => {
    await page.goto("/register");
    await expect(page.getByLabel("Name")).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute("minlength", "12");
    await expect(page.getByLabel("Confirm password")).toBeVisible();
    await expect(
      page.getByRole("checkbox", { name: /does not replace medical advice/i }),
    ).toBeVisible();
    await expectNoAxeViolations(page, "Registration page");

    await page.goto("/sign-in");
    await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
    await expectNoAxeViolations(page, "Sign-in page");
  });

  test("the seeded demo account can sign in", async ({ page }) => {
    await page.goto("/app");
    await expect(page).toHaveURL(/\/sign-in\?reason=session-required$/);

    await signInAsDemo(page);
    await expect(page.getByRole("combobox", { name: /Active profile/i })).toContainText(
      "Demo Family",
    );
  });
});
