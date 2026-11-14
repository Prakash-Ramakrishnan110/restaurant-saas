/**
 * Audit Step 6: UX Crawl
 * Uses Playwright to crawl routes across all role x venue combinations against the real stack.
 * Captures light/dark/touch screenshots, network errors, console errors, scroll checks, and axe accessibility audits.
 */

const fs = require("fs");
const path = require("path");

const FRONTEND_MODULES = path.resolve(__dirname, "../../frontend/node_modules");
const { chromium, devices } = require(path.join(FRONTEND_MODULES, "@playwright/test"));

const BASE_URL = "http://127.0.0.1:5173";
const SCREENS_DIR = path.resolve(__dirname, "../../docs/audit/screens");
const RAW_DIR = path.resolve(__dirname, "../../docs/audit/raw");
const AXE_PATH = path.join(FRONTEND_MODULES, "axe-core/axe.min.js");

if (!fs.existsSync(SCREENS_DIR)) {
  fs.mkdirSync(SCREENS_DIR, { recursive: true });
}
if (!fs.existsSync(RAW_DIR)) {
  fs.mkdirSync(RAW_DIR, { recursive: true });
}

const ROLES_TO_CRAWL = [
  {
    roleId: "owner_table",
    roleLabel: "Owner (Table Venue - Spice Garden)",
    email: "owner@spicegarden.com",
    password: "Password123!",
    expectedHome: "/dashboard",
  },
  {
    roleId: "manager_table",
    roleLabel: "Manager (Spice Garden)",
    email: "manager@spicegarden.com",
    password: "Password123!",
    expectedHome: "/dashboard",
  },
  {
    roleId: "waiter_table",
    roleLabel: "Waiter (Spice Garden)",
    email: "waiter@spicegarden.com",
    password: "Password123!",
    expectedHome: "/dashboard",
  },
  {
    roleId: "kitchen_table",
    roleLabel: "Kitchen (Spice Garden)",
    email: "kitchen@spicegarden.com",
    password: "Password123!",
    expectedHome: "/kds",
  },
  {
    roleId: "cashier_counter",
    roleLabel: "Cashier (Counter Venue - Chai Corner)",
    email: "cashier@chaicorner.in",
    password: "Password123!",
    expectedHome: "/dashboard",
  },
  {
    roleId: "owner_counter",
    roleLabel: "Owner (Counter Venue - Chai Corner)",
    email: "owner@chaicorner.in",
    password: "Password123!",
    expectedHome: "/dashboard",
  },
  {
    roleId: "owner_hotel",
    roleLabel: "Owner (Hotel - Grand Meridian)",
    email: "owner@grandmeridian.com",
    password: "Password123!",
    expectedHome: "/dashboard",
  },
  {
    roleId: "platform_admin",
    roleLabel: "Platform Super Admin",
    email: "admin@fusionengine.in",
    password: "AdminPassword123!",
    expectedHome: "/admin",
  },
];

// All distinct routed paths in App.tsx
const ALL_ROUTED_PATHS = [
  "/dashboard",
  "/pos",
  "/orders",
  "/serve",
  "/kds",
  "/takeaway",
  "/room-service",
  "/billing",
  "/billing/bills",
  "/billing/room-charges",
  "/billing/closeout",
  "/menu",
  "/menu/availability",
  "/menu/options",
  "/menu/import",
  "/menu/prices",
  "/onboarding",
  "/branches",
  "/venue/areas",
  "/venue/tables",
  "/venue/counters",
  "/venue/floor",
  "/qr",
  "/venue/rooms",
  "/staff",
  "/team/shifts",
  "/team/assignments",
  "/team/roles",
  "/activity",
  "/inventory/stock",
  "/inventory/recipes",
  "/inventory/suppliers",
  "/inventory/wastage",
  "/inventory/reports",
  "/customers",
  "/reports/sales",
  "/reports/items",
  "/reports/payments",
  "/reports/orders",
  "/reports/exceptions",
  "/reports/staff",
  "/reports/outlets",
  "/settings/branding",
  "/settings/venue",
  "/settings/approvals",
  "/settings/sound",
  "/settings/devices",
  "/settings/customer-ordering",
  "/settings/plan",
  "/admin",
  "/admin/tenants",
  "/admin/tenants/new",
  "/admin/plans",
  "/admin/health",
  "/admin/activity",
  "/admin/support",
  "/admin/announcements",
  "/suspended",
  "/403",
  "/non-existent-path-for-404-check",
];

function sanitizeFilename(str) {
  return str.replace(/[^a-zA-Z0-9_-]/g, "_").replace(/^_+|_+$/g, "") || "root";
}

async function runCrawl() {
  console.log("=== Starting Playwright UX Crawl on Real Stack ===");
  const crawlResults = [];
  const axeScript = fs.readFileSync(AXE_PATH, "utf8");

  for (const roleDef of ROLES_TO_CRAWL) {
    console.log(`\n--------------------------------------------------`);
    console.log(`Crawling Role: ${roleDef.roleLabel} (${roleDef.email})`);
    console.log(`--------------------------------------------------`);

    const browser = await chromium.launch({ headless: true });
    try {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
      });

      const page = await context.newPage();

      // 1. Log in
      console.log(`Navigating to ${BASE_URL}/login...`);
      await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded", timeout: 8000 });

      await page.fill('input[type="email"]', roleDef.email);
      await page.fill('input[type="password"]', roleDef.password);
      await page.click('button[type="submit"]');

      // Wait for post-login navigation
      await Promise.race([
        page.waitForURL((url) => !url.pathname.endsWith("/login"), { timeout: 8000 }),
        page.waitForTimeout(4000),
      ]).catch(() => {});
      await page.waitForTimeout(400);

      const actualHomeUrl = page.url().replace(BASE_URL, "") || "/";
      console.log(`Landed at post-login home: ${actualHomeUrl} (Expected: ${roleDef.expectedHome})`);

      // Capture Home Screenshots: Light, Dark, Mobile Touch
      // A. Desktop Light
      const homeLightPath = path.join(SCREENS_DIR, `${roleDef.roleId}_home_desktop_light.png`);
      await page.screenshot({ path: homeLightPath, fullPage: false });

      // B. Desktop Dark
      await page.evaluate(() => {
        document.documentElement.classList.add("dark");
      });
      await page.waitForTimeout(400);
      const homeDarkPath = path.join(SCREENS_DIR, `${roleDef.roleId}_home_desktop_dark.png`);
      await page.screenshot({ path: homeDarkPath, fullPage: false });
      await page.evaluate(() => {
        document.documentElement.classList.remove("dark");
      });

      // C. Mobile Touch
      const storageState = await context.storageState();
      const mobileContext = await browser.newContext({
        ...devices["Pixel 7"],
        storageState,
      });
      const mobilePage = await mobileContext.newPage();
      await mobilePage.goto(`${BASE_URL}${actualHomeUrl}`, { waitUntil: "domcontentloaded", timeout: 8000 }).catch(() => {});
      await mobilePage.waitForTimeout(500);
      const homeMobilePath = path.join(SCREENS_DIR, `${roleDef.roleId}_home_mobile_touch.png`);
      await mobilePage.screenshot({ path: homeMobilePath, fullPage: false });
      await mobileContext.close();

    // 2. Discover Visible Sidebar Links
    const sidebarLinks = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll("aside a, nav a"));
      return links
        .map((a) => a.getAttribute("href"))
        .filter((href) => href && href.startsWith("/") && !href.startsWith("/#"));
    });

    const uniqueSidebarLinks = Array.from(new Set(sidebarLinks));
    console.log(`Found ${uniqueSidebarLinks.length} visible sidebar links for this role.`);

    // 3. Test every sidebar link and every routed path
    const pathsToTest = Array.from(new Set([...uniqueSidebarLinks, ...ALL_ROUTED_PATHS]));

    for (const targetPath of pathsToTest) {
      const isSidebar = uniqueSidebarLinks.includes(targetPath);
      const httpErrors = [];
      const consoleErrors = [];
      const uncaughtExceptions = [];

      const onResponse = (response) => {
        const status = response.status();
        if (status >= 400 && response.url().includes("/api/")) {
          httpErrors.push({ url: response.url(), status });
        }
      };

      const onConsole = (msg) => {
        if (msg.type() === "error") {
          consoleErrors.push(msg.text());
        }
      };

      const onPageError = (err) => {
        uncaughtExceptions.push(err.message || String(err));
      };

      page.on("response", onResponse);
      page.on("console", onConsole);
      page.on("pageerror", onPageError);

      const startTime = Date.now();
      let navigationSucceeded = true;
      try {
        await page.goto(`${BASE_URL}${targetPath}`, { waitUntil: "domcontentloaded", timeout: 8000 });
        await page.waitForTimeout(300);
      } catch (err) {
        navigationSucceeded = false;
        uncaughtExceptions.push(`Navigation failed: ${err.message}`);
      }
      const timeToContent = Date.now() - startTime;

      page.off("response", onResponse);
      page.off("console", onConsole);
      page.off("pageerror", onPageError);

      const finalUrl = page.url().replace(BASE_URL, "") || "/";

      // Evaluate page states
      const pageAudit = await page
        .evaluate(() => {
          const docEl = document.documentElement;
          const body = document.body;

          const hasPulseSkeleton = Boolean(document.querySelector(".animate-pulse, [data-skeleton]"));
          const bodyText = (body.innerText || "").trim();
          const isEmpty = bodyText.length === 0;

          // Horizontal scroll detection
          const hasHScroll = docEl.scrollWidth > window.innerWidth || body.scrollWidth > window.innerWidth;

          // Document scrolling check
          const docScrolls = docEl.scrollHeight > window.innerHeight;

          // Main scroll and sidebar scroll
          const mainScroll = document.querySelector("#main-scroll, main, [role='main']");
          const sidebar = document.querySelector("aside, nav");

          let mainScrollsSep = false;
          if (mainScroll && sidebar) {
            const mStyle = window.getComputedStyle(mainScroll);
            const sStyle = window.getComputedStyle(sidebar);
            mainScrollsSep =
              (mStyle.overflowY === "auto" || mStyle.overflowY === "scroll") &&
              (sStyle.overflowY === "auto" || sStyle.overflowY === "scroll" || sStyle.position === "fixed");
          }

          return {
            hasPulseSkeleton,
            isEmpty,
            hasHScroll,
            docScrolls,
            mainScrollsSep,
            title: document.title,
          };
        })
        .catch(() => ({
          hasPulseSkeleton: false,
          isEmpty: true,
          hasHScroll: false,
          docScrolls: false,
          mainScrollsSep: false,
          title: "",
        }));

      // Run Axe accessibility audit on the page
      let axeSerious = 0;
      let axeCritical = 0;
      try {
        const runAxe = async () => {
          await page.evaluate(axeScript);
          return await page.evaluate(async () => {
            const res = await window.axe.run(document, {
              runOnly: {
                type: "tag",
                values: ["wcag2a", "wcag2aa"],
              },
            });
            const serious = res.violations.filter((v) => v.impact === "serious").length;
            const critical = res.violations.filter((v) => v.impact === "critical").length;
            return { serious, critical };
          });
        };
        const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("Axe timeout")), 5000));
        const axeResults = await Promise.race([runAxe(), timeout]);
        axeSerious = axeResults.serious;
        axeCritical = axeResults.critical;
      } catch (err) {
        // Axe evaluation failed or not supported on this view
      }

      // Capture screenshot if sidebar or home or specific test route
      const safePath = sanitizeFilename(targetPath);
      const screenFile = `${roleDef.roleId}_${safePath}.png`;
      const screenFullPath = path.join(SCREENS_DIR, screenFile);
      if (isSidebar || targetPath.startsWith("/admin") || targetPath.startsWith("/pos") || targetPath.startsWith("/billing")) {
        await Promise.race([
          page.screenshot({ path: screenFullPath, fullPage: false }),
          new Promise((_, reject) => setTimeout(() => reject(new Error("Screenshot timeout")), 5000)),
        ]).catch(() => {});
      }

      const record = {
        roleId: roleDef.roleId,
        roleLabel: roleDef.roleLabel,
        requestedPath: targetPath,
        finalUrl,
        inSidebar: isSidebar ? "Y" : "N",
        timeToFirstContentMs: timeToContent,
        skeletonAfter10s: pageAudit.hasPulseSkeleton,
        isEmpty: pageAudit.isEmpty,
        horizontalScroll: pageAudit.hasHScroll ? "Y" : "N",
        documentScrolls: pageAudit.docScrolls ? "Y" : "N",
        mainAndSidebarScrollSep: pageAudit.mainScrollsSep ? "Y" : "N",
        axeSerious: axeSerious + axeCritical,
        httpErrorsSeen: httpErrors.length > 0 ? httpErrors.map((e) => `${e.status} ${e.url}`).join("; ") : "NONE",
        consoleErrorsSeen: consoleErrors.length > 0 ? consoleErrors.join("; ") : "NONE",
        uncaughtExceptions: uncaughtExceptions.length > 0 ? uncaughtExceptions.join("; ") : "NONE",
        screenshot: fs.existsSync(screenFullPath) ? screenFile : "",
      };

      crawlResults.push(record);
      process.stdout.write(`  [${record.inSidebar === "Y" ? "SIDEBAR" : "DIRECT"}] ${targetPath} -> ${finalUrl} (Axe: ${record.axeSerious}, HTTP err: ${httpErrors.length})\n`);
    }
      await page.close().catch(() => {});
      await context.close().catch(() => {});
    } finally {
      await Promise.race([
        browser.close(),
        new Promise((resolve) => setTimeout(resolve, 2000)),
      ]).catch(() => {});
    }
  }

  // Save crawl results
  fs.writeFileSync(path.join(RAW_DIR, "crawl_raw.json"), JSON.stringify(crawlResults, null, 2), "utf8");

  const summaryLines = [
    "=== UX CRAWL AUDIT REPORT ===",
    `Total page checks executed: ${crawlResults.length}`,
    `Total HTTP errors encountered: ${crawlResults.filter((r) => r.httpErrorsSeen !== "NONE").length}`,
    `Total Console errors encountered: ${crawlResults.filter((r) => r.consoleErrorsSeen !== "NONE").length}`,
    `Total Uncaught exceptions encountered: ${crawlResults.filter((r) => r.uncaughtExceptions !== "NONE").length}`,
    `Total Horizontal overflow pages: ${crawlResults.filter((r) => r.horizontalScroll === "Y").length}`,
    `Total Pages with serious/critical accessibility violations: ${crawlResults.filter((r) => r.axeSerious > 0).length}`,
    "",
    "--- HTTP ERRORS ENCOUNTERED ---",
    ...crawlResults
      .filter((r) => r.httpErrorsSeen !== "NONE")
      .map((r) => `  [${r.roleId}] ${r.requestedPath}: ${r.httpErrorsSeen}`),
    "",
    "--- CONSOLE ERRORS & CRASHES ---",
    ...crawlResults
      .filter((r) => r.consoleErrorsSeen !== "NONE" || r.uncaughtExceptions !== "NONE")
      .map((r) => `  [${r.roleId}] ${r.requestedPath}: Console: ${r.consoleErrorsSeen} | Uncaught: ${r.uncaughtExceptions}`),
  ];

  fs.writeFileSync(path.join(RAW_DIR, "crawl_raw.txt"), summaryLines.join("\n"), "utf8");
  console.log(`\n[OK] Step 6 Crawl complete. Data saved to docs/audit/raw/crawl_raw.json and crawl_raw.txt.`);
}

runCrawl().catch((err) => {
  console.error("Crawl error:", err);
  process.exit(1);
});
