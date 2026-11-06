import { test, expect } from "@playwright/test";
import path from "path";
import fs from "fs";

const screenshotsDir = path.resolve("../docs/screenshots");

async function setupMockApiForCapture(page: any, profile: "CAFE" | "QUICK_SERVICE") {
  const isTables = profile === "CAFE";

  await page.addInitScript(() => {
    localStorage.setItem("servemyfood_has_session", "true");
    localStorage.setItem("servemyfood_tenant_id", "ten-capture-1");
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
          email: "owner@madrascafe.com",
          full_name: "Ramesh Owner",
          role: "OWNER",
          must_change_password: false,
        },
        memberships: [
          {
            tenant_id: "ten-capture-1",
            tenant_name: isTables ? "Madras Cafe" : "Chai Spot",
            tenant_slug: isTables ? "madras-cafe" : "chai-spot",
            role: "OWNER",
            is_active: true,
            permissions: ["*"],
          },
        ],
        active_role: "OWNER",
        permissions: ["*"],
        must_change_password: false,
      }),
    });
  });

  await page.route("**/api/v1/business/", async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "ten-capture-1",
        name: isTables ? "Madras Cafe" : "Chai Spot",
        venue_profile: profile,
        uses_tables: isTables,
        uses_token_calling: !isTables,
        business_settings: {
          display_name: isTables ? "Madras Cafe" : "Chai Spot",
          brand_primary_color: "#FF6A00",
          document_language: "EN",
        },
      }),
    });
  });

  await page.route("**/api/v1/entitlements/**", async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        entitlements: {
          max_branches: 3,
          max_tables: 20,
          max_staff: 10,
        },
      }),
    });
  });

  await page.route("**/api/v1/branches/", async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          id: "br-1",
          name: "Main Outlet (Anna Salai)",
          code: "MAIN",
          phone: "+91 44 2626 0000",
          address: "100 Anna Salai, Chennai, Tamil Nadu",
          is_active: true,
          is_main: true,
          venue_profile: profile,
        },
        {
          id: "br-2",
          name: "Express Kiosk (T. Nagar)",
          code: "TNAG",
          phone: "+91 44 2828 0000",
          address: "45 Usman Road, T. Nagar, Chennai",
          is_active: true,
          is_main: false,
          venue_profile: profile,
        },
      ]),
    });
  });

  await page.route("**/api/v1/branches/br-1/capabilities/", async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        uses_tables: true,
        uses_tokens: false,
        uses_kds: false,
        supports_courses: false,
        allows_takeaway: true,
        allows_room_service: false,
        allows_room_charge: false,
        has_sections: true,
        has_seat_ordering: false,
        allows_table_transfer: true,
        allows_qr_ordering: true,
        payment_timing: "EITHER",
        qr_ordering_mode: "ORDER_DIRECT",
        qr_session_policy: "CUSTOMER_CAN_OPEN",
        order_workflow: "TABLE_SERVICE",
      }),
    });
  });

  await page.route("**/api/v1/service-areas/**", async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        { id: "area-1", name: "Ground Floor Dining", sort_order: 1, is_active: true, service_charge_bps: 0, area_type: "DINING" },
        { id: "area-2", name: "First Floor Banquet", sort_order: 2, is_active: true, service_charge_bps: 500, area_type: "BANQUET" },
      ]),
    });
  });

  await page.route("**/api/v1/sections/**", async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        { id: "sec-1", name: "Family AC Hall", service_area_id: "area-1", color: "#3B82F6", sort_order: 1 },
        { id: "sec-2", name: "Garden Verandah", service_area_id: "area-1", color: "#10B981", sort_order: 2 },
        { id: "sec-3", name: "VIP Suite", service_area_id: "area-2", color: "#8B5CF6", sort_order: 1 },
      ]),
    });
  });

  await page.route("**/api/v1/tables/**", async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        { id: "tbl-1", label: "T1", capacity: 4, status: "AVAILABLE", service_area_name: "Ground Floor Dining", section_name: "Family AC Hall", section: { id: "sec-1", name: "Family AC Hall" }, is_active: true },
        { id: "tbl-2", label: "T2", capacity: 2, status: "OCCUPIED", service_area_name: "Ground Floor Dining", section_name: "Family AC Hall", section: { id: "sec-1", name: "Family AC Hall" }, is_active: true },
        { id: "tbl-3", label: "T3", capacity: 4, status: "BILLING", service_area_name: "Ground Floor Dining", section_name: "Garden Verandah", section: { id: "sec-2", name: "Garden Verandah" }, is_active: true },
        { id: "tbl-4", label: "T4", capacity: 6, status: "RESERVED", service_area_name: "Ground Floor Dining", section_name: "Garden Verandah", section: { id: "sec-2", name: "Garden Verandah" }, is_active: true },
        { id: "tbl-10", label: "T10", capacity: 8, status: "AVAILABLE", service_area_name: "First Floor Banquet", section_name: "VIP Suite", section: { id: "sec-3", name: "VIP Suite" }, is_active: true },
      ]),
    });
  });

  await page.route("**/api/v1/staff/**", async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        { id: "mem-1", user: { id: "u-1", email: "ramesh@madrascafe.com", full_name: "Ramesh Owner", phone: "+91 98765 11111" }, role: "OWNER", is_active: true, branches: [{ id: "br-1", name: "Main Outlet" }] },
        { id: "mem-2", user: { id: "u-2", email: "kavitha@madrascafe.com", full_name: "Kavitha Raman", phone: "+91 98765 22222" }, role: "BRANCH_MANAGER", is_active: true, branches: [{ id: "br-1", name: "Main Outlet" }] },
        { id: "mem-3", user: { id: "u-3", email: "suresh@madrascafe.com", full_name: "Suresh Cashier", phone: "+91 98765 33333" }, role: "CASHIER", is_active: true, branches: [{ id: "br-1", name: "Main Outlet" }] },
        { id: "mem-4", user: { id: "u-4", email: "anand@madrascafe.com", full_name: "Anand Waiter", phone: "+91 98765 44444" }, role: "WAITER", is_active: true, branches: [{ id: "br-1", name: "Main Outlet" }] },
      ]),
    });
  });
}

test.describe("Prompt 3C: Management Screens Artifact Capture", () => {
  test.beforeAll(async () => {
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }
  });

  test("Capture Branches Management (Desktop Light)", async ({ page }) => {
    await setupMockApiForCapture(page, "CAFE");
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/branches");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("Main Outlet (Anna Salai)")).toBeVisible();

    await page.screenshot({
      path: path.join(screenshotsDir, "18-branches-desktop.png"),
      fullPage: true,
    });
  });

  test("Capture Areas & Sections Management (Desktop Light)", async ({ page }) => {
    await setupMockApiForCapture(page, "CAFE");
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/venue/areas");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("Ground Floor Dining")).toBeVisible();
    await expect(page.getByText("Family AC Hall")).toBeVisible();

    await page.screenshot({
      path: path.join(screenshotsDir, "19-areas-sections-desktop.png"),
      fullPage: true,
    });
  });

  test("Capture Dining Tables DataTable (Desktop Light)", async ({ page }) => {
    await setupMockApiForCapture(page, "CAFE");
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/venue/tables");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("T10", { exact: true })).toBeVisible();

    await page.screenshot({
      path: path.join(screenshotsDir, "20-tables-datatable-desktop.png"),
      fullPage: true,
    });
  });

  test("Capture Floor Plan View (Desktop Light)", async ({ page }) => {
    await setupMockApiForCapture(page, "CAFE");
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/venue/floor");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(/Drag-and-drop editing comes later/i)).toBeVisible();
    await expect(page.getByText("T1", { exact: true })).toBeVisible();

    await page.screenshot({
      path: path.join(screenshotsDir, "21-floor-plan-desktop.png"),
      fullPage: true,
    });
  });

  test("Capture Floor Plan View (Dark + Touch Mode)", async ({ page }) => {
    await setupMockApiForCapture(page, "CAFE");
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/venue/floor");
    await page.waitForLoadState("networkidle");

    // Enable dark and touch mode
    await page.evaluate(() => {
      document.documentElement.classList.add("dark");
      document.documentElement.setAttribute("data-theme", "dark");
      document.documentElement.setAttribute("data-touch", "true");
    });
    await page.waitForTimeout(300);

    await page.screenshot({
      path: path.join(screenshotsDir, "22-floor-plan-dark-touch.png"),
      fullPage: true,
    });
  });

  test("Capture Counters & Tokens Station (Desktop Light)", async ({ page }) => {
    await setupMockApiForCapture(page, "QUICK_SERVICE");
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/venue/counters");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("Now Serving")).toBeVisible();

    await page.screenshot({
      path: path.join(screenshotsDir, "23-counters-tokens-desktop.png"),
      fullPage: true,
    });
  });

  test("Capture Counters & Tokens Station (Mobile Viewport)", async ({ page }) => {
    await setupMockApiForCapture(page, "QUICK_SERVICE");
    await page.setViewportSize({ width: 412, height: 915 }); // Pixel 7
    await page.goto("/venue/counters");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("Now Serving")).toBeVisible();

    await page.screenshot({
      path: path.join(screenshotsDir, "24-counters-tokens-mobile.png"),
      fullPage: true,
    });
  });

  test("Capture Staff Management (Desktop Light)", async ({ page }) => {
    await setupMockApiForCapture(page, "CAFE");
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/staff");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("table").getByText("Ramesh Owner")).toBeVisible();
    await expect(page.getByText("Kavitha Raman")).toBeVisible();

    await page.screenshot({
      path: path.join(screenshotsDir, "25-staff-management-desktop.png"),
      fullPage: true,
    });
  });

  test("Capture Venue Settings & Capabilities (Desktop Light)", async ({ page }) => {
    await setupMockApiForCapture(page, "CAFE");
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/settings/venue");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("Dining & Floor Layout")).toBeVisible();
    await expect(page.getByText("Ordering & Workflow")).toBeVisible();

    await page.screenshot({
      path: path.join(screenshotsDir, "26-settings-venue-desktop.png"),
      fullPage: true,
    });
  });
});

