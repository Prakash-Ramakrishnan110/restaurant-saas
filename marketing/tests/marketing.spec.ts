import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs";
import path from "node:path";

const SHOTS_DIR = path.resolve(import.meta.dirname, "../../docs/evidence/marketing/shots");
fs.mkdirSync(SHOTS_DIR, { recursive: true });

const PAGES = [
  { name: "home-en", url: "/" },
  { name: "home-ta", url: "/ta/" },
  { name: "tea-shops-en", url: "/tea-shops/" },
  { name: "tea-shops-ta", url: "/ta/tea-shops/" },
  { name: "restaurants-en", url: "/restaurants/" },
  { name: "restaurants-ta", url: "/ta/restaurants/" },
  { name: "hotels-en", url: "/hotels/" },
  { name: "hotels-ta", url: "/ta/hotels/" },
  { name: "book-demo-en", url: "/book-demo/" },
  { name: "book-demo-ta", url: "/ta/book-demo/" },
];

test.describe("ServeMyFood Marketing Static Site Verification", () => {
  for (const item of PAGES) {
    test(`Page ${item.name} renders cleanly with zero console/3rd-party/a11y/overflow issues`, async ({
      page,
    }) => {
      const consoleErrors: string[] = [];
      const thirdPartyUrls: string[] = [];

      page.on("console", (msg) => {
        if (msg.type() === "error") consoleErrors.push(msg.text());
      });
      page.on("request", (req) => {
        const u = new URL(req.url());
        if (
          u.protocol.startsWith("http") &&
          u.hostname !== "127.0.0.1" &&
          u.hostname !== "localhost"
        ) {
          thirdPartyUrls.push(req.url());
        }
      });

      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(item.url, { waitUntil: "networkidle" });

      await expect(page.locator("h1")).toBeVisible();

      // Check all images have alt text
      const imgsMissingAlt = await page.evaluate(() => {
        return Array.from(document.querySelectorAll("img")).filter(
          (img) => !img.getAttribute("alt")?.trim()
        ).length;
      });
      expect(imgsMissingAlt).toBe(0);

      // Axe accessibility check (zero serious/critical violations)
      const axeResults = await new AxeBuilder({ page }).analyze();
      const seriousOrCritical = axeResults.violations.filter(
        (v) => v.impact === "serious" || v.impact === "critical"
      );
      expect(seriousOrCritical).toEqual([]);

      // Responsive overflow check at 360px, 768px, 1440px
      for (const width of [360, 768, 1440]) {
        await page.setViewportSize({ width, height: 844 });
        const hasOverflow = await page.evaluate(
          () => document.documentElement.scrollWidth > window.innerWidth
        );
        expect(hasOverflow, `Horizontal overflow at ${width}px on ${item.url}`).toBe(false);
        if (item.name.startsWith("home-") && (width === 360 || width === 1440)) {
          await page.screenshot({
            path: path.join(SHOTS_DIR, `${item.name}-${width}.png`),
            fullPage: false,
          });
        }
      }

      if (!item.name.startsWith("home-")) {
        await page.setViewportSize({ width: 1280, height: 800 });
        await page.screenshot({
          path: path.join(SHOTS_DIR, `${item.name}.png`),
          fullPage: false,
        });
      }

      expect(thirdPartyUrls).toEqual([]);
      expect(consoleErrors).toEqual([]);
    });
  }

  test("Hero animation pause/play, reduced-motion storyboard, and video attributes", async ({
    page,
  }) => {
    await page.goto("/", { waitUntil: "networkidle" });
    await page.mouse.click(10, 10);
    await page.waitForFunction(() => Boolean((window as { __SMF_HYDRATED__?: boolean }).__SMF_HYDRATED__));
    const pauseBtn = page.getByRole("button", { name: /Pause animation/i });
    await expect(pauseBtn).toBeVisible({ timeout: 8000 });
    await pauseBtn.click();
    await expect(page.getByRole("button", { name: /Play animation/i })).toBeVisible();

    const video = page.locator("video");
    await expect(video).toHaveAttribute("preload", "none");
    expect(await video.getAttribute("autoplay")).toBeNull();
    expect(await video.evaluate((v: HTMLVideoElement) => v.muted)).toBe(true);
    await expect(page.locator('video track[kind="captions"]')).toHaveCount(2);

    // Reduced motion shows static storyboard
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.getByTestId("hero-storyboard")).toBeVisible();
  });

  test("Book a demo form validates invalid phone and submits cleanly", async ({ page }) => {
    await page.goto("/book-demo/", { waitUntil: "networkidle" });
    await page.mouse.click(10, 10);
    await page.waitForFunction(() => Boolean((window as { __SMF_HYDRATED__?: boolean }).__SMF_HYDRATED__));

    await page.fill("#lead-name", "Suresh Kumar");
    await page.fill("#lead-phone", "12345");
    await page.fill("#lead-city", "Madurai");
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: /Book a free demo/i }).click();
    await expect(page.getByRole("alert")).toContainText("10-digit Indian mobile number");

    const uniquePhone = `98${String(Date.now()).slice(-8)}`;
    await page.fill("#lead-phone", uniquePhone);
    await page.getByRole("button", { name: /Book a free demo/i }).click();
    await expect(page.getByRole("status")).toContainText("Demo request received");
  });
});
