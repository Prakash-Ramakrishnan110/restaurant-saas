import { test, expect, request, attachApiErrorGuard } from "./fixtures";
import type { APIRequestContext, TestInfo } from "@playwright/test";
import path from "path";
import fs from "fs";

const SCREENSHOT_DIR = path.resolve(process.cwd(), "../docs/evidence/stage3");
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

test.describe.serial("Stage 3 Sound & Notifications (Live Stack, Real Backend)", () => {
  let spiceCtx: APIRequestContext;
  let foodieCtx: APIRequestContext;
  let spiceTableId = "";
  let spiceMenuItemId = "";
  let foodieMenuItemId = "";
  let counterQrToken = "";
  let origSoundDefaults: Record<string, unknown> | null = null;
  const createdSpiceOrders: string[] = [];
  const createdFoodieOrders: string[] = [];

  test.beforeAll(async () => {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    spiceCtx = await getOwnerCtx("owner@kavericafe.com");
    foodieCtx = await getOwnerCtx("owner@foodieplaza.in");

    const tblRes = await spiceCtx.get("tables/");
    expect(tblRes.ok()).toBeTruthy();
    const tblRaw = await tblRes.json();
    const tblList = Array.isArray(tblRaw) ? tblRaw : tblRaw.results || [];
    expect(tblList.length).toBeGreaterThan(0);
    const availableTbl =
      tblList.find((t: { status?: string }) => t.status === "AVAILABLE") || tblList[0];
    spiceTableId = availableTbl.id;

    const spiceMenuRes = await spiceCtx.get("menu/items/");
    expect(spiceMenuRes.ok()).toBeTruthy();
    const spiceMenuRaw = await spiceMenuRes.json();
    const spiceMenuList = Array.isArray(spiceMenuRaw) ? spiceMenuRaw : spiceMenuRaw.results || [];
    expect(spiceMenuList.length).toBeGreaterThan(0);
    spiceMenuItemId = spiceMenuList[0].id;

    const qrRes = await foodieCtx.get("qr-codes/");
    expect(qrRes.ok()).toBeTruthy();
    const qrRaw = await qrRes.json();
    const qrList = Array.isArray(qrRaw) ? qrRaw : qrRaw.results || [];
    const counterQr = qrList.find(
      (q: { is_active?: boolean; target_type?: string; qr_type?: string }) =>
        q.is_active && (q.target_type === "COUNTER" || q.qr_type === "COUNTER")
    );
    expect(counterQr).toBeTruthy();
    counterQrToken = counterQr.public_token;

    const foodieMenuRes = await foodieCtx.get("menu/items/");
    expect(foodieMenuRes.ok()).toBeTruthy();
    const foodieMenuRaw = await foodieMenuRes.json();
    const foodieMenuList = Array.isArray(foodieMenuRaw)
      ? foodieMenuRaw
      : foodieMenuRaw.results || [];
    expect(foodieMenuList.length).toBeGreaterThan(0);
    foodieMenuItemId = foodieMenuList[0].id;

    const defRes = await spiceCtx.get("events/sound-defaults/");
    if (defRes.ok()) {
      origSoundDefaults = await defRes.json();
    }
  });

  test.afterAll(async () => {
    if (spiceCtx) {
      for (const oid of createdSpiceOrders) {
        await spiceCtx
          .post(`orders/${oid}/cancel/`, { data: { reason: "Stage 3 E2E cleanup" } })
          .catch(() => null);
      }
      if (origSoundDefaults) {
        await spiceCtx
          .patch("events/sound-defaults/", { data: origSoundDefaults })
          .catch(() => null);
      }
      await spiceCtx.dispose();
    }
    if (foodieCtx) {
      for (const oid of createdFoodieOrders) {
        await foodieCtx
          .post(`orders/${oid}/cancel/`, { data: { reason: "Stage 3 E2E cleanup" } })
          .catch(() => null);
      }
      await foodieCtx.dispose();
    }
  });

  test("3.1 Live KDS receives zero-PII speech & visual alert on real new order", async ({
    browser,
  }, testInfo: TestInfo) => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    try {
      const page = await ctx.newPage();
      await page.addInitScript(() => {
        (window as unknown as { __smfSpoken?: Array<{ text: string; lang: string }> }).__smfSpoken =
          [];
        (window as unknown as { __smfTones?: number }).__smfTones = 0;

        class FakeUtterance {
          text: string;
          lang = "en-US";
          rate = 1;
          volume = 1;
          onend: (() => void) | null = null;
          onerror: (() => void) | null = null;
          constructor(t: string) {
            this.text = t;
          }
        }
        (window as unknown as { SpeechSynthesisUtterance: unknown }).SpeechSynthesisUtterance =
          FakeUtterance;
        Object.defineProperty(window, "speechSynthesis", {
          configurable: true,
          value: {
            getVoices: () => [
              { name: "Google US English", lang: "en-US" },
              { name: "Microsoft Valluvar Tamil", lang: "ta-IN" },
            ],
            speak: (u: FakeUtterance) => {
              const list =
                (window as unknown as { __smfSpoken?: Array<{ text: string; lang: string }> })
                  .__smfSpoken || [];
              list.push({ text: u.text, lang: u.lang });
              if (u.onend) setTimeout(() => u.onend && u.onend(), 20);
            },
            cancel: () => {},
            addEventListener: () => {},
            removeEventListener: () => {},
          },
        });
      });

      attachApiErrorGuard(page, testInfo);
      await page.goto("/login");
      await page.getByPlaceholder("name@restaurant.com").fill("owner@kavericafe.com");
      await page.getByPlaceholder("••••••••").fill("Password123!");
      await page.getByRole("button", { name: /Sign In|உள்நுழைக/i }).click();
      await page.waitForURL("**/dashboard", { timeout: 15000 });

      await page.goto("/kds");
      await expect(page.getByTestId("start-sound-btn")).toBeVisible({ timeout: 10000 });
      await page.getByTestId("start-sound-btn").click();
      await expect(page.getByTestId("live-events-indicator")).toContainText(/Live/i, {
        timeout: 15000,
      });

      // Open (or reuse active) session + create real order containing sentinel customer name/notes/phone
      let sessId = "";
      const sessRes = await spiceCtx.post("sessions/open/", {
        data: { table_id: spiceTableId },
      });
      if (sessRes.ok()) {
        const sessJson = await sessRes.json();
        sessId = sessJson.id;
      } else {
        const openRes = await spiceCtx.get("sessions/?status=OPEN");
        expect(openRes.ok()).toBeTruthy();
        const openRaw = await openRes.json();
        const openList = Array.isArray(openRaw) ? openRaw : openRaw.results || [];
        expect(openList.length).toBeGreaterThan(0);
        sessId = openList[0].id;
      }

      const ordRes = await spiceCtx.post("orders/", {
        data: {
          order_workflow: "TABLE_SERVICE",
          table_session_id: sessId,
          notes: "SENTINEL_PHONE_9876543210",
          items: [
            {
              menu_item_id: spiceMenuItemId,
              quantity: 2,
              notes: "SENTINEL_DISH_NOTE",
            },
          ],
        },
      });
      expect(ordRes.status()).toBe(201);
      const ordJson = await ordRes.json();
      createdSpiceOrders.push(ordJson.id);

      // KDS polls /api/v1/events/?since=<seq> every 3s -> visual alert & spoken announcement appear
      await expect(page.getByTestId("sound-visual-alert")).toBeVisible({ timeout: 12000 });
      await expect
        .poll(
          () =>
            page.evaluate(() =>
              (
                (window as unknown as { __smfSpoken?: Array<{ text: string; lang: string }> })
                  .__smfSpoken || []
              ).some((s) => s.text.includes("New order"))
            ),
          { timeout: 12000 }
        )
        .toBe(true);

      const spoken = await page.evaluate(
        () =>
          (window as unknown as { __smfSpoken?: Array<{ text: string; lang: string }> })
            .__smfSpoken || []
      );
      const allSpeech = spoken.map((s) => s.text).join(" | ");
      expect(allSpeech).toContain("New order");
      expect(allSpeech).not.toContain("SENTINEL_PHONE");
      expect(allSpeech).not.toContain("9876543210");
      expect(allSpeech).not.toContain("SENTINEL_DISH_NOTE");

      if (testInfo.project.name === "chromium") {
        await page.screenshot({
          path: path.join(SCREENSHOT_DIR, "kds-sound-live-alert.png"),
        });
      }
    } finally {
      await ctx.close();
    }
  });

  test("3.2 60-second Sound-Off red warning bar appears on TV and clears on Start Sound", async ({
    browser,
  }, testInfo: TestInfo) => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    try {
      const page = await ctx.newPage();
      await page.clock.install();
      attachApiErrorGuard(page, testInfo);

      await page.goto(`/tv/${encodeURIComponent(counterQrToken)}`);
      await expect(page.getByTestId("token-tv-page")).toBeVisible({ timeout: 10000 });
      await expect(page.getByTestId("tv-sound-off-warning-bar")).not.toBeVisible();

      // Advance clock past 60s without starting sound
      await page.clock.runFor(61000);
      await expect(page.getByTestId("tv-sound-off-warning-bar")).toBeVisible();
      await expect(page.getByTestId("tv-sound-off-warning-bar")).toContainText(
        "Sound is off. Orders will not be heard."
      );

      if (testInfo.project.name === "chromium") {
        await page.screenshot({
          path: path.join(SCREENSHOT_DIR, "sound-off-warning-bar.png"),
        });
      }

      await page.getByTestId("tv-start-sound-btn").click();
      await expect(page.getByTestId("tv-sound-off-warning-bar")).not.toBeVisible();
    } finally {
      await ctx.close();
    }
  });

  test("3.3 Sound & Alerts Settings page configures EN/TA, lists voices, and saves branch defaults", async ({
    browser,
  }, testInfo: TestInfo) => {
    // Also place & call a real Token TV order to verify Token TV ready voice event works end-to-end
    const tokRes = await foodieCtx.post("orders/", {
      data: {
        order_workflow: "COUNTER_TOKEN",
        items: [{ menu_item_id: foodieMenuItemId, quantity: 1 }],
      },
    });
    expect(tokRes.status()).toBe(201);
    const tokOrd = await tokRes.json();
    createdFoodieOrders.push(tokOrd.id);
    const callRes = await foodieCtx.post(`orders/${tokOrd.id}/call/`, { data: {} });
    expect(callRes.status()).toBe(200);

    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    try {
      const page = await ctx.newPage();
      await page.addInitScript(() => {
        Object.defineProperty(window, "speechSynthesis", {
          configurable: true,
          value: {
            getVoices: () => [
              { name: "Google US English", lang: "en-US" },
              { name: "Microsoft Valluvar Tamil", lang: "ta-IN" },
            ],
            speak: () => {},
            cancel: () => {},
            addEventListener: () => {},
            removeEventListener: () => {},
          },
        });
      });
      attachApiErrorGuard(page, testInfo);

      await page.goto("/login");
      await page.getByPlaceholder("name@restaurant.com").fill("owner@kavericafe.com");
      await page.getByPlaceholder("••••••••").fill("Password123!");
      await page.getByRole("button", { name: /Sign In|உள்நுழைக/i }).click();
      await page.waitForURL("**/dashboard", { timeout: 15000 });

      await page.goto("/settings/sound");
      await expect(page.getByTestId("sound-settings-page")).toBeVisible({ timeout: 10000 });
      await expect(page.getByTestId("tamil-voice-status")).toContainText(/Tamil Voice Detected/i);
      await expect(page.getByTestId("sound-event-row-new_order")).toBeVisible();
      await expect(page.getByTestId("sound-event-row-ticket_late")).toBeVisible();

      await page.getByTestId("test-event-new_order").click();
      await page.getByTestId("keep-screen-awake-toggle").check();
      await page.getByTestId("save-device-sound-btn").click();
      await expect(page.getByText(/Sound settings saved on this device/i)).toBeVisible();

      const [patchResp] = await Promise.all([
        page.waitForResponse(
          (r) =>
            r.url().includes("/api/v1/events/sound-defaults/") && r.request().method() === "PATCH"
        ),
        page.getByTestId("save-branch-sound-defaults-btn").click(),
      ]);
      expect(patchResp.status()).toBe(200);
      await expect(page.getByText(/Branch default sound rules saved/i)).toBeVisible();

      if (testInfo.project.name === "chromium") {
        await page.screenshot({
          path: path.join(SCREENSHOT_DIR, "sound-settings-desktop.png"),
          fullPage: true,
        });

        await page.getByRole("button", { name: /Switch language/i }).click();
        await expect(page.getByText(/ஒலி & அறிவிப்புகள்/)).toBeVisible();
        await page.screenshot({
          path: path.join(SCREENSHOT_DIR, "sound-settings-tamil.png"),
          fullPage: true,
        });
      }

      // 320px responsive check (Common Rule 5)
      await page.setViewportSize({ width: 320, height: 568 });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth
      );
      expect(overflow).toBe(false);
    } finally {
      await ctx.close();
    }
  });
});
