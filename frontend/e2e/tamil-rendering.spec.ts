import { test, expect } from "@playwright/test";

test.describe("Tamil Localization and Typography Rendering", () => {
  test("renders Tamil heading and body text on /dev/brand without missing glyphs", async ({ page }) => {
    await page.goto("/dev/brand");

    const tamilHeading = page.locator('[data-testid="tamil-heading"]');
    await expect(tamilHeading).toBeVisible();
    await expect(tamilHeading).toContainText("ஒரே தளம். அனைத்து உணவு வணிகங்களுக்கும்.");

    const tamilBody = page.locator('[data-testid="tamil-body"]');
    await expect(tamilBody).toBeVisible();
    await expect(tamilBody).toContainText("மேஜைகள், தள வரைபடம்");

    // Verify computed font-family includes Noto Sans Tamil or display fallback
    const computedFont = await tamilHeading.evaluate((el) => {
      return window.getComputedStyle(el).fontFamily;
    });
    expect(computedFont).toContain("Noto Sans Tamil");
  });

  test("toggles language between English and Tamil on login screen", async ({ page }) => {
    await page.goto("/login");

    // Default English
    await expect(page.locator("h1")).toContainText("One Platform. Every Food Business.");

    // Click language toggle button
    const langBtn = page.getByRole("button", { name: /தமிழ்/i });
    await langBtn.click();

    // Now text changes to Tamil
    await expect(page.locator("h1")).toContainText("ஒரே தளம். அனைத்து உணவு வணிகங்களுக்கும்.");
    await expect(page.getByRole("button", { name: /உள்நுழைக/i })).toBeVisible();
  });
});
