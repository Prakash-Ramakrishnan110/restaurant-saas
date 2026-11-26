import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const round = process.argv[2] || "stage4-round1";
const ROOT = path.resolve(import.meta.dirname, "../..");
const MARKETING_DIR = path.join(ROOT, "marketing");
const OUT_DIR = path.join(ROOT, "docs/marketing/review", round);
fs.mkdirSync(OUT_DIR, { recursive: true });

const requireFrontend = createRequire(path.join(ROOT, "frontend/package.json"));
const requireMarketing = createRequire(path.join(MARKETING_DIR, "package.json"));
const { chromium } = requireFrontend("playwright");
const AxeBuilder = requireMarketing("@axe-core/playwright").default;

const PORT = 4175;
const BASE = `http://127.0.0.1:${PORT}`;

const TARGETS = [
  { slug: "home", path: "/" },
  { slug: "home-ta", path: "/ta/" },
  { slug: "hardware", path: "/hardware/" },
  { slug: "hardware-ta", path: "/ta/hardware/" },
  { slug: "tea-shops", path: "/tea-shops/" },
  { slug: "tea-shops-ta", path: "/ta/tea-shops/" },
];

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

async function scrollPage(page) {
  await page.evaluate(async () => {
    const html = document.documentElement;
    const prev = html.style.scrollBehavior;
    html.style.scrollBehavior = "auto";
    for (let y = 0; y <= document.body.scrollHeight; y += 550) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 70));
    }
    window.scrollTo(0, 0);
    html.scrollTop = 0;
    document.body.scrollTop = 0;
    window.dispatchEvent(new Event("scroll"));
    html.style.scrollBehavior = prev;
  });
  await page.waitForTimeout(350);
}

const server = spawn(
  "node",
  ["./node_modules/vite/bin/vite.js", "preview", "--port", String(PORT), "--host", "127.0.0.1", "--strictPort"],
  { cwd: MARKETING_DIR, stdio: "ignore" }
);

const browser = await chromium.launch({ headless: true });
try {
  await waitForServer(`${BASE}/`);
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  const report = {};
  for (const t of TARGETS) {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${BASE}${t.path}`, { waitUntil: "networkidle" });
    await scrollPage(page);
    await page.screenshot({ path: path.join(OUT_DIR, `${t.slug}-1440.png`), fullPage: true });

    const axeDesktop = await new AxeBuilder({ page }).analyze();

    const widths = {};
    for (const w of [320, 360, 390, 768, 1440]) {
      await page.setViewportSize({ width: w, height: w <= 390 ? 844 : 900 });
      await page.waitForTimeout(150);
      widths[w] = await page.evaluate(() => {
        const overflow = document.documentElement.scrollWidth > window.innerWidth;
        const smallControls = Array.from(document.querySelectorAll("a, button"))
          .map((el) => {
            const st = getComputedStyle(el);
            const r = el.getBoundingClientRect();
            return {
              text: (el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 32),
              w: Math.round(r.width),
              h: Math.round(r.height),
              hidden: st.display === "none" || st.visibility === "hidden",
            };
          })
          .filter((x) => !x.hidden && x.w > 0 && x.h > 0 && x.h < 48);
        const brokenImgs = Array.from(document.querySelectorAll("img"))
          .filter((img) => img.complete && img.naturalWidth === 0)
          .map((img) => img.getAttribute("src"));
        return { overflow, smallControls, brokenImgs };
      });
    }

    await page.setViewportSize({ width: 390, height: 844 });
    await scrollPage(page);
    await page.screenshot({ path: path.join(OUT_DIR, `${t.slug}-390.png`), fullPage: true });

    report[t.slug] = {
      axeViolations: axeDesktop.violations.map((v) => ({ id: v.id, impact: v.impact })),
      widths,
    };
  }

  fs.writeFileSync(path.join(OUT_DIR, "metrics.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
  server.kill();
}
