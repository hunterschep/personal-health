import { expect, test } from "@playwright/test";
import { expectNoAxeViolations } from "./support/accessibility";

test("the offline shell explains that private health data is not cached", async ({ page }) => {
  const response = await page.goto("/offline.html");
  expect(response?.status()).toBe(200);
  await expect(
    page.getByRole("heading", { level: 1, name: "Your private data stays online-only" }),
  ).toBeVisible();
  await expect(
    page.getByText(/Authenticated health information is deliberately not cached/i),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Try again" })).toHaveAttribute("href", "/");
  await expectNoAxeViolations(page, "Offline shell");
});

test("the service worker cache list contains only static public shell assets", async ({
  request,
}) => {
  const response = await request.get("/sw.js");
  expect(response.ok()).toBe(true);
  const source = await response.text();

  for (const asset of [
    "/offline.html",
    "/icon.svg",
    "/icon-192.png",
    "/icon-512.png",
    "/icon-maskable-512.png",
    "/apple-touch-icon.png",
    "/manifest.webmanifest",
  ]) {
    expect(source).toContain(`"${asset}"`);
  }
  expect(source).toContain('url.pathname.startsWith("/app")');
  expect(source).toContain('url.pathname.startsWith("/api")');
  expect(source).not.toMatch(/cache\.put\(request/);
});

test("the manifest exposes installable raster and maskable icons", async ({ request }) => {
  const response = await request.get("/manifest.webmanifest");
  expect(response.ok()).toBe(true);
  const manifest = (await response.json()) as {
    display: string;
    icons: { src: string; sizes: string; purpose: string }[];
  };
  expect(manifest.display).toBe("standalone");
  expect(manifest.icons).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ src: "/icon-192.png", sizes: "192x192", purpose: "any" }),
      expect.objectContaining({ src: "/icon-512.png", sizes: "512x512", purpose: "any" }),
      expect.objectContaining({
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        purpose: "maskable",
      }),
    ]),
  );
});
