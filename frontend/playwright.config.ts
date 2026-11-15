import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
  projects: [
    {
      name: "chromium",
      testIgnore: [
        /capture-closeout4\.spec\.ts/,
        /capture-closeout5\.spec\.ts/,
        /screenshots\.spec\.ts/,
      ],
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile",
      testIgnore: [
        /capture-closeout4\.spec\.ts/,
        /capture-closeout5\.spec\.ts/,
        /screenshots\.spec\.ts/,
      ],
      use: { ...devices["Pixel 7"] },
    },
    {
      name: "capture",
      testMatch: [
        /capture-closeout4\.spec\.ts/,
        /capture-closeout5\.spec\.ts/,
        /screenshots\.spec\.ts/,
      ],
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
