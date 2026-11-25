import { test, expect, request, attachApiErrorGuard } from "./fixtures";
import type { APIRequestContext, TestInfo } from "@playwright/test";
import path from "path";
import fs from "fs";

const SCREENSHOT_DIR = path.resolve(process.cwd(), "../docs/evidence/stage2");
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

test.describe.serial("Stage 2 Token Slip, Token TV & Call (Live Stack, Real Backend)", () => {
  let foodieCtx: APIRequestContext;
  let counterQrToken = "";
  let capPath = "";
  let origCaps: Record<string, any> = {};
  let menuItemId = "";
  const createdOrderIds: string[] = [];

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
    if (capRes.ok()) {
      origCaps = await capRes.json();
      await foodieCtx.patch(capPath, {
        data: {
          allows_qr_ordering: true,
          qr_ordering_mode: "ORDER_DIRECT",
          payment_timing: "PAY_LATER",
          allows_takeaway: true,
        },
      });
    }

    const menuRes = await foodieCtx.get("menu/items/");
    expect(menuRes.ok()).toBeTruthy();
    const menuRaw = await menuRes.json();
    const menuList = Array.isArray(menuRaw) ? menuRaw : menuRaw.results || [];
    expect(menuList.length).toBeGreaterThan(0);
    menuItemId = menuList[0].id;
  });

  test.afterAll(async () => {
    if (foodieCtx) {
      for (const oid of createdOrderIds) {
        await foodieCtx
          .post(`orders/${oid}/cancel/`, { data: { reason: "E2E cleanup" } })
          .catch(() => null);
      }
      if (capPath && origCaps && Object.keys(origCaps).length > 0) {
        await foodieCtx.patch(capPath, { data: origCaps }).catch(() => null);
      }
      await foodieCtx.dispose();
    }
  });

  test("2.1 Server-assigned Token Slip on POS and live Token TV Call workflow", async ({
    browser,
  }, testInfo: TestInfo) => {
    // 1. Place two real counter orders without client-guessed token numbers
    const prepRes = await foodieCtx.post("orders/", {
      data: {
        order_workflow: "COUNTER_TOKEN",
        items: [{ menu_item_id: menuItemId, quantity: 1 }],
      },
    });
    expect(prepRes.status()).toBe(201);
    const prepOrd = await prepRes.json();
    createdOrderIds.push(prepOrd.id);
    expect(typeof prepOrd.token_number).toBe("number");

    const readyRes = await foodieCtx.post("orders/", {
      data: {
        order_workflow: "COUNTER_TOKEN",
        items: [{ menu_item_id: menuItemId, quantity: 2 }],
      },
    });
    expect(readyRes.status()).toBe(201);
    const readyOrd = await readyRes.json();
    createdOrderIds.push(readyOrd.id);
    expect(readyOrd.token_number).toBe(prepOrd.token_number + 1);

    // 2. Staff opens POS in live browser, fires a counter order & gets Token Slip Modal
    const staffCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    try {
      const staffPage = await staffCtx.newPage();
      attachApiErrorGuard(staffPage, testInfo);
      await staffPage.goto("/login");
      await staffPage.getByPlaceholder("name@restaurant.com").fill("owner@foodieplaza.in");
      await staffPage.getByPlaceholder("••••••••").fill("Password123!");
      await staffPage.getByRole("button", { name: /Sign In|உள்நுழைக/i }).click();
      await staffPage.waitForURL("**/dashboard", { timeout: 15000 });

      await staffPage.goto("/pos");
      const addBtn = staffPage.getByRole("button", { name: /^Add .* to order$/i }).first();
      await expect(addBtn).toBeVisible({ timeout: 15000 });
      await addBtn.click();

      const fireBtn = staffPage.getByRole("button", { name: /Fire Order to Kitchen/i });
      await expect(fireBtn).toBeEnabled({ timeout: 10000 });
      const [postOrdResp] = await Promise.all([
        staffPage.waitForResponse((r) => r.url().includes("/api/v1/orders/") && r.request().method() === "POST"),
        fireBtn.click(),
      ]);
      expect(postOrdResp.status()).toBe(201);
      const posOrdJson = await postOrdResp.json();
      createdOrderIds.push(posOrdJson.id);
      expect(posOrdJson.token_number).toBe(readyOrd.token_number + 1);

      await expect(staffPage.getByTestId("token-slip-modal")).toBeVisible({ timeout: 10000 });
      await expect(staffPage.getByTestId("token-slip-number")).toContainText(`#${posOrdJson.token_number}`);
      await expect(staffPage.getByText("TOKEN SLIP - NOT A TAX INVOICE")).toBeVisible();

      if (testInfo.project.name === "chromium") {
        await staffPage.screenshot({
          path: path.join(SCREENSHOT_DIR, "token-slip-desktop.png"),
        });
      }
    } finally {
      await staffCtx.close();
    }

    // 3. Call readyOrd token via API (`POST /orders/<id>/call/`) and inspect Public Token TV
    const callRes = await foodieCtx.post(`orders/${readyOrd.id}/call/`, { data: {} });
    expect(callRes.status()).toBe(200);
    const calledJson = await callRes.json();
    expect(calledJson.status).toBe("READY");
    expect(calledJson.call_count).toBeGreaterThanOrEqual(1);

    const tvCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    try {
      const tvPage = await tvCtx.newPage();
      attachApiErrorGuard(tvPage, testInfo);
      await tvPage.goto(`/tv/${encodeURIComponent(counterQrToken)}`);
      await expect(tvPage.getByTestId("tv-now-calling")).toBeVisible({ timeout: 15000 });
      await expect(tvPage.getByTestId("tv-now-calling")).toContainText(`#${readyOrd.token_number}`);
      await expect(tvPage.getByTestId(`tv-ready-token-${readyOrd.token_number}`)).toBeVisible();
      await expect(tvPage.getByTestId(`tv-preparing-token-${prepOrd.token_number}`)).toBeVisible();

      if (testInfo.project.name === "chromium") {
        await tvPage.screenshot({
          path: path.join(SCREENSHOT_DIR, "token-tv-desktop.png"),
          fullPage: true,
        });

        await tvPage.getByTestId("tv-lang-toggle").click();
        await expect(tvPage.getByText("தற்போது அழைக்கப்படுகிறது")).toBeVisible();
        await tvPage.screenshot({
          path: path.join(SCREENSHOT_DIR, "token-tv-tamil.png"),
          fullPage: true,
        });

        await tvPage.getByTestId("tv-theme-toggle").click();
        await tvPage.screenshot({
          path: path.join(SCREENSHOT_DIR, "token-tv-light.png"),
          fullPage: true,
        });
      }

      // Check zero horizontal scroll at 320px
      await tvPage.setViewportSize({ width: 320, height: 568 });
      const overflow = await tvPage.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth
      );
      expect(overflow).toBe(false);
    } finally {
      await tvCtx.close();
    }
  });

  test("[negative] Invalid Token TV route returns generic unavailable card", async ({
    browser,
  }, testInfo: TestInfo) => {
    const ctx = await browser.newContext({ viewport: { width: 393, height: 852 } });
    try {
      const page = await ctx.newPage();
      attachApiErrorGuard(page, testInfo);
      await page.goto("/tv/invalid-token-tv-xyz");
      await expect(page.getByTestId("tv-unavailable")).toBeVisible({ timeout: 10000 });
      await expect(page.getByText("Display unavailable")).toBeVisible();
    } finally {
      await ctx.close();
    }
  });
});
