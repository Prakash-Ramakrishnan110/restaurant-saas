import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { test, expect } from "./fixtures";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STAGE_D_DIR = path.resolve(__dirname, "../../docs/evidence/stage-d");
fs.mkdirSync(STAGE_D_DIR, { recursive: true });

async function loginAs(page: import("@playwright/test").Page, email: string) {
  await page.goto("/login");
  await page.waitForLoadState("domcontentloaded");
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', "Password123!");
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 15000 });
  await page.waitForLoadState("networkidle");
}

test.describe("Stage D: Scale & Polish Live E2E (Multi-Outlet, Purchase Orders & Guest Loyalty)", () => {
  test("1. Multi-Outlet Consolidated Revenue, Margin & Inter-Branch Stock Transfers", async ({
    page,
  }) => {
    await loginAs(page, "owner@spicegarden.com");
    await page.goto("/reports/outlets");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("Multi-Outlet Revenue Comparison")).toBeVisible();
    await expect(page.getByTestId("consolidated-outlet-totals")).toBeVisible();
    await expect(page.getByText("Group Net Sales")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Inter-Branch Stock Transfers" })
    ).toBeVisible();

    await page.screenshot({
      path: path.join(STAGE_D_DIR, "multi-outlet-transfers.png"),
      fullPage: true,
    });
  });

  test("2. Purchase Orders & One-Click Convert to Goods Receipt", async ({ page }) => {
    await loginAs(page, "owner@spicegarden.com");
    await page.goto("/inventory/purchases");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText(/Purchase Orders & One-Click Goods Receipt/i)).toBeVisible();
    const createPoBtn = page.getByTestId("create-po-btn");
    await expect(createPoBtn).toBeVisible();
    await createPoBtn.click();

    await expect(page.getByText(/Purchase Order created in DRAFT status\./i)).toBeVisible();

    const receivePoBtn = page.getByTestId("receive-po-btn").first();
    await expect(receivePoBtn).toBeVisible();
    await receivePoBtn.click();

    await expect(
      page.getByText(/to Goods Receipt & updated stock levels\./i)
    ).toBeVisible();

    await page.screenshot({
      path: path.join(STAGE_D_DIR, "purchase-orders-grn.png"),
      fullPage: true,
    });
  });

  test("3. Guest Profiles & VIP Loyalty Points Directory", async ({ page }) => {
    await loginAs(page, "owner@spicegarden.com");
    await page.goto("/customers");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText(/Guest Profiles & VIP Loyalty/i)).toBeVisible();
    await expect(page.getByRole("columnheader", { name: /Loyalty Points/i })).toBeVisible();

    await page.screenshot({
      path: path.join(STAGE_D_DIR, "guest-loyalty-directory.png"),
      fullPage: true,
    });
  });
});
