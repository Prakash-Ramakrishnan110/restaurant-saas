import { test, expect } from "@playwright/test";

test.describe("ServeMyFood 8 Core E2E Flows", () => {
  // Flow 1: Login & Logout
  test("Flow 1: successful login redirects to dashboard and logout returns to login", async ({ page }) => {
    await page.route("**/api/v1/auth/login/", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          access: "mock-valid-access-token",
          user: {
            id: "user-123",
            email: "owner@fusionengine.in",
            name: "Restaurant Owner",
            role: "OWNER",
            must_change_password: false,
          },
        }),
      });
    });

    await page.route("**/api/v1/auth/me/", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          user: {
            id: "user-123",
            email: "owner@fusionengine.in",
            name: "Restaurant Owner",
            role: "OWNER",
            must_change_password: false,
          },
          memberships: [
            {
              id: "mem-1",
              tenant_id: "tenant-owner-1",
              tenant_name: "Fusion Diner",
              role: "OWNER",
              is_default: true,
            },
          ],
          active_role: "OWNER",
          permissions: ["branch.view", "branch.manage", "floor.manage"],
          must_change_password: false,
        }),
      });
    });

    await page.route("**/api/v1/onboarding/status/", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          steps: [
            { id: "account_setup", label: "Account Setup", completed: true },
            { id: "create_branch", label: "Create Branch", completed: true },
          ],
          is_complete: true,
        }),
      });
    });

    await page.route("**/api/v1/entitlements/", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          plan: "PROFESSIONAL",
          usage: { branches: 1, tables: 12 },
          limits: { branches: 3, tables: 50 },
        }),
      });
    });

    await page.route("**/api/v1/auth/logout/", async (route) => {
      await route.fulfill({ status: 204 });
    });

    await page.goto("/login");
    await page.getByPlaceholder("name@restaurant.com").fill("owner@fusionengine.in");
    await page.getByPlaceholder("••••••••").fill("ValidPass123!");
    await page.getByRole("button", { name: /Sign In|உள்நுழைக/i }).click();

    await expect(page).toHaveURL(/.*dashboard/);
    await expect(page.getByText("Manage Tables")).toBeVisible();

    // Trigger logout
    const logoutBtn = page.getByRole("button", { name: /Sign Out/i }).first();
    await logoutBtn.click();
    await expect(page).toHaveURL(/.*login/);
  });

  // Flow 2: Wrong Password Handling
  test("Flow 2: wrong credentials shows error alert", async ({ page }) => {
    await page.route("**/api/v1/auth/login/", async (route) => {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({
          error: {
            code: "AUTHENTICATION_FAILED",
            message: "Invalid email or password.",
            details: {},
          },
        }),
      });
    });

    await page.goto("/login");
    await page.getByPlaceholder("name@restaurant.com").fill("owner@fusionengine.in");
    await page.getByPlaceholder("••••••••").fill("WrongPassword123!");
    await page.getByRole("button", { name: /Sign In|உள்நுழைக/i }).click();

    await expect(page.getByText(/Invalid email or password/i)).toBeVisible();
  });

  // Flow 3: Rate Limit Countdown / Lockout
  test("Flow 3: 429 response displays active rate-limit countdown timer", async ({ page }) => {
    await page.route("**/api/v1/auth/login/", async (route) => {
      await route.fulfill({
        status: 429,
        contentType: "application/json",
        headers: { "Retry-After": "60" },
        body: JSON.stringify({
          error: {
            code: "RATE_LIMITED",
            message: "Too many login attempts. Please wait before retrying.",
            details: { retry_after: 60 },
          },
        }),
      });
    });

    await page.goto("/login");
    await page.getByPlaceholder("name@restaurant.com").fill("owner@fusionengine.in");
    await page.getByPlaceholder("••••••••").fill("SpamPassword123!");
    await page.getByRole("button", { name: /Sign In|உள்நுழைக/i }).click();

    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page.getByText(/Rate limit reached/i)).toBeVisible();
  });

  // Flow 4: Forced Password Change via Temporary Password
  test("Flow 4: user with must_change_password=true is forced to /change-password", async ({ page }) => {
    let passwordChanged = false;

    await page.route("**/api/v1/auth/login/", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          access: "temp-access-token",
          user: {
            id: "user-456",
            email: "waiter@fusionengine.in",
            name: "New Waiter",
            role: "WAITER",
            must_change_password: true,
          },
        }),
      });
    });

    await page.route("**/api/v1/auth/me/", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          user: {
            id: "user-456",
            email: "waiter@fusionengine.in",
            name: "New Waiter",
            role: "WAITER",
            must_change_password: !passwordChanged,
          },
          memberships: [
            {
              id: "mem-456",
              tenant_id: "tenant-waiter-1",
              tenant_name: "Fusion Diner",
              role: "WAITER",
              is_default: true,
            },
          ],
          active_role: "WAITER",
          permissions: ["table.view"],
          must_change_password: !passwordChanged,
        }),
      });
    });

    await page.route("**/api/v1/auth/change-password/", async (route) => {
      passwordChanged = true;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          access: "fresh-permanent-access-token",
        }),
      });
    });

    await page.route("**/api/v1/onboarding/status/", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ is_complete: true, steps: [] }),
      });
    });

    await page.route("**/api/v1/entitlements/", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ plan: "STARTER", usage: {}, limits: {} }),
      });
    });

    await page.goto("/login");
    await page.getByPlaceholder("name@restaurant.com").fill("waiter@fusionengine.in");
    await page.getByPlaceholder("••••••••").fill("TempPass123!");
    await page.getByRole("button", { name: /Sign In|உள்நுழைக/i }).click();

    await expect(page).toHaveURL(/.*change-password/);
    await expect(page.getByText(/Password Change Required/i)).toBeVisible();

    await page.getByLabel(/Current/i).fill("TempPass123!");
    await page.getByLabel(/^New Password/i).fill("PermanentPass123!");
    await page.getByLabel(/Confirm New Password/i).fill("PermanentPass123!");
    await page.getByRole("button", { name: /Update Password/i }).click();

    await expect(page).toHaveURL(/.*dashboard/);
  });

  // Flow 5: Tenant Suspension Page
  test("Flow 5: suspended tenant displays /suspended page with support email", async ({ page }) => {
    await page.goto("/suspended");
    await expect(page.getByText(/Account Suspended/i)).toBeVisible();
    await expect(page.getByText(/support@fusionengine.in/i)).toBeVisible();
  });

  // Flow 6: Tenant Isolation on Headers
  test("Flow 6: outgoing API requests attach active X-Tenant-ID header", async ({ page }) => {
    let capturedHeader = "";

    await page.route("**/api/v1/auth/login/", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          access: "tenant-token",
          user: {
            id: "user-1",
            email: "manager@fusionengine.in",
            name: "Branch Manager",
            role: "BRANCH_MANAGER",
            must_change_password: false,
          },
        }),
      });
    });

    await page.route("**/api/v1/auth/me/", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          user: {
            id: "user-1",
            email: "manager@fusionengine.in",
            name: "Branch Manager",
            role: "BRANCH_MANAGER",
            must_change_password: false,
          },
          memberships: [
            {
              id: "mem-3",
              tenant_id: "t-isolation-uuid-99",
              tenant_name: "Branch Alpha",
              role: "BRANCH_MANAGER",
              is_default: true,
            },
          ],
          active_role: "BRANCH_MANAGER",
          permissions: ["branch.view"],
          must_change_password: false,
        }),
      });
    });

    await page.route("**/api/v1/onboarding/status/", async (route) => {
      const h = route.request().headers()["x-tenant-id"];
      if (h) capturedHeader = h;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ is_complete: true, steps: [] }),
      });
    });

    await page.route("**/api/v1/entitlements/", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ plan: "STARTER", usage: {}, limits: {} }),
      });
    });

    await page.goto("/login");
    await page.getByPlaceholder("name@restaurant.com").fill("manager@fusionengine.in");
    await page.getByPlaceholder("••••••••").fill("SecurePass123!");
    await page.getByRole("button", { name: /Sign In|உள்நுழைக/i }).click();

    await page.waitForResponse("**/api/v1/onboarding/status/");
    await page.waitForURL("**/dashboard");
    expect(capturedHeader).toBe("t-isolation-uuid-99");
  });

  // Flow 7: Tamil Localization Toggle
  test("Flow 7: Tamil language toggle switches UI strings and preserves typography", async ({ page }) => {
    await page.goto("/login");

    await expect(page.locator("h1")).toContainText("One Platform. Every Food Business.");

    const tamilBtn = page.getByRole("button", { name: /தமிழ்/i });
    await tamilBtn.click();

    await expect(page.locator("h1")).toContainText("ஒரே தளம். அனைத்து உணவு வணிகங்களுக்கும்.");
    await expect(page.getByRole("button", { name: /உள்நுழைக/i })).toBeVisible();

    const enBtn = page.getByRole("button", { name: /English/i });
    await enBtn.click();
    await expect(page.locator("h1")).toContainText("One Platform. Every Food Business.");
  });

  // Flow 8: Dark Mode and Touch Mode
  test("Flow 8: Dark Mode and Touch Mode toggles apply design tokens correctly", async ({ page }) => {
    await page.goto("/dev/design-system");

    // Check Comfortable Mode vs Touch Mode
    const touchBtn = page.getByRole("button", { name: /Toggle Touch Mode/i });
    await touchBtn.click();
    await page.waitForTimeout(300);
    await expect(page.locator(".touch-mode")).toBeVisible();

    // Check Dark Mode
    const darkBtn = page.getByRole("button", { name: /Toggle Dark Mode/i });
    await darkBtn.click();
    await page.waitForTimeout(300);
    const isDark = await page.evaluate(() => document.documentElement.classList.contains("dark"));
    expect(isDark).toBe(true);

    // Switch back to Light Mode
    await darkBtn.click();
    const isLight = await page.evaluate(() => !document.documentElement.classList.contains("dark"));
    expect(isLight).toBe(true);
  });
});
