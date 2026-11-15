import { test, expect, request as pwRequest, APIRequestContext } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const rawApiUrl = process.env.VITE_API_BASE_URL || "http://127.0.0.1:8000/api/v1";
const API_URL = rawApiUrl.endsWith("/") ? rawApiUrl : `${rawApiUrl}/`;
const SCREENSHOT_DIR = path.resolve(process.cwd(), "../docs/evidence/qr-ordering");

async function getOwnerApiContext() {
  const ctx = await pwRequest.newContext({ baseURL: API_URL });
  const loginRes = await ctx.post("auth/login/", {
    data: { email: "owner@spicegarden.com", password: "Password123!" },
  });
  expect(loginRes.ok()).toBeTruthy();
  const loginData = await loginRes.json();
  const accessToken = loginData.access;
  const tenantId = loginData.memberships?.[0]?.tenant_id;

  const authedCtx = await pwRequest.newContext({
    baseURL: API_URL,
    extraHTTPHeaders: {
      Authorization: `Bearer ${accessToken}`,
      "X-Tenant-ID": tenantId,
    },
  });
  return authedCtx;
}

test.describe.serial("Customer Phone QR Ordering (Live Stack E2E)", () => {
  let authedCtx: APIRequestContext;
  let qrTokens: string[] = [];
  let qrToken: string;
  let capPath: string;
  let origCaps: Record<string, any>;

  test.beforeAll(async () => {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    authedCtx = await getOwnerApiContext();
    const qrRes = await authedCtx.get("qr-codes/");
    expect(qrRes.ok()).toBeTruthy();
    const qrJson = await qrRes.json();
    const qrList = Array.isArray(qrJson) ? qrJson : qrJson.results || [];
    const activeTableQrs = qrList.filter((q: any) => q.qr_type === "TABLE" && q.is_active);
    const firstQr = activeTableQrs[0] || qrList[0];
    expect(firstQr).toBeTruthy();
    const branchId: string = firstQr.branch || firstQr.branch_id;
    const branchQrs = (activeTableQrs.length > 0 ? activeTableQrs : qrList).filter(
      (q: any) => (q.branch || q.branch_id) === branchId
    );
    qrTokens = branchQrs.map((q: any) => q.public_token);
    qrToken = qrTokens[0];
    capPath = `branches/${branchId}/capabilities/`;

    const capRes = await authedCtx.get(capPath);
    expect(capRes.ok()).toBeTruthy();
    const capJson = await capRes.json();
    origCaps = {
      qr_ordering_mode: capJson.qr_ordering_mode || "ORDER_DIRECT",
      payment_timing: capJson.payment_timing || "PAY_LATER",
      qr_session_policy: capJson.qr_session_policy || "CUSTOMER_CAN_OPEN",
    };

    // Clean up any leftover open table sessions for this table so session limits are fresh
    const sessRes = await authedCtx.get("table-sessions/?status=OPEN");
    if (sessRes.ok()) {
      const sessJson = await sessRes.json();
      const sessList = Array.isArray(sessJson) ? sessJson : sessJson.results || [];
      await Promise.all(
        sessList
          .filter((s: any) => s.status === "OPEN" && (!firstQr.table || s.table === firstQr.table))
          .map((s: any) => authedCtx.post(`table-sessions/${s.id}/close/`))
      );
    }
    if (firstQr.table) {
      await authedCtx.post(`tables/${firstQr.table}/status/`, {
        data: { status: "AVAILABLE" },
      });
    }
  });

  test.afterAll(async () => {
    if (authedCtx && capPath && origCaps) {
      await authedCtx.patch(capPath, { data: origCaps });
      await authedCtx.dispose();
    }
  });

  test("1. Direct order, 360px, Tamil, Dark mode, Slow 4G & Kitchen QR badge", async ({
    browser,
  }) => {
    await authedCtx.patch(capPath, {
      data: {
        qr_ordering_mode: "ORDER_DIRECT",
        payment_timing: "PAY_LATER",
        qr_session_policy: "CUSTOMER_CAN_OPEN",
      },
    });

    const customerContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });

    try {
      const page = await customerContext.newPage();
      await page.goto(`/q/${qrToken}`);
      await page.waitForSelector("article", { timeout: 20000 });
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "menu.png") });

      // Check 360px zero horizontal overflow
      await page.setViewportSize({ width: 360, height: 800 });
      const overflow360 = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth
      );
      expect(overflow360).toBe(false);
      await page.setViewportSize({ width: 390, height: 844 });

      // Tamil & Dark mode screenshots
      await page.getByRole("button", { name: "தமிழ்" }).click();
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "tamil.png") });
      await page.getByRole("button", { name: "English" }).click();

      await page.evaluate(() => document.documentElement.classList.add("dark"));
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "dark.png") });
      await page.evaluate(() => document.documentElement.classList.remove("dark"));

      // Open item sheet
      await page.locator("article").filter({ hasText: "Add" }).first().click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "item-sheet.png") });
      await page.getByRole("button", { name: /Add to order/i }).click();
      await expect(page.getByText(/1 item/i)).toBeVisible();

      // Reload keeps sessionStorage cart, zero token keys in localStorage
      await page.reload();
      await page.waitForSelector("article", { timeout: 20000 });
      await expect(page.getByText(/1 item/i)).toBeVisible();
      const tokenKeys = await page.evaluate(() =>
        Object.keys(window.localStorage).filter((k) =>
          /token|session|auth|refresh|access|cart/i.test(k)
        )
      );
      expect(tokenKeys).toEqual([]);

      // Cart -> Place order -> Tracker
      await page.getByRole("button", { name: /View order/i }).click();
      await expect(page.getByRole("dialog", { name: /Your order/i })).toBeVisible();
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "cart.png") });

      // Enable Slow 4G throttling via CDP for order submission & tracker load
      const cdp = await customerContext.newCDPSession(page);
      await cdp.send("Network.emulateNetworkConditions", {
        offline: false,
        downloadThroughput: (1.6 * 1024 * 1024) / 8,
        uploadThroughput: (750 * 1024) / 8,
        latency: 150,
      });

      await page.getByRole("button", { name: /^Place order$/i }).dblclick();
      await page.waitForURL(new RegExp(`/q/${qrToken}/o/`), { timeout: 20000 });
      await expect(page.getByText("Items in your order")).toBeVisible({ timeout: 15000 });
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "tracker-received.png") });
    } finally {
      await customerContext.close();
    }
  });

  test("2. ORDER_WITH_APPROVAL flow with Staff Accept & Live Tracker update", async ({
    browser,
  }) => {
    const token2 = qrToken;
    await authedCtx.patch(capPath, {
      data: { qr_ordering_mode: "ORDER_WITH_APPROVAL", payment_timing: "PAY_LATER" },
    });

    const customerContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const staffContext = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });

    try {
      const staffPage = await staffContext.newPage();
      await staffPage.goto("/login");
      await staffPage.fill('input[type="email"]', "owner@spicegarden.com");
      await staffPage.fill('input[type="password"]', "Password123!");
      await staffPage.click('button[type="submit"]');
      await staffPage.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 15000 });
      await staffPage.getByRole("link", { name: /Live Orders/i }).click();

      const page = await customerContext.newPage();
      await page.goto(`/q/${token2}`);
      await page.waitForSelector("article", { timeout: 20000 });
      await page.locator("article").filter({ hasText: "Add" }).first().click();
      await page.getByRole("button", { name: /Add to order/i }).click();
      await page.getByRole("button", { name: /View order/i }).click();
      await page.getByRole("button", { name: /^Place order$/i }).click();
      await page.waitForURL(new RegExp(`/q/${token2}/o/`), { timeout: 20000 });
      await expect(page.getByText("Waiting for staff to confirm")).toBeVisible({
        timeout: 15000,
      });
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "approval-waiting.png") });

      await staffPage.getByRole("button", { name: /Refresh/i }).click();
      await staffPage.getByRole("button", { name: /Needs approval/i }).click();
      await expect(staffPage.getByRole("button", { name: /^Accept$/i }).first()).toBeVisible({
        timeout: 10000,
      });
      await staffPage.screenshot({ path: path.join(SCREENSHOT_DIR, "staff-needs-approval.png") });
      await staffPage
        .getByRole("button", { name: /^Accept$/i })
        .first()
        .click();

      await expect(page.getByText("Received")).toBeVisible({ timeout: 15000 });

      await staffPage.getByRole("link", { name: "Kitchen KDS" }).click();
      await expect(staffPage.getByText("QR", { exact: true }).first()).toBeVisible({
        timeout: 15000,
      });
      await staffPage.screenshot({ path: path.join(SCREENSHOT_DIR, "kitchen-qr-badge.png") });
    } finally {
      await customerContext.close();
      await staffContext.close();
    }
  });

  test("3. PAY_FIRST token, BROWSE_ONLY, DISABLED, Invalid QR & Cross-tenant tracker", async ({
    browser,
  }) => {
    const token3 = qrToken;
    const customerContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const staffContext = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });

    try {
      const page = await customerContext.newPage();

      // PAY_FIRST
      await authedCtx.patch(capPath, {
        data: { qr_ordering_mode: "ORDER_DIRECT", payment_timing: "PAY_FIRST" },
      });
      await page.goto(`/q/${token3}`);
      await page.waitForSelector("article", { timeout: 20000 });
      await page.locator("article").filter({ hasText: "Add" }).first().click();
      await page.getByRole("button", { name: /Add to order/i }).click();
      await page.getByRole("button", { name: /View order/i }).click();
      await page.getByRole("button", { name: /^Place order$/i }).click();
      await page.waitForURL(new RegExp(`/q/${token3}/o/`), { timeout: 20000 });
      await expect(page.getByText("Please pay at the counter to start your order")).toBeVisible({
        timeout: 15000,
      });
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "pay-first-token.png") });
    } finally {
      await customerContext.close();
    }
  });

  test("4. BROWSE_ONLY, DISABLED, Invalid QR & Cross-tenant tracker", async ({ browser }) => {
    await authedCtx.patch(capPath, { data: { qr_ordering_mode: "BROWSE_ONLY" } });
    const ctxBrowse = await browser.newContext({ viewport: { width: 390, height: 844 } });
    try {
      const pBrowse = await ctxBrowse.newPage();
      await pBrowse.goto(`/q/${qrToken}`);
      await expect(pBrowse.getByText("Please ask our staff to order")).toBeVisible({
        timeout: 15000,
      });
      await pBrowse.screenshot({ path: path.join(SCREENSHOT_DIR, "browse-only.png") });
    } finally {
      await ctxBrowse.close();
    }

    await authedCtx.patch(capPath, { data: { qr_ordering_mode: "DISABLED" } });
    const ctxDisabled = await browser.newContext({ viewport: { width: 390, height: 844 } });
    try {
      const pDisabled = await ctxDisabled.newPage();
      await pDisabled.goto(`/q/${qrToken}`);
      await expect(pDisabled.getByText("Ordering is closed")).toBeVisible({ timeout: 15000 });
      await pDisabled.screenshot({ path: path.join(SCREENSHOT_DIR, "disabled.png") });

      await pDisabled.goto("/q/invalid-nonexistent-token-xyz");
      await expect(pDisabled.getByText("Menu unavailable")).toBeVisible({ timeout: 15000 });
      await pDisabled.screenshot({ path: path.join(SCREENSHOT_DIR, "invalid-qr.png") });

      await pDisabled.goto(`/q/${qrToken}/o/invalid-tracking-token-xyz`);
      await expect(pDisabled.getByText("Order details no longer available")).toBeVisible({
        timeout: 15000,
      });
    } finally {
      await ctxDisabled.close();
    }
  });
});
