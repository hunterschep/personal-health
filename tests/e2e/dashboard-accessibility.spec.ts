import { expect, test } from "@playwright/test";
import { expectNoAxeViolations } from "./support/accessibility";
import { DEMO_PROFILE_ID, expectNoHorizontalOverflow, signInAsDemo } from "./support/fixtures";

test.beforeEach(async ({ page }) => {
  await signInAsDemo(page);
});

const criticalPages = [
  { name: "overview", path: "/app", heading: /Welcome back/i },
  {
    name: "care plan",
    path: `/app/profile/${DEMO_PROFILE_ID}/care-plan`,
    heading: /Alex Example's care plan/i,
  },
  {
    name: "guided backfill",
    path: `/app/profile/${DEMO_PROFILE_ID}/records/backfill`,
    heading: /Fill the highest-impact gaps/i,
  },
  {
    name: "calendar",
    path: `/app/profile/${DEMO_PROFILE_ID}/calendar`,
    heading: /Alex Example's calendar/i,
  },
  { name: "family", path: "/app/family", heading: /Demo Family/i },
  {
    name: "family sharing",
    path: `/app/profile/${DEMO_PROFILE_ID}/sharing`,
    heading: /Alex Example's sharing/i,
  },
  {
    name: "visit preparation",
    path: `/app/profile/${DEMO_PROFILE_ID}/visit-prep`,
    heading: /Prepare for a doctor visit/i,
  },
  { name: "sources", path: "/app/sources", heading: /^Sources$/i },
  { name: "settings", path: "/app/settings", heading: /^Settings$/i },
] as const;

for (const criticalPage of criticalPages) {
  test(`${criticalPage.name} passes an axe smoke scan`, async ({ page }) => {
    await page.goto(criticalPage.path);
    await expect(page.getByRole("heading", { level: 1, name: criticalPage.heading })).toBeVisible();
    await expectNoAxeViolations(page, `${criticalPage.name} page`);
  });
}

test("recommendation detail passes an axe smoke scan", async ({ page }) => {
  await page.goto(`/app/profile/${DEMO_PROFILE_ID}/care-plan`);
  const detailLink = page.getByRole("link", { name: "Details" }).first();
  await expect(detailLink).toBeVisible();
  const detailPath = await detailLink.getAttribute("href");
  if (detailPath === null) throw new Error("The recommendation detail link has no destination.");

  await page.goto(detailPath);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expectNoAxeViolations(page, "Recommendation detail page");
});

test("dark mode and reduced-motion preferences remain accessible", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await page.goto("/");
  const animationDuration = await page
    .locator(".animate-rise")
    .first()
    .evaluate((element) => getComputedStyle(element).animationDuration);
  expect(Number.parseFloat(animationDuration)).toBeLessThanOrEqual(0.01);

  await page.goto("/app");
  await expect(page.locator("html")).toHaveClass(/dark/);
  await expectNoAxeViolations(page, "Dark, reduced-motion overview");
});

test("desktop shell navigation is keyboard operable and collapsible", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/app");
  const navigation = page.getByRole("navigation", { name: "Main navigation" });
  const overview = navigation.getByRole("link", { name: "Overview" });
  await overview.focus();
  await page.keyboard.press("Tab");
  await expect(navigation.getByRole("link", { name: "Care Plan" })).toBeFocused();

  const collapse = page.getByRole("button", { name: "Collapse main navigation" });
  await collapse.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Expand main navigation" })).toHaveAttribute(
    "aria-expanded",
    "false",
  );
});

test("overview reflows at required desktop widths and a 200%-zoom equivalent", async ({ page }) => {
  for (const width of [1440, 1024, 640]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/app");
    await expect(page.getByRole("heading", { name: /Welcome back/i })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  }
});
