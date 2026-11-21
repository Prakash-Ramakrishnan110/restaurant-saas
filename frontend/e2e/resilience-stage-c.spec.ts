import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { test, expect } from "./fixtures";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STAGE_C_DIR = path.resolve(__dirname, "../../docs/evidence/stage-c");
fs.mkdirSync(STAGE_C_DIR, { recursive: true });

async function loginAs(page: import("@playwright/test").Page, email: string) {
  await page.goto("/login");
  await page.waitForLoadState("domcontentloaded");
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', "Password123!");
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 15000 });
  await page.waitForLoadState("networkidle");
}

test.describe("Stage C: Offline Resilience, Conflict Drawer & Owner ZIP Data Export", () => {
  test("1. Top-bar connection status pill opens Offline Order Queue & Conflict Drawer", async ({
    page,
  }) => {
    await loginAs(page, "owner@spicegarden.com");

    // Seed an offline queued order and a conflict order to verify the drawer & conflict resolution UI
    await page.evaluate(() => {
      const sampleQueue = [
        {
          client_order_id: "idem-c1-queued-001",
          tenant_id: "spice-garden",
          table_label: "Table T-02",
          status: "QUEUED",
          created_at: new Date().toISOString(),
          payload: {
            order_workflow: "TABLE_SERVICE",
            items: [{ menu_item_id: "item-1", quantity: 2 }],
          },
        },
        {
          client_order_id: "idem-c1-conflict-002",
          tenant_id: "spice-garden",
          table_label: "Table T-05",
          status: "CONFLICT",
          conflict_reason: "Murgh Malai Kebab was marked 86'd (sold out) while offline.",
          conflict_item_ids: ["item-86"],
          created_at: new Date().toISOString(),
          payload: {
            order_workflow: "TABLE_SERVICE",
            items: [
              { menu_item_id: "item-86", quantity: 1 },
              { menu_item_id: "item-2", quantity: 2 },
            ],
          },
        },
      ];
      localStorage.setItem("smf_offline_order_queue_v1", JSON.stringify(sampleQueue));
      window.dispatchEvent(new CustomEvent("smf-offline-queue-updated"));
    });

    const pill = page.getByTestId("connection-status-pill");
    await expect(pill).toContainText("Conflict (1)");
    await pill.click();

    await expect(page.getByText("Offline Order Queue & Sync Status")).toBeVisible();
    await expect(page.getByText("2 Queued Orders")).toBeVisible();
    await expect(
      page.getByText(/Murgh Malai Kebab was marked 86'd \(sold out\) while offline\./i)
    ).toBeVisible();
    await expect(page.getByTestId("conflict-retry-btn")).toBeVisible();

    await page.screenshot({
      path: path.join(STAGE_C_DIR, "offline-queue-drawer.png"),
      fullPage: true,
    });

    // Clean up seeded offline queue items via Discard buttons
    const discardButtons = page.getByTestId("offline-discard-btn");
    const count = await discardButtons.count();
    for (let i = 0; i < count; i++) {
      await discardButtons.first().click();
    }
    await expect(
      page.getByText("All orders are synchronized with the kitchen server.")
    ).toBeVisible();
  });

  test("2. Owner exports tenant-isolated restaurant data ZIP archive from Account Settings", async ({
    page,
  }) => {
    await loginAs(page, "owner@spicegarden.com");
    await page.goto("/settings/account");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("Data Portability & Backup Export")).toBeVisible();

    const exportBtn = page.getByTestId("export-my-data-btn");
    await expect(exportBtn).toBeVisible();

    await page.screenshot({
      path: path.join(STAGE_C_DIR, "data-export-account.png"),
      fullPage: true,
    });

    const [response] = await Promise.all([
      page.waitForResponse(
        (res) =>
          res.url().includes("/api/v1/settings/export-my-data/") && res.status() === 200
      ),
      exportBtn.click(),
    ]);

    expect(response.headers()["content-type"]).toContain("application/zip");
    await expect(
      page.getByText(/Restaurant data archive downloaded \(servemyfood-data-export\.zip\)\./i)
    ).toBeVisible();
  });
});
