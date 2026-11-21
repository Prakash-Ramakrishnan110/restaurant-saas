import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { chromium } from "@playwright/test";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUT_DIR = path.resolve(__dirname, "../../docs/help/screenshots");
fs.mkdirSync(OUT_DIR, { recursive: true });

async function main() {
  const baseUrl = process.env.BASE_URL || "http://localhost:5173";
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  await page.goto(`${baseUrl}/login`);
  await page.fill('input[type="email"]', "owner@spicegarden.com");
  await page.fill('input[type="password"]', "Password123!");
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 15000 });
  await page.waitForLoadState("networkidle");

  const targets = [
    { route: "/dashboard", file: "dashboard.png" },
    { route: "/menu", file: "menu.png" },
    { route: "/orders/floor", file: "floor-pos.png" },
    { route: "/kds", file: "kitchen-kds.png" },
    { route: "/billing", file: "billing.png" },
    { route: "/settings/devices", file: "printers-devices.png" },
  ];

  for (const t of targets) {
    await page.goto(`${baseUrl}${t.route}`);
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: path.join(OUT_DIR, t.file), fullPage: false });
  }

  await browser.close();
  console.log(`Captured ${targets.length} help screenshots in ${OUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
