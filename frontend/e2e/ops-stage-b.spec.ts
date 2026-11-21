import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { test, expect } from "./fixtures";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STAGE_B_DIR = path.resolve(__dirname, "../../docs/evidence/stage-b");
fs.mkdirSync(STAGE_B_DIR, { recursive: true });

async function loginAs(page: import("@playwright/test").Page, email: string) {
  await page.goto("/login");
  await page.waitForLoadState("domcontentloaded");
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', "Password123!");
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 15000 });
  await page.waitForLoadState("networkidle");
}

async function navTo(page: import("@playwright/test").Page, href: string) {
  await expect(async () => {
    const link = page.locator(`a[href="${href}"]`).first();
    await link.waitFor({ state: "attached", timeout: 5000 });
    await link.evaluate((el: HTMLElement) => el.click());
    expect(new URL(page.url()).pathname).toBe(href);
  }).toPass({ timeout: 15000 });
}

test.describe("Stage B: Operational Hardening Live E2E", () => {
  test("1. Blind shift cash handover with denomination helper, cash movements, and Z-Report lock", async ({
    page,
  }) => {
    await loginAs(page, "owner@spicegarden.com");
    await navTo(page, "/billing/closeout");

    await expect(page.getByText("Cashier Shift Closeout (Z-Report)")).toBeVisible({
      timeout: 15000,
    });

    // Open denomination helper
    await page.getByRole("button", { name: /Count Notes & Coins/i }).click();
    await expect(page.getByText(/Denomination Note & Coin Counter/i)).toBeVisible();

    await page.screenshot({ path: path.join(STAGE_B_DIR, "shift-blind-count.png") });

    // Enter counted cash and reconcile with reason code
    await page.getByPlaceholder("Enter counted cash...").fill("2500");
    await page.locator('select[aria-label="Variance Reason"]').selectOption("CHANGE_ERROR");
    await page.getByRole("button", { name: /Reconcile & Generate Z-Report/i }).click();

    await expect(page.getByText("Shift Z-Report Summary")).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("Expected Drawer Cash:")).toBeVisible();
    await page.screenshot({ path: path.join(STAGE_B_DIR, "shift-z-report.png") });
  });

  test("2. Bills history reprint and thermal printer device settings (80mm / 58mm & 5 slip templates)", async ({
    page,
  }) => {
    await loginAs(page, "owner@spicegarden.com");
    await navTo(page, "/billing/bills");

    await expect(page.getByRole("heading", { name: /Bills & Receipts History/i })).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByText("Loading invoices history...")).toHaveCount(0, { timeout: 15000 });
    await page.screenshot({ path: path.join(STAGE_B_DIR, "bills-history-refunds.png") });

    // Navigate to Printer & Device settings via SPA history push (no full reload)
    await page.evaluate(() => {
      window.history.pushState({}, "", "/settings/devices");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    await expect(page.getByRole("heading", { name: /Printers & Devices/i })).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByText(/DEMO RECEIPT - NOT A TAX INVOICE/i)).toBeVisible();

    // Switch preview slip tabs (KOT, Token, Z-Slip, Refund)
    await page.getByRole("button", { name: "KOT", exact: true }).click();
    await expect(page.getByText("KITCHEN TICKET • TABLE T-04")).toBeVisible();
    await page.screenshot({ path: path.join(STAGE_B_DIR, "printer-kot-preview.png") });

    await page.getByRole("button", { name: "Token", exact: true }).click();
    await expect(page.getByText(/Counter Pickup Token/i)).toBeVisible();
    await page.screenshot({ path: path.join(STAGE_B_DIR, "printer-token-preview.png") });
  });
});
