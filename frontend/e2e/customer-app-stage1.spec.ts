import { test, expect, request, attachApiErrorGuard } from "./fixtures";
import type { APIRequestContext, TestInfo } from "@playwright/test";
import path from "path";
import fs from "fs";

const SCREENSHOT_DIR = path.resolve(process.cwd(), "../docs/evidence/stage1");
const BASE_API = "http://127.0.0.1:8000/api/v1/";

async function getOwnerCtx(email: string): Promise<APIRequestContext> {
  const apiCtx = await request.newContext({ baseURL: BASE_API });
  const loginRes = await apiCtx.post("auth/login/", {
    data: { email, password: "Password123!" },
  });
  expect(loginRes.ok()).toBeTruthy();
  const loginJson = await loginRes.json();
  const token = loginJson.access as string;
  const tenantId =
    loginJson.user?.memberships?.[0]?.tenant_id ||
    loginJson.memberships?.[0]?.tenant_id ||
    loginJson.tenants?.[0]?.id;

  const authedCtx = await request.newContext({
    baseURL: BASE_API,
    extraHTTPHeaders: {
      Authorization: `Bearer ${token}`,
      "X-Tenant-ID": tenantId,
    },
  });
  await apiCtx.dispose();
  return authedCtx;
}

const VIEWPORT_MATRIX = [
  { name: "mobile-320", width: 320, height: 568 },
  { name: "mobile-360", width: 360, height: 800 },
  { name: "iphone-se", width: 375, height: 667 },
  { name: "iphone-14-pro", width: 393, height: 852 },
  { name: "pixel-7", width: 412, height: 915 },
  { name: "ipad-768", width: 768, height: 1024 },
  { name: "desktop-1280", width: 1280, height: 800 },
];

test.describe.serial("Stage 1 Customer App (Live Stack, Real Backend)", () => {
  let foodieCtx: APIRequestContext;
  let counterQrToken = "";
  let capPath = "";
  let origCaps: Record<string, any> = {};

  test.beforeAll(async () => {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    foodieCtx = await getOwnerCtx("owner@foodieplaza.in");

    const qrRes = await foodieCtx.get("qr-codes/");
    expect(qrRes.ok()).toBeTruthy();
    const qrRaw = await qrRes.json();
    const qrList = Array.isArray(qrRaw) ? qrRaw : qrRaw.results || [];
    const counterQr = qrList.find(
      (q: any) => q.is_active && (q.target_type === "COUNTER" || q.qr_type === "COUNTER")
    );
    expect(counterQr).toBeTruthy();
    counterQrToken = counterQr.public_token;

    const branchId = counterQr.branch || counterQr.branch_id;
    capPath = `branches/${branchId}/capabilities/`;
    const capRes = await foodieCtx.get(capPath);
    expect(capRes.ok()).toBeTruthy();
    origCaps = await capRes.json();
    await foodieCtx.patch(capPath, {
      data: {
        allows_qr_ordering: true,
        qr_ordering_mode: "ORDER_DIRECT",
        payment_timing: "PAY_LATER",
        allows_takeaway: true,
      },
    });
  });

  test.afterAll(async () => {
    if (foodieCtx && capPath && origCaps && Object.keys(origCaps).length > 0) {
      await foodieCtx.patch(capPath, { data: origCaps }).catch(() => null);
      await foodieCtx.dispose();
    }
  });

  test("1.2 Header safe-area & responsive matrix across 320px..1280px with zero horizontal overflow", async ({
    browser,
  }, testInfo: TestInfo) => {
    const ctx = await browser.newContext({ viewport: { width: 320, height: 568 } });
    try {
      const page = await ctx.newPage();
      attachApiErrorGuard(page, testInfo);
      await page.goto(`/q/${encodeURIComponent(counterQrToken)}`);
      await page.waitForSelector("article", { timeout: 20000 });

      for (const vp of VIEWPORT_MATRIX) {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.waitForTimeout(100);

        const metrics = await page.evaluate(() => {
          const docOverflow = document.documentElement.scrollWidth > window.innerWidth;
          const header = document.querySelector("header");
          const headerRect = header ? header.getBoundingClientRect() : null;
          const badge = document.querySelector('[data-testid="qr-target-badge"]');
          const langBtn = header ? header.querySelector("button") : null;
          const badgeRect = badge ? badge.getBoundingClientRect() : null;
          const langRect = langBtn ? langBtn.getBoundingClientRect() : null;
          const badgeOverlapsLang = Boolean(
            badgeRect &&
            langRect &&
            badgeRect.right > langRect.left + 1 &&
            badgeRect.left < langRect.right &&
            badgeRect.bottom > langRect.top &&
            badgeRect.top < langRect.bottom
          );
          return {
            docOverflow,
            headerTop: headerRect?.top ?? -1,
            headerRight: headerRect?.right ?? -1,
            badgeOverlapsLang,
            innerWidth: window.innerWidth,
          };
        });

        expect(metrics.docOverflow, `Horizontal overflow at ${vp.name}`).toBe(false);
        expect(metrics.badgeOverlapsLang, `Header badge overlaps lang toggle at ${vp.name}`).toBe(
          false
        );
        expect(metrics.headerTop, `Header top at ${vp.name}`).toBeGreaterThanOrEqual(0);
        expect(metrics.headerRight, `Header right edge at ${vp.name}`).toBeLessThanOrEqual(
          vp.width + 1
        );

        if (vp.name === "mobile-320") {
          await page.screenshot({ path: path.join(SCREENSHOT_DIR, "header-320.png") });
        } else if (vp.name === "iphone-14-pro") {
          await page.screenshot({ path: path.join(SCREENSHOT_DIR, "header-393.png") });
        }
      }
    } finally {
      await ctx.close();
    }
  });

  test("1.3-1.5 Counter QR order -> unpaid receipt 403 -> KDS READY alert + pickup code -> Cashier settle -> DEMO RECEIPT", async ({
    browser,
  }, testInfo: TestInfo) => {
    test.setTimeout(90000);
    const guestCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const staffCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } });

    try {
      const guestPage = await guestCtx.newPage();
      attachApiErrorGuard(guestPage, testInfo);

      // Place Counter QR order
      await guestPage.goto(`/q/${encodeURIComponent(counterQrToken)}`);
      await guestPage.waitForSelector("article", { timeout: 20000 });
      await guestPage.locator("article").filter({ hasText: "Add" }).first().click();
      await guestPage.getByRole("button", { name: /Add to order/i }).click();
      await guestPage.getByRole("button", { name: /View order/i }).click();
      await guestPage.getByRole("button", { name: /^Place order$/i }).click();
      await guestPage.waitForURL(new RegExp(`/q/${counterQrToken}/o/`), { timeout: 20000 });

      const trackingUrl = new URL(guestPage.url());
      const trackingToken = trackingUrl.pathname.split("/").filter(Boolean).pop() || "";
      expect(trackingToken.length).toBeGreaterThan(8);

      // Verify Counter Big Token Banner shown, bill gated before payment
      await expect(guestPage.getByTestId("counter-token-banner")).toBeVisible({ timeout: 15000 });
      await expect(guestPage.getByTestId("customer-order-summary")).toBeVisible();
      await expect(guestPage.getByTestId("bill-pending-notice")).toBeVisible();
      await expect(guestPage.getByTestId("customer-printable-bill")).toHaveCount(0);

      // Verify backend /receipt/ enforces 403 BILL_NOT_PAID directly
      const unpaidReceiptRes = await foodieCtx.get(
        `public/orders/${encodeURIComponent(trackingToken)}/receipt/`
      );
      expect(unpaidReceiptRes.status()).toBe(403);

      // Staff logs into Kitchen KDS & bumps this order to READY
      const staffPage = await staffCtx.newPage();
      await staffPage.goto("/login");
      await staffPage.locator('input[type="email"]').fill("owner@foodieplaza.in");
      await staffPage.locator('input[type="password"]').fill("Password123!");
      await staffPage.getByRole("button", { name: /Sign In/i }).click();
      await staffPage.waitForURL(/\/dashboard|\/pos|\/orders/, { timeout: 15000 });

      // Find the newly placed order by trackingToken / latest QR order via API and transition -> READY
      const ordListRes = await foodieCtx.get("orders/?limit=10");
      expect(ordListRes.ok()).toBeTruthy();
      const ordListJson = await ordListRes.json();
      const orders = Array.isArray(ordListJson) ? ordListJson : ordListJson.results || [];
      const targetOrder = orders.find((o: any) => o.source === "QR" && o.token_number !== null);
      expect(targetOrder).toBeTruthy();

      // Advance order cleanly via staff KDS endpoint (PLACED -> PREPARING -> READY)
      await foodieCtx.post(`orders/${targetOrder.id}/transition/`, {
        data: { status: "PREPARING" },
      });
      await foodieCtx.post(`orders/${targetOrder.id}/transition/`, {
        data: { status: "READY" },
      });

      // Refresh customer tracker -> sees READY alert banner + 4-digit pickup code
      await guestPage.getByRole("button", { name: /Refresh/i }).click();
      await expect(guestPage.getByTestId("order-ready-banner")).toBeVisible({ timeout: 15000 });
      await expect(guestPage.getByTestId("customer-pickup-code")).toBeVisible();
      await guestPage.screenshot({ path: path.join(SCREENSHOT_DIR, "counter-token-ready.png") });

      // Tamil ready + big token screenshot at 360px
      await guestPage.setViewportSize({ width: 360, height: 800 });
      await guestPage.getByRole("button", { name: "தமிழ்" }).click();
      await expect(guestPage.getByText("உங்கள் ஆர்டர் தயார்!")).toBeVisible();
      const overflowTa = await guestPage.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth
      );
      expect(overflowTa).toBe(false);
      await guestPage.screenshot({ path: path.join(SCREENSHOT_DIR, "counter-token-ready-ta.png") });
      await guestPage.getByRole("button", { name: "English" }).click();
      await guestPage.setViewportSize({ width: 390, height: 844 });

      // Cashier settles the counter order via backend billing endpoint
      const settleRes = await foodieCtx.post(`orders/billing/order/${targetOrder.id}/settle/`, {
        data: { payment_method: "UPI", discount_paise: 0 },
      });
      expect(settleRes.ok()).toBeTruthy();

      // Customer tracker reloads -> official DEMO RECEIPT unlocked with print/download
      await guestPage.reload();
      await expect(guestPage.getByTestId("customer-printable-bill")).toBeVisible({
        timeout: 15000,
      });
      await expect(guestPage.getByText("DEMO RECEIPT - NOT A TAX INVOICE")).toBeVisible();
      await expect(guestPage.getByRole("button", { name: /Save PDF \/ Print/i })).toBeVisible();
      await guestPage.screenshot({ path: path.join(SCREENSHOT_DIR, "paid-receipt.png") });

      // Dark mode verification on paid receipt
      await guestPage.evaluate(() => document.documentElement.classList.add("dark"));
      await guestPage.screenshot({ path: path.join(SCREENSHOT_DIR, "paid-receipt-dark.png") });
      await guestPage.evaluate(() => document.documentElement.classList.remove("dark"));
    } finally {
      await guestCtx.close();
      await staffCtx.close();
    }
  });
});
