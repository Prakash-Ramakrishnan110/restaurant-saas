import { test, expect } from "@playwright/test";

test.describe("Waiter Seating Live Stack Flow (No Stubs)", () => {
  test("Waiter logs in, navigates to /pos, seats guests on an available table with real backend", async ({
    page,
  }) => {
    // 1. Log in on real Docker backend without any page.route stubs
    await page.goto("/login");
    await page.waitForLoadState("domcontentloaded");

    await page.fill('input[type="email"]', "waiter@kavericafe.com");
    await page.fill('input[type="password"]', "Password123!");
    await page.click('button[type="submit"]');

    // 2. Waiter redirects to /pos (or floor POS)
    await page.waitForURL((url) => url.pathname.includes("/pos") || url.pathname.includes("/dashboard"), {
      timeout: 15000,
    });
    if (!page.url().includes("/pos")) {
      await page.goto("/pos");
    }
    await page.waitForLoadState("domcontentloaded");

    // 3. Locate available tables
    await expect(page.getByRole("heading", { name: /Floor Tables/i })).toBeVisible({ timeout: 10000 });

    // Find any Free table button
    const freeTableBtn = page.locator("button").filter({ hasText: "Free" }).first();
    await expect(freeTableBtn).toBeVisible({ timeout: 10000 });
    const tableText = await freeTableBtn.innerText();
    const tableLabelMatch = tableText.match(/^T\d+/m);
    const tableLabel = tableLabelMatch ? tableLabelMatch[0] : "T2";

    await freeTableBtn.click();

    // 4. Modal "Seat Guests at Table ..." opens
    const modalHeading = page.getByRole("heading", { name: new RegExp(`Seat Guests at Table ${tableLabel}`, "i") });
    await expect(modalHeading).toBeVisible({ timeout: 5000 });

    // Click "Open Dining Session"
    const openBtn = page.getByRole("button", { name: /Open Dining Session/i });
    await expect(openBtn).toBeVisible();
    await openBtn.click();

    // 5. Assert table session opens successfully without failure toast
    await expect(page.getByText("Could not seat guests at this table.")).not.toBeVisible();
    await expect(
      page.getByText(new RegExp(`Table ${tableLabel} seated with`, "i"))
    ).toBeVisible({ timeout: 10000 });

    // 6. Verify Table is now active / occupied in Order Target heading
    await expect(page.getByRole("heading", { name: `Table ${tableLabel}` })).toBeVisible();
  });
});
