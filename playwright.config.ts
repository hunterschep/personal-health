import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  // Logic and authorization regressions must fail immediately. Infrastructure
  // retries belong in the runner/orchestrator, not around stateful journeys.
  retries: 0,
  // Browser journeys share the seeded synthetic household and intentionally
  // mutate its plan. Serial workers keep those stateful flows deterministic.
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  expect: { timeout: 20_000 },
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    actionTimeout: 30_000,
    navigationTimeout: 30_000,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    timezoneId: "America/Los_Angeles",
  },
  webServer: {
    command: process.env.CI ? "node .next/standalone/server.js" : "pnpm dev",
    url: "http://127.0.0.1:3000/api/health?mode=readiness",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium",
      testIgnore: /mobile\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chromium",
      testMatch: /mobile\.spec\.ts/,
      use: { ...devices["Pixel 5"], browserName: "chromium" },
    },
    ...(process.env.PLAYWRIGHT_WEBKIT_SMOKE === "true"
      ? [
          {
            name: "webkit-smoke",
            testMatch: /public-auth\.spec\.ts/,
            use: { ...devices["Desktop Safari"] },
          },
        ]
      : []),
    ...(process.env.PLAYWRIGHT_FIREFOX_SMOKE === "true"
      ? [
          {
            name: "firefox-smoke",
            testMatch: /public-auth\.spec\.ts/,
            use: { ...devices["Desktop Firefox"] },
          },
        ]
      : []),
  ],
});
