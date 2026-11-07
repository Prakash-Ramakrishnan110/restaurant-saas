import { test, expect } from "@playwright/test";

// Helper to mock auth & common tenant endpoints for a given role
async function setupOperationsMock(
  page: any,
  role: string = "OWNER",
  isPlatformAdmin: boolean = false
) {
  const permissionsByRole: Record<string, string[]> = {
    OWNER: [
      "business.manage",
      "business.view",
      "branch.view",
      "area.view",
      "table.view",
      "floor.manage",
      "staff.view",
      "qr.view",
      "menu.view",
      "menu.manage",
      "menu.availability",
      "order.create",
      "order.view",
    ],
    WAITER: ["table.view", "menu.view", "order.create", "order.view"],
    KITCHEN: ["menu.view", "menu.availability", "order.view"],
    CASHIER: ["menu.view", "order.create", "order.view", "business.view"],
  };

  await page.addInitScript(() => {
    localStorage.setItem("servemyfood_has_session", "true");
    localStorage.setItem("servemyfood_tenant_id", "ten-alpha-1");
  });

  await page.route("**/api/v1/auth/refresh/", async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ access: "fake-jwt-token" }),
    });
  });

  await page.route("**/api/v1/auth/me/", async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        user: {
          id: "usr-tester-1",
          email: `${role.toLowerCase()}@testops.in`,
          full_name: `${role} User`,
          must_change_password: false,
          is_platform_admin: isPlatformAdmin,
        },
        memberships: [
          {
            tenant_id: "ten-alpha-1",
            tenant_name: "Grand Spice Haven",
            tenant_slug: "grand-spice-haven",
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
        name: "Grand Spice Haven",
        business_type: "CASUAL_DINING",
        venue_profile: "CASUAL_DINING",
        uses_tables: true,
        business_settings: {
          display_name: "Grand Spice Haven",
          brand_primary_color: "#FF6A00",
          document_language: "EN_TA",
          receipt_footer_text: "Thank you for dining with Grand Spice Haven!",
          legal_name: "Grand Spice Hospitality LLP",
          gstin: "33AAAAA0000A1Z5",
          registered_address: "123 OMR IT Expressway, Chennai, TN",
        },
      }),
    });
  });

  await page.route("**/api/v1/subscriptions/entitlements/", async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        plan_name: "Professional Plan",
        limits: {
          max_tables: { limit: 50, current: 10, remaining: 40 },
          max_menu_items: { limit: 100, current: 15, remaining: 85 },
        },
      }),
    });
  });

  await page.route("**/api/v1/branches/", async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        results: [{ id: "br-1", name: "Main Dining Hall", is_active: true }],
      }),
    });
  });

  // Mock tables
  const mockTables = [
    {
      id: "tbl-1",
      label: "T1",
      capacity: 4,
      status: "AVAILABLE",
      section: { name: "AC Dining" },
    },
    {
      id: "tbl-2",
      label: "T2",
      capacity: 2,
      status: "OCCUPIED",
      section: { name: "AC Dining" },
    },
    {
      id: "tbl-3",
      label: "T3",
      capacity: 6,
      status: "AVAILABLE",
      section: { name: "Garden" },
    },
  ];

  await page.route("**/api/v1/tables/", async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ results: mockTables }),
    });
  });

  // Dynamic sessions store
  const mockSessions: any[] = [
    {
      id: "sess-2",
      table: { id: "tbl-2", label: "T2" },
      guest_count: 2,
      status: "OPEN",
      session_code: "SES-102",
      opened_at: new Date(Date.now() - 35 * 60000).toISOString(),
    },
  ];

  await page.route("**/api/v1/sessions/**", async (route: any) => {
    if (route.request().method() === "POST") {
      const newSess = {
        id: "sess-new",
        table: { id: "tbl-1", label: "T1" },
        guest_count: 4,
        session_code: "SES-103",
        status: "OPEN",
      };
      mockSessions.push(newSess);
      const t1 = mockTables.find((t) => t.id === "tbl-1");
      if (t1) t1.status = "OCCUPIED";

      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify(newSess),
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ results: mockSessions }),
      });
    }
  });

  // Mock categories & menu items
  await page.route("**/api/v1/menu/categories/", async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        results: [
          { id: "cat-1", name: "Starters" },
          { id: "cat-2", name: "Main Course" },
          { id: "cat-3", name: "Beverages" },
        ],
      }),
    });
  });

  await page.route("**/api/v1/menu/items/", async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        results: [
          {
            id: "itm-1",
            name: "Paneer Tikka Angare",
            category: { id: "cat-1", name: "Starters" },
            base_price_paise: 28000,
            food_type: "VEG",
            is_active: true,
          },
          {
            id: "itm-2",
            name: "Murgh Malai Kebab",
            category: { id: "cat-1", name: "Starters" },
            base_price_paise: 34000,
            food_type: "NON_VEG",
            is_active: true,
          },
          {
            id: "itm-3",
            name: "Dal Makhani Heritage",
            category: { id: "cat-2", name: "Main Course" },
            base_price_paise: 24000,
            food_type: "VEG",
            is_active: true,
          },
        ],
      }),
    });
  });

  await page.route("**/api/v1/menu/availability/**", async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ results: [] }),
    });
  });

  // Mock orders & KDS
  await page.route("**/api/v1/orders/service-requests/**", async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([]),
    });
  });

  // Mock KDS tickets
  const mockKDSTickets = [
    {
      id: "ord-101",
      branch_id: "br-1",
      table_session_id: "sess-2",
      table_label: "T2",
      order_workflow: "DINE_IN",
      status: "PLACED",
      placed_at: new Date(Date.now() - 12 * 60000).toISOString(),
      notes: "Less spicy please",
      elapsed_minutes: 12,
      total_paise: 52000,
      items: [
        {
          id: "oi-1",
          item_name: "Paneer Tikka Angare",
          quantity: 1,
          course: "STARTER",
          status: "PLACED",
          notes: "Extra mint chutney",
          unit_price_paise: 28000,
          subtotal_paise: 28000,
        },
        {
          id: "oi-2",
          item_name: "Dal Makhani Heritage",
          quantity: 1,
          course: "MAIN",
          status: "COOKING",
          notes: "",
          unit_price_paise: 24000,
          subtotal_paise: 24000,
        },
      ],
    },
  ];

  await page.route("**/api/v1/orders/kds/**", async (route: any) => {
    if (route.request().url().includes("/bump/")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ order_id: "ord-101", status: "SERVED" }),
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockKDSTickets),
      });
    }
  });

  // Mock billing endpoints
  await page.route("**/api/v1/orders/billing/session/**", async (route: any) => {
    if (route.request().url().includes("/settle")) {
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          id: "inv-5001",
          invoice_number: "INV-2026-5001",
          table_session_id: "sess-2",
          table_label: "T2",
          subtotal_paise: 52000,
          discount_paise: 0,
          total_paise: 52000,
          payment_method: "CASH",
          amount_tendered_paise: 55000,
          change_due_paise: 3000,
          is_settled: true,
          settled_at: new Date().toISOString(),
          notes: "",
        }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        table_label: "T2",
        session_code: "SES-102",
        items_count: 2,
        subtotal_paise: 52000,
        total_paise: 52000,
        items: [
          {
            item_name: "Paneer Tikka Angare",
            quantity: 1,
            unit_price_paise: 28000,
            subtotal_paise: 28000,
            course: "STARTER",
          },
          {
            item_name: "Dal Makhani Heritage",
            quantity: 1,
            unit_price_paise: 24000,
            subtotal_paise: 24000,
            course: "MAIN",
          },
        ],
      }),
    });
  });

  await page.route("**/api/v1/orders/billing/invoices/", async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          id: "inv-5001",
          invoice_number: "INV-2026-5001",
          table_label: "T2",
          total_paise: 54600,
          payment_method: "CASH",
          settled_at: new Date().toISOString(),
        },
        {
          id: "inv-5002",
          invoice_number: "INV-2026-5002",
          table_label: "T4",
          total_paise: 38000,
          payment_method: "UPI",
          settled_at: new Date().toISOString(),
        },
      ]),
    });
  });

  // Mock general orders create
  await page.route("**/api/v1/orders/", async (route: any) => {
    if (route.request().method() === "POST") {
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          id: "ord-101",
          order_number: "ORD-101",
          status: "PLACED",
          items_count: 1,
          total_paise: 28000,
        }),
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    }
  });

  // Mock platform tenants
  await page.route("**/api/v1/tenants/**", async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        results: [
          {
            id: "ten-alpha-1",
            name: "Grand Spice Haven",
            slug: "grand-spice-haven",
            business_type: "CASUAL_DINING",
            status: "ACTIVE",
            owner_email: "owner@testops.in",
            created_at: "2026-01-15T10:00:00Z",
            branches_count: 2,
            tables_count: 14,
            active_plan: "Professional",
          },
          {
            id: "ten-beta-2",
            name: "Chai Express Central",
            slug: "chai-express",
            business_type: "QUICK_SERVICE",
            status: "ACTIVE",
            owner_email: "chai@express.in",
            created_at: "2026-02-01T08:30:00Z",
            branches_count: 1,
            tables_count: 0,
            active_plan: "Starter",
          },
        ],
      }),
    });
  });
}

// Helper to open sidebar if on mobile viewport
async function ensureSidebarVisible(page: any) {
  const toggleBtn = page.locator('button[aria-label="Toggle navigation menu"]');
  if (await toggleBtn.isVisible()) {
    await toggleBtn.click();
    await page.waitForTimeout(300);
  }
}

test.describe("Production Operational & Sidebar Suite", () => {
  test("Option 1: Dynamic Role-based Sidebar Navigation", async ({ page }) => {
    // 1. Owner view
    await setupOperationsMock(page, "OWNER", false);
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    await ensureSidebarVisible(page);

    // Owner must see all operational daily work links
    await expect(page.getByRole("link", { name: "Floor POS" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Kitchen KDS" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Cashier Billing" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Menu", exact: true })).toBeVisible();

    // Owner must NOT see Super Admin by default
    await expect(page.getByText("Super Admin")).not.toBeVisible();

    // 2. Platform Admin view
    await setupOperationsMock(page, "OWNER", true);
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    await ensureSidebarVisible(page);
    await expect(page.getByText("Super Admin")).toBeVisible();
    await expect(page.getByRole("link", { name: "Tenants Directory" })).toBeVisible();

    // 3. Waiter view
    await setupOperationsMock(page, "WAITER", false);
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    await ensureSidebarVisible(page);
    await expect(page.getByRole("link", { name: "Floor POS" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Menu", exact: true })).toBeVisible();
    // Waiter must NOT see Kitchen KDS or Settings
    await expect(page.getByRole("link", { name: "Kitchen KDS" })).not.toBeVisible();
    await expect(page.getByRole("link", { name: "Settings" })).not.toBeVisible();

    // 4. Kitchen view
    await setupOperationsMock(page, "KITCHEN", false);
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    await ensureSidebarVisible(page);
    await expect(page.getByRole("link", { name: "Kitchen KDS" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Today's Availability" })).toBeVisible();
    // Kitchen must NOT see POS or Billing
    await expect(page.getByRole("link", { name: "Floor POS" })).not.toBeVisible();
    await expect(page.getByRole("link", { name: "Cashier Billing" })).not.toBeVisible();
  });

  test("Option 2: Live Floor POS Table Selection, Search, Cart & Order Dispatch", async ({
    page,
  }) => {
    await setupOperationsMock(page, "OWNER", false);
    await page.goto("/pos");
    await page.waitForLoadState("networkidle");

    // Verify Header & Sections
    await expect(page.getByRole("heading", { name: "Floor Tables" })).toBeVisible();

    // Verify Dining Tables cards and select available Table T1
    const t1Btn = page.getByRole("button", { name: /T1 Free/i });
    await expect(t1Btn).toBeVisible();
    await t1Btn.click();

    // Seat Guests Modal opens for available table
    await expect(page.getByText("Seat Guests at Table T1")).toBeVisible();
    await page.getByRole("button", { name: "Open Dining Session" }).click();

    // Menu Item add to cart
    await expect(page.getByRole("heading", { name: "Paneer Tikka Angare" })).toBeVisible();
    await page.getByRole("heading", { name: "Paneer Tikka Angare" }).click();

    // Verify Column 3 displays Order Target
    await expect(page.getByText("Order Target")).toBeVisible();

    // Dispatch Order
    const placeOrderBtn = page.getByRole("button", { name: /Fire Order to Kitchen/i });
    await expect(placeOrderBtn).toBeVisible();
    await placeOrderBtn.click();

    // Verify Success notification
    await expect(page.getByText(/Order fired to kitchen/i)).toBeVisible();
  });

  test("Option 3: Kitchen Display System (KDS) Realtime Bump Bar", async ({ page }) => {
    await setupOperationsMock(page, "KITCHEN", false);
    await page.goto("/kds");
    await page.waitForLoadState("networkidle");

    // Header verification
    await expect(page.getByText("Kitchen Display System")).toBeVisible();

    // Ticket Card verification (Table T2, Line item)
    await expect(page.getByText("T2", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Paneer Tikka Angare")).toBeVisible();

    // Bump Action: Start Cooking
    const startCookingBtn = page.getByRole("button", { name: "Start Cooking" });
    await expect(startCookingBtn).toBeVisible();
    await startCookingBtn.click();

    // Verify ticket queue transitions
    await expect(page.getByText("Active Tickets")).toBeVisible();
  });

  test("Option 4: Cashier Billing, Multi-Split Settlement & 80mm Receipt", async ({ page }) => {
    await setupOperationsMock(page, "CASHIER", false);
    await page.goto("/billing");
    await page.waitForLoadState("networkidle");

    // Header
    await expect(page.getByText("Cashier POS & Bill Settlement")).toBeVisible();

    // Select Active Session for Table T2
    const sessionBtn = page.getByRole("button", { name: /Table T2/ });
    if (await sessionBtn.isVisible()) {
      await sessionBtn.click();
    }

    // Bill calculation card
    await expect(page.getByText("Subtotal:")).toBeVisible();
    await expect(page.getByText("₹520.00").first()).toBeVisible(); // Subtotal
    await expect(page.getByText("Grand Total:")).toBeVisible();

    // Settle Bill with Cash
    const settleBtn = page.getByRole("button", { name: /Settle & Print Receipt/i });
    await expect(settleBtn).toBeVisible();
    await settleBtn.click();

    // Verify 80mm Thermal Receipt Dialog appears
    await expect(page.getByText(/Receipt INV-2026-5001/i)).toBeVisible();
    await expect(page.getByText("DEMO RECEIPT - NOT A TAX INVOICE")).toBeVisible();
    await expect(page.getByText("GST Tax Invoice", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Print 80mm Receipt" })).toBeVisible();
  });

  test("Option 5: Shift Closeout & Z-Report Reconciliation", async ({ page }) => {
    await setupOperationsMock(page, "CASHIER", false);
    await page.goto("/billing/closeout");
    await page.waitForLoadState("networkidle");

    // Header
    await expect(page.getByText("Cashier Shift Closeout (Z-Report)")).toBeVisible();

    // Enter actual counted cash
    const cashInput = page.getByPlaceholder("Enter counted cash...");
    await cashInput.fill("2546.00");

    // Perform reconciliation
    await page.getByRole("button", { name: "Reconcile & Generate Z-Report" }).click();

    // Verify Z-Report Preview is rendered
    await expect(page.getByText("Shift Z-Report Summary")).toBeVisible();
    await expect(page.getByText("Expected Drawer Cash:")).toBeVisible();
    await expect(page.getByRole("button", { name: "Print Z-Report" })).toBeVisible();
  });

  test("Option 6: Platform Super Admin Multi-Tenant Directory", async ({ page }) => {
    await setupOperationsMock(page, "OWNER", true); // Platform Admin
    await page.goto("/admin/tenants");
    await page.waitForLoadState("networkidle");

    // Header
    await expect(page.getByText("Super-Admin Command Center")).toBeVisible();
    await expect(page.getByText("All Registered Restaurant Tenants")).toBeVisible();

    // Verify tenants in directory table
    await expect(page.getByRole("table").getByText("Grand Spice Haven")).toBeVisible();
    await expect(page.getByRole("table").getByText("Chai Express Central")).toBeVisible();
  });
});
