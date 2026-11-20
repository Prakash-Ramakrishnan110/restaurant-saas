import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { test, expect } from "./fixtures";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STAGE_A_DIR = path.resolve(__dirname, "../../docs/evidence/stage-a");
fs.mkdirSync(STAGE_A_DIR, { recursive: true });

async function loginAs(page: import("@playwright/test").Page, email: string) {
  await page.goto("/login");
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', "Password123!");
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 15000 });
}

async function navTo(page: import("@playwright/test").Page, href: string) {
  const link = page.locator(`a[href="${href}"]`).first();
  await link.waitFor({ state: "attached", timeout: 15000 });
  await link.evaluate((el: HTMLElement) => el.click());
}

test.describe("Stage A: Inventory Core Live E2E", () => {
  test("1a. Owner views seeded stock (light & dark) and receive stock screen", async ({ page }) => {
    await loginAs(page, "owner@spicegarden.com");

    // Stock overview
    await navTo(page, "/inventory");
    await expect(page.getByText("Fresh Malai Paneer")).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: path.join(STAGE_A_DIR, "stock-desktop.png") });

    // Dark mode screenshot
    await page.evaluate(() => document.documentElement.classList.add("dark"));
    await page.screenshot({ path: path.join(STAGE_A_DIR, "stock-dark.png") });
    await page.evaluate(() => document.documentElement.classList.remove("dark"));

    // Receive stock
    await navTo(page, "/inventory/receive");
    await expect(page.getByRole("heading", { name: /Receive Stock/i })).toBeVisible({
      timeout: 10000,
    });
    await page.screenshot({ path: path.join(STAGE_A_DIR, "receive-stock.png") });
  });

  test("1b. Owner views recipes with live margin and stock counts screen", async ({ page }) => {
    await loginAs(page, "owner@spicegarden.com");

    // Recipes (owner sees margin)
    await navTo(page, "/inventory/recipes");
    await expect(page.getByText("Butter Chicken Royal").last()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/Margin:/i).first()).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: path.join(STAGE_A_DIR, "recipes.png") });

    // Counts
    await navTo(page, "/inventory/counts");
    await expect(page.getByRole("heading", { name: /Stock Counts/i })).toBeVisible({
      timeout: 10000,
    });
    await page.screenshot({ path: path.join(STAGE_A_DIR, "counts.png") });
  });

  test("2. Kitchen sees stock without cost columns", async ({ page }) => {
    await loginAs(page, "kitchen@spicegarden.com");
    await navTo(page, "/inventory");
    await expect(page.getByText("Fresh Malai Paneer")).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("Avg Cost")).toHaveCount(0);
  });

  test("2b. Waiter has zero inventory sidebar links", async ({ page }) => {
    await loginAs(page, "waiter@spicegarden.com");
    await expect(page.locator('a[href="/inventory"]')).toHaveCount(0);
  });

  test("3. Tea shop quick count has zero /table/i text", async ({ page }) => {
    await loginAs(page, "owner@chaicorner.in");
    await navTo(page, "/inventory/counts");
    await expect(page.getByRole("heading", { name: /Stock Counts/i })).toBeVisible({
      timeout: 15000,
    });
    const mainText = await page.locator("main").innerText();
    expect(mainText).not.toMatch(/\btable\b/i);
  });

  test("4. Mobile stock overview captures phone screenshot cleanly", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAs(page, "owner@spicegarden.com");
    await navTo(page, "/inventory");
    await expect(page.getByText("Fresh Malai Paneer")).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: path.join(STAGE_A_DIR, "stock-mobile.png") });
  });
});
