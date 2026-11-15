import { test as base, expect, request, type Page, type TestInfo } from "@playwright/test";

const NEGATIVE_TITLE_PATTERN =
  /negative|invalid|401|403|404|400|cross-tenant|cross-restaurant|rotated|browse_only|disabled|reject/i;

export function attachApiErrorGuard(page: Page, testInfo: TestInfo): string[] {
  const failures: string[] = ((testInfo as any)._apiFailures =
    (testInfo as any)._apiFailures || []);
  page.on("response", (res) => {
    const url = res.url();
    if (!url.includes("/api/")) return;
    if (res.status() >= 400) {
      failures.push(`${res.status()} ${res.request().method()} ${url}`);
    }
  });
  return failures;
}

export const test = base.extend<{ apiErrorGuard: void }>({
  apiErrorGuard: [
    async ({ page }, use, testInfo) => {
      attachApiErrorGuard(page, testInfo);
      await use();
      const recorded: string[] = (testInfo as any)._apiFailures || [];
      if (recorded.length > 0 && !NEGATIVE_TITLE_PATTERN.test(testInfo.title)) {
        throw new Error(
          `Unexpected >=400 API responses in "${testInfo.title}":\n${recorded.join("\n")}`
        );
      }
    },
    { auto: true },
  ],
});

export { expect, request };
