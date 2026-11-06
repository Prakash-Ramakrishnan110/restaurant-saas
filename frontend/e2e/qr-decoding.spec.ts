import { test, expect, Page } from "@playwright/test";
import path from "path";

// Helper to mock authenticated owner
async function mockAuthenticatedOwner(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("servemyfood_has_session", "true");
    localStorage.setItem("servemyfood_tenant_id", "ten-spice-1");
  });

  await page.route("**/api/v1/auth/refresh/", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ access: "mock-valid-access-token" }),
    });
  });

  await page.route("**/api/v1/auth/me/", async (route) => {
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

  await page.route("**/api/v1/business/", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "ten-spice-1",
        name: "Spice Garden",
        venue_profile: "CAFE",
        business_settings: {
          display_name: "Spice Garden Café",
          brand_primary_color: "#FF6A00",
          document_language: "EN_TA",
          receipt_footer_text: "Thank you for dining with us!",
        },
      }),
    });
  });
}

const mockSheetData = [
  {
    id: "qr-1",
    token: "token_table_01_secure",
    label: "Table 01",
    target_type: "TABLE",
    target_id: "tbl-1",
    area_name: "Main Hall",
    branch_name: "Central",
    public_url: "http://localhost:5173/q/token_table_01_secure",
    qr_svg_url: "/api/v1/qr-codes/qr-1/image/?format=svg",
    qr_png_url: "/api/v1/qr-codes/qr-1/image/?format=png",
  },
  {
    id: "qr-2",
    token: "token_table_02_secure",
    label: "Table 02",
    target_type: "TABLE",
    target_id: "tbl-2",
    area_name: "Main Hall",
    branch_name: "Central",
    public_url: "http://localhost:5173/q/token_table_02_secure",
    qr_svg_url: "/api/v1/qr-codes/qr-2/image/?format=svg",
    qr_png_url: "/api/v1/qr-codes/qr-2/image/?format=png",
  },
  {
    id: "qr-3",
    token: "token_counter_01_fast",
    label: "Counter 01",
    target_type: "SERVICE_AREA",
    target_id: "sa-1",
    area_name: "Express Pickup",
    branch_name: "Central",
    public_url: "http://localhost:5173/q/token_counter_01_fast",
    qr_svg_url: "/api/v1/qr-codes/qr-3/image/?format=svg",
    qr_png_url: "/api/v1/qr-codes/qr-3/image/?format=png",
  },
];

test.describe("Requirement A3: Comprehensive QR Canvas Decoding on A4 Print Sheet", () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthenticatedOwner(page);

    await page.route("**/api/v1/qr-codes/", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          results: mockSheetData.map((d) => ({
            id: d.id,
            token: d.token,
            target_type: d.target_type,
            table: d.target_type === "TABLE" ? { id: d.target_id, name: d.label, identifier: d.label } : null,
            service_area: d.target_type === "SERVICE_AREA" ? { id: d.target_id, name: d.area_name } : null,
            branch: { id: "br-1", name: d.branch_name },
            is_active: true,
            created_at: new Date().toISOString(),
          })),
        }),
      });
    });

    await page.route("**/api/v1/qr-codes/sheet-data/", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockSheetData),
      });
    });
  });

  const layoutPermutations = [
    { cards: 6, lang: "EN", name: "6 per page (Large Standee) - English" },
    { cards: 6, lang: "EN_TA", name: "6 per page (Large Standee) - Bilingual EN/TA" },
    { cards: 12, lang: "EN", name: "12 per page (Compact Tent) - English" },
    { cards: 12, lang: "EN_TA", name: "12 per page (Compact Tent) - Bilingual EN/TA" },
  ];

  for (const perm of layoutPermutations) {
    test(`DECODES every canvas on sheet: ${perm.name}`, async ({ page }) => {
      await page.goto("/qr");
      await page.waitForLoadState("networkidle");

      // Open print preview modal
      const printBtn = page.getByRole("button", { name: "Print QR Sheet" });
      await expect(printBtn).toBeVisible();
      await printBtn.click();

      await expect(page.getByText("A4 QR Standee Print Sheet Preview")).toBeVisible();

      // Configure cards per page
      const layoutSelect = page.locator('select[aria-label="Cards per sheet layout"]');
      await layoutSelect.selectOption(String(perm.cards));

      // Configure language
      const langSelect = page.locator('select[aria-label="Sheet language"]');
      await langSelect.selectOption(perm.lang);

      // Wait for rendering to stabilize
      await page.waitForTimeout(300);

      // Inject jsQR library directly into the preview page
      const jsqrPath = path.resolve("./node_modules/jsqr/dist/jsQR.js");
      await page.addScriptTag({ path: jsqrPath });

      // Find all canvas elements in the print cards
      const canvases = page.locator(".qr-sheet-print-container canvas");
      const count = await canvases.count();
      expect(count).toBe(mockSheetData.length);

      // Decode every canvas using jsQR and verify against target public URL
      for (let i = 0; i < count; i++) {
        const canvas = canvases.nth(i);
        await expect(canvas).toBeVisible();

        const decodedUrl = await canvas.evaluate((el: HTMLCanvasElement) => {
          const ctx = el.getContext("2d");
          if (!ctx) return null;
          const imgData = ctx.getImageData(0, 0, el.width, el.height);
          // @ts-ignore
          if (typeof window.jsQR !== "function") {
            throw new Error("jsQR not loaded on window");
          }
          // @ts-ignore
          const qrResult = window.jsQR(imgData.data, el.width, el.height);
          return qrResult ? qrResult.data : null;
        });

        expect(decodedUrl).not.toBeNull();
        expect(decodedUrl).toBe(mockSheetData[i].public_url);
        expect(decodedUrl).toContain(mockSheetData[i].token);
      }
    });
  }
});

