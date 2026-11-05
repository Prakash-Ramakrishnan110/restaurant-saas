import { test, expect } from "@playwright/test";
import path from "path";
import fs from "fs";

const screenshotsDir = path.resolve("../docs/screenshots");

async function setupMockApi(page: any, profile: "CAFE" | "QUICK_SERVICE", bType: "CAFE" | "TEA_SHOP") {
  await page.addInitScript(() => {
    localStorage.setItem("servemyfood_has_session", "true");
    localStorage.setItem("servemyfood_tenant_id", "ten-mock-1");
  });

  await page.route("**/api/v1/auth/refresh/", async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ access: "mock-valid-access-token" }),
    });
  });

  await page.route("**/api/v1/auth/me/", async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        user: {
          id: "usr-owner-1",
          email: "owner@spicegarden.com",
          name: "Ramesh Owner",
          role: "OWNER",
          must_change_password: false,
        },
        memberships: [
          {
            id: "mem-owner-1",
            tenant_id: "ten-mock-1",
            tenant_name: profile === "CAFE" ? "Cozy Bean Café" : "Anna Chai Stall",
            role: "OWNER",
            is_default: true,
          },
        ],
        active_role: "OWNER",
        permissions: ["*"],
        must_change_password: false,
      }),
    });
  });

  await page.route("**/api/v1/business/", async (route: any) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "ten-mock-1",
          name: profile === "CAFE" ? "Cozy Bean Café" : "Anna Chai Stall",
          business_type: bType,
          venue_profile: profile,
          contact_email: "owner@restaurant.com",
          contact_phone: "+91 98765 43210",
          timezone: "Asia/Kolkata",
          business_settings: {
            display_name: profile === "CAFE" ? "Cozy Bean Café" : "Anna Chai Stall",
            brand_primary_color: "#FF6A00",
            document_language: "EN_TA",
            receipt_footer_text: "Thank you for visiting us!",
            legal_name: "Authentic Foods LLP",
            gstin: "33AAAAA0000A1Z5",
            registered_address: "100 GST Road, Guindy, Chennai",
            logo_url: null,
            logo_128_url: null,
          },
        }),
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      });
    }
  });

  await page.route("**/api/v1/branches/", async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        results: [
          {
            id: "br-1",
            name: "Main Outlet",
            address: "100 GST Road, Guindy",
            phone: "+91 44 2626 0000",
            venue_profile: profile,
          },
        ],
      }),
    });
  });

  await page.route("**/api/v1/branches/br-1/", async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "br-1",
        name: "Main Outlet",
        address: "100 GST Road, Guindy",
        phone: "+91 44 2626 0000",
        venue_profile: profile,
      }),
    });
  });

  await page.route("**/api/v1/layout-templates/**", async (route: any) => {
    if (profile === "CAFE") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            key: "cafe_small",
            name: "Cozy Café (10 Tables)",
            description: "1 dining area with 10 tables, ideal for small cafes and bistros.",
            recommended_profiles: ["CAFE"],
            has_tables: true,
          },
          {
            key: "empty",
            name: "Custom Blank Canvas",
            description: "Blank canvas with one starter area, ready for custom design.",
            recommended_profiles: ["CAFE"],
            has_tables: false,
          },
        ]),
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            key: "counters",
            name: "Counters & Tokens (No Tables)",
            description: "Counter service stations with atomic daily token numbers. Zero dining tables.",
            recommended_profiles: ["QUICK_SERVICE"],
            has_tables: false,
          },
          {
            key: "empty",
            name: "Custom Blank Canvas",
            description: "Blank canvas with one starter area, ready for custom design.",
            recommended_profiles: ["QUICK_SERVICE"],
            has_tables: false,
          },
        ]),
      });
    }
  });

  await page.route("**/api/v1/qr-codes/", async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        results: [
          {
            id: "qr-1",
            token: "sec_token_01",
            target_type: profile === "CAFE" ? "TABLE" : "COUNTER",
            table: profile === "CAFE" ? { id: "tbl-1", name: "Table 01", identifier: "T01" } : null,
            service_area: { id: "sa-1", name: profile === "CAFE" ? "Main Hall" : "Counter Area" },
            branch: { id: "br-1", name: "Main Outlet" },
            is_active: true,
          },
        ],
      }),
    });
  });

  await page.route("**/api/v1/qr-codes/sheet-data/", async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          id: "qr-1",
          token: "sec_token_01",
          label: profile === "CAFE" ? "Table 01" : "Order Counter 1",
          target_type: profile === "CAFE" ? "TABLE" : "COUNTER",
          target_id: "t-1",
          area_name: profile === "CAFE" ? "Main Hall" : "Front Counter",
          branch_name: "Main Outlet",
          public_url: "http://localhost:5173/q/sec_token_01",
          qr_svg_url: "/api/v1/qr-codes/qr-1/image/?format=svg",
          qr_png_url: "/api/v1/qr-codes/qr-1/image/?format=png",
        },
      ]),
    });
  });

  await page.route("**/api/v1/onboarding/status/", async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        is_complete: false,
        completion_percentage: 14,
        next_step: "business",
        steps: {
          business: true,
          branch: true,
          style: true,
          layout: true,
          qr: true,
          staff: true,
          done: true,
        },
      }),
    });
  });
}

test.describe("Part D: Full Screenshot Generation Suite", () => {
  test("Capture Cafe Onboarding Steps 1 through 7", async ({ page }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await setupMockApi(page, "CAFE", "CAFE");

    await page.goto("/onboarding");
    await page.waitForLoadState("networkidle");

    // Cafe Step 1
    await page.screenshot({ path: path.join(screenshotsDir, "onboarding-cafe-step1.png"), fullPage: true });

    // Step 2: Branch
    await page.getByRole("button", { name: "Next Step" }).click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(screenshotsDir, "onboarding-cafe-step2.png"), fullPage: true });

    // Step 3: Service Style
    await page.getByRole("button", { name: "Next Step" }).click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(screenshotsDir, "onboarding-cafe-step3.png"), fullPage: true });

    // Step 4: Layout
    await page.getByRole("button", { name: "Next Step" }).click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(screenshotsDir, "onboarding-cafe-step4.png"), fullPage: true });

    // Step 5: QR Codes
    await page.getByRole("button", { name: "Next Step" }).click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(screenshotsDir, "onboarding-cafe-step5.png"), fullPage: true });

    // Step 6: Staff
    await page.getByRole("button", { name: "Next Step" }).click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(screenshotsDir, "onboarding-cafe-step6.png"), fullPage: true });

    // Step 7: Done
    await page.getByRole("button", { name: "Next Step" }).click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(screenshotsDir, "onboarding-cafe-step7.png"), fullPage: true });
  });

  test("Capture Tea Shop Onboarding Steps 1 through 7", async ({ page }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await setupMockApi(page, "QUICK_SERVICE", "TEA_SHOP");

    await page.goto("/onboarding");
    await page.waitForLoadState("networkidle");

    // Select Tea Shop
    const teaCardLabel = page.locator("label[for='vp-quick']");
    if (await teaCardLabel.isVisible()) {
      await teaCardLabel.click();
      await page.waitForTimeout(300);
    }

    // Tea Shop Step 1
    await page.screenshot({ path: path.join(screenshotsDir, "onboarding-teashop-step1.png"), fullPage: true });

    // Step 2: Branch
    await page.getByRole("button", { name: "Next Step" }).click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(screenshotsDir, "onboarding-teashop-step2.png"), fullPage: true });

    // Step 3: Service Style
    await page.getByRole("button", { name: "Next Step" }).click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(screenshotsDir, "onboarding-teashop-step3.png"), fullPage: true });

    // Step 4: Layout
    await page.getByRole("button", { name: "Next Step" }).click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(screenshotsDir, "onboarding-teashop-step4.png"), fullPage: true });

    // Step 5: QR Codes
    await page.getByRole("button", { name: "Next Step" }).click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(screenshotsDir, "onboarding-teashop-step5.png"), fullPage: true });

    // Step 6: Staff
    await page.getByRole("button", { name: "Next Step" }).click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(screenshotsDir, "onboarding-teashop-step6.png"), fullPage: true });

    // Step 7: Done
    await page.getByRole("button", { name: "Next Step" }).click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(screenshotsDir, "onboarding-teashop-step7.png"), fullPage: true });
  });

  test("Capture Step 4 Mobile Viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await setupMockApi(page, "CAFE", "CAFE");

    await page.goto("/onboarding");
    await page.waitForLoadState("networkidle");

    // Advance to Step 4 (Layout)
    await page.getByRole("button", { name: "Next Step" }).click();
    await page.waitForTimeout(200);
    await page.getByRole("button", { name: "Next Step" }).click();
    await page.waitForTimeout(200);
    await page.getByRole("button", { name: "Next Step" }).click();
    await page.waitForTimeout(400);

    await page.screenshot({ path: path.join(screenshotsDir, "onboarding-step4-mobile.png"), fullPage: true });
  });

  test("Capture Branding & QR Codes Pages", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await setupMockApi(page, "CAFE", "CAFE");

    // Branding Settings Page
    await page.goto("/settings/branding");
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: path.join(screenshotsDir, "15-settings-branding.png"), fullPage: true });

    // QR Codes Page
    await page.goto("/qr");
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: path.join(screenshotsDir, "qr-codes-page.png"), fullPage: true });

    // Open Print Sheet Modal
    const printBtn = page.getByRole("button", { name: "Print QR Sheet" });
    await printBtn.click();
    await page.waitForTimeout(500);

    // 6 Cards EN
    const cardsSelect = page.locator('select[aria-label="Cards per sheet layout"]');
    const langSelect = page.locator('select[aria-label="Sheet language"]');

    await cardsSelect.selectOption("6");
    await langSelect.selectOption("EN");
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(screenshotsDir, "qr-print-sheet-6-en.png"), fullPage: true });

    // 12 Cards EN
    await cardsSelect.selectOption("12");
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(screenshotsDir, "qr-print-sheet-12-en.png"), fullPage: true });

    // 12 Cards TA
    await langSelect.selectOption("EN_TA");
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(screenshotsDir, "qr-print-sheet-12-ta.png"), fullPage: true });

    // 6 Cards TA
    await cardsSelect.selectOption("6");
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(screenshotsDir, "qr-print-sheet-6-ta.png"), fullPage: true });
  });

  test("Capture Public /q Valid and Invalid Landing Pages", async ({ page }) => {
    await page.setViewportSize({ width: 420, height: 800 });

    // 1. Valid Token
    await page.route("**/api/v1/public/qr/valid-token-123/", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          valid: true,
          tenant_name: "Spice Garden",
          display_name: "Spice Garden Café",
          logo_url: null,
          brand_primary_color: "#FF6A00",
          table_identifier: "Table 05",
          area_name: "Courtyard",
          branch_name: "Guindy",
        }),
      });
    });

    await page.goto("/q/valid-token-123");
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: path.join(screenshotsDir, "public-qr-valid.png"), fullPage: true });

    // 2. Invalid Token
    await page.route("**/api/v1/public/qr/invalid-token-404/", async (route) => {
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ error: { code: "TOKEN_NOT_FOUND", message: "QR token invalid or expired" } }),
      });
    });

    await page.goto("/q/invalid-token-404");
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: path.join(screenshotsDir, "public-qr-invalid.png"), fullPage: true });
  });

  test("Rename logo-compare.png to logo-preview-sheet.png", async () => {
    const src = path.join(screenshotsDir, "logo-compare.png");
    const dst = path.join(screenshotsDir, "logo-preview-sheet.png");
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dst);
    }
  });

  test("Capture Dashboard Light & Dark+Touch Screens", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await setupMockApi(page, "CAFE", "CAFE");

    await page.route("**/api/v1/subscription/entitlements/", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          plan_name: "Professional",
          status: "ACTIVE",
          max_branches: 5,
          current_branches: 1,
          max_tables: 25,
          current_tables: 10,
          max_service_areas: 5,
          current_service_areas: 2,
        }),
      });
    });

    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(500);

    // Light Desktop Dashboard
    await page.screenshot({ path: path.join(screenshotsDir, "04-dashboard-desktop.png"), fullPage: true });

    // Dark Mode + Touch Density Dashboard
    await page.evaluate(() => {
      document.documentElement.setAttribute("data-theme", "dark");
      document.documentElement.setAttribute("data-density", "touch");
      document.documentElement.classList.add("dark", "touch-mode");
    });
    await page.waitForTimeout(400);

    await page.screenshot({ path: path.join(screenshotsDir, "06-dashboard-dark-touch.png"), fullPage: true });
  });
});
