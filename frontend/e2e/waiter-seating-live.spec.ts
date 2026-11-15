import { test, expect, request as playwrightRequest } from "./fixtures";

const API_BASE = "http://localhost:8000/api/v1/";

async function cleanupOpenedSessionsForKaveri(): Promise<void> {
  const ctx = await playwrightRequest.newContext({ baseURL: API_BASE });
  try {
    const loginRes = await ctx.post("auth/login/", {
      data: { email: "owner@kavericafe.com", password: "Password123!" },
    });
    if (!loginRes.ok()) return;
    const { access } = await loginRes.json();
    const headers = { Authorization: `Bearer ${access}` };

    const sessRes = await ctx.get("sessions/?status=OPEN", { headers });
    if (sessRes.ok()) {
      const sessJson = await sessRes.json();
      const sessList = Array.isArray(sessJson) ? sessJson : sessJson.results || [];
      for (const s of sessList) {
        if (s.status === "OPEN") {
          await ctx.post(`sessions/${s.id}/close/`, { headers });
        }
      }
    }

    const tblRes = await ctx.get("tables/", { headers });
    if (tblRes.ok()) {
      const tblJson = await tblRes.json();
      const tblList = Array.isArray(tblJson) ? tblJson : tblJson.results || [];
      for (const t of tblList) {
        if (t.status !== "AVAILABLE") {
          await ctx.post(`tables/${t.id}/status/`, {
            headers,
            data: { status: "AVAILABLE" },
          });
        }
      }
    }
  } finally {
    await ctx.dispose();
  }
}

test.describe("Waiter Seating Live Stack Flow (No Stubs)", () => {
  test.afterEach(async () => {
    await cleanupOpenedSessionsForKaveri();
  });

  test("Waiter logs in, navigates to /pos, seats guests on an available table with real backend (desktop & 390px)", async ({
    page,
  }) => {
    // 1. Log in on real Docker backend without any page.route stubs
    await page.goto("/login");
    await page.waitForLoadState("domcontentloaded");

    await page.fill('input[type="email"]', "waiter@kavericafe.com");
    await page.fill('input[type="password"]', "Password123!");
    await page.click('button[type="submit"]');

    // 2. Waiter redirects to /pos (or floor POS)
    await page.waitForURL(
      (url) => url.pathname.includes("/pos") || url.pathname.includes("/dashboard"),
      {
        timeout: 15000,
      }
    );
    if (!page.url().includes("/pos")) {
      await page.goto("/pos");
    }
    await page.waitForLoadState("domcontentloaded");

    // 3. Locate available tables
    await expect(page.getByRole("heading", { name: /Floor Tables/i })).toBeVisible({
      timeout: 10000,
    });

    // Find any Free table button
    const freeTableBtn = page.locator("button").filter({ hasText: "Free" }).first();
    await expect(freeTableBtn).toBeVisible({ timeout: 10000 });
    const tableText = await freeTableBtn.innerText();
    const tableLabelMatch = tableText.match(/^T\d+/m);
    const tableLabel = tableLabelMatch ? tableLabelMatch[0] : "T2";

    await freeTableBtn.click();

    // 4. Modal "Seat Guests at Table ..." opens
    const modalHeading = page.getByRole("heading", {
      name: new RegExp(`Seat Guests at Table ${tableLabel}`, "i"),
    });
    await expect(modalHeading).toBeVisible({ timeout: 5000 });

    // Click "Open Dining Session"
    const openBtn = page.getByRole("button", { name: /Open Dining Session/i });
    await expect(openBtn).toBeVisible();
    await openBtn.click();

    // 5. Assert table session opens successfully without failure toast
    await expect(page.getByText("Could not seat guests at this table.")).not.toBeVisible();
    await expect(page.getByText(new RegExp(`Table ${tableLabel} seated with`, "i"))).toBeVisible({
      timeout: 10000,
    });

    // 6. Verify Table is now active / occupied in Order Target heading
    await expect(page.getByRole("heading", { name: `Table ${tableLabel}` })).toBeVisible();

    // 7. Also verify hand-seating on 390px phone viewport against the real backend
    await expect(
      page.locator("button").filter({ hasText: tableLabel }).first()
    ).not.toContainText("Free", { timeout: 10000 });
    await page.setViewportSize({ width: 390, height: 844 });
    const secondFreeBtn = page.locator("button").filter({ hasText: "Free" }).first();
    await expect(secondFreeBtn).toBeVisible({ timeout: 10000 });
    await secondFreeBtn.click();
    await expect(openBtn).toBeVisible({ timeout: 5000 });
    await openBtn.click();
    await expect(page.getByText("Could not seat guests at this table.")).not.toBeVisible();
  });
});
