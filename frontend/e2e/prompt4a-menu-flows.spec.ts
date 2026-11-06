import { test, expect } from "@playwright/test";
import path from "path";

// Helper to setup mock authentication state and menu API routes
async function setupMenuRoutes(page: any, role: string = "OWNER") {
  const permissionsByRole: Record<string, string[]> = {
    OWNER: [
      "business.manage",
      "business.view",
      "branch.view",
      "menu.view",
      "menu.manage",
      "menu.availability",
    ],
    BRANCH_MANAGER: [
      "business.view",
      "branch.view",
      "menu.view",
      "menu.manage",
      "menu.availability",
    ],
    WAITER: [
      "menu.view",
      "menu.availability",
    ],
    CASHIER: [
      "menu.view",
      "menu.availability",
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
      body: JSON.stringify({ access: "fake-jwt-token" }),
    });
  });

  await page.route("**/api/v1/auth/me/", async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        user: {
          id: "usr-menu-1",
          email: "owner@demo.in",
          full_name: "Demo Owner",
          must_change_password: false,
          is_platform_admin: false,
        },
        memberships: [
          {
            tenant_id: "ten-alpha-1",
            tenant_name: "Spice Garden",
            tenant_slug: "spice-garden",
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
        business_type: "CASUAL_DINING",
        venue_profile: "CASUAL_DINING",
        uses_tables: true,
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
          max_menu_items: { limit: 100, current: 5, remaining: 95, over_limit: false },
          max_image_storage_mb: { limit: 50, current: 2.4, remaining: 47.6, over_limit: false },
        },
      }),
    });
  });

  await page.route("**/api/v1/branches/", async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        results: [
          { id: "br-1", name: "Indiranagar Main", is_active: true },
          { id: "br-2", name: "Koramangala Outlet", is_active: true },
        ],
      }),
    });
  });

  const categories = [
    { id: "cat-1", name: "Starters", name_ta: "தொடக்க உணவுகள்", sort_order: 1 },
    { id: "cat-2", name: "Main Course", name_ta: "பிரதான உணவுகள்", sort_order: 2 },
    { id: "cat-3", name: "Beverages", name_ta: "பானங்கள்", sort_order: 3 },
  ];

  let items = [
    {
      id: "itm-1",
      category: "cat-1",
      category_name: "Starters",
      name: "Paneer Tikka Angare",
      name_ta: "பனீர் டிக்கா",
      description: "Char-grilled cottage cheese marinated in spiced yogurt",
      base_price_paise: 28000,
      food_type: "VEG",
      prep_minutes: 15,
      is_bestseller: true,
      is_active: true,
      variants: [],
      is_available: true,
    },
    {
      id: "itm-2",
      category: "cat-1",
      category_name: "Starters",
      name: "Murgh Malai Kebab",
      name_ta: "முர்க் மலாய் கபாப்",
      description: "Boneless chicken marinated with cream, cheese, and cardamom",
      base_price_paise: 38000,
      food_type: "NON_VEG",
      prep_minutes: 18,
      is_bestseller: true,
      is_active: true,
      variants: [],
      is_available: true,
    },
    {
      id: "itm-3",
      category: "cat-2",
      category_name: "Main Course",
      name: "Dal Makhani Heritage",
      name_ta: "தால் மக்கானி",
      description: "Slow-cooked black lentils simmered with churned butter",
      base_price_paise: 32000,
      food_type: "VEG",
      prep_minutes: 10,
      is_bestseller: false,
      is_active: true,
      variants: [],
      is_available: false,
    },
    {
      id: "itm-4",
      category: "cat-2",
      category_name: "Main Course",
      name: "Dum Biryani",
      name_ta: "தம் பிரியாணி",
      description: "Layered basmati rice cooked on slow charcoal dum",
      base_price_paise: 36000,
      food_type: "NON_VEG",
      prep_minutes: 20,
      is_bestseller: true,
      is_active: true,
      variants: [
        { id: "var-1", name: "Half", price_paise: 36000, is_default: true },
        { id: "var-2", name: "Full", price_paise: 48000, is_default: false },
      ],
      is_available: true,
    },
    {
      id: "itm-5",
      category: "cat-3",
      category_name: "Beverages",
      name: "Masala Chai",
      name_ta: "மசாலா தேநீர்",
      description: "Freshly brewed spiced tea with ginger and cardamom",
      base_price_paise: 3000,
      food_type: "VEG",
      prep_minutes: 4,
      is_bestseller: false,
      is_active: true,
      variants: [],
      is_available: true,
    },
  ];

  await page.route("**/api/v1/menu/categories/**", async (route: any) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ results: categories }),
      });
    } else {
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ id: "cat-new", name: "Desserts" }),
      });
    }
  });

  await page.route("**/api/v1/menu/option-groups/**", async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        results: [
          { id: "og-1", name: "Spice Level", min_select: 1, max_select: 1 },
          { id: "og-2", name: "Portion Size", min_select: 1, max_select: 1 },
        ],
      }),
    });
  });

  await page.route("**/api/v1/menu/items/bulk-create/", async (route: any) => {
    const data = JSON.parse(route.request().postData() || "{}");
    const count = data.items?.length || 0;
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ status: "success", created_count: count }),
    });
  });

  await page.route("**/api/v1/menu/items/**", async (route: any) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ results: items }),
      });
    } else if (route.request().method() === "POST") {
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          id: "itm-new",
          name: "New Dish",
          base_price_paise: 25000,
          food_type: "VEG",
          is_active: true,
        }),
      });
    } else {
      await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    }
  });

  await page.route("**/api/v1/menu/availability/**", async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ status: "success" }),
    });
  });
}

test.describe("Prompt 4A: Menu Core Management & Availability E2E Suite", () => {
  test("Flow 1: Owner accesses Menu page, views categories, items, and plan usage", async ({ page }) => {
    await setupMenuRoutes(page, "OWNER");
    await page.goto("/menu");

    await expect(page.locator("h1")).toContainText("Menu Management");
    await expect(page.getByText("5 of 100 items used")).toBeVisible();
    await expect(page.getByText("Paneer Tikka Angare")).toBeVisible();
    await expect(page.getByText("₹280")).toBeVisible();
    await expect(page.getByText("Add Item")).toBeVisible();
    await expect(page.getByText("Quick Add (Paste)")).toBeVisible();

    // Screenshot 27: Menu Management Desktop
    await page.screenshot({
      path: path.join("..", "docs", "screenshots", "27-menu-management-desktop.png"),
      fullPage: true,
    });
  });

  test("Flow 2: Owner opens Item Editor Side Sheet and captures view", async ({ page }) => {
    page.on("console", (msg) => console.log("BROWSER CONSOLE:", msg.text()));
    page.on("pageerror", (err) => console.log("BROWSER ERROR:", err.message));
    await setupMenuRoutes(page, "OWNER");
    await page.goto("/menu");
    await expect(page.locator("h1")).toContainText("Menu Management");

    await page.getByRole("button", { name: "Add Item" }).click();
    await expect(page.getByText("Add Menu Item")).toBeVisible();
    await expect(page.getByText("Item Name (English)")).toBeVisible();
    await expect(page.getByText("Base Price (₹)")).toBeVisible();
    await expect(page.getByText("Click photo to set crop focus")).toBeVisible();

    // Screenshot 28: Menu Item Editor Side Sheet
    await page.screenshot({
      path: path.join("..", "docs", "screenshots", "28-menu-item-editor-desktop.png"),
    });
  });

  test("Flow 3: Owner opens Quick Add Dialog and previews spreadsheet paste", async ({ page }) => {
    await setupMenuRoutes(page, "OWNER");
    await page.goto("/menu");
    await expect(page.locator("h1")).toContainText("Menu Management");

    await page.getByRole("button", { name: "Quick Add (Paste)" }).first().click();
    await expect(page.getByText("Quick Add Items from Spreadsheet")).toBeVisible();

    const textarea = page.locator("textarea");
    await textarea.fill("Starters\tCrispy Corn\t220\tVeg\nDesserts\tGulab Jamun\t120\tVeg");
    await expect(page.getByText("Preview (2 valid / 2 total)")).toBeVisible();
    await expect(page.getByRole("cell", { name: "Crispy Corn" })).toBeVisible();

    // Screenshot 29: Menu Quick Add Dialog
    await page.screenshot({
      path: path.join("..", "docs", "screenshots", "29-menu-quick-add-desktop.png"),
    });
  });

  test("Flow 4: Staff accesses Today's Availability and toggles item status", async ({ page }) => {
    await setupMenuRoutes(page, "WAITER");
    await page.goto("/menu/availability");

    await expect(page.locator("h1")).toContainText("Today's Availability");
    await expect(page.getByText("Paneer Tikka Angare")).toBeVisible();
    await expect(page.getByText("Dal Makhani Heritage")).toBeVisible();

    // Screenshot 30: Menu Availability Desktop / Mobile
    const isMobile = page.viewportSize() && page.viewportSize().width < 600;
    if (isMobile) {
      await page.screenshot({
        path: path.join("..", "docs", "screenshots", "31-menu-availability-mobile.png"),
        fullPage: true,
      });
    } else {
      await page.screenshot({
        path: path.join("..", "docs", "screenshots", "30-menu-availability-desktop.png"),
        fullPage: true,
      });
    }

    // Toggle availability
    const firstSwitch = page.locator('button[role="switch"]').first();
    await firstSwitch.click();

    // Verify Undo notification appears
    await expect(page.getByText("Undo")).toBeVisible();
  });

  test("Flow 5: Waiter CANNOT see Add Item or Quick Add on Menu page", async ({ page }) => {
    await setupMenuRoutes(page, "WAITER");
    await page.goto("/menu");

    await expect(page.locator("h1")).toContainText("Menu Management");
    await expect(page.getByText("Paneer Tikka Angare")).toBeVisible();
    await expect(page.getByText("Add Item")).toHaveCount(0);
    await expect(page.getByText("Quick Add (Paste)")).toHaveCount(0);
  });
});

