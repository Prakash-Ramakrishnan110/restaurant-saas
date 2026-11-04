import { test } from "@playwright/test";
import path from "path";

const screenshotsDir = path.resolve("../docs/screenshots");

test.describe("Capture ServeMyFood Visual Artifact Screenshots", () => {
  test("capture desktop screens (login, change-password, dashboard, dev routes)", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    // 1. Desktop Login (Split Layout)
    await page.goto("/login");
    await page.waitForLoadState("networkidle");
    await page.screenshot({
      path: path.join(screenshotsDir, "01-login-desktop.png"),
      fullPage: true,
    });

    // 2. Change Password Page
    await page.goto("/change-password");
    await page.waitForLoadState("networkidle");
    await page.screenshot({
      path: path.join(screenshotsDir, "03-change-password.png"),
      fullPage: true,
    });

    // 3. Desktop Dashboard with Live Table Grid (Simulated Auth state in localStorage)
    await page.addInitScript(() => {
      window.localStorage.setItem("servemyfood_tenant_id", "t-alpha-001");
    });
    // Fill demo credentials and sign in to get live dashboard view
    await page.goto("/login");
    await page.getByPlaceholder("name@restaurant.com").fill("owner@alphadine.com");
    await page.getByPlaceholder("••••••••").fill("Password123!");
    // Note: if backend is running, submit; otherwise visit /dashboard directly
    try {
      await page.getByRole("button", { name: "Sign In", exact: true }).click();
      await page.waitForURL("**/dashboard", { timeout: 3000 });
    } catch {
      await page.goto("/dashboard");
    }
    await page.waitForLoadState("networkidle");
    await page.screenshot({
      path: path.join(screenshotsDir, "04-dashboard-desktop.png"),
      fullPage: true,
    });

    // 4. Dark Mode & Touch Mode Dashboard
    await page.goto("/dashboard");
    // Enable dark mode & touch mode via buttons
    const darkBtn = page.locator("button[title*='Toggle Light/Dark Theme']");
    if (await darkBtn.isVisible()) {
      await darkBtn.click();
    }
    const touchBtn = page.locator("button[title*='Toggle Touch Mode']");
    if (await touchBtn.isVisible()) {
      await touchBtn.click();
    }
    await page.waitForTimeout(300);
    await page.screenshot({
      path: path.join(screenshotsDir, "06-dashboard-dark-touch.png"),
      fullPage: true,
    });

    // Reset theme to light
    if (await darkBtn.isVisible()) {
      await darkBtn.click();
    }

    // 5. /dev/brand Showcase
    await page.goto("/dev/brand");
    await page.waitForLoadState("networkidle");
    await page.screenshot({
      path: path.join(screenshotsDir, "07-dev-brand.png"),
      fullPage: true,
    });

    // 6. /dev/design-system Showcase
    await page.goto("/dev/design-system");
    await page.waitForLoadState("networkidle");
    await page.screenshot({
      path: path.join(screenshotsDir, "08-dev-design-system.png"),
      fullPage: true,
    });
  });

  test("capture mobile screens (login, dashboard)", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 }); // iPhone / Pixel viewport

    // Mobile Login
    await page.goto("/login");
    await page.waitForLoadState("networkidle");
    await page.screenshot({
      path: path.join(screenshotsDir, "02-login-mobile.png"),
      fullPage: true,
    });

    // Mobile Dashboard
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    await page.screenshot({
      path: path.join(screenshotsDir, "05-dashboard-mobile.png"),
      fullPage: true,
    });
  });
});
