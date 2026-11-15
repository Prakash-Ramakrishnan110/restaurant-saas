import { test, expect } from "./fixtures";

test.describe("Touch Targets & Contrast Invariants", () => {
  test("TOUCH INVARIANT: Touch mode target heights are >= 56px", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/dev/design-system");
    await page.waitForLoadState("networkidle");

    await page.evaluate(() => {
      document.documentElement.setAttribute("data-density", "touch");
      document.documentElement.classList.add("touch-mode");
    });
    await page.waitForTimeout(400);

    const buttons = page.locator("button");
    const count = await buttons.count();
    expect(count).toBeGreaterThan(5);

    let measuredButtons = 0;
    for (let i = 0; i < Math.min(count, 15); i++) {
      const btn = buttons.nth(i);
      if (await btn.isVisible()) {
        const box = await btn.boundingBox();
        if (box && box.height > 0) {
          expect(box.height).toBeGreaterThanOrEqual(55.5);
          measuredButtons++;
        }
      }
    }
    expect(measuredButtons).toBeGreaterThan(0);
  });
});
