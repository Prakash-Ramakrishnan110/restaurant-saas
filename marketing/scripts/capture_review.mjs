import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs";

const round = process.argv[2] || "round1";
const outDir = path.resolve(import.meta.dirname, `../../docs/marketing/review/${round}`);
fs.mkdirSync(outDir, { recursive: true });

const server = spawn(
  "node",
  ["./node_modules/vite/bin/vite.js", "preview", "--port", "4173", "--host", "127.0.0.1"],
  { cwd: path.resolve(import.meta.dirname, ".."), stdio: "ignore" }
);

await new Promise((r) => setTimeout(r, 2500));

const browser = await chromium.launch({ channel: "chrome" });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto("http://127.0.0.1:4173/", { waitUntil: "networkidle" });
  // Trigger lazy images to load before full-page review screenshot
  await page.evaluate(async () => {
    for (let y = 0; y <= document.body.scrollHeight; y += 500) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 120));
    }
    window.scrollTo({ top: 0, behavior: "instant" });
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(outDir, "desktop-1440.png"), fullPage: true });

  for (const w of [360, 390, 768, 1440]) {
    await page.setViewportSize({ width: w, height: 844 });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth
    );
    const smallTapTargets = await page.evaluate(() => {
      return Array.from(document.querySelectorAll("a, button, summary"))
        .map((el) => {
          const r = el.getBoundingClientRect();
          return { text: (el.textContent || "").trim().slice(0, 30), w: Math.round(r.width), h: Math.round(r.height) };
        })
        .filter((item) => item.w > 0 && item.h > 0 && item.h < 48);
    });
    console.log(`[${round}] width=${w}px overflow=${overflow} smallTapTargets(<48px)=${JSON.stringify(smallTapTargets)}`);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(async () => {
    for (let y = 0; y <= document.body.scrollHeight; y += 500) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 100));
    }
    window.scrollTo({ top: 0, behavior: "instant" });
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(outDir, "mobile-390.png"), fullPage: true });
} finally {
  await browser.close();
  server.kill();
}
