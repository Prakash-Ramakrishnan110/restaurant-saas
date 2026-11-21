import { test, expect } from "./fixtures";

test.describe("Branding Logo Upload & Preview Suite", () => {
  test("Owner uploads a PNG logo and verifies rendered preview in logo card and QR standee", async ({
    page,
  }) => {
    // 1. Log in as owner on real stack
    await page.goto("/login");
    await page.waitForLoadState("domcontentloaded");

    await page.fill('input[type="email"]', "owner@kavericafe.com");
    await page.fill('input[type="password"]', "Password123!");
    await page.click('button[type="submit"]');

    // Wait for authenticated session
    await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 15000 });
    await page.waitForLoadState("networkidle");

    // 2. Navigate to Branding Settings via sidebar link (SPA navigation, avoids full reload)
    await expect(async () => {
      const brandingLink = page.locator('a[href="/settings/branding"]').first();
      await brandingLink.waitFor({ state: "attached", timeout: 5000 });
      await brandingLink.evaluate((el: HTMLElement) => el.click());
      expect(new URL(page.url()).pathname).toBe("/settings/branding");
    }).toPass({ timeout: 15000 });

    await expect(page.getByRole("heading", { name: /Branding & Business Identity/i })).toBeVisible({
      timeout: 10000,
    });

    // 3. Create a valid 64x64 solid orange PNG
    const base64Png =
      "iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAYElEQVR4nO3PMQ0AIADAMEAu/n8QwdGQrAq2efb42tIBrxrQGtAa0BrQGtAa0BrQGtAa0BrQGtAa0BrQGtAa0BrQGtAa0BrQGtAa0BrQGtAa0BrQGtAa0BrQGtAa0BrQLk1dAenGmk4DAAAAAElFTkSuQmCC";
    const pngBuffer = Buffer.from(base64Png, "base64");

    // 4. Upload PNG via file input
    const fileInput = page.locator('input[type="file"]');
    await fileInput.waitFor({ state: "attached", timeout: 10000 });
    await fileInput.setInputFiles({
      name: "restaurant-logo.png",
      mimeType: "image/png",
      buffer: pngBuffer,
    });

    // 5. Verify the logo preview rendered in Restaurant Logo card
    const logoImg = page.locator('img[alt="Restaurant Logo"]');
    await expect(logoImg).toBeVisible({ timeout: 10000 });

    // Verify image actually rendered and is not a broken placeholder
    const isImageLoaded = await logoImg.evaluate((img: HTMLImageElement) => {
      return img.complete && img.naturalWidth > 0;
    });
    expect(isImageLoaded).toBe(true);

    // 6. Verify preview in Live Customer QR Card preview
    const qrLogoImg = page.locator('img[alt="Logo Preview"]');
    await expect(qrLogoImg).toBeVisible({ timeout: 10000 });
    const isQrImageLoaded = await qrLogoImg.evaluate((img: HTMLImageElement) => {
      return img.complete && img.naturalWidth > 0;
    });
    expect(isQrImageLoaded).toBe(true);
  });
});
