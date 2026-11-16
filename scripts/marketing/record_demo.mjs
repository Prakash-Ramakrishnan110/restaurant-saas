import { chromium } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";

const rawDir = process.argv[2] || path.resolve("raw-video");
const appUrl = process.env.APP_URL || "http://localhost:5173";

async function showCaption(page, text) {
  await page.evaluate((msg) => {
    let el = document.getElementById("demo-caption-overlay");
    if (!el) {
      el = document.createElement("div");
      el.id = "demo-caption-overlay";
      el.style.cssText =
        "position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#0B1F3B;color:#FFFFFF;padding:10px 20px;border-radius:10px;font-family:sans-serif;font-weight:700;font-size:16px;z-index:99999;border:2px solid #FF6A00;";
      document.body.appendChild(el);
    }
    el.textContent = msg;
  }, text);
}

async function loginOffCamera(browser, email, password) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  await page.goto(`${appUrl}/login`);
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 15000 });
  const state = await ctx.storageState();
  await ctx.close();
  return state;
}

const browser = await chromium.launch();
try {
  // 1. Restaurant 60s walkthrough (Kaveri Cafe)
  const restState = await loginOffCamera(browser, "owner@kavericafe.com", "Password123!");
  const restCtx = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    storageState: restState,
    recordVideo: { dir: path.join(rawDir, "restaurant"), size: { width: 1280, height: 720 } },
  });
  const p = await restCtx.newPage();
  await p.goto(`${appUrl}/pos`);
  await showCaption(p, "1. Waiter takes the order on a phone or tablet");
  await p.waitForTimeout(4000);
  await p.goto(`${appUrl}/kds`);
  await showCaption(p, "2. Kitchen sees it at once, with a sound alert");
  await p.waitForTimeout(4000);
  await p.goto(`${appUrl}/billing`);
  await showCaption(p, "4. Cashier takes payment and gives the receipt");
  await p.waitForTimeout(4000);
  await p.goto(`${appUrl}/dashboard`);
  await showCaption(p, "5. Owner sees today's sales");
  await p.waitForTimeout(4000);
  await restCtx.close();

  // 2. Tea Shop 30s walkthrough (Chai Corner)
  fs.mkdirSync(path.join(rawDir, "teashop"), { recursive: true });
  const teaState = await loginOffCamera(browser, "cashier@chaicorner.in", "Password123!");
  const teaCtx = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    storageState: teaState,
    recordVideo: { dir: path.join(rawDir, "teashop"), size: { width: 1280, height: 720 } },
  });
  const tp = await teaCtx.newPage();
  await tp.goto(`${appUrl}/pos`);
  await showCaption(tp, "Customer pays, gets a token, and collects when called");
  await tp.waitForTimeout(5000);
  await teaCtx.close();
} finally {
  await browser.close();
}
