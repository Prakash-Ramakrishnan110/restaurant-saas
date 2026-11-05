import { test, expect } from "@playwright/test";
import path from "path";
import fs from "fs";

const screenshotsDir = path.resolve("../docs/screenshots");

// Helper to log in as seeded owner and navigate to dashboard
async function loginAsSeededOwner(page: any) {
  await page.goto("/login");
  await page.waitForLoadState("networkidle");

  // Fill seeded owner credentials via robust ID locators
  await page.locator("#email-input").fill("owner@spicegarden.com");
  await page.locator("#password-input").fill("Password123!");

  // Submit Sign In form
  await page.locator('button[type="submit"]').click();

  // Wait for navigation to /dashboard
  await page.waitForURL("**/dashboard", { timeout: 15000 });
  await page.waitForLoadState("networkidle");

  // Hard assertion: Login form elements must NOT be visible on the authenticated dashboard
  await expect(page.locator("#email-input")).not.toBeVisible();
  await expect(page.locator('button[type="submit"]')).not.toBeVisible();

  // Assert Dashboard content is rendered
  await expect(page.locator("h1")).toBeVisible();
  await expect(page.getByRole("main").getByText("Spice Garden")).toBeVisible();
  await expect(page.getByText("Manage Tables")).toBeVisible();
}

test.describe("ServeMyFood Visual Artifacts & Screenshots Suite", () => {
  test.beforeAll(async () => {
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }
  });

  test("01-08: capture core desktop and authenticated screens", async ({ page }) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width: 1440, height: 900 });

    // 01. Desktop Login (Split Layout with Plain Language Benefits)
    await page.goto("/login");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("Orders go straight to the kitchen")).toBeVisible();
    await page.screenshot({
      path: path.join(screenshotsDir, "01-login-desktop.png"),
      fullPage: true,
    });

    // 03. Change Password Page (Security Shield in Blue, Zero Orange in Alert/Security)
    await page.goto("/change-password");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("Password Change Required")).toBeVisible();
    await page.screenshot({
      path: path.join(screenshotsDir, "03-change-password.png"),
      fullPage: true,
    });

    // 04. Authenticated Desktop Dashboard (Spice Garden, Stat Cards, Plan Status)
    await loginAsSeededOwner(page);
    await expect(page.getByRole("main").getByText("Spice Garden")).toBeVisible();
    await page.screenshot({
      path: path.join(screenshotsDir, "04-dashboard-desktop.png"),
      fullPage: true,
    });

    // 06. Dark Mode & Touch Mode Dashboard
    await page.evaluate(() => {
      document.documentElement.setAttribute("data-theme", "dark");
      document.documentElement.setAttribute("data-density", "touch");
      document.documentElement.classList.add("dark", "touch-mode");
    });
    await page.waitForTimeout(400);
    // Assert dashboard is still active and login form is NOT visible
    await expect(page.locator("#email-input")).not.toBeVisible();
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.getByRole("main").getByText("Spice Garden")).toBeVisible();
    await page.screenshot({
      path: path.join(screenshotsDir, "06-dashboard-dark-touch.png"),
      fullPage: true,
    });

    // Reset theme & density to light/default
    await page.evaluate(() => {
      document.documentElement.setAttribute("data-theme", "light");
      document.documentElement.setAttribute("data-density", "default");
      document.documentElement.classList.remove("dark", "touch-mode");
    });

    // 07. /dev/brand Showcase (Contrast Ratios Table, WCAG Compliance, Logo Variants)
    await page.goto("/dev/brand");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("ServeMyFood Brand & Token System")).toBeVisible();
    await page.screenshot({
      path: path.join(screenshotsDir, "07-dev-brand.png"),
      fullPage: true,
    });

    // 08. /dev/design-system Showcase (All 25 Components Showcase)
    await page.goto("/dev/design-system");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("ServeMyFood Component Showcase")).toBeVisible();
    await page.screenshot({
      path: path.join(screenshotsDir, "08-dev-design-system.png"),
      fullPage: true,
    });

    // 09. Login Screen in Tamil Language (ta-IN)
    await page.goto("/login");
    await page.waitForLoadState("networkidle");
    // Switch to Tamil
    const langBtn = page.getByRole("button", { name: "தமிழ்" });
    if (await langBtn.isVisible()) {
      await langBtn.click();
      await page.waitForTimeout(300);
    }
    await page.screenshot({
      path: path.join(screenshotsDir, "09-login-tamil.png"),
      fullPage: true,
    });
    // Switch back to English
    const enBtn = page.getByRole("button", { name: "English" });
    if (await enBtn.isVisible()) {
      await enBtn.click();
      await page.waitForTimeout(300);
    }

    // 10. Dashboard Touch Targets Overlay & Density Verification
    await loginAsSeededOwner(page);
    await page.evaluate(() => {
      document.documentElement.setAttribute("data-density", "touch");
      document.documentElement.classList.add("touch-mode");
    });
    await page.waitForTimeout(400);
    await page.screenshot({
      path: path.join(screenshotsDir, "10-dashboard-touch-overlay.png"),
      fullPage: true,
    });

    // 11. Suspended Account Error Screen
    await page.goto("/suspended");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: "Account Suspended" })).toBeVisible();
    await page.screenshot({
      path: path.join(screenshotsDir, "11-error-suspended.png"),
      fullPage: true,
    });

    // 12. 404 Page Not Found Screen
    await page.goto("/non-existent-sample-route");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("404")).toBeVisible();
    await page.screenshot({
      path: path.join(screenshotsDir, "12-error-notfound.png"),
      fullPage: true,
    });
  });

  test("02 & 05: capture mobile screens (login & dashboard)", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 }); // iPhone / Pixel viewport

    // 02. Mobile Login (Stacked Layout)
    await page.goto("/login");
    await page.waitForLoadState("networkidle");
    await page.screenshot({
      path: path.join(screenshotsDir, "02-login-mobile.png"),
      fullPage: true,
    });

    // 05. Authenticated Mobile Dashboard
    await loginAsSeededOwner(page);
    await expect(page.locator("#email-input")).not.toBeVisible();
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.getByRole("main").getByText("Spice Garden")).toBeVisible();
    await page.screenshot({
      path: path.join(screenshotsDir, "05-dashboard-mobile.png"),
      fullPage: true,
    });
  });

  test("TOUCH INVARIANT: Touch mode target heights are >= 56px", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/dev/design-system");
    await page.waitForLoadState("networkidle");

    // Enable touch density mode
    await page.evaluate(() => {
      document.documentElement.setAttribute("data-density", "touch");
      document.documentElement.classList.add("touch-mode");
    });
    await page.waitForTimeout(400);

    // Measure button heights in touch mode
    const buttons = page.locator("button");
    const count = await buttons.count();
    expect(count).toBeGreaterThan(5);

    let measuredButtons = 0;
    for (let i = 0; i < Math.min(count, 15); i++) {
      const btn = buttons.nth(i);
      if (await btn.isVisible()) {
        const box = await btn.boundingBox();
        if (box && box.height > 0) {
          // Touch mode requires >= 56px (allowing minor subpixel float)
          expect(box.height).toBeGreaterThanOrEqual(55.5);
          measuredButtons++;
        }
      }
    }
    expect(measuredButtons).toBeGreaterThan(0);
  });

  test("LOGO COMPARE: generate brand sheet vs implemented SVG comparison", async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 600 });
    await page.goto("/dev/brand");
    await page.waitForLoadState("networkidle");

    // Select the logo section for the comparison screenshot
    const logoSection = page.locator("section").first();
    await logoSection.screenshot({
      path: path.join(screenshotsDir, "logo-compare.png"),
    });
  });
});
