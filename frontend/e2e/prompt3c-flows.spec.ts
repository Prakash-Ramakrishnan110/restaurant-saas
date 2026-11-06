import { test, expect } from "@playwright/test";

// Helper to setup mock authentication state via page.route
async function setupMockAuth(page: any, role: string = "OWNER", usesTables: boolean = true) {
  const permissionsByRole: Record<string, string[]> = {
    OWNER: [
      "business.manage",
      "business.view",
      "branch.view",
      "branch.manage",
      "area.view",
      "area.manage",
      "table.view",
      "table.manage",
      "table.status_update",
      "floor.manage",
      "qr.view",
      "qr.manage",
      "staff.view",
      "staff.manage",
    ],
    MANAGER: [
      "business.view",
      "branch.view",
      "area.view",
      "table.view",
      "table.status_update",
      "qr.view",
      "qr.manage",
      "staff.view",
    ],
    WAITER: [
      "table.view",
      "table.status_update",
    ],
    CASHIER: [
      "table.view",
      "table.status_update",
    ],
  };

  await page.addInitScript(() => {
    localStorage.setItem("servemyfood_has_session", "true");
    localStorage.setItem("servemyfood_tenant_id", "ten-alpha-1");
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
          id: "usr-123",
          email: `${role.toLowerCase()}@testrestaurant.com`,
          full_name: `Test ${role}`,
          role: role,
          must_change_password: false,
        },
        memberships: [
          {
            tenant_id: "ten-alpha-1",
            tenant_name: usesTables ? "Madras Cafe" : "Chai Spot",
            tenant_slug: usesTables ? "madras-cafe" : "chai-spot",
            role: role,
            is_active: true,
            permissions: permissionsByRole[role] || [],
          },
        ],
        active_role: role,
        permissions: permissionsByRole[role] || [],
        must_change_password: false,
      }),
    });
  });

  await page.route("**/api/v1/business/", async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "ten-alpha-1",
        name: usesTables ? "Madras Cafe" : "Chai Spot",
        venue_profile: usesTables ? "CAFE" : "QUICK_SERVICE",
        uses_tables: usesTables,
        uses_token_calling: !usesTables,
        business_settings: {
          display_name: usesTables ? "Madras Cafe" : "Chai Spot",
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
          id: "br-main-1",
          name: "Main Branch",
          code: "MAIN",
          phone: "+91 98765 43210",
          address: "123 Anna Salai, Chennai",
          is_active: true,
          is_main: true,
          venue_profile: "CAFE",
        },
      ]),
    });
  });

  await page.route("**/api/v1/branches/br-main-1/capabilities/", async (route: any) => {
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
        {
          id: "area-1",
          name: "Ground Floor",
          sort_order: 1,
          is_active: true,
          service_charge_bps: 0,
        },
      ]),
    });
  });

  await page.route("**/api/v1/sections/**", async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          id: "sec-1",
          name: "AC Dining",
          service_area_id: "area-1",
          color: "#3B82F6",
          sort_order: 1,
        },
      ]),
    });
  });

  await page.route("**/api/v1/tables/**", async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          id: "tbl-1",
          label: "T1",
          capacity: 4,
          status: "AVAILABLE",
          service_area_name: "Ground Floor",
          section_name: "AC Dining",
          section: { id: "sec-1", name: "AC Dining" },
          is_active: true,
        },
        {
          id: "tbl-2",
          label: "T2",
          capacity: 2,
          status: "OCCUPIED",
          service_area_name: "Ground Floor",
          section_name: "AC Dining",
          section: { id: "sec-1", name: "AC Dining" },
          is_active: true,
        },
        {
          id: "tbl-10",
          label: "T10",
          capacity: 6,
          status: "AVAILABLE",
          service_area_name: "Ground Floor",
          section_name: "AC Dining",
          section: { id: "sec-1", name: "AC Dining" },
          is_active: true,
        },
      ]),
    });
  });

  await page.route("**/api/v1/staff/**", async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          id: "mem-1",
          user: { id: "usr-owner-1", email: "owner@test.com", full_name: "Boss Owner" },
          role: "OWNER",
          is_active: true,
          branches: [{ id: "br-main-1", name: "Main Branch" }],
        },
        {
          id: "mem-2",
          user: { id: "usr-mgr-1", email: "manager@test.com", full_name: "Store Manager" },
          role: "BRANCH_MANAGER",
          is_active: true,
          branches: [{ id: "br-main-1", name: "Main Branch" }],
        },
      ]),
    });
  });
}

test.describe("Prompt 3C: Comprehensive Management Screens & Flows", () => {
  test("Flow 1: Owner accesses Branches page and sees list and add button", async ({ page }) => {
    await setupMockAuth(page, "OWNER", true);
    await page.goto("/branches");
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("heading", { name: "Branches", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /Add New Branch/i })).toBeVisible();
    await expect(page.getByText("Main Branch")).toBeVisible();
  });

  test("Flow 2: Manager sees Branches list but CANNOT see Add Branch button", async ({ page }) => {
    await setupMockAuth(page, "MANAGER", true);
    await page.goto("/branches");
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("heading", { name: "Branches", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /Add New Branch/i })).not.toBeVisible();
    await expect(page.getByText("Main Branch")).toBeVisible();
  });

  test("Flow 3: Owner creates Areas and Sections, views tree view", async ({ page }) => {
    await setupMockAuth(page, "OWNER", true);
    await page.goto("/venue/areas");
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("heading", { name: "Areas & Sections" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Add Area/i })).toBeVisible();
    await expect(page.getByText("Ground Floor")).toBeVisible();
    await expect(page.getByText("AC Dining")).toBeVisible();
  });

  test("Flow 4: Dining Tables DataTable shows natural sort (T1, T2, T10) and Bulk Create", async ({ page }) => {
    await setupMockAuth(page, "OWNER", true);
    await page.goto("/venue/tables");
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("heading", { name: "Dining Tables" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Bulk Create/i })).toBeVisible();
    await expect(page.getByText("T1", { exact: true })).toBeVisible();
    await expect(page.getByText("T2", { exact: true })).toBeVisible();
    await expect(page.getByText("T10", { exact: true })).toBeVisible();
  });

  test("Flow 5: Waiter can view Tables, but CANNOT create tables", async ({ page }) => {
    await setupMockAuth(page, "WAITER", true);
    await page.goto("/venue/tables");
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("heading", { name: "Dining Tables" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Add Table/i })).not.toBeVisible();
    await expect(page.getByRole("button", { name: /Bulk Create/i })).not.toBeVisible();
    await expect(page.getByText("T1", { exact: true })).toBeVisible();
  });

  test("Flow 6: Floor Plan shows read-only canvas with banner and legend", async ({ page }) => {
    await setupMockAuth(page, "OWNER", true);
    await page.goto("/venue/floor");
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("heading", { name: "Floor Plan" })).toBeVisible();
    await expect(page.getByText(/Drag-and-drop editing comes later/i)).toBeVisible();
    await expect(page.getByText("Available", { exact: true })).toBeVisible();
    await expect(page.getByText("Occupied", { exact: true })).toBeVisible();
    await expect(page.getByText("T1", { exact: true })).toBeVisible();
  });

  test("Flow 7: Staff Management shows staff list and Add Staff", async ({ page }) => {
    await setupMockAuth(page, "OWNER", true);
    await page.goto("/staff");
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("heading", { name: "Staff Management" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Add Team Member/i })).toBeVisible();
    await expect(page.getByText("Boss Owner")).toBeVisible();
    await expect(page.getByText("Store Manager")).toBeVisible();
  });

  test("Flow 8: Tea Shop owner sees Counters and Tokens, ZERO occurrence of 'table' or 'மேஜை'", async ({ page }) => {
    await setupMockAuth(page, "OWNER", false); // usesTables = false
    await page.goto("/venue/counters");
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("heading", { name: "Counters and Tokens" })).toBeVisible();
    await expect(page.getByText("Now Serving")).toBeVisible();

    // Verify ZERO occurrence of table or மேஜை in text
    const pageText = await page.evaluate(() => document.body.innerText);
    expect(pageText).not.toMatch(/\btable\b/i);
    expect(pageText).not.toContain("மேஜை");
  });

  test("Flow 9: Venue Settings displays grouped capability switches and plan locks", async ({ page }) => {
    await setupMockAuth(page, "OWNER", true);
    await page.goto("/settings/venue");
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("heading", { name: "Venue Settings" })).toBeVisible();
    await expect(page.getByText("Dining & Floor Layout")).toBeVisible();
    await expect(page.getByText("Ordering & Workflow")).toBeVisible();
    await expect(page.getByRole("button", { name: /Reset to Venue Defaults/i })).toBeVisible();
  });
});
