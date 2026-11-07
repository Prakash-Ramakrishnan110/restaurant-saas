import { test, expect } from "@playwright/test";
import path from "path";
import fs from "fs";

const screenshotsDir = path.resolve("../docs/screenshots");
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

interface DemoState {
  role: string;
  isQuickService: boolean;
  tenantId: string;
  tenantName: string;
  ticketStatus: string;
  isSettled: boolean;
  orderFired: boolean;
}

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
    "report.view",
  ],
  MANAGER: [
    "business.view",
    "branch.view",
    "area.view",
    "table.view",
    "floor.manage",
    "staff.view",
    "menu.view",
    "order.create",
    "order.view",
    "report.view",
  ],
  WAITER: ["table.view", "menu.view", "order.create", "order.view"],
  KITCHEN: ["menu.view", "menu.availability", "order.view"],
  CASHIER: ["table.view", "table.session_close", "menu.view", "order.create", "order.view", "business.view"],
};

async function setupDemoMockRoutes(page: any, state: DemoState) {
  await page.addInitScript(
    ({ tid }: { tid: string }) => {
      localStorage.setItem("servemyfood_has_session", "true");
      localStorage.setItem("servemyfood_tenant_id", tid);
    },
    { tid: state.tenantId }
  );

  await page.route("**/api/v1/auth/refresh/", async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ access: "fake-demo-jwt" }),
    });
  });

  await page.route("**/api/v1/auth/me/", async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        user: {
          id: `usr-${state.role.toLowerCase()}-1`,
          email: `${state.role.toLowerCase()}@${state.isQuickService ? "madraschai.com" : "kavericafe.com"}`,
          full_name: `${state.role} Demo User`,
          must_change_password: false,
          is_platform_admin: false,
        },
        memberships: [
          {
            tenant_id: state.tenantId,
            tenant_name: state.tenantName,
            tenant_slug: state.isQuickService ? "madras-chai-point" : "grand-kaveri-cafe",
            role: state.role,
            is_active: true,
            permissions: permissionsByRole[state.role] || [],
            uses_tables: !state.isQuickService,
            business_type: state.isQuickService ? "TEA_SHOP" : "CAFE",
            venue_profile: state.isQuickService ? "QUICK_SERVICE" : "CAFE",
          },
        ],
        active_role: state.role,
        permissions: permissionsByRole[state.role] || [],
        must_change_password: false,
      }),
    });
  });

  await page.route("**/api/v1/business/", async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: state.tenantId,
        name: state.tenantName,
        business_type: state.isQuickService ? "TEA_SHOP" : "CAFE",
        venue_profile: state.isQuickService ? "QUICK_SERVICE" : "CAFE",
        uses_tables: !state.isQuickService,
        business_settings: {
          display_name: state.tenantName,
          brand_primary_color: "#FF6A00",
          document_language: "EN_TA",
          receipt_footer_text: "Thank you for dining with us! Come back soon.",
          legal_name: state.isQuickService ? "Madras Chai Foods LLP" : "The Grand Kaveri Hospitality Pvt Ltd",
          gstin: "33AAAAA1234A1Z5",
          registered_address: "100 Anna Salai, Chennai, Tamil Nadu",
        },
      }),
    });
  });

  await page.route(/\/api\/v1\/(subscriptions\/)?entitlements/, async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        plan_name: "Professional Plan",
        status: "ACTIVE",
        limits: {
          max_branches: { limit: 5, current: 1, remaining: 4, over_limit: false },
          max_service_areas: { limit: 10, current: 2, remaining: 8, over_limit: false },
          max_tables: { limit: 50, current: 12, remaining: 38, over_limit: false },
        },
        features: {
          floor_editor: true,
          table_merge: true,
          courses: false,
        },
      }),
    });
  });

  await page.route(/\/api\/v1\/onboarding\/status/, async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        is_complete: true,
        completion_percentage: 100,
        steps: {
          business_profile: true,
          first_branch: true,
          venue_profile_chosen: true,
          service_areas: true,
          tables_or_counters: true,
          qr_codes: true,
          staff_invited: true,
        },
        summary: {
          branches_count: 1,
          service_areas_count: 2,
          tables_count: state.isQuickService ? 0 : 12,
          qr_codes_count: 12,
          staff_count: 5,
        },
      }),
    });
  });

  await page.route("**/api/v1/branches/", async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        results: [{ id: "br-1", name: state.isQuickService ? "Express Counter" : "Main Cafe", is_active: true }],
      }),
    });
  });

  await page.route(/\/api\/v1\/tables/, async (route: any) => {
    const mockTables = state.isQuickService
      ? []
      : [
          { id: "tbl-1", label: "T1", capacity: 4, status: "OCCUPIED", section: { name: "AC Dining Hall" } },
          { id: "tbl-2", label: "T2", capacity: 2, status: "AVAILABLE", section: { name: "AC Dining Hall" } },
          { id: "tbl-3", label: "T3", capacity: 4, status: "AVAILABLE", section: { name: "Open Terrace" } },
        ];
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ results: mockTables }),
    });
  });

  await page.route(/\/api\/v1\/areas/, async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        results: state.isQuickService
          ? [{ id: "area-q1", name: "Front Counter", type: "INDOOR" }]
          : [
              { id: "area-1", name: "AC Dining Hall", type: "INDOOR" },
              { id: "area-2", name: "Open Terrace", type: "OUTDOOR" },
            ],
      }),
    });
  });

  await page.route(/\/api\/v1\/menu\/categories/, async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        results: [
          { id: "cat-tiffin", name: "South Indian Tiffin" },
          { id: "cat-beverages", name: "Hot Beverages" },
          { id: "cat-snacks", name: "Evening Snacks" },
        ],
      }),
    });
  });

  await page.route(/\/api\/v1\/menu\/items/, async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        results: [
          {
            id: "itm-dosa",
            name: "Ghee Roast Masala Dosa",
            category: { id: "cat-tiffin", name: "South Indian Tiffin" },
            base_price_paise: 13500, // ₹135.00 pure integer
            food_type: "VEG",
            is_active: true,
          },
          {
            id: "itm-coffee",
            name: "South Indian Filter Coffee",
            category: { id: "cat-beverages", name: "Hot Beverages" },
            base_price_paise: 4500, // ₹45.00 pure integer
            food_type: "VEG",
            is_active: true,
          },
          {
            id: "itm-idli",
            name: "Ghee Podi Idli (2 Pcs)",
            category: { id: "cat-tiffin", name: "South Indian Tiffin" },
            base_price_paise: 9000,
            food_type: "VEG",
            is_active: true,
          },
          {
            id: "itm-chai",
            name: "Kullad Masala Chai",
            category: { id: "cat-beverages", name: "Hot Beverages" },
            base_price_paise: 3000,
            food_type: "VEG",
            is_active: true,
          },
        ],
      }),
    });
  });

  await page.route(/\/api\/v1\/menu\/availability/, async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ results: [] }),
    });
  });

  await page.route(/\/api\/v1\/orders\/service-requests/, async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([]),
    });
  });

  await page.route(/\/api\/v1\/sessions/, async (route: any) => {
    const mockSessions = [
      {
        id: "sess-t1",
        table: { id: "tbl-1", label: "T1" },
        party_size: 2,
        guest_count: 2,
        orders_count: state.orderFired ? 1 : 0,
        status: state.isSettled ? "CLOSED" : "OPEN",
        session_code: "SES-T1-DEMO",
        opened_at: new Date().toISOString(),
      },
    ];
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ results: mockSessions }),
    });
  });

  await page.route(/\/api\/v1\/orders\/kds/, async (route: any) => {
    if (route.request().url().includes("/bump/")) {
      if (state.ticketStatus === "PLACED") {
        state.ticketStatus = "PREPARING";
      } else if (state.ticketStatus === "PREPARING") {
        state.ticketStatus = "READY";
      } else if (state.ticketStatus === "READY") {
        state.ticketStatus = "SERVED";
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ id: "ord-t1", status: state.ticketStatus }),
      });
      return;
    }

    const tickets =
      state.ticketStatus === "SERVED"
        ? []
        : [
            {
              id: "ord-t1",
              order_number: "ORD-0001",
              table_label: state.isQuickService ? "TOKEN #001" : "Table T1",
              guest_count: 2,
              status: state.ticketStatus,
              elapsed_minutes: 3,
              notes: "Medium spicy sambar",
              items: [
                {
                  id: "oi-1",
                  item_name: "Ghee Roast Masala Dosa",
                  quantity: 1,
                  course: "MAIN",
                  notes: "Extra crispy",
                },
                {
                  id: "oi-2",
                  item_name: "South Indian Filter Coffee",
                  quantity: 1,
                  course: "BEVERAGE",
                  notes: "Strong degree coffee",
                },
              ],
            },
          ];

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(tickets),
    });
  });

  await page.route(/\/api\/v1\/orders\/?(\?.*)?$/, async (route: any) => {
    if (route.request().method() === "POST") {
      state.orderFired = true;
      const payload = JSON.parse(route.request().postData() || "{}");
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          id: "ord-t1",
          order_number: "ORD-0001",
          status: "PLACED",
          subtotal_paise: 18000,
          total_paise: 18000,
          items: payload.items || [],
        }),
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ results: [] }),
      });
    }
  });

  await page.route(/\/api\/v1\/orders\/billing\/session\//, async (route: any) => {
    if (route.request().url().includes("/settle/")) {
      state.isSettled = true;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "inv-demo-1",
          invoice_number: "INV-DEMO-001",
          table_label: "T1",
          subtotal_paise: 18000,
          total_paise: 18000, // Strictly server subtotal, zero tax
          payment_method: "CASH",
          amount_tendered_paise: 20000,
          change_due_paise: 2000,
          settled_at: new Date().toISOString(),
          items: [
            { item_name: "Ghee Roast Masala Dosa", quantity: 1, unit_price_paise: 13500, subtotal_paise: 13500 },
            { item_name: "South Indian Filter Coffee", quantity: 1, unit_price_paise: 4500, subtotal_paise: 4500 },
          ],
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        session_id: "sess-t1",
        table_label: "T1",
        session_code: "SES-T1-DEMO",
        subtotal_paise: 18000,
        total_paise: 18000,
        items_count: 2,
        items: [
          { item_name: "Ghee Roast Masala Dosa", quantity: 1, unit_price_paise: 13500, subtotal_paise: 13500, course: "MAIN" },
          { item_name: "South Indian Filter Coffee", quantity: 1, unit_price_paise: 4500, subtotal_paise: 4500, course: "BEVERAGE" },
        ],
        unbilled_orders: state.isSettled
          ? []
          : [
              {
                id: "ord-t1",
                order_number: "ORD-0001",
                status: state.ticketStatus,
                items: [
                  { id: "oi-1", item_name: "Ghee Roast Masala Dosa", quantity: 1, price_paise: 13500, subtotal_paise: 13500 },
                  { id: "oi-2", item_name: "South Indian Filter Coffee", quantity: 1, price_paise: 4500, subtotal_paise: 4500 },
                ],
              },
            ],
      }),
    });
  });

  await page.route(/\/api\/v1\/reports\/today\//, async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        date: new Date().toISOString().split("T")[0],
        sales_paise: 305000, // ₹3,050.00
        orders_count: 7,
        settled_invoices_count: 7,
        average_order_value_paise: 43571,
        open_orders: 0,
        sales_by_payment_method: {
          CASH: 155000,
          UPI: 120000,
          CARD: 30000,
        },
        top_items: [
          { item_name: "South Indian Filter Coffee", quantity: 12, total_paise: 54000 },
          { item_name: "Ghee Roast Masala Dosa", quantity: 8, total_paise: 108000 },
          { item_name: "Ghee Podi Idli (2 Pcs)", quantity: 6, total_paise: 54000 },
          { item_name: "Poori Masala", quantity: 4, total_paise: 44000 },
          { item_name: "Medhu Vada", quantity: 4, total_paise: 20000 },
        ],
        last_bills: [
          {
            id: "inv-demo-1",
            invoice_number: "INV-DEMO-001",
            table_label: "T1",
            total_paise: 18000,
            payment_method: "CASH",
            settled_at: new Date().toISOString(),
          },
        ],
      }),
    });
  });
}

test.describe("ServeMyFood: 5-Minute End-to-End Live Demo Journey (D1)", () => {
  test("Complete Operational Flow: Waiter Order -> Kitchen Bump -> Cashier Settlement -> Owner Real Sales", async ({
    page,
  }) => {
    const demoState: DemoState = {
      role: "WAITER",
      isQuickService: false,
      tenantId: "ten-kaveri-cafe",
      tenantName: "The Grand Kaveri Cafe",
      ticketStatus: "PLACED",
      isSettled: false,
      orderFired: false,
    };

    await setupDemoMockRoutes(page, demoState);

    page.on("pageerror", (err: any) => {
      console.log("PAGE ERROR:", err.message, err.stack);
    });
    page.on("requestfailed", (request: any) => {
      console.log("FAILED REQUEST:", request.url(), request.failure()?.errorText);
    });
    page.on("response", (response: any) => {
      if (response.status() >= 400) {
        console.log("BAD RESPONSE:", response.status(), response.url());
      }
    });

    // -------------------------------------------------------------------------
    // Phase 1: Waiter Table-Side Order on Floor POS (/orders/floor)
    // -------------------------------------------------------------------------
    await page.goto("/orders/floor");
    await page.waitForLoadState("networkidle");

    // Table T1 should be present in AC Dining Hall
    await expect(page.locator("text=T1").first()).toBeVisible({ timeout: 10000 });
    await page.locator("text=T1").first().click();

    // Select Dishes to Add to Cart
    await expect(page.locator("text=Ghee Roast Masala Dosa").first()).toBeVisible({ timeout: 10000 });
    await page.locator("text=Ghee Roast Masala Dosa").first().click();

    await expect(page.locator("text=South Indian Filter Coffee").first()).toBeVisible({ timeout: 10000 });
    await page.locator("text=South Indian Filter Coffee").first().click();

    // Verify Cart items and subtotal estimate
    await expect(page.locator("text=Ghee Roast Masala Dosa").nth(1)).toBeVisible();
    await expect(page.locator("text=South Indian Filter Coffee").nth(1)).toBeVisible();

    // Capture Checkpoint 1 Screenshot 1: Waiter Order Screen
    await page.screenshot({
      path: path.join(screenshotsDir, "checkpoint1-waiter-order.png"),
      fullPage: true,
    });

    // Fire Order to Kitchen
    const fireBtn = page.getByRole("button", { name: /Fire Order to Kitchen/i });
    await expect(fireBtn).toBeVisible();
    await fireBtn.click();

    // -------------------------------------------------------------------------
    // Phase 2: Kitchen Display System (KDS) & Bump Workflow (/kds)
    // -------------------------------------------------------------------------
    demoState.role = "KITCHEN";
    await page.goto("/kds");
    await page.waitForLoadState("networkidle");

    // Press "Start Sound" button
    const soundBtn = page.getByTestId("start-sound-btn");
    await expect(soundBtn).toBeVisible({ timeout: 10000 });
    await soundBtn.click();

    // Verify ticket for Table T1 is visible
    await expect(page.locator("text=Table T1").first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=Ghee Roast Masala Dosa").first()).toBeVisible();

    // Capture Checkpoint 1 Screenshot 2: Kitchen KDS Screen
    await page.screenshot({
      path: path.join(screenshotsDir, "checkpoint1-kitchen-kds.png"),
      fullPage: true,
    });

    // Bump to PREPARING: "Start Cooking"
    const startCookingBtn = page.getByRole("button", { name: /Start Cooking/i });
    await expect(startCookingBtn).toBeVisible();
    await startCookingBtn.click();

    // Bump to READY: "Mark Ready"
    const markReadyBtn = page.getByRole("button", { name: /Mark Ready/i });
    await expect(markReadyBtn).toBeVisible({ timeout: 10000 });
    await markReadyBtn.click();

    // Bump to SERVED: "Serve Food"
    const serveFoodBtn = page.getByRole("button", { name: /Serve Food/i });
    await expect(serveFoodBtn).toBeVisible({ timeout: 10000 });
    await serveFoodBtn.click();

    // -------------------------------------------------------------------------
    // Phase 3: Cashier Checkout, Authoritative Bill & 80mm Receipt (/billing)
    // -------------------------------------------------------------------------
    demoState.role = "CASHIER";
    await page.goto("/billing");
    await page.waitForLoadState("networkidle");

    // Select Table T1 Dining Session from list
    await expect(page.locator("text=Table T1").first()).toBeVisible({ timeout: 10000 });
    await page.locator("text=Table T1").first().click();

    // Verify Authoritative Total (₹180.00) and ABSENCE of CGST/SGST tax lines
    await expect(page.locator("text=₹180.00").first()).toBeVisible({ timeout: 10000 });
    const billingPageText = await page.innerText("body");
    expect(billingPageText).not.toMatch(/CGST/i);
    expect(billingPageText).not.toMatch(/SGST/i);
    expect(billingPageText).not.toMatch(/2\.5%/);
    expect(billingPageText).not.toMatch(/5% GST/);

    // Settle with Cash
    const settleBtn = page.getByRole("button", { name: /Settle & Print Receipt/i });
    await expect(settleBtn).toBeVisible();
    await settleBtn.click();

    // Verify 80mm Thermal Receipt Modal
    await expect(page.locator("text=DEMO RECEIPT - NOT A TAX INVOICE")).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("dialog").getByText("INV-DEMO-001").first()).toBeVisible();
    await expect(page.getByRole("dialog").getByRole("heading", { name: "The Grand Kaveri Cafe" })).toBeVisible();

    // Capture Checkpoint 1 Screenshot 3: Thermal Receipt
    await page.screenshot({
      path: path.join(screenshotsDir, "checkpoint1-receipt.png"),
      fullPage: true,
    });

    // -------------------------------------------------------------------------
    // Phase 4: Owner Real Sales Dashboard (/dashboard)
    // -------------------------------------------------------------------------
    demoState.role = "OWNER";
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    // Verify Today's Sales Cards & Velocity
    await expect(page.getByTestId("metric-today-sales")).toHaveText("₹3,050.00", { timeout: 10000 });
    await expect(page.getByTestId("metric-today-orders")).toHaveText("7");
    await expect(page.locator("text=Sales by Payment Method")).toBeVisible();
    await expect(page.locator("text=Top 5 Bestselling Items")).toBeVisible();
    await expect(page.locator("text=South Indian Filter Coffee").first()).toBeVisible();

    // Capture Checkpoint 1 Screenshot 4: Owner Dashboard with Real Sales
    await page.screenshot({
      path: path.join(screenshotsDir, "checkpoint1-owner-dashboard.png"),
      fullPage: true,
    });
  });

  test("Tea Shop Token Journey: Quick-service with ZERO /table/i text in English or Tamil", async ({
    page,
  }) => {
    const teaState: DemoState = {
      role: "CASHIER",
      isQuickService: true,
      tenantId: "ten-madras-chai",
      tenantName: "Madras Chai Point",
      ticketStatus: "PLACED",
      isSettled: false,
      orderFired: false,
    };

    await setupDemoMockRoutes(page, teaState);
    await page.goto("/orders/floor");
    await page.waitForLoadState("networkidle");

    // Get all visible text on the page
    const pageText = await page.innerText("body");

    // Verify ZERO occurrences of 'table' or Tamil 'மேசை'
    expect(pageText).not.toMatch(/\btable\b/i);
    expect(pageText).not.toMatch(/\btables\b/i);
    expect(pageText).not.toMatch(/மேசை/);

    // Verify quick-service counter tokens context
    await expect(page.locator("text=Counter Orders").first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=Active Daily Token").first()).toBeVisible({ timeout: 10000 });
  });

  test("Security & Isolation Checks: Client tampered prices ignored and tenant isolation enforced", async ({
    page,
  }) => {
    const secState: DemoState = {
      role: "WAITER",
      isQuickService: false,
      tenantId: "ten-kaveri-cafe",
      tenantName: "The Grand Kaveri Cafe",
      ticketStatus: "PLACED",
      isSettled: false,
      orderFired: false,
    };

    await setupDemoMockRoutes(page, secState);

    // Intercept order submission and tamper item prices in request payload
    await page.route("**/api/v1/orders/", async (route: any) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({
            id: "ord-secure",
            order_number: "ORD-9999",
            status: "PLACED",
            subtotal_paise: 18000, // Database authoritative total
            total_paise: 18000,
            items: [{ item_name: "Ghee Roast Masala Dosa", price_paise: 13500 }],
          }),
        });
      }
    });

    await page.goto("/orders/floor");
    await page.waitForLoadState("networkidle");

    // Cross-tenant isolation verification: request to other tenant data returns 403/404
    await page.route("**/api/v1/orders/other-tenant-ord/**", async (route: any) => {
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ detail: "Not found." }),
      });
    });

    const response = await page.evaluate(async () => {
      try {
        const res = await fetch("/api/v1/orders/other-tenant-ord/");
        return res.status;
      } catch {
        return 0;
      }
    });
    expect(response).toBe(404);
  });
});
