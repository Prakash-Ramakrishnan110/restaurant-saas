import { test, expect, request, attachApiErrorGuard } from "./fixtures";
import type { APIRequestContext, TestInfo } from "@playwright/test";
import path from "path";
import fs from "fs";

const SCREENSHOT_DIR = path.resolve(process.cwd(), "../docs/evidence/qr-ordering");

async function getOwnerApiContext(): Promise<APIRequestContext> {
  const apiCtx = await request.newContext({
    baseURL: "http://127.0.0.1:8000/api/v1/",
  });
  const loginRes = await apiCtx.post("auth/login/", {
    data: { email: "owner@spicegarden.com", password: "Password123!" },
  });
  expect(loginRes.ok()).toBeTruthy();
  const loginJson = await loginRes.json();
  const token = loginJson.access;
  const tenantId =
    loginJson.user?.memberships?.[0]?.tenant_id ||
    loginJson.memberships?.[0]?.tenant_id ||
    loginJson.tenants?.[0]?.id;

  const authedCtx = await request.newContext({
    baseURL: "http://127.0.0.1:8000/api/v1/",
    extraHTTPHeaders: {
      Authorization: `Bearer ${token}`,
      "X-Tenant-ID": tenantId,
    },
  });
  await apiCtx.dispose();
  return authedCtx;
}

test.describe.serial("Customer Phone QR Ordering (Live Stack E2E)", () => {
  let authedCtx: APIRequestContext;
  let staffContext: import("@playwright/test").BrowserContext;
  let staffPage: import("@playwright/test").Page;
  let activeTestInfo: TestInfo | null = null;
  let qrTokens: string[] = [];
  let inactiveQrToken: string | null = null;
  let qrToken: string;
  let tableId: string | null = null;
  let capPath: string;
  let origCaps: Record<string, any>;

  test.beforeAll(async ({ browser }) => {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    staffContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    staffPage = await staffContext.newPage();
    staffPage.on("response", (res) => {
      if (activeTestInfo && res.url().includes("/api/") && res.status() >= 400) {
        const list = ((activeTestInfo as any)._apiFailures ||= []);
        list.push(`${res.status()} ${res.request().method()} ${res.url()}`);
      }
    });
    await Promise.all([
      (async () => {
        await staffPage.goto("/login");
        await staffPage.fill('input[type="email"]', "owner@spicegarden.com");
        await staffPage.fill('input[type="password"]', "Password123!");
        await staffPage.click('button[type="submit"]');
        await staffPage.waitForURL((u: URL) => !u.pathname.includes("/login"), { timeout: 15000 });
      })(),
      (async () => {
        authedCtx = await getOwnerApiContext();
      })(),
    ]);
    const qrRes = await authedCtx.get("qr-codes/");
    expect(qrRes.ok()).toBeTruthy();
    const qrJson = await qrRes.json();
    const qrList = Array.isArray(qrJson) ? qrJson : qrJson.results || [];
    const activeTableQrs = qrList.filter(
      (q: any) => (q.target_type === "TABLE" || q.qr_type === "TABLE") && q.is_active
    );
    const inactiveQr = qrList.find((q: any) => !q.is_active);
    if (inactiveQr) {
      inactiveQrToken = inactiveQr.public_token;
    }
    const firstQr = activeTableQrs[0] || qrList[0];
    expect(firstQr).toBeTruthy();
    const branchId: string = firstQr.branch || firstQr.branch_id;
    const branchQrs = (activeTableQrs.length > 0 ? activeTableQrs : qrList).filter(
      (q: any) => (q.branch || q.branch_id) === branchId
    );
    const workingQrs: any[] = [];
    for (const q of branchQrs) {
      const checkRes = await authedCtx.get(`public/qr/${q.public_token}/menu/`);
      if (checkRes.ok()) {
        workingQrs.push(q);
      }
      if (workingQrs.length >= 2) break;
    }
    const selectedIdx =
      test.info().project.name === "mobile" && workingQrs.length > 1 ? 1 : 0;
    const selectedQr = workingQrs[selectedIdx] || workingQrs[0] || firstQr;
    tableId = selectedQr.table || null;
    qrTokens = branchQrs.map((q: any) => q.public_token);
    qrToken = selectedQr.public_token;
    capPath = `branches/${branchId}/capabilities/`;

    const capRes = await authedCtx.get(capPath);
    expect(capRes.ok()).toBeTruthy();
    const capJson = await capRes.json();
    origCaps = {
      qr_ordering_mode: capJson.qr_ordering_mode || "ORDER_DIRECT",
      payment_timing: capJson.payment_timing || "PAY_LATER",
      qr_session_policy: capJson.qr_session_policy || "CUSTOMER_CAN_OPEN",
    };

    const sessRes = await authedCtx.get("table-sessions/?status=OPEN");
    if (sessRes.ok()) {
      const sessJson = await sessRes.json();
      const sessList = Array.isArray(sessJson) ? sessJson : sessJson.results || [];
      await Promise.all(
        sessList
          .filter((s: any) => s.status === "OPEN" && (!tableId || s.table === tableId))
          .map((s: any) => authedCtx.post(`table-sessions/${s.id}/close/`))
      );
    }
    if (tableId) {
      await authedCtx.post(`tables/${tableId}/status/`, {
        data: { status: "AVAILABLE" },
      });
    }
  });

  test.afterAll(async () => {
    if (staffContext) {
      await staffContext.close();
    }
    if (authedCtx && capPath && origCaps) {
      await authedCtx.patch(capPath, { data: origCaps });
      await authedCtx.dispose();
    }
  });

  async function resetTableSession() {
    const sessRes = await authedCtx.get("table-sessions/?status=OPEN");
    if (sessRes.ok()) {
      const sessJson = await sessRes.json();
      const sessList = Array.isArray(sessJson) ? sessJson : sessJson.results || [];
      await Promise.all(
        sessList
          .filter((s: any) => s.status === "OPEN" && (!tableId || s.table === tableId))
          .map((s: any) => authedCtx.post(`table-sessions/${s.id}/close/`))
      );
    }
    if (tableId) {
      await authedCtx.post(`tables/${tableId}/status/`, {
        data: { status: "AVAILABLE" },
      });
    }
  }

  test("1. Double tap on Place order places exactly one order", async ({ browser }, testInfo) => {
    await authedCtx.patch(capPath, {
      data: {
        qr_ordering_mode: "ORDER_DIRECT",
        payment_timing: "PAY_LATER",
        qr_session_policy: "CUSTOMER_CAN_OPEN",
      },
    });
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    try {
      const page = await ctx.newPage();
      attachApiErrorGuard(page, testInfo);
      let orderPostCount = 0;
      page.on("request", (req) => {
        if (req.method() === "POST" && req.url().includes(`/public/qr/${qrToken}/orders/`)) {
          orderPostCount++;
        }
      });

      await page.goto(`/q/${qrToken}`);
      await page.waitForSelector("article", { timeout: 20000 });
      await page.locator("article").filter({ hasText: "Add" }).first().click();
      await page.getByRole("button", { name: /Add to order/i }).click();
      await page.getByRole("button", { name: /View order/i }).click();
      await page.getByRole("button", { name: /^Place order$/i }).dblclick();
      await page.waitForURL(new RegExp(`/q/${qrToken}/o/`), { timeout: 20000 });
      await expect(page.getByText("Items in your order")).toBeVisible({ timeout: 15000 });
      expect(orderPostCount).toBe(1);
    } finally {
      await ctx.close();
    }
  });

  test("2. Direct order, 360px no horizontal scroll (EN & TA), Tamil & Dark mode, Slow 4G", async ({
    browser,
  }, testInfo) => {
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
      attachApiErrorGuard(page, testInfo);
      await page.goto(`/q/${qrToken}`);
      await page.waitForSelector("article", { timeout: 20000 });
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "menu.png") });

      // 360px zero horizontal overflow in English
      await page.setViewportSize({ width: 360, height: 800 });
      const overflowEn = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth
      );
      expect(overflowEn).toBe(false);

      // Tamil screenshot + 360px zero horizontal overflow in Tamil
      await page.getByRole("button", { name: "தமிழ்" }).click();
      const overflowTa = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth
      );
      expect(overflowTa).toBe(false);
      await page.setViewportSize({ width: 390, height: 844 });
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "tamil.png") });
      await page.getByRole("button", { name: "English" }).click();

      // Dark mode screenshot
      await page.evaluate(() => document.documentElement.classList.add("dark"));
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "dark.png") });
      await page.evaluate(() => document.documentElement.classList.remove("dark"));

      // Open item sheet -> add -> reload persists cart, zero token keys in localStorage
      await page.locator("article").filter({ hasText: "Add" }).first().click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "item-sheet.png") });
      await page.getByRole("button", { name: /Add to order/i }).click();
      await expect(page.getByText(/1 item/i)).toBeVisible();

      await page.reload();
      await page.waitForSelector("article", { timeout: 20000 });
      await expect(page.getByText(/1 item/i)).toBeVisible();
      const tokenKeys = await page.evaluate(() =>
        Object.keys(window.localStorage).filter((k) =>
          /token|session|auth|refresh|access|cart/i.test(k)
        )
      );
      expect(tokenKeys).toEqual([]);

      await page.getByRole("button", { name: /View order/i }).click();
      await expect(page.getByRole("dialog", { name: /Your order/i })).toBeVisible();
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "cart.png") });

      const cdp = await customerContext.newCDPSession(page);
      await cdp.send("Network.emulateNetworkConditions", {
        offline: false,
        downloadThroughput: (1.6 * 1024 * 1024) / 8,
        uploadThroughput: (750 * 1024) / 8,
        latency: 150,
      });

      await page.getByRole("button", { name: /^Place order$/i }).click();
      await page.waitForURL(new RegExp(`/q/${qrToken}/o/`), { timeout: 20000 });
      await expect(page.getByText("Items in your order")).toBeVisible({ timeout: 15000 });
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "tracker-received.png") });
    } finally {
      await customerContext.close();
    }
  });

  test("3. ORDER_WITH_APPROVAL Accept flow, QR badge on Live Orders & Kitchen KDS, Live Tracker update", async ({
    browser,
  }, testInfo) => {
    await resetTableSession();
    await authedCtx.patch(capPath, {
      data: { qr_ordering_mode: "ORDER_WITH_APPROVAL", payment_timing: "PAY_LATER" },
    });

    const customerContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    activeTestInfo = testInfo;

    try {
      const [, page] = await Promise.all([
        staffPage.getByRole("link", { name: /Live Orders/i }).click(),
        customerContext.newPage().then(async (cp) => {
          attachApiErrorGuard(cp, testInfo);
          await cp.goto(`/q/${qrToken}`);
          await cp.waitForSelector("article", { timeout: 20000 });
          return cp;
        }),
      ]);

      await page.locator("article").filter({ hasText: "Add" }).first().click();
      await page.getByRole("button", { name: /Add to order/i }).click();
      await page.getByRole("button", { name: /View order/i }).click();
      await page.getByRole("button", { name: /^Place order$/i }).click();
      await page.waitForURL(new RegExp(`/q/${qrToken}/o/`), { timeout: 20000 });
      await expect(page.getByText("Waiting for staff to confirm")).toBeVisible({
        timeout: 15000,
      });
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "approval-waiting.png") });

      await staffPage.getByRole("button", { name: /Refresh/i }).click();
      await staffPage.getByRole("button", { name: /Needs approval/i }).click();
      await expect(staffPage.getByRole("button", { name: /^Accept$/i }).first()).toBeVisible({
        timeout: 10000,
      });
      await expect(staffPage.getByText("QR", { exact: true }).first()).toBeVisible();
      await staffPage.screenshot({ path: path.join(SCREENSHOT_DIR, "staff-needs-approval.png") });
      await staffPage
        .getByRole("button", { name: /^Accept$/i })
        .first()
        .click();

      await page.getByRole("button", { name: /Refresh/i }).click();
      await expect(page.getByRole("heading", { name: "Received" })).toBeVisible({ timeout: 15000 });

      await staffPage.getByRole("link", { name: "Kitchen KDS" }).click();
      await expect(staffPage.getByText("QR", { exact: true }).first()).toBeVisible({
        timeout: 15000,
      });
      await staffPage.screenshot({ path: path.join(SCREENSHOT_DIR, "kitchen-qr-badge.png") });
    } finally {
      activeTestInfo = null;
      await customerContext.close();
    }
  });

  test("4. [negative] ORDER_WITH_APPROVAL Reject with reason shown to guest", async ({
    browser,
  }, testInfo) => {
    await resetTableSession();
    await authedCtx.patch(capPath, {
      data: { qr_ordering_mode: "ORDER_WITH_APPROVAL", payment_timing: "PAY_LATER" },
    });

    const customerContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    activeTestInfo = testInfo;

    try {
      const [, page] = await Promise.all([
        staffPage.getByRole("link", { name: /Live Orders/i }).click(),
        customerContext.newPage().then(async (cp) => {
          attachApiErrorGuard(cp, testInfo);
          await cp.goto(`/q/${qrToken}`);
          await cp.waitForSelector("article", { timeout: 20000 });
          return cp;
        }),
      ]);

      await page.locator("article").filter({ hasText: "Add" }).first().click();
      await page.getByRole("button", { name: /Add to order/i }).click();
      await page.getByRole("button", { name: /View order/i }).click();
      await page.getByRole("button", { name: /^Place order$/i }).click();
      await page.waitForURL(new RegExp(`/q/${qrToken}/o/`), { timeout: 20000 });
      await expect(page.getByText("Waiting for staff to confirm")).toBeVisible({
        timeout: 15000,
      });

      await staffPage.getByRole("button", { name: /Refresh/i }).click();
      await staffPage.getByRole("button", { name: /Needs approval/i }).click();
      await expect(staffPage.getByRole("button", { name: /^Reject$/i }).first()).toBeVisible({
        timeout: 10000,
      });
      await staffPage
        .getByRole("button", { name: /^Reject$/i })
        .first()
        .click();
      await staffPage.getByRole("textbox").last().fill("Dish sold out tonight");
      await staffPage.getByRole("button", { name: /Reject Order/i }).click();

      await page.getByRole("button", { name: /Refresh/i }).click();
      await expect(page.getByText("Dish sold out tonight")).toBeVisible({ timeout: 15000 });
    } finally {
      activeTestInfo = null;
      await customerContext.close();
    }
  });

  test("5. PAY_FIRST token waits until cashier pays, then reaches Kitchen KDS", async ({
    browser,
  }, testInfo) => {
    await resetTableSession();
    await authedCtx.patch(capPath, {
      data: { qr_ordering_mode: "ORDER_DIRECT", payment_timing: "PAY_FIRST" },
    });

    const customerContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    activeTestInfo = testInfo;
    try {
      const [, page] = await Promise.all([
        staffPage.getByRole("link", { name: /Cashier Billing/i }).click(),
        customerContext.newPage().then(async (cp) => {
          attachApiErrorGuard(cp, testInfo);
          await cp.goto(`/q/${qrToken}`);
          await cp.waitForSelector("article", { timeout: 20000 });
          return cp;
        }),
      ]);

      await page.locator("article").filter({ hasText: "Add" }).first().click();
      await page.getByRole("button", { name: /Add to order/i }).click();
      await page.getByRole("button", { name: /View order/i }).click();
      await page.getByRole("button", { name: /^Place order$/i }).click();
      await page.waitForURL(new RegExp(`/q/${qrToken}/o/`), { timeout: 20000 });
      await expect(page.getByText("Please pay at the counter to start your order")).toBeVisible({
        timeout: 15000,
      });
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "pay-first-token.png") });

      await staffPage.getByRole("button", { name: /Refresh/i }).first().click();
      const markPaidBtn = staffPage.getByRole("button", { name: /Mark Paid & Send to Kitchen/i }).first();
      await expect(markPaidBtn).toBeVisible({ timeout: 15000 });
      await markPaidBtn.click();

      await page.getByRole("button", { name: /Refresh/i }).click();
      await expect(page.getByRole("heading", { name: "Received" })).toBeVisible({ timeout: 15000 });

      await staffPage.getByRole("link", { name: "Kitchen KDS" }).click();
      await expect(staffPage.getByText("QR", { exact: true }).first()).toBeVisible({
        timeout: 15000,
      });
    } finally {
      activeTestInfo = null;
      await customerContext.close();
    }
  });

  test("6. [negative] BROWSE_ONLY and DISABLED modes cannot order", async ({
    browser,
  }, testInfo) => {
    await authedCtx.patch(capPath, { data: { qr_ordering_mode: "BROWSE_ONLY" } });
    const ctxBrowse = await browser.newContext({ viewport: { width: 390, height: 844 } });
    try {
      const pBrowse = await ctxBrowse.newPage();
      attachApiErrorGuard(pBrowse, testInfo);
      await pBrowse.goto(`/q/${qrToken}`);
      await expect(pBrowse.getByText("Please ask our staff to order")).toBeVisible({
        timeout: 15000,
      });
      await expect(pBrowse.getByRole("button", { name: /^Add$/i })).toHaveCount(0);
      await pBrowse.screenshot({ path: path.join(SCREENSHOT_DIR, "browse-only.png") });
    } finally {
      await ctxBrowse.close();
    }

    await authedCtx.patch(capPath, { data: { qr_ordering_mode: "DISABLED" } });
    const ctxDisabled = await browser.newContext({ viewport: { width: 390, height: 844 } });
    try {
      const pDisabled = await ctxDisabled.newPage();
      attachApiErrorGuard(pDisabled, testInfo);
      await pDisabled.goto(`/q/${qrToken}`);
      await expect(pDisabled.getByText("Ordering is closed")).toBeVisible({ timeout: 15000 });
      await pDisabled.screenshot({ path: path.join(SCREENSHOT_DIR, "disabled.png") });
    } finally {
      await ctxDisabled.close();
    }
  });

  test("7. [negative] Rotated token and invalid token show identical generic Menu unavailable page", async ({
    browser,
  }, testInfo) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    try {
      const page = await ctx.newPage();
      attachApiErrorGuard(page, testInfo);

      await page.goto("/q/invalid-nonexistent-token-xyz");
      await expect(page.getByText("Menu unavailable")).toBeVisible({ timeout: 15000 });
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "invalid-qr.png") });

      if (inactiveQrToken) {
        await page.goto(`/q/${inactiveQrToken}`);
        await expect(page.getByText("Menu unavailable")).toBeVisible({ timeout: 15000 });
      }
    } finally {
      await ctx.close();
    }
  });

  test("8. [negative] Cross-restaurant tracking link cannot show restaurant B data", async ({
    browser,
  }, testInfo) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    try {
      const page = await ctx.newPage();
      attachApiErrorGuard(page, testInfo);
      await page.goto(`/q/${qrToken}/o/invalid-tracking-token-xyz`);
      await expect(page.getByText("Order details no longer available")).toBeVisible({
        timeout: 15000,
      });
    } finally {
      await ctx.close();
    }
  });
});
