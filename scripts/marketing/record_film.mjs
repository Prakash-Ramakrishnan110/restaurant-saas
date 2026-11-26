import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../..");
const requireFrontend = createRequire(path.join(ROOT, "frontend/package.json"));
const { chromium } = requireFrontend("playwright");

const APP_URL = process.env.APP_URL || "http://127.0.0.1:5173";
const API_URL = process.env.API_URL || "http://127.0.0.1:8000/api/v1";
const VIDEO_OUT_DIR = path.join(ROOT, "marketing/public/video");
const SHOTS_OUT_DIR = path.join(ROOT, "marketing/public/shots");

fs.mkdirSync(VIDEO_OUT_DIR, { recursive: true });
fs.mkdirSync(SHOTS_OUT_DIR, { recursive: true });

function resolveFfmpeg() {
  const wingetPath = path.join(
    process.env.LOCALAPPDATA || "",
    "Microsoft/WinGet/Links/ffmpeg.exe"
  );
  if (wingetPath && fs.existsSync(wingetPath)) return wingetPath;
  return "ffmpeg";
}

async function apiJson(endpoint, { method = "GET", token, tenantId, body } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (tenantId) headers["X-Tenant-ID"] = tenantId;
  const res = await fetch(`${API_URL}/${endpoint.replace(/^\//, "")}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`API ${method} ${endpoint} failed (${res.status}): ${txt.slice(0, 240)}`);
  }
  return res.json();
}

async function showOverlayCaption(page, text) {
  await page.evaluate((msg) => {
    let el = document.getElementById("smf-film-caption");
    if (!el) {
      el = document.createElement("div");
      el.id = "smf-film-caption";
      el.style.cssText =
        "position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#0B1F3B;color:#FFFFFF;padding:12px 22px;border-radius:12px;font-family:Inter,system-ui,sans-serif;font-weight:700;font-size:16px;z-index:99999;border:2px solid #FF6A00;box-shadow:0 12px 32px rgba(0,0,0,0.45);";
      document.body.appendChild(el);
    }
    el.textContent = msg;
  }, text);
}

async function pulseClickHighlight(page, locator) {
  const box = await locator.boundingBox();
  if (!box) return;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.evaluate(
    ({ x, y }) => {
      const ring = document.createElement("div");
      ring.style.cssText = `position:fixed;left:${x - 24}px;top:${y - 24}px;width:48px;height:48px;border-radius:9999px;border:4px solid #FF6A00;background:rgba(255,106,0,0.22);z-index:999999;pointer-events:none;transition:transform 0.35s ease,opacity 0.35s ease;`;
      document.body.appendChild(ring);
      requestAnimationFrame(() => {
        ring.style.transform = "scale(1.5)";
        ring.style.opacity = "0";
      });
      setTimeout(() => ring.remove(), 450);
    },
    { x: cx, y: cy }
  );
}

async function loginOffCamera(browser, email, password) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  await page.goto(`${APP_URL}/login`, { waitUntil: "networkidle" });
  await page.getByPlaceholder("name@restaurant.com").fill(email);
  await page.getByPlaceholder("••••••••").fill(password);
  await page.getByRole("button", { name: /Sign In|உள்நுழைக/i }).click();
  await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 15000 });
  const state = await ctx.storageState();
  await ctx.close();
  return state;
}

/**
 * Clip H (Stage 4.3): Kitchen taps Ready and the token appears live on the Token TV.
 */
async function recordClipH(browser, ffmpegBin) {
  const loginData = await apiJson("auth/login/", {
    method: "POST",
    body: { email: "owner@foodieplaza.in", password: "Password123!" },
  });
  const token = loginData.access;
  const tenantId =
    loginData.user?.memberships?.[0]?.tenant_id ||
    loginData.memberships?.[0]?.tenant_id ||
    loginData.tenants?.[0]?.id;

  const qrRaw = await apiJson("qr-codes/", { token, tenantId });
  const qrList = Array.isArray(qrRaw) ? qrRaw : qrRaw.results || [];
  const counterQr = qrList.find(
    (q) => q.is_active && (q.target_type === "COUNTER" || q.qr_type === "COUNTER")
  );
  if (!counterQr) throw new Error("No active COUNTER QR found for Foodie Plaza.");
  const qrToken = counterQr.public_token;

  const menuRaw = await apiJson("menu/items/", { token, tenantId });
  const menuList = Array.isArray(menuRaw) ? menuRaw : menuRaw.results || [];
  if (menuList.length === 0) throw new Error("No menu items found for Foodie Plaza.");
  const itemId = menuList[0].id;

  const createdOrderIds = [];
  const rawDir = fs.mkdtempSync(path.join(os.tmpdir(), "smf-clip-h-"));

  try {
    // Seed one order that turns READY on camera + one order remaining in Preparing
    const ordMain = await apiJson("orders/", {
      method: "POST",
      token,
      tenantId,
      body: { order_workflow: "COUNTER_TOKEN", items: [{ menu_item_id: itemId, quantity: 2 }] },
    });
    createdOrderIds.push(ordMain.id);

    const ordNext = await apiJson("orders/", {
      method: "POST",
      token,
      tenantId,
      body: { order_workflow: "COUNTER_TOKEN", items: [{ menu_item_id: itemId, quantity: 1 }] },
    });
    createdOrderIds.push(ordNext.id);

    // Move main and next orders to PREPARING via KDS bump so Kitchen KDS shows "Mark Ready"
    await apiJson(`orders/kds/${ordMain.id}/bump/`, {
      method: "POST",
      token,
      tenantId,
      body: {},
    });
    await apiJson(`orders/kds/${ordNext.id}/bump/`, {
      method: "POST",
      token,
      tenantId,
      body: {},
    });

    const storageState = await loginOffCamera(browser, "owner@foodieplaza.in", "Password123!");

    const recCtx = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      storageState,
      recordVideo: { dir: rawDir, size: { width: 1280, height: 720 } },
    });
    const page = await recCtx.newPage();

    // Scene 1: Token TV before Ready (shows Preparing queue)
    await page.goto(`${APP_URL}/tv/${encodeURIComponent(qrToken)}`, { waitUntil: "networkidle" });
    await showOverlayCaption(
      page,
      `1. Token #${ordMain.token_number} shows under Preparing on the counter TV`
    );
    await page.waitForTimeout(2200);

    // Scene 2: Kitchen KDS taps Mark Ready
    await page.goto(`${APP_URL}/kds`, { waitUntil: "networkidle" });
    await showOverlayCaption(page, "2. Kitchen cook taps Mark Ready when the snack is ready");
    const markReadyBtn = page.getByRole("button", { name: /Mark Ready/i }).first();
    await markReadyBtn.waitFor({ state: "visible", timeout: 10000 });
    await page.waitForTimeout(900);
    await pulseClickHighlight(page, markReadyBtn);
    await markReadyBtn.click();
    await page.waitForTimeout(900);

    // Trigger Token TV Call so NOW CALLING hero highlights the ready token
    await apiJson(`orders/${ordMain.id}/call/`, {
      method: "POST",
      token,
      tenantId,
      body: {},
    });

    // Scene 3: Token TV updates with NOW CALLING #<token> and Ready for Pickup
    await page.goto(`${APP_URL}/tv/${encodeURIComponent(qrToken)}`, { waitUntil: "networkidle" });
    await page.getByTestId("tv-now-calling").waitFor({ state: "visible", timeout: 10000 });

    // Save clean real screenshot (before overlay caption) for DeviceFrame on /tea-shops/
    const tmpPng = path.join(rawDir, "token-tv-live.png");
    await page.screenshot({ path: tmpPng });

    await showOverlayCaption(
      page,
      `3. Token #${ordMain.token_number} appears in NOW CALLING on the Token TV`
    );
    await page.waitForTimeout(2800);

    const videoObj = page.video();
    await recCtx.close();
    const rawVideoPath = await videoObj.path();

    const mp4Out = path.join(VIDEO_OUT_DIR, "token-tv-clip-h.mp4");
    const webmOut = path.join(VIDEO_OUT_DIR, "token-tv-clip-h.webm");
    const posterOut = path.join(VIDEO_OUT_DIR, "token-tv-poster.webp");
    const shotWebpOut = path.join(SHOTS_OUT_DIR, "token-tv-live.webp");

    execFileSync(
      ffmpegBin,
      ["-y", "-i", tmpPng, "-vf", "scale=1280:-1", "-quality", "82", shotWebpOut],
      { stdio: "ignore" }
    );
    fs.copyFileSync(shotWebpOut, posterOut);

    execFileSync(
      ffmpegBin,
      [
        "-y",
        "-i",
        rawVideoPath,
        "-an",
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "28",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        mp4Out,
      ],
      { stdio: "ignore" }
    );

    execFileSync(
      ffmpegBin,
      [
        "-y",
        "-i",
        rawVideoPath,
        "-an",
        "-c:v",
        "libvpx-vp9",
        "-crf",
        "35",
        "-b:v",
        "0",
        webmOut,
      ],
      { stdio: "ignore" }
    );

    // Also populate teashop-demo.mp4/.webm and restaurant-demo.mp4/.webm if absent
    fs.copyFileSync(mp4Out, path.join(VIDEO_OUT_DIR, "teashop-demo.mp4"));
    fs.copyFileSync(webmOut, path.join(VIDEO_OUT_DIR, "teashop-demo.webm"));
    const restMp4 = path.join(VIDEO_OUT_DIR, "restaurant-demo.mp4");
    const restWebm = path.join(VIDEO_OUT_DIR, "restaurant-demo.webm");
    if (!fs.existsSync(restMp4) && fs.existsSync(path.join(VIDEO_OUT_DIR, "hero-demo.mp4"))) {
      fs.copyFileSync(path.join(VIDEO_OUT_DIR, "hero-demo.mp4"), restMp4);
    }
    if (!fs.existsSync(restWebm) && fs.existsSync(path.join(VIDEO_OUT_DIR, "hero-demo.webm"))) {
      fs.copyFileSync(path.join(VIDEO_OUT_DIR, "hero-demo.webm"), restWebm);
    }

    console.log("Recorded Clip H successfully:", {
      mp4Bytes: fs.statSync(mp4Out).size,
      webmBytes: fs.statSync(webmOut).size,
      shotBytes: fs.statSync(shotWebpOut).size,
    });
  } finally {
    for (const oid of createdOrderIds) {
      await apiJson(`orders/${oid}/cancel/`, {
        method: "POST",
        token,
        tenantId,
        body: { reason: "Clip H recording cleanup" },
      }).catch(() => null);
    }
    fs.rmSync(rawDir, { recursive: true, force: true });
  }
}

export const FILM_CLIPS = {
  H: recordClipH,
};

async function main() {
  const ffmpegBin = resolveFfmpeg();
  const browser = await chromium.launch({ headless: true });
  try {
    await FILM_CLIPS.H(browser, ffmpegBin);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
