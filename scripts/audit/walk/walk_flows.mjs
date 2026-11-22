import fs from "fs";
import path from "path";
import { runScreenAudit, waitUntilContentReady, BASE_DIR } from "./inspect_helper.mjs";

const FRONTEND_MODULES = path.join(BASE_DIR, "frontend/node_modules");
const { chromium } = await import(
  `file://${path.join(FRONTEND_MODULES, "@playwright/test/index.mjs").replace(/\\/g, "/")}`
);

const BASE_URL = "http://127.0.0.1:5173";
const SEED_PATH = path.join(BASE_DIR, "docs/audit/walk/raw/seed_context.json");
const RAW_WALK_PATH = path.join(BASE_DIR, "docs/audit/walk/raw/walk_raw.json");
const RAW_TIMING_PATH = path.join(BASE_DIR, "docs/audit/walk/raw/flow_timings.json");
const SHOTS_DIR = path.join(BASE_DIR, "docs/audit/walk/shots");

const seed = JSON.parse(fs.readFileSync(SEED_PATH, "utf8"));
const VIEWPORTS = [
  { name: "mobile", width: 390, height: 844, hasTouch: true, isMobile: true },
  { name: "desktop", width: 1440, height: 900, hasTouch: false, isMobile: false },
];

const results = [];
const flowTimings = [];

function attachCollectors(page) {
  const httpErrors = [];
  const consoleErrors = [];
  const pageErrors = [];
  page.on("response", (res) => {
    if (res.status() >= 400) {
      httpErrors.push({
        status: res.status(),
        method: res.request().method(),
        url: res.url().replace(BASE_URL, ""),
      });
    }
  });
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text().slice(0, 220));
  });
  page.on("pageerror", (err) => {
    pageErrors.push(String(err).slice(0, 220));
  });
  return {
    reset() {
      httpErrors.length = 0;
      consoleErrors.length = 0;
      pageErrors.length = 0;
    },
    snapshot() {
      return {
        httpErrors: [...httpErrors],
        consoleErrors: [...consoleErrors],
        pageErrors: [...pageErrors],
      };
    },
  };
}

async function createCtx(browser, vp) {
  return browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    hasTouch: vp.hasTouch,
    isMobile: vp.isMobile,
  });
}

async function loginStaff(page, col, email, password = "Password123!") {
  col.reset();
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded", timeout: 25000 }).catch(() => {});
    const found = await page.waitForSelector('input[type="email"]', { timeout: 20000 }).then(() => true).catch(() => false);
    if (found) break;
    await page.waitForTimeout(1000);
  }
  await page.waitForSelector('input[type="email"]', { timeout: 15000 });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await Promise.race([
    page.waitForURL((u) => !u.pathname.endsWith("/login"), { timeout: 15000 }),
    page.waitForTimeout(4500),
  ]).catch(() => {});
  await waitUntilContentReady(page);
  await page.waitForTimeout(400);
}

// Navigate cleanly inside SPA via History API + React Router popstate to preserve inMemoryAccessToken,
// while also catching real auth drops separately if they occur!
async function spaNav(page, col, routePath) {
  col.reset();
  const curUrl = page.url();
  if (!curUrl.startsWith(BASE_URL) || curUrl.includes("/login")) {
    await page.goto(`${BASE_URL}${routePath}`, { waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => {});
  } else {
    await page.evaluate((target) => {
      window.history.pushState({}, "", target);
      window.dispatchEvent(new PopStateEvent("popstate"));
    }, routePath);
  }
  await page.waitForTimeout(500);
  await waitUntilContentReady(page);
  await page.waitForTimeout(350);
}

async function safeNav(page, col, routePath) {
  col.reset();
  await page.goto(`${BASE_URL}${routePath}`, { waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(500);
  await waitUntilContentReady(page);
  await page.waitForTimeout(350);
}

async function recordStep(flowId, stepId, role, vp, page, col, extra = {}) {
  const shotPath = path.join(SHOTS_DIR, flowId, `${vp.name}__${stepId}.png`);
  const logs = col.snapshot();
  const audit = await runScreenAudit(page, {
    flowId,
    stepId,
    viewportName: vp.name,
    shotPath,
    isCounterVenue: Boolean(extra.isCounterVenue),
    checkTamil: Boolean(extra.checkTamil),
    httpErrors: logs.httpErrors,
    consoleErrors: logs.consoleErrors,
    pageErrors: logs.pageErrors,
  });
  let status = extra.forcedStatus || "PASS";
  let note = extra.note || "";
  if (status === "PASS") {
    if (logs.pageErrors.length > 0) {
      status = "FAIL";
      note = `Uncaught page error: ${logs.pageErrors[0]}`;
    } else if (
      logs.httpErrors.some((e) => e.status >= 500) ||
      (logs.httpErrors.length > 0 && !extra.allowExpectedHttpErrors)
    ) {
      status = "FAIL";
      note = `HTTP ${logs.httpErrors.map((e) => `${e.status} ${e.url}`).join("; ")}`;
    }
  }
  const entry = {
    flowId,
    stepId,
    role,
    viewport: `${vp.width}x${vp.height}`,
    status,
    note,
    ...audit,
  };
  results.push(entry);
  col.reset();
  return entry;
}

async function walkCustomerQrOrder(page, col, token) {
  let taps = 0;
  await safeNav(page, col, `/q/${token}`);
  // Wait specifically for menu item Add button or browse banner
  await Promise.race([
    page.locator("button:has-text('Add')").first().waitFor({ state: "visible", timeout: 8000 }),
    page.waitForTimeout(3000),
  ]).catch(() => {});

  const addBtn = page.locator("button:has-text('Add')").first();
  if ((await addBtn.count()) > 0 && (await addBtn.isEnabled())) {
    await addBtn.click();
    taps++;
    await page.waitForTimeout(450);
    const confirmModalBtn = page.locator('[role="dialog"] button:has-text("Add")').last();
    if ((await confirmModalBtn.count()) > 0 && (await confirmModalBtn.isVisible())) {
      await confirmModalBtn.click();
      taps++;
      await page.waitForTimeout(350);
    }
  } else {
    return { ok: false, reason: "No enabled Add button found on menu", taps };
  }

  const viewCartBtn = page
    .locator("button:has-text('View order'), button:has-text('Cart'), button:has-text('Order')")
    .last();
  if ((await viewCartBtn.count()) > 0 && (await viewCartBtn.isVisible())) {
    await viewCartBtn.click();
    taps++;
    await page.waitForTimeout(400);
  }

  const placeBtn = page.locator('[role="dialog"] button:has-text("Place Order")').first();
  if ((await placeBtn.count()) > 0 && (await placeBtn.isEnabled())) {
    await placeBtn.click();
    taps++;
    await Promise.race([
      page.waitForURL(/\/q\/.+\/o\/.+/, { timeout: 10000 }),
      page.waitForTimeout(4500),
    ]).catch(() => {});
    await waitUntilContentReady(page);
    await page.waitForTimeout(400);
    return { ok: /\/q\/.+\/o\/.+/.test(page.url()), trackingUrl: page.url(), taps };
  }
  return { ok: false, reason: "Place Order button missing or disabled", taps };
}

async function runAllFlows() {
  const browser = await chromium.launch({ headless: true });

  const spiceQrs = (seed.tenants["spice-garden"]?.qrs || []).filter((q) => q.target_type === "TABLE");
  const beanQrs = (seed.tenants["bean-bloom"]?.qrs || []).filter((q) => q.target_type === "TABLE");
  const royalQrs = (seed.tenants["royal-dum-pukht"]?.qrs || []).filter((q) => q.target_type === "TABLE");
  const foodieQrs = (seed.tenants["foodie-plaza"]?.qrs || []).filter((q) => q.target_type === "COUNTER");

  let rotatedOldToken = null;

  for (const vp of VIEWPORTS) {
    const vpIdx = vp.name === "mobile" ? 0 : 1;
    console.log(`\n=== Walking all 28 flows @ ${vp.width}x${vp.height} (${vp.name}) ===`);

    // F-01: Customer QR — Browse Only
    {
      const flowId = "F-01";
      const t0 = Date.now();
      let taps = 0;
      const ctx = await createCtx(browser, vp);
      const page = await ctx.newPage();
      const col = attachCollectors(page);
      const qr = royalQrs[vpIdx] || royalQrs[0];
      await safeNav(page, col, `/q/${qr.token}`);
      await recordStep(flowId, "01-browse-en", "GUEST", vp, page, col);
      const langBtn = page.locator("button:has-text('தமிழ்')").first();
      if ((await langBtn.count()) > 0) {
        await langBtn.click();
        taps++;
        await page.waitForTimeout(350);
        await recordStep(flowId, "02-browse-ta", "GUEST", vp, page, col, { checkTamil: true });
      }
      flowTimings.push({ flowId, viewport: vp.name, taps, durationMs: Date.now() - t0 });
      await ctx.close();
    }

    // F-02: Customer QR — Order with Approval
    {
      const flowId = "F-02";
      const t0 = Date.now();
      const ctx = await createCtx(browser, vp);
      const page = await ctx.newPage();
      const col = attachCollectors(page);
      const qr = spiceQrs[vpIdx] || spiceQrs[0];
      await safeNav(page, col, `/q/${qr.token}`);
      await recordStep(flowId, "01-menu", "GUEST", vp, page, col);
      const res = await walkCustomerQrOrder(page, col, qr.token);
      await recordStep(flowId, "02-tracker", "GUEST", vp, page, col, {
        forcedStatus: res.ok ? "PASS" : "BLOCKED",
        note: res.ok ? "" : res.reason,
      });
      flowTimings.push({ flowId, viewport: vp.name, taps: res.taps, durationMs: Date.now() - t0 });
      await ctx.close();
    }

    // F-03: Customer QR — Order Direct
    let beanTrackingUrl = null;
    {
      const flowId = "F-03";
      const t0 = Date.now();
      const ctx = await createCtx(browser, vp);
      const page = await ctx.newPage();
      const col = attachCollectors(page);
      const qr = beanQrs[vpIdx] || beanQrs[0];
      await safeNav(page, col, `/q/${qr.token}`);
      await recordStep(flowId, "01-menu", "GUEST", vp, page, col);
      const res = await walkCustomerQrOrder(page, col, qr.token);
      beanTrackingUrl = res.trackingUrl || null;
      await recordStep(flowId, "02-tracker", "GUEST", vp, page, col, {
        forcedStatus: res.ok ? "PASS" : "BLOCKED",
        note: res.ok ? "" : res.reason,
      });
      flowTimings.push({ flowId, viewport: vp.name, taps: res.taps, durationMs: Date.now() - t0 });
      await ctx.close();
    }

    // F-04 & F-16: Customer QR Pay First + Cashier Settle Awaiting Payment (multi-context)
    {
      const flowId = "F-04";
      const t0 = Date.now();
      let taps = 0;
      const gCtx = await createCtx(browser, vp);
      const cCtx = await createCtx(browser, vp);
      const gPage = await gCtx.newPage();
      const cPage = await cCtx.newPage();
      const gCol = attachCollectors(gPage);
      const cCol = attachCollectors(cPage);
      const qr = foodieQrs[vpIdx] || foodieQrs[0];

      await safeNav(gPage, gCol, `/q/${qr.token}`);
      await recordStep(flowId, "01-counter-menu", "GUEST", vp, gPage, gCol, { isCounterVenue: true });
      const res = await walkCustomerQrOrder(gPage, gCol, qr.token);
      taps += res.taps;
      await recordStep(flowId, "02-awaiting-payment", "GUEST", vp, gPage, gCol, {
        isCounterVenue: true,
        forcedStatus: res.ok ? "PASS" : "BLOCKED",
        note: res.ok ? "" : res.reason,
      });

      await loginStaff(cPage, cCol, "cashier@foodieplaza.in");
      await spaNav(cPage, cCol, "/billing");
      taps++;
      await recordStep("F-16", "01-awaiting-list", "CASHIER", vp, cPage, cCol, { isCounterVenue: true });
      const confirmPayBtn = cPage.locator("button:has-text('Mark Paid')").first();
      if ((await confirmPayBtn.count()) > 0 && (await confirmPayBtn.isEnabled())) {
        await confirmPayBtn.click();
        taps++;
        await cPage.waitForTimeout(900);
        await recordStep("F-16", "02-settled", "CASHIER", vp, cPage, cCol, { isCounterVenue: true });
      } else {
        await recordStep("F-16", "02-settled", "CASHIER", vp, cPage, cCol, {
          isCounterVenue: true,
          forcedStatus: "BLOCKED",
          note: "No Mark Paid button enabled for awaiting payment order",
        });
      }

      if (res.ok) {
        await gPage.reload({ waitUntil: "domcontentloaded" }).catch(() => {});
        await gPage.waitForTimeout(400);
        await waitUntilContentReady(gPage);
        await recordStep(flowId, "03-guest-after-pay", "GUEST", vp, gPage, gCol, { isCounterVenue: true });
      }
      flowTimings.push({ flowId, viewport: vp.name, taps, durationMs: Date.now() - t0 });
      await gCtx.close();
      await cCtx.close();
    }

    // F-05: Customer QR — Rotated or Invalid Token
    {
      const flowId = "F-05";
      const t0 = Date.now();
      let taps = 0;
      const gCtx = await createCtx(browser, vp);
      const gPage = await gCtx.newPage();
      const gCol = attachCollectors(gPage);
      await safeNav(gPage, gCol, "/q/invalid-nonexistent-token-999");
      await recordStep(flowId, "01-invalid-token", "GUEST", vp, gPage, gCol, { allowExpectedHttpErrors: true });

      if (!rotatedOldToken) {
        const oCtx = await createCtx(browser, vp);
        const oPage = await oCtx.newPage();
        const oCol = attachCollectors(oPage);
        await loginStaff(oPage, oCol, "owner@spicegarden.com");
        await spaNav(oPage, oCol, "/qr");
        const sacQr = spiceQrs[spiceQrs.length - 1];
        if (sacQr) rotatedOldToken = sacQr.token;
        const rotBtn = oPage.locator("button:has-text('Rotate')").first();
        if ((await rotBtn.count()) > 0) {
          await rotBtn.click();
          taps++;
          await oPage.waitForTimeout(500);
          const confBtn = oPage.locator("button:has-text('Rotate Token Now')").first();
          if ((await confBtn.count()) > 0) {
            await confBtn.click();
            taps++;
            await oPage.waitForTimeout(1000);
          }
          await recordStep(flowId, "02-owner-rotated", "OWNER", vp, oPage, oCol);
        }
        await oCtx.close();
      }
      if (rotatedOldToken) {
        await safeNav(gPage, gCol, `/q/${rotatedOldToken}`);
        await recordStep(flowId, "03-rotated-old-token", "GUEST", vp, gPage, gCol, { allowExpectedHttpErrors: true });
      }
      flowTimings.push({ flowId, viewport: vp.name, taps, durationMs: Date.now() - t0 });
      await gCtx.close();
    }

    // F-06: Customer QR — Reorder & History Consent
    {
      const flowId = "F-06";
      const t0 = Date.now();
      let taps = 0;
      const ctx = await createCtx(browser, vp);
      const page = await ctx.newPage();
      const col = attachCollectors(page);
      const qr = beanQrs[2 + vpIdx] || beanQrs[0];
      await safeNav(page, col, `/q/${qr.token}`);
      const enableHistBtn = page.locator("button:has-text('Enable')").first();
      if ((await enableHistBtn.count()) > 0) {
        await enableHistBtn.click();
        taps++;
        await page.waitForTimeout(300);
      }
      await recordStep(flowId, "01-consent-enabled", "GUEST", vp, page, col);
      const res = await walkCustomerQrOrder(page, col, qr.token);
      taps += res.taps;
      if (res.ok) {
        const backBtn = page.locator("a:has-text('Back'), button:has-text('Back')").first();
        if ((await backBtn.count()) > 0) {
          await backBtn.click();
          taps++;
          await waitUntilContentReady(page);
        } else {
          await safeNav(page, col, `/q/${qr.token}`);
        }
        const myOrdersBtn = page.locator("button:has-text('My orders')").first();
        if ((await myOrdersBtn.count()) > 0) {
          await myOrdersBtn.click();
          taps++;
          await page.waitForTimeout(350);
          const reorderBtn = page.locator("button:has-text('Reorder')").first();
          if ((await reorderBtn.count()) > 0) {
            await reorderBtn.click();
            taps++;
            await page.waitForTimeout(800);
          }
        }
        await recordStep(flowId, "02-reorder-cart", "GUEST", vp, page, col);
      } else {
        await recordStep(flowId, "02-reorder-cart", "GUEST", vp, page, col, {
          forcedStatus: "BLOCKED",
          note: res.reason || "Initial order failed before reorder",
        });
      }
      flowTimings.push({ flowId, viewport: vp.name, taps, durationMs: Date.now() - t0 });
      await ctx.close();
    }

    // F-07 & F-13: Service Requests (Guest) + Ready to Serve (Waiter)
    {
      const flowId = "F-07";
      const t0 = Date.now();
      let taps = 0;
      const gCtx = await createCtx(browser, vp);
      const wCtx = await createCtx(browser, vp);
      const gPage = await gCtx.newPage();
      const wPage = await wCtx.newPage();
      const gCol = attachCollectors(gPage);
      const wCol = attachCollectors(wPage);

      const qr = spiceQrs[3 + vpIdx] || spiceQrs[0];
      await safeNav(gPage, gCol, `/q/${qr.token}`);
      for (const label of ["Call waiter", "Water", "Request bill", "Cutlery"]) {
        const btn = gPage.locator(`button:has-text("${label}")`).first();
        if ((await btn.count()) > 0) {
          await btn.click();
          taps++;
          await gPage.waitForTimeout(500);
        }
      }
      await recordStep(flowId, "01-guest-requests", "GUEST", vp, gPage, gCol);

      await loginStaff(wPage, wCol, "waiter@spicegarden.com");
      await spaNav(wPage, wCol, "/serve");
      await recordStep("F-13", "01-ready-and-requests", "WAITER", vp, wPage, wCol);
      const resBtn = wPage.locator("button:has-text('Resolve'), button:has-text('Done')").first();
      if ((await resBtn.count()) > 0) {
        await resBtn.click();
        taps++;
        await wPage.waitForTimeout(700);
      }
      const serveBtn = wPage.locator("button:has-text('Mark Served')").first();
      if ((await serveBtn.count()) > 0) {
        await serveBtn.click();
        taps++;
        await wPage.waitForTimeout(700);
      }
      await recordStep("F-13", "02-after-serve-resolve", "WAITER", vp, wPage, wCol);
      flowTimings.push({ flowId, viewport: vp.name, taps, durationMs: Date.now() - t0 });
      await gCtx.close();
      await wCtx.close();
    }

    // F-08: Order Tracker & Feedback
    {
      const flowId = "F-08";
      const t0 = Date.now();
      let taps = 0;
      const gCtx = await createCtx(browser, vp);
      const gPage = await gCtx.newPage();
      const gCol = attachCollectors(gPage);
      if (beanTrackingUrl) {
        await gPage.goto(beanTrackingUrl, { waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => {});
        await gPage.waitForTimeout(400);
        await waitUntilContentReady(gPage);
        await recordStep(flowId, "01-tracker-bill", "GUEST", vp, gPage, gCol);
        const topicBtn = gPage.locator("button:has-text('Taste')").first();
        if ((await topicBtn.count()) > 0 && (await topicBtn.isVisible())) {
          await topicBtn.click().catch(() => {});
          taps++;
        }
        const fbInput = gPage.locator("textarea").first();
        if ((await fbInput.count()) > 0) {
          await fbInput.fill("Great coffee and quick service");
        }
        const submitFb = gPage
          .locator("button:has-text('Submit Feedback'), button:has-text('Send Feedback')")
          .first();
        if ((await submitFb.count()) > 0) {
          await submitFb.click();
          taps++;
          await gPage.waitForTimeout(900);
        }
        await recordStep(flowId, "02-feedback-submitted", "GUEST", vp, gPage, gCol);
      } else {
        await recordStep(flowId, "01-tracker-bill", "GUEST", vp, gPage, gCol, {
          forcedStatus: "BLOCKED",
          note: "No tracking URL from F-03",
        });
      }
      flowTimings.push({ flowId, viewport: vp.name, taps, durationMs: Date.now() - t0 });
      await gCtx.close();
    }

    // F-09, F-10, F-11, F-12, F-14, F-15: Multi-User Waiter + Live Orders + Kitchen + Cashier
    {
      const flowId = "F-09";
      const t0 = Date.now();
      let taps = 0;
      const wCtx = await createCtx(browser, vp);
      const kCtx = await createCtx(browser, vp);
      const oCtx = await createCtx(browser, vp);
      const gCtx = await createCtx(browser, vp);
      const wPage = await wCtx.newPage();
      const kPage = await kCtx.newPage();
      const oPage = await oCtx.newPage();
      const gPage = await gCtx.newPage();
      const wCol = attachCollectors(wPage);
      const kCol = attachCollectors(kPage);
      const oCol = attachCollectors(oPage);
      const gCol = attachCollectors(gPage);

      await loginStaff(wPage, wCol, "waiter@spicegarden.com");
      await spaNav(wPage, wCol, "/pos");
      await Promise.race([
        wPage.locator("button:has-text('Free')").first().waitFor({ state: "visible", timeout: 8000 }),
        wPage.waitForTimeout(3000),
      ]).catch(() => {});
      await recordStep("F-09", "01-pos-tables", "WAITER", vp, wPage, wCol);

      const freeTableBtn = wPage.locator("button:has-text('Free')").first();
      if ((await freeTableBtn.count()) > 0) {
        await freeTableBtn.click();
        taps++;
        await wPage.waitForTimeout(450);
        const seatConfirm = wPage.locator('[role="dialog"] button:has-text("Open Dining Session"), [role="dialog"] button:has-text("Seat")').first();
        if ((await seatConfirm.count()) > 0 && (await seatConfirm.isVisible())) {
          await seatConfirm.click({ timeout: 8000 }).catch(() => {});
          taps++;
          await wPage.waitForTimeout(800);
        }
        await recordStep("F-09", "02-table-seated", "WAITER", vp, wPage, wCol);

        const dishBtn = wPage
          .locator("button:has-text('Tap to add'), button:has-text('Butter Chicken'), button:has-text('Dal Makhani')")
          .first();
        if ((await dishBtn.count()) > 0) {
          await dishBtn.click({ timeout: 8000 }).catch(() => {});
          taps++;
          await wPage.waitForTimeout(300);
        }
        const fireBtn = wPage.locator("button:has-text('Fire Order to Kitchen')").first();
        if ((await fireBtn.count()) > 0 && (await fireBtn.isEnabled())) {
          await fireBtn.click({ timeout: 8000 }).catch(() => {});
          taps++;
          await wPage.waitForTimeout(900);
          await recordStep("F-09", "03-first-order-fired", "WAITER", vp, wPage, wCol);

          if ((await dishBtn.count()) > 0) {
            await dishBtn.click({ timeout: 8000 }).catch(() => {});
            taps++;
            await wPage.waitForTimeout(300);
            await fireBtn.click({ timeout: 8000 }).catch(() => {});
            taps++;
            await wPage.waitForTimeout(900);
            await recordStep("F-09", "04-second-round-fired", "WAITER", vp, wPage, wCol);
          }
        } else {
          await recordStep("F-09", "03-first-order-fired", "WAITER", vp, wPage, wCol, {
            forcedStatus: "BLOCKED",
            note: "Fire Order button missing or disabled",
          });
        }

        // F-10: Last Bill + Request Payment + Free Table
        const lastBillBtn = wPage.locator("button:has-text('Last Bill'), button:has-text('Current Bill')").first();
        if ((await lastBillBtn.count()) > 0) {
          await lastBillBtn.click({ timeout: 8000 }).catch(() => {});
          taps++;
          await wPage.waitForTimeout(600);
          await recordStep("F-10", "01-last-or-current-bill", "WAITER", vp, wPage, wCol);
          const closeMod = wPage.locator('[role="dialog"] button:has-text("Close")').first();
          if ((await closeMod.count()) > 0) await closeMod.click({ timeout: 5000 }).catch(() => {});
        }
        const reqPayBtn = wPage.locator("button:has-text('Request Payment')").first();
        if ((await reqPayBtn.count()) > 0) {
          await reqPayBtn.click({ timeout: 8000 }).catch(() => {});
          taps++;
          await wPage.waitForTimeout(700);
          await recordStep("F-10", "02-request-payment", "WAITER", vp, wPage, wCol);
        }

        const anotherFree = wPage.locator("button:has-text('Free')").first();
        if ((await anotherFree.count()) > 0) {
          await anotherFree.click({ timeout: 8000 }).catch(() => {});
          taps++;
          await wPage.waitForTimeout(450);
          const seat2 = wPage.locator('[role="dialog"] button:has-text("Open Dining Session"), [role="dialog"] button:has-text("Seat")').first();
          if ((await seat2.count()) > 0 && (await seat2.isVisible())) {
            await seat2.click({ timeout: 8000 }).catch(() => {});
            taps++;
            await wPage.waitForTimeout(700);
          }
          const freeBtn = wPage.locator("button:has-text('Free Table')").first();
          if ((await freeBtn.count()) > 0) {
            await freeBtn.click({ timeout: 8000 }).catch(() => {});
            taps++;
            await wPage.waitForTimeout(700);
          }
          await recordStep("F-10", "03-free-table", "WAITER", vp, wPage, wCol);
        }
      } else {
        await recordStep("F-09", "02-table-seated", "WAITER", vp, wPage, wCol, {
          forcedStatus: "BLOCKED",
          note: "No Free table found on Floor POS",
        });
      }
      flowTimings.push({ flowId: "F-09", viewport: vp.name, taps, durationMs: Date.now() - t0 });

      // F-11: Live Orders Approve & Reject QR
      const t11 = Date.now();
      let taps11 = 0;
      const qrAppr1 = spiceQrs[5 + vpIdx] || spiceQrs[0];
      const qrAppr2 = spiceQrs[7 + vpIdx] || spiceQrs[1];
      await walkCustomerQrOrder(gPage, gCol, qrAppr1.token);
      await walkCustomerQrOrder(gPage, gCol, qrAppr2.token);
      await spaNav(wPage, wCol, "/orders");
      await recordStep("F-11", "01-live-orders", "WAITER", vp, wPage, wCol);
      const approveBtn = wPage.locator("button:has-text('Approve')").first();
      if ((await approveBtn.count()) > 0) {
        await approveBtn.click();
        taps11++;
        await wPage.waitForTimeout(700);
      }
      const rejectBtn = wPage.locator("button:has-text('Reject')").first();
      if ((await rejectBtn.count()) > 0) {
        await rejectBtn.click();
        taps11++;
        await wPage.waitForTimeout(450);
        const reasonInput = wPage.locator('[role="dialog"] input, [role="dialog"] textarea').first();
        if ((await reasonInput.count()) > 0) await reasonInput.fill("Out of ingredient right now");
        const confReject = wPage.locator('[role="dialog"] button:has-text("Reject")').first();
        if ((await confReject.count()) > 0) {
          await confReject.click();
          taps11++;
          await wPage.waitForTimeout(700);
        }
      }
      await recordStep("F-11", "02-after-approve-reject", "WAITER", vp, wPage, wCol);
      flowTimings.push({ flowId: "F-11", viewport: vp.name, taps: taps11, durationMs: Date.now() - t11 });

      // F-12: Kitchen KDS & Availability
      const t12 = Date.now();
      let taps12 = 0;
      await loginStaff(kPage, kCol, "kitchen@spicegarden.com");
      await spaNav(kPage, kCol, "/kds");
      await recordStep("F-12", "01-kds-board", "KITCHEN", vp, kPage, kCol);
      const startCook = kPage.locator("button:has-text('Start Cooking'), button:has-text('Start')").first();
      if ((await startCook.count()) > 0) {
        await startCook.click();
        taps12++;
        await kPage.waitForTimeout(600);
      }
      const markReady = kPage.locator("button:has-text('Mark Ready')").first();
      if ((await markReady.count()) > 0) {
        await markReady.click();
        taps12++;
        await kPage.waitForTimeout(600);
      }
      await recordStep("F-12", "02-kds-after-bump", "KITCHEN", vp, kPage, kCol);
      await spaNav(kPage, kCol, "/menu/availability");
      await recordStep("F-12", "03-sold-out-switches", "KITCHEN", vp, kPage, kCol);
      flowTimings.push({ flowId: "F-12", viewport: vp.name, taps: taps12, durationMs: Date.now() - t12 });

      // F-14 & F-15: Billing Cash & UPI/Card
      const t14 = Date.now();
      await loginStaff(oPage, oCol, "owner@spicegarden.com");
      await spaNav(oPage, oCol, "/billing");
      await recordStep("F-14", "01-billing-queue", "OWNER", vp, oPage, oCol);
      const firstSess = oPage.locator("button:has-text('Table')").first();
      if ((await firstSess.count()) > 0) {
        await firstSess.click();
        await oPage.waitForTimeout(500);
        const settleCashBtn = oPage.locator("button:has-text('Settle & Print Receipt')").first();
        if ((await settleCashBtn.count()) > 0 && (await settleCashBtn.isEnabled())) {
          await settleCashBtn.click();
          await oPage.waitForTimeout(900);
          await recordStep("F-14", "02-cash-receipt", "OWNER", vp, oPage, oCol);
          const doneBtn = oPage.locator('[role="dialog"] button:has-text("Done")').first();
          if ((await doneBtn.count()) > 0) await doneBtn.click();
        }
      }
      const nextSess = oPage.locator("button:has-text('Table')").first();
      if ((await nextSess.count()) > 0) {
        await nextSess.click();
        await oPage.waitForTimeout(450);
        const upiBtn = oPage.locator("button:has-text('UPI')").first();
        if ((await upiBtn.count()) > 0) await upiBtn.click();
        const settleUpi = oPage.locator("button:has-text('Settle & Print Receipt')").first();
        if ((await settleUpi.count()) > 0 && (await settleUpi.isEnabled())) {
          await settleUpi.click();
          await oPage.waitForTimeout(900);
        }
        await recordStep("F-15", "01-upi-settled", "OWNER", vp, oPage, oCol);
      } else {
        await recordStep("F-15", "01-upi-settled", "OWNER", vp, oPage, oCol);
      }
      flowTimings.push({ flowId: "F-14", viewport: vp.name, taps: 4, durationMs: Date.now() - t14 });

      await wCtx.close();
      await kCtx.close();
      await oCtx.close();
      await gCtx.close();
    }

    // F-17, F-20, F-21: Hotel Grand Meridian
    {
      const flowId = "F-17";
      const t0 = Date.now();
      const ctx = await createCtx(browser, vp);
      const page = await ctx.newPage();
      const col = attachCollectors(page);
      await loginStaff(page, col, "owner@grandmeridian.com");

      await spaNav(page, col, "/venue/rooms");
      await recordStep("F-21", "01-rooms-list", "OWNER", vp, page, col);

      await spaNav(page, col, "/room-service");
      await recordStep("F-20", "01-room-service-board", "OWNER", vp, page, col);

      await spaNav(page, col, "/pos");
      const roomBtn = page.locator("button:has-text('Room')").first();
      if ((await roomBtn.count()) > 0) {
        await roomBtn.click({ timeout: 8000 }).catch(() => {});
        await page.waitForTimeout(450);
        const seatConfirm = page.locator('[role="dialog"] button:has-text("Open Dining Session"), [role="dialog"] button:has-text("Seat")').first();
        if ((await seatConfirm.count()) > 0 && (await seatConfirm.isVisible())) {
          await seatConfirm.click({ timeout: 8000 }).catch(() => {});
          await page.waitForTimeout(700);
        }
        const addItem = page
          .locator("button:has-text('Tap to add'), button:has-text('Dosa'), button:has-text('Platter')")
          .first();
        if ((await addItem.count()) > 0) await addItem.click();
        const fire = page.locator("button:has-text('Fire Order to Kitchen')").first();
        if ((await fire.count()) > 0 && (await fire.isEnabled())) {
          await fire.click();
          await page.waitForTimeout(800);
        }
      }
      await spaNav(page, col, "/billing");
      await recordStep(flowId, "01-hotel-billing", "OWNER", vp, page, col);
      const folioOpt = page.locator("button:has-text('Room'), button:has-text('Folio')").first();
      if ((await folioOpt.count()) > 0) {
        await folioOpt.click();
        await page.waitForTimeout(300);
        const settleBtn = page.locator("button:has-text('Settle & Print Receipt')").first();
        if ((await settleBtn.count()) > 0 && (await settleBtn.isEnabled())) {
          await settleBtn.click();
          await page.waitForTimeout(900);
          const doneBtn = page.locator('[role="dialog"] button:has-text("Done")').first();
          if ((await doneBtn.count()) > 0) await doneBtn.click();
        }
      }
      await spaNav(page, col, "/billing/room-charges");
      await recordStep(flowId, "02-room-charges-folio", "OWNER", vp, page, col);
      flowTimings.push({ flowId, viewport: vp.name, taps: 6, durationMs: Date.now() - t0 });
      await ctx.close();
    }

    // F-18, F-19, F-22: Counter Token (Chai Corner), Bills History, Shift Close, Takeaway
    {
      const flowId = "F-22";
      const t0 = Date.now();
      const cCtx = await createCtx(browser, vp);
      const kCtx = await createCtx(browser, vp);
      const cPage = await cCtx.newPage();
      const kPage = await kCtx.newPage();
      const cCol = attachCollectors(cPage);
      const kCol = attachCollectors(kPage);

      await loginStaff(cPage, cCol, "cashier@chaicorner.in");
      await spaNav(cPage, cCol, "/pos");
      await recordStep("F-22", "01-counter-pos", "CASHIER", vp, cPage, cCol, { isCounterVenue: true });
      const dish = cPage.locator("button:has-text('Tap to add'), button:has-text('Chai'), button:has-text('Coffee')").first();
      if ((await dish.count()) > 0) await dish.click();
      const fire = cPage.locator("button:has-text('Fire Order to Kitchen')").first();
      if ((await fire.count()) > 0 && (await fire.isEnabled())) {
        await fire.click();
        await cPage.waitForTimeout(700);
      }

      await loginStaff(kPage, kCol, "kitchen@chaicorner.in");
      await spaNav(kPage, kCol, "/kds");
      await recordStep("F-22", "02-counter-kds", "KITCHEN", vp, kPage, kCol, { isCounterVenue: true });

      await spaNav(cPage, cCol, "/billing/bills");
      await recordStep("F-18", "01-bills-history", "CASHIER", vp, cPage, cCol, { isCounterVenue: true });
      await spaNav(cPage, cCol, "/billing/closeout");
      await recordStep("F-18", "02-shift-closeout", "CASHIER", vp, cPage, cCol, { isCounterVenue: true });

      await spaNav(cPage, cCol, "/takeaway");
      await recordStep("F-19", "01-takeaway-queue", "CASHIER", vp, cPage, cCol, { isCounterVenue: true });
      flowTimings.push({ flowId, viewport: vp.name, taps: 3, durationMs: Date.now() - t0 });

      await cCtx.close();
      await kCtx.close();
    }

    // F-23 .. F-27: Owner/Manager, Inventory, Menu, Setup & QR Print Sheet, Staff & Settings
    {
      const ctx = await createCtx(browser, vp);
      const page = await ctx.newPage();
      const col = attachCollectors(page);
      await loginStaff(page, col, "owner@spicegarden.com");

      // Explicitly test F5 full page reload persistence on /dashboard once so auth refresh bug is documented cleanly!
      await safeNav(page, col, "/dashboard");
      await recordStep("F-23", "00-reload-auth-persistence", "OWNER", vp, page, col);
      if (page.url().includes("/login")) {
        await loginStaff(page, col, "owner@spicegarden.com");
      }

      for (const [step, rPath] of [
        ["01-dashboard", "/dashboard"],
        ["02-reports-sales", "/reports/sales"],
        ["03-reports-items", "/reports/items"],
        ["04-reports-payments", "/reports/payments"],
        ["05-reports-exceptions", "/reports/exceptions"],
        ["06-reports-staff", "/reports/staff"],
        ["07-reports-outlets", "/reports/outlets"],
        ["08-customers", "/customers"],
        ["09-feedback", "/customers/feedback"],
        ["10-activity", "/activity"],
      ]) {
        await spaNav(page, col, rPath);
        await recordStep("F-23", step, "OWNER", vp, page, col);
      }

      for (const [step, rPath] of [
        ["01-stock", "/inventory"],
        ["02-receive", "/inventory/receive"],
        ["03-wastage", "/inventory/wastage"],
        ["04-counts", "/inventory/counts"],
        ["05-recipes", "/inventory/recipes"],
        ["06-purchases", "/inventory/purchases"],
        ["07-reports", "/inventory/reports"],
        ["08-settings", "/inventory/settings"],
      ]) {
        await spaNav(page, col, rPath);
        await recordStep("F-24", step, "OWNER", vp, page, col);
      }

      for (const [step, rPath] of [
        ["01-menu", "/menu"],
        ["02-options", "/menu/options"],
        ["03-availability", "/menu/availability"],
        ["04-translations", "/menu/translations"],
      ]) {
        await spaNav(page, col, rPath);
        await recordStep("F-25", step, "OWNER", vp, page, col, { checkTamil: rPath.includes("translations") });
      }

      for (const [step, rPath] of [
        ["01-onboarding", "/onboarding"],
        ["02-branches", "/branches"],
        ["03-venue-hub", "/venue"],
        ["04-areas", "/venue/areas"],
        ["05-tables", "/venue/tables"],
        ["06-counters", "/venue/counters"],
        ["07-floor", "/venue/floor"],
        ["08-qr-codes", "/qr"],
      ]) {
        await spaNav(page, col, rPath);
        await recordStep("F-26", step, "OWNER", vp, page, col);
      }

      for (const [step, rPath] of [
        ["01-staff", "/staff"],
        ["02-roles-guide", "/team/roles"],
        ["03-branding", "/settings/branding"],
        ["04-venue-settings", "/settings/venue"],
        ["05-sound", "/settings/sound"],
        ["06-devices", "/settings/devices"],
        ["07-account", "/settings/account"],
        ["08-plan", "/settings/plan"],
        ["09-help", "/help"],
      ]) {
        await spaNav(page, col, rPath);
        await recordStep("F-27", step, "OWNER", vp, page, col);
      }
      await ctx.close();
    }

    // F-28: Platform Super Admin Screens
    {
      const ctx = await createCtx(browser, vp);
      const page = await ctx.newPage();
      const col = attachCollectors(page);
      await loginStaff(page, col, "admin@fusionengine.in", "AdminPassword123!");
      const sampleTenantId = seed.tenants["spice-garden"]?.id || "unknown";
      for (const [step, rPath] of [
        ["01-admin-home", "/admin"],
        ["02-tenants", "/admin/tenants"],
        ["03-new-tenant", "/admin/tenants/new"],
        ["04-tenant-detail", `/admin/tenants/${sampleTenantId}`],
        ["05-plans", "/admin/plans"],
        ["06-health", "/admin/health"],
        ["07-activity", "/admin/activity"],
        ["08-support", "/admin/support"],
        ["09-leads", "/admin/leads"],
        ["10-announcements", "/admin/announcements"],
      ]) {
        await spaNav(page, col, rPath);
        await recordStep("F-28", step, "PLATFORM_ADMIN", vp, page, col);
      }
      await ctx.close();
    }
  }

  // Step 4 Live Route Probe across Roles using SPA nav (so inMemory token persists cleanly)
  console.log("\n=== Running Step 4 Route Probe Across Roles ===");
  const ROLE_PROBES = [
    { role: "OWNER", email: "owner@spicegarden.com", pass: "Password123!" },
    { role: "BRANCH_MANAGER", email: "manager@spicegarden.com", pass: "Password123!" },
    { role: "WAITER", email: "waiter@spicegarden.com", pass: "Password123!" },
    { role: "KITCHEN", email: "kitchen@spicegarden.com", pass: "Password123!" },
    { role: "CASHIER", email: "cashier@kavericafe.com", pass: "Password123!" },
    { role: "PLATFORM_ADMIN", email: "admin@fusionengine.in", pass: "AdminPassword123!" },
    { role: "PUBLIC", email: null, pass: null },
  ];

  const PROBE_ROUTES = [
    "/dashboard", "/pos", "/orders/floor", "/orders", "/orders/live", "/orders/ready", "/serve",
    "/room-service", "/takeaway", "/kds", "/orders/kds", "/billing", "/orders/billing",
    "/billing/invoices", "/billing/bills", "/billing/closeout", "/billing/room-charges",
    "/reports/sales", "/reports/items", "/reports/payments", "/reports/exceptions", "/reports/staff", "/reports/outlets",
    "/inventory", "/inventory/recipes", "/inventory/purchases", "/inventory/wastage",
    "/inventory/reports", "/inventory/receive", "/inventory/counts", "/inventory/settings",
    "/activity", "/menu", "/menu/options", "/menu/translations", "/menu/availability",
    "/onboarding", "/branches", "/venue", "/venue/layout", "/venue/branches", "/venue/areas",
    "/venue/tables", "/venue/rooms", "/venue/counters", "/venue/floor", "/venue/floor-plan",
    "/qr", "/staff", "/customers", "/customers/feedback", "/team/roles",
    "/settings/venue", "/settings/branding", "/settings/sound", "/settings/devices", "/settings/account", "/settings/plan",
    "/help", "/admin", "/admin/tenants", "/admin/tenants/new", "/admin/plans", "/admin/health",
    "/admin/activity", "/admin/support", "/admin/leads", "/admin/announcements",
  ];

  const probeOutput = {};
  for (const rPath of PROBE_ROUTES) {
    probeOutput[rPath] = { allowed_roles: [], unauthorized_behaviors: [] };
  }

  for (const rp of ROLE_PROBES) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const col = attachCollectors(page);
    if (rp.email) {
      await loginStaff(page, col, rp.email, rp.pass);
    } else {
      await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded" });
    }
    for (const rPath of PROBE_ROUTES) {
      col.reset();
      await page.evaluate((target) => {
        window.history.pushState({}, "", target);
        window.dispatchEvent(new PopStateEvent("popstate"));
      }, rPath);
      await page.waitForTimeout(300);
      const finalPath = new URL(page.url()).pathname;
      const logs = col.snapshot();
      const bodyTxt = await page.evaluate(() => (document.body?.innerText || "").slice(0, 400)).catch(() => "");
      if (finalPath === rPath) {
        const has403 = logs.httpErrors.some((e) => e.status === 403);
        const saysForbidden = /forbidden|not authorized|permission denied|access denied/i.test(bodyTxt);
        if (has403 || saysForbidden) {
          probeOutput[rPath].unauthorized_behaviors.push(`${rp.role}:rendered+403/denied`);
        } else {
          probeOutput[rPath].allowed_roles.push(rp.role);
        }
      } else {
        probeOutput[rPath].unauthorized_behaviors.push(`${rp.role}->${finalPath}`);
      }
    }
    await ctx.close();
  }

  fs.writeFileSync(RAW_WALK_PATH, JSON.stringify(results, null, 2));
  fs.writeFileSync(RAW_TIMING_PATH, JSON.stringify(flowTimings, null, 2));
  fs.writeFileSync(
    path.join(BASE_DIR, "docs/audit/walk/raw/route_probe_raw.json"),
    JSON.stringify(probeOutput, null, 2)
  );
  await browser.close();
  console.log(`Completed ${results.length} screen captures across 28 flows & 7 role probes.`);
}

runAllFlows().catch((err) => {
  console.error("WALK FAILED:", err);
  process.exit(1);
});
