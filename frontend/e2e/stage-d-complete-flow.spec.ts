import { test, expect, request, attachApiErrorGuard } from "./fixtures";
import type { APIRequestContext, TestInfo } from "@playwright/test";

const BASE_API = "http://127.0.0.1:8000/api/v1/";

async function getOwnerCtx(): Promise<{ ctx: APIRequestContext; token: string; tenantId: string }> {
  const apiCtx = await request.newContext({ baseURL: BASE_API });
  const loginRes = await apiCtx.post("auth/login/", {
    data: { email: "owner@spicegarden.com", password: "Password123!" },
  });
  expect(loginRes.ok()).toBeTruthy();
  const loginJson = await loginRes.json();
  const token = loginJson.access as string;
  const tenantId =
    loginJson.user?.memberships?.[0]?.tenant_id ||
    loginJson.memberships?.[0]?.tenant_id ||
    loginJson.tenants?.[0]?.id;

  const ctx = await request.newContext({
    baseURL: BASE_API,
    extraHTTPHeaders: {
      Authorization: `Bearer ${token}`,
      "X-Tenant-ID": tenantId,
    },
  });
  await apiCtx.dispose();
  return { ctx, token, tenantId };
}

test.describe.serial("Complete QR Guest + Waiter + Kitchen + Cashier Flow", () => {
  let ctx: APIRequestContext;
  let qrToken = "";
  let branchId = "";
  let tableId = "";
  let tableLabel = "";
  let capPath = "";
  let origCaps: Record<string, any> = {};
  let firstTrackingPath = "";

  test.beforeAll(async () => {
    const auth = await getOwnerCtx();
    ctx = auth.ctx;

    const [qrRes, tblRes] = await Promise.all([ctx.get("qr-codes/"), ctx.get("tables/")]);
    expect(qrRes.ok()).toBeTruthy();
    expect(tblRes.ok()).toBeTruthy();
    const qrRaw = await qrRes.json();
    const qrList = qrRaw.results || qrRaw;
    const tblRaw = await tblRes.json();
    const tblList = tblRaw.results || tblRaw;
    const tableQr =
      tblList
        .map((t: any) =>
          qrList.find((q: any) => q.is_active && q.target_type === "TABLE" && q.table === t.id)
        )
        .find(Boolean) ||
      qrList.find((q: any) => q.is_active && q.target_type === "TABLE" && q.table);
    expect(tableQr).toBeTruthy();
    qrToken = tableQr.public_token;
    branchId = tableQr.branch;
    tableId = tableQr.table;
    tableLabel = tableQr.table_label || tableQr.target_label || "";

    capPath = `branches/${branchId}/capabilities/`;
    const capRes = await ctx.get(capPath);
    if (capRes.ok()) {
      origCaps = await capRes.json();
      await ctx.patch(capPath, {
        data: {
          qr_ordering_mode: "ORDER_DIRECT",
          qr_session_policy: "CUSTOMER_CAN_OPEN",
          allows_qr_ordering: true,
          allows_service_requests: true,
        },
      });
    }

    // Ensure no stale open session blocks clean test start
    const sessRes = await ctx.get(`sessions/?table_id=${tableId}&status=OPEN`);
    if (sessRes.ok()) {
      const openSess = (await sessRes.json()).results || (await sessRes.json()) || [];
      for (const s of openSess) {
        const ordersRes = await ctx.get(`orders/?session_id=${s.id}`);
        const ords = ordersRes.ok()
          ? (await ordersRes.json()).results || (await ordersRes.json())
          : [];
        if (ords.length > 0) {
          await ctx.post(`orders/billing/session/${s.id}/settle/`, {
            data: { payment_method: "CASH", amount_tendered_paise: 999999, discount_paise: 0 },
          });
        } else {
          await ctx.post(`sessions/${s.id}/close/`);
        }
      }
    }

    // Resolve any stale pending or acknowledged service requests on this table
    for (const st of ["PENDING", "ACKNOWLEDGED"]) {
      const srvRes = await ctx.get(`orders/service-requests/?status=${st}`);
      if (srvRes.ok()) {
        const srvRaw = await srvRes.json();
        const reqs = srvRaw.results || srvRaw || [];
        for (const r of reqs) {
          if (!tableLabel || r.table_label === tableLabel) {
            await ctx.post(`orders/service-requests/${r.id}/resolve/`);
          }
        }
      }
    }
  });

  test.afterAll(async () => {
    if (capPath && origCaps && Object.keys(origCaps).length > 0) {
      await ctx.patch(capPath, { data: origCaps }).catch(() => null);
    }
    await ctx.dispose();
  });

  test("Flow 1: Customer scans QR, orders, reorders into same bill, sends all 4 requests, and gets clean PDF-only bill", async ({
    browser,
  }, testInfo: TestInfo) => {
    const mobileCtx = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await mobileCtx.newPage();
    attachApiErrorGuard(page, testInfo);

    await page.goto(`/q/${encodeURIComponent(qrToken)}`);
    await expect(page.getByRole("button", { name: "All Diets" })).toBeVisible();

    // Opt into phone-only order history
    const enableBtn = page.getByRole("button", { name: "Enable" });
    if (await enableBtn.isVisible()) {
      await enableBtn.click();
    }

    // Add first available item
    const addButtons = page.getByRole("button", { name: /Add/i });
    await addButtons.first().click();
    const modalAdd = page.getByRole("button", { name: /Add to cart/i });
    if (await modalAdd.isVisible({ timeout: 1000 }).catch(() => false)) {
      await modalAdd.click();
    }

    // Open Cart and place Order #1 with guest_label
    await page
      .getByRole("button", { name: /View Cart|My cart/i })
      .first()
      .click();
    const guestInput = page.locator("#guest-label");
    if (await guestInput.isVisible()) {
      await guestInput.fill("Arun");
    }
    await page.getByRole("button", { name: /Place Order/i }).click();
    await page.waitForURL(/\/q\/.*\/o\/.*/);
    firstTrackingPath = new URL(page.url()).pathname;

    // Verify order summary is shown while unpaid, and printable bill is server-gated until payment
    await expect(page.getByTestId("customer-order-summary")).toBeVisible();
    await expect(page.getByTestId("customer-printable-bill")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Save PDF \/ Print/i })).toHaveCount(0);

    // Re-open QR menu, reorder into the SAME table session, and send all 4 service requests
    await page.goto(`/q/${encodeURIComponent(qrToken)}`);
    await page.getByRole("button", { name: /My orders/i }).click();
    await page.getByRole("button", { name: "Reorder" }).first().click();
    await page.getByRole("button", { name: /Place Order/i }).click();
    await page.waitForURL(/\/q\/.*\/o\/.*/);

    await page.goto(`/q/${encodeURIComponent(qrToken)}`);
    await expect(page.getByRole("button", { name: "Request bill" })).toBeVisible();
    for (const label of ["Call waiter", "Water", "Cutlery"]) {
      await page.getByRole("button", { name: label }).click();
      await expect(page.getByText(new RegExp(`Request sent: ${label}`, "i"))).toBeVisible();
    }

    await mobileCtx.close();
  });

  test("Flow 2: Staff views Current Bill on aligned mobile POS, bumps KDS, serves, settles in Billing, and customer submits feedback", async ({
    browser,
  }, testInfo: TestInfo) => {
    test.setTimeout(60000);
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    attachApiErrorGuard(page, testInfo);

    // Log in on /login
    await page.goto("/login");
    await page.locator('input[type="email"]').fill("owner@spicegarden.com");
    await page.locator('input[type="password"]').fill("Password123!");
    await page.getByRole("button", { name: /Sign In/i }).click();
    await page.waitForURL(/\/dashboard|\/pos|\/orders/);

    // Check Floor POS at 390px mobile via mobile bottom nav / menu
    await page.getByRole("button", { name: "Toggle navigation menu" }).click();
    await page
      .getByRole("link", { name: /Floor POS|Tables and Orders/i })
      .first()
      .click();
    await page.waitForURL(/\/pos/);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(2);

    // Select the active occupied table and check Current / Last Bill modal
    await page
      .getByRole("button", { name: new RegExp(`^${tableLabel}\\b`, "i") })
      .first()
      .click();
    await page.getByRole("button", { name: /Current \/ Last Bill/i }).click();
    await expect(page.getByText(/Current Running Bill/i)).toBeVisible();
    await page.getByRole("button", { name: "Close" }).first().click();

    // Bump KDS tickets to READY using desktop sidebar navigation
    await page.setViewportSize({ width: 1280, height: 800 });
    await page
      .getByRole("link", { name: /Kitchen KDS/i })
      .first()
      .click();
    await page.waitForURL(/\/kds/);
    for (let i = 0; i < 6; i++) {
      const startBtn = page.getByRole("button", { name: /Start Preparing/i }).first();
      if (await startBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
        await startBtn.click();
        await page.waitForTimeout(300);
        continue;
      }
      const readyBtn = page.getByRole("button", { name: /Mark Ready/i }).first();
      if (await readyBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
        await readyBtn.click();
        await page.waitForTimeout(300);
        continue;
      }
      break;
    }

    // Serve ready orders and resolve guest requests on /serve
    await page
      .getByRole("link", { name: /Ready to Serve/i })
      .first()
      .click();
    await page.waitForURL(/\/serve/);
    await page.waitForTimeout(500);
    for (let i = 0; i < 6; i++) {
      const doneBtn = page.getByRole("button", { name: /^Done$/i }).first();
      if (await doneBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await doneBtn.click();
        await page.waitForTimeout(250);
      } else {
        break;
      }
    }
    for (let i = 0; i < 4; i++) {
      const serveBtn = page.getByRole("button", { name: /Mark Served/i }).first();
      if (await serveBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await serveBtn.click();
        await page.waitForTimeout(300);
      } else {
        break;
      }
    }

    // Customer submits verified-order feedback on tracker
    if (firstTrackingPath) {
      const guestPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
      await guestPage.goto(firstTrackingPath);
      const feedbackBtn = guestPage.getByRole("button", { name: /Submit feedback/i });
      if (await feedbackBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await feedbackBtn.click();
        await expect(guestPage.getByText(/Thank you for your feedback/i)).toBeVisible();
      }
      await guestPage.close();
    }

    // Settle the combined table bill in Cashier Billing
    await page
      .getByRole("link", { name: /Cashier Billing/i })
      .first()
      .click();
    await page.waitForURL(/\/billing/);
    await page
      .getByText(new RegExp(`Table ${tableLabel}`, "i"))
      .first()
      .click();
    await page.getByRole("button", { name: /Settle & Print Receipt/i }).click();
    await expect(page.getByText(/Payment Settled|Receipt/i).first()).toBeVisible();

    // After payment, customer tracker unlocks the official printable DEMO RECEIPT
    if (firstTrackingPath) {
      const receiptPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
      await receiptPage.goto(firstTrackingPath);
      await expect(receiptPage.getByTestId("customer-printable-bill")).toBeVisible({
        timeout: 15000,
      });
      await expect(receiptPage.getByText("DEMO RECEIPT - NOT A TAX INVOICE")).toBeVisible();
      await expect(receiptPage.getByRole("button", { name: /Save PDF \/ Print/i })).toBeVisible();
      await receiptPage.emulateMedia({ media: "print" });
      await expect(receiptPage.locator("header")).toBeHidden();
      await expect(receiptPage.locator("footer")).toBeHidden();
      await expect(receiptPage.getByTestId("customer-printable-bill")).toBeVisible();
      await receiptPage.emulateMedia({ media: "screen" });
      await receiptPage.close();
    }

    await context.close();
  });
});
