import { defineConfig, devices } from "@playwright/test";

// Port dédié (évite tout conflit avec un `npm run dev` lancé à la main sur 3000).
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3100";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["html", { open: "never" }], ["list"]] : "list",
  use: { baseURL, trace: "on-first-retry" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // .next séparé (NEXT_DIST_DIR) → n'interfère jamais avec un dev manuel sur 3000.
    command: "npm run dev -- --port 3100",
    url: `${baseURL}/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: { NEXT_DIST_DIR: ".next-e2e" },
  },
});
