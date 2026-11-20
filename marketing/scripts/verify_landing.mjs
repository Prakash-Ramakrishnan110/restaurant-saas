import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../..");
const MARKETING_DIR = path.join(ROOT, "marketing");
const OUT_DIR = path.join(ROOT, "docs/marketing/review/final");
fs.mkdirSync(OUT_DIR, { recursive: true });

const requireFrontend = createRequire(path.join(ROOT, "frontend/package.json"));
const requireMarketing = createRequire(path.join(MARKETING_DIR, "package.json"));
const { chromium } = requireFrontend("playwright");
const AxeBuilder = requireMarketing("@axe-core/playwright").default;

const PORT = 4173;
const URL = `http://127.0.0.1:${PORT}/`;

function startPreview() {
  return spawn(
    "node",
    ["./node_modules/vite/bin/vite.js", "preview", "--host", "127.0.0.1", "--port", String(PORT), "--strictPort"],
    { cwd: MARKETING_DIR, stdio: "ignore" }
  );
}

async function waitForServer(url, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error("Preview server timed out");
}

async function run() {
  const server = startPreview();
  const browser = await chromium.launch({ headless: true });

  try {
    await waitForServer(URL);
    const consoleErrors = [];
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => consoleErrors.push(String(err)));

    await page.goto(URL, { waitUntil: "networkidle" });
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(OUT_DIR, "desktop-1440.png"), fullPage: true });

    const domCheck = await page.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll("img")).map((img) => ({
        src: img.getAttribute("src"),
        naturalWidth: img.naturalWidth,
      }));
      const text = document.body.innerText || "";
      const hasPhotoNeeded = /PHOTO NEEDED/i.test(text);
      const forbidden = ["tenant", "entitlement", "paise", "preset", "flag", "solution", "ecosystem"];
      const foundForbidden = forbidden.filter((w) => new RegExp(`\\b${w}\\b`, "i").test(text));
      return { imgs, hasPhotoNeeded, foundForbidden };
    });
    console.log("DOM:", JSON.stringify(domCheck));

    const axe = await new AxeBuilder({ page }).analyze();
    const serious = axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    console.log("AXE serious/critical:", serious.length, serious.map((v) => v.id));

    for (const width of [360, 390, 768, 1440]) {
      const height = width <= 390 ? 844 : 900;
      await page.setViewportSize({ width, height });
      await page.waitForTimeout(250);
      const check = await page.evaluate(() => {
        const overflow = document.documentElement.scrollWidth > window.innerWidth;
        const smallTaps = Array.from(document.querySelectorAll("a, button"))
          .filter((el) => {
            const st = getComputedStyle(el);
            const r = el.getBoundingClientRect();
            return st.display !== "none" && st.visibility !== "hidden" && r.width > 0 && r.height > 0 && r.height < 48;
          })
          .map((el) => ({
            text: el.textContent?.trim() || el.getAttribute("aria-label"),
            h: Math.round(el.getBoundingClientRect().height),
          }));
        return { overflow, smallTaps };
      });
      console.log(`width=${width}px`, JSON.stringify(check));
    }

    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(OUT_DIR, "mobile-390.png"), fullPage: true });
    console.log("Console errors:", JSON.stringify(consoleErrors));
    await ctx.close();
  } finally {
    await browser.close();
    server.kill();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
