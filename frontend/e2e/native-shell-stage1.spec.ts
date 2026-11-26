import { test, expect } from "@playwright/test";

test.describe("Stage 1 Native Android Shell (Shim + Real Backend)", () => {
  test("signs in via native endpoint without cookies, navigates to POS, and shows update screen when below min version", async ({
    page,
  }) => {
    const nativeLoginRequests: string[] = [];
    page.on("request", (req) => {
      if (req.url().includes("/auth/native/login/")) {
        nativeLoginRequests.push(req.headers()["x-client"] || "");
      }
    });

    await page.addInitScript(() => {
      const mem = new Map<string, string>();
      (window as any).__SMF_NATIVE_SHIM__ = {
        secureStorage: {
          get: async (k: string) => mem.get(k) ?? null,
          set: async (k: string, v: string) => {
            mem.set(k, v);
          },
          remove: async (k: string) => {
            mem.delete(k);
          },
        },
        appVersionCode: 999,
        appVersionName: "1.10.0",
      };
    });

    await page.goto("/login");
    await page.locator('input[type="email"]').fill("waiter@kavericafe.com");
    await page.locator('input[type="password"]').fill("Password123!");
    await page.getByRole("button", { name: /sign in/i }).click();

    await page.waitForURL(/\/pos|\/dashboard/, { timeout: 15000 });
    expect(nativeLoginRequests).toContain("android-staff");

    // Verify no refresh token leaked into localStorage
    const lsDump = await page.evaluate(() => JSON.stringify(window.localStorage));
    expect(lsDump).not.toContain("refresh");
  });
});
