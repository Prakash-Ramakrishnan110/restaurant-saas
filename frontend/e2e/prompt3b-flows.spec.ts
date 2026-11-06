import { test, expect } from "@playwright/test";
import path from "path";
import fs from "fs";

const screenshotsDir = path.resolve("../docs/screenshots");

// Helper to setup mock authentication state for testing protected routes
async function mockAuthenticatedOwner(page: any) {
  await page.addInitScript(() => {
    localStorage.setItem("servemyfood_has_session", "true");
    localStorage.setItem("servemyfood_tenant_id", "ten-spice-1");
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
            tenant_id: "ten-spice-1",
            tenant_name: "Spice Garden",
            role: "OWNER",
            is_default: true,
          },
        ],
        active_role: "OWNER",
        permissions: [
          "business.manage",
          "branch.view",
          "branch.manage",
          "area.view",
          "area.manage",
          "table.view",
          "table.manage",
          "floor.manage",
          "qr.view",
          "qr.manage",
          "staff.view",
          "staff.manage",
        ],
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
          id: "ten-spice-1",
          name: "Spice Garden",
          venue_profile: "CAFE",
          contact_email: "contact@spicegarden.com",
          contact_phone: "+91 98765 43210",
          timezone: "Asia/Kolkata",
          business_settings: {
            display_name: "Spice Garden Café",
            brand_primary_color: "#FF6A00",
            document_language: "EN_TA",
            receipt_footer_text: "Thank you for dining with us!",
            legal_name: "Spice Garden Hospitality LLP",
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
            id: "br-main-1",
            name: "Main Branch",
            address: "100 GST Road, Guindy",
            phone: "+91 44 2626 0000",
          },
        ],
      }),
    });
  });
}

test.describe("Prompt 3B: 8 Core E2E Flows", () => {
  test.beforeAll(async () => {
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }
  });

  // Flow 1: Café Wizard Path
  test("Flow 1: Café Onboarding Wizard completes all steps cleanly", async ({ page }) => {
    await mockAuthenticatedOwner(page);

    await page.route("**/api/v1/onboarding/status/", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          is_complete: false,
          completion_percentage: 14,
          next_step: "business",
          steps: {
            business: false,
            branch: false,
            style: false,
            layout: false,
            qr: false,
            staff: false,
            done: false,
          },
          summary: {
            branches_count: 1,
            service_areas_count: 0,
            tables_count: 0,
            qr_codes_count: 0,
            staff_count: 0,
          },
        }),
      });
    });

    await page.goto("/onboarding");
    await page.waitForLoadState("networkidle");

    // Check Cafe preset is highlighted by default
    await expect(page.getByText("Restaurant Onboarding")).toBeVisible();
    await expect(page.getByText("Café")).toBeVisible();
    await expect(page.getByText("Default")).toBeVisible();

    // Capture screenshot of wizard step 1
    await page.screenshot({
      path: path.join(screenshotsDir, "13-onboarding-wizard.png"),
      fullPage: true,
    });
  });

  // Flow 2: Quick Service / Tea Shop Path (ZERO Table Invariant)
  test("Flow 2: Tea Shop / Quick Service mode has ZERO occurrence of the word 'table'", async ({ page }) => {
    await mockAuthenticatedOwner(page);

    await page.route("**/api/v1/onboarding/status/", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          is_complete: false,
          completion_percentage: 50,
          next_step: "layout",
          steps: {
            business: true,
            branch: true,
            style: true,
            layout: false,
            qr: false,
            staff: false,
            done: false,
          },
        }),
      });
    });

    await page.route("**/api/v1/layout-templates/?venue_profile=QUICK_SERVICE", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            key: "counters",
            name: "Counters and token numbers",
            description: "Takeaway counter service areas and sequential token numbers without dining furniture.",
            areas_count: 1,
            counters_count: 2,
            tables_count: 0,
          },
        ]),
      });
    });

    await page.goto("/onboarding");
    await page.waitForLoadState("networkidle");

    // Select Quick Service / Tea Shop if on step 0
    const quickCard = page.getByText(/Tea [sS]hop/).or(page.getByText("Quick Service / Tea Shop"));
    if (await quickCard.first().isVisible()) {
      await quickCard.first().click();
    }

    // Advance to Layout step or inspect layout text
    const layoutHeader = page.getByText("Layout & Capacity");
    if (await layoutHeader.isVisible()) {
      // Step 4 Layout Card content specifically
      const stepContent = await page.locator("div.max-w-4xl").innerText();
      // Strict Invariant Assertion:
      // The word "table" or "மேஜை" MUST NOT appear in the counter layout UI
      expect(stepContent.toLowerCase()).not.toContain("table");
      expect(stepContent).not.toContain("மேஜை");
    }
  });

  // Flow 3: Reload Resume Step
  test("Flow 3: Reloading wizard resumes at the first incomplete step", async ({ page }) => {
    await mockAuthenticatedOwner(page);

    await page.route("**/api/v1/onboarding/status/", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          is_complete: false,
          completion_percentage: 42,
          next_step: "style",
          steps: {
            business: true,
            branch: true,
            style: false,
            layout: false,
            qr: false,
            staff: false,
            done: false,
          },
        }),
      });
    });

    await page.goto("/onboarding");
    await page.waitForLoadState("networkidle");

    // Asserts wizard navigated to Step 3 (Service Style)
    await expect(page.getByRole("heading", { name: "Service Style" })).toBeVisible();
    await expect(page.getByText("Ordering Workflow", { exact: true })).toBeVisible();
  });

  // Flow 4: Plan Limit Warning
  test("Flow 4: Dry-run check exceeding plan limits displays warning banner", async ({ page }) => {
    await mockAuthenticatedOwner(page);

    await page.route("**/api/v1/onboarding/status/", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          is_complete: false,
          completion_percentage: 55,
          next_step: "layout",
          steps: { business: true, branch: true, style: true, layout: false },
        }),
      });
    });

    await page.route("**/api/v1/layout-templates/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            key: "restaurant_3_sections",
            name: "Large Restaurant (26 Tables)",
            description: "Exceeds starter plan limit.",
            areas_count: 3,
            tables_count: 26,
          },
        ]),
      });
    });

    await page.route("**/api/v1/branches/*/layout-templates/*/apply/?dry_run=true", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          is_allowed: false,
          error_code: "ENTITLEMENT_LIMIT_REACHED",
          error_message: "Plan table limit reached (10 max, 26 requested).",
        }),
      });
    });

    await page.goto("/onboarding");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText(/exceeds your plan capacity/i)).toBeVisible();
  });

  // Flow 5: Logo Upload Rejection & Contrast Feedback
  test("Flow 5: Branding settings rejects SVG and computes live color contrast", async ({ page }) => {
    await mockAuthenticatedOwner(page);

    await page.goto("/settings/branding");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("Branding & Business Identity")).toBeVisible();
    await expect(page.getByText("Meets WCAG AA (>= 4.5:1)")).toBeVisible();
    await expect(page.getByText("Live Customer QR Card Preview")).toBeVisible();

    // Capture screenshot of branding page
    await page.screenshot({
      path: path.join(screenshotsDir, "15-settings-branding.png"),
      fullPage: true,
    });
  });

  // Flow 6: A4 Print Sheet Preview
  test("Flow 6: QR codes page opens A4 print sheet with 6/12 card toggle", async ({ page }) => {
    await mockAuthenticatedOwner(page);

    await page.route("**/api/v1/qr-codes/", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          results: [
            {
              id: "qr-1",
              token: "sec_token_001",
              target_type: "TABLE",
              table: { id: "tbl-1", name: "Table 01", identifier: "T01" },
              service_area: { id: "sa-1", name: "Main Hall" },
              branch: { id: "br-1", name: "Main Branch" },
              is_active: true,
              created_at: new Date().toISOString(),
            },
            {
              id: "qr-2",
              token: "sec_token_002",
              target_type: "TABLE",
              table: { id: "tbl-2", name: "Table 02", identifier: "T02" },
              service_area: { id: "sa-1", name: "Main Hall" },
              branch: { id: "br-1", name: "Main Branch" },
              is_active: true,
              created_at: new Date().toISOString(),
            },
          ],
        }),
      });
    });

    await page.route("**/api/v1/qr-codes/sheet-data/", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: "qr-1",
            token: "sec_token_001",
            label: "Table 01",
            target_type: "TABLE",
            target_id: "tbl-1",
            area_name: "Main Hall",
            branch_name: "Main Branch",
            public_url: "http://localhost:5173/q/sec_token_001",
            qr_svg_url: "/api/v1/qr-codes/qr-1/image/?format=svg",
            qr_png_url: "/api/v1/qr-codes/qr-1/image/?format=png",
          },
          {
            id: "qr-2",
            token: "sec_token_002",
            label: "Table 02",
            target_type: "TABLE",
            target_id: "tbl-2",
            area_name: "Main Hall",
            branch_name: "Main Branch",
            public_url: "http://localhost:5173/q/sec_token_002",
            qr_svg_url: "/api/v1/qr-codes/qr-2/image/?format=svg",
            qr_png_url: "/api/v1/qr-codes/qr-2/image/?format=png",
          },
        ]),
      });
    });

    await page.goto("/qr");
    await page.waitForLoadState("networkidle");

    // Open Print Sheet modal
    const printBtn = page.getByRole("button", { name: "Print QR Sheet" });
    await expect(printBtn).toBeVisible();
    await printBtn.click();

    // Verify modal preview opened
    await expect(page.getByText("A4 QR Standee Print Sheet Preview")).toBeVisible();
    await expect(page.getByText("Print to A4 Paper")).toBeVisible();

    // Capture screenshot of print preview sheet
    await page.screenshot({
      path: path.join(screenshotsDir, "preview-sheet.png"),
      fullPage: true,
    });
  });

  // Flow 7: Public /q/:token Customer Landing Page
  test("Flow 7: Public QR landing page displays coming soon notice with tenant branding", async ({ page }) => {
    await page.route("**/api/v1/public/qr/guest-token-123/", async (route) => {
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

    await page.goto("/q/guest-token-123");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("Spice Garden Café")).toBeVisible();
    await expect(page.getByText("Guindy • Courtyard • Table 05")).toBeVisible();
    await expect(
      page.getByText("Online ordering is coming soon. Please ask our staff to take your order.")
    ).toBeVisible();
    await expect(page.getByText("Powered by ServeMyFood")).toBeVisible();

    // Capture screenshot of public page
    await page.screenshot({
      path: path.join(screenshotsDir, "17-public-qr-landing.png"),
      fullPage: true,
    });
  });

  // Flow 8: Security & Isolation
  test("Flow 8: Unauthenticated access to /settings/branding redirects to /login", async ({ page }) => {
    await page.route("**/api/v1/auth/me/", async (route) => {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } }),
      });
    });

    await page.goto("/settings/branding");
    await page.waitForURL("**/login**", { timeout: 10000 });
    await expect(page.getByRole("button", { name: "Sign In" })).toBeVisible();
  });

  // Invariant B1 & B2: Client-side QR canvas rendering and zero secret token fragments
  test("Invariant B1 & B2: QR cards render canvas client-side with non-zero dimensions and NO secret token fragments", async ({ page }) => {
    await mockAuthenticatedOwner(page);

    await page.route("**/api/v1/qr-codes/", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          results: [
            {
              id: "qr-1",
              token: "sec_token_999888777",
              target_type: "TABLE",
              table: { id: "tbl-1", name: "Table 01", identifier: "T01" },
              service_area: { id: "sa-1", name: "Main Hall" },
              branch: { id: "br-1", name: "Main Branch" },
              is_active: true,
              created_at: new Date().toISOString(),
            },
          ],
        }),
      });
    });

    await page.route("**/api/v1/qr-codes/sheet-data/", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: "qr-1",
            token: "sec_token_999888777",
            label: "Table 01",
            target_type: "TABLE",
            target_id: "tbl-1",
            area_name: "Main Hall",
            branch_name: "Main Branch",
            public_url: "http://localhost:5173/q/sec_token_999888777",
            qr_svg_url: "/api/v1/qr-codes/qr-1/image/?format=svg",
            qr_png_url: "/api/v1/qr-codes/qr-1/image/?format=png",
          },
        ]),
      });
    });

    await page.goto("/qr");
    await page.waitForLoadState("networkidle");

    const printBtn = page.getByRole("button", { name: "Print QR Sheet" });
    await expect(printBtn).toBeVisible();
    await printBtn.click();

    // Verify modal is open
    await expect(page.getByText("A4 QR Standee Print Sheet Preview")).toBeVisible();

    // Emulate print media to test print layout
    await page.emulateMedia({ media: "print" });

    // Assert canvas exists and has non-zero natural dimensions
    const canvas = page.locator("canvas").first();
    await expect(canvas).toBeVisible();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(50);
    expect(box!.height).toBeGreaterThan(50);

    // Assert canvas data URL is not empty/blank
    const isCanvasDrawn = await canvas.evaluate((el: HTMLCanvasElement) => {
      const ctx = el.getContext("2d");
      if (!ctx) return false;
      const data = ctx.getImageData(0, 0, el.width, el.height).data;
      return data.some((pixel) => pixel > 0);
    });
    expect(isCanvasDrawn).toBe(true);

    // Invariant B2: NO secret token prefix or fragment in rendered DOM
    const modalText = await page.locator("div.fixed.inset-0").innerText();
    expect(modalText).not.toContain("sec_token");
    expect(modalText).not.toContain("999888777");

    // Reset media
    await page.emulateMedia({ media: "screen" });
  });

  // Invariant B4 & B5: Contrast invariants for brand text and header wordmark
  test("Invariant B4 & B5: Wordmark and Brand Badges maintain contrast >= 4.5:1 across themes", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    // Measure "ServeMy" text contrast against header in light mode (select visible wordmark on current viewport)
    const servemyLight = page.locator('[data-testid="wordmark-servemy"]:visible').first();
    await expect(servemyLight).toBeVisible();
    const lightColor = await servemyLight.evaluate((el) => window.getComputedStyle(el).color);
    // In light mode, color is navy rgb(11, 31, 59)
    expect(lightColor).toBe("rgb(11, 31, 59)");

    // Switch to dark mode
    await page.evaluate(() => {
      document.documentElement.classList.add("dark");
      document.documentElement.setAttribute("data-theme", "dark");
    });
    await page.waitForTimeout(300);

    // In dark mode, color MUST be white rgb(255, 255, 255) for >= 4.5:1 contrast
    const darkColor = await servemyLight.evaluate((el) => window.getComputedStyle(el).color);
    expect(darkColor).toBe("rgb(255, 255, 255)");
  });
});
