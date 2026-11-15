import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import zlib from "zlib";

describe("Public QR Route Code Splitting & Bundle Budget", () => {
  const distAssetsDir = path.resolve(__dirname, "../../dist/assets");

  it("keeps customer /q/* chunks under 150 KB gzip and free of admin/billing/inventory/platform modules", () => {
    expect(fs.existsSync(distAssetsDir)).toBe(true);
    const files = fs.readdirSync(distAssetsDir).filter((f) => f.endsWith(".js"));

    const indexChunk = files.find((f) => /^index-[^.]+\.js$/.test(f));
    const publicQrChunk = files.find((f) => /^PublicQRPage-[^.]+\.js$/.test(f));
    const trackerChunk = files.find((f) => /^PublicOrderTrackerPage-[^.]+\.js$/.test(f));

    expect(indexChunk).toBeDefined();
    expect(publicQrChunk).toBeDefined();
    expect(trackerChunk).toBeDefined();

    const gzipSize = (fileName: string) => {
      const buf = fs.readFileSync(path.join(distAssetsDir, fileName));
      return zlib.gzipSync(buf).length;
    };

    const indexGzip = gzipSize(indexChunk!);
    const qrGzip = gzipSize(publicQrChunk!);
    const trackerGzip = gzipSize(trackerChunk!);

    expect(qrGzip).toBeLessThan(150 * 1024);
    expect(indexGzip + qrGzip).toBeLessThan(150 * 1024);
    expect(indexGzip + trackerGzip).toBeLessThan(150 * 1024);

    const qrCode = fs.readFileSync(path.join(distAssetsDir, publicQrChunk!), "utf-8");
    const trackerCode = fs.readFileSync(path.join(distAssetsDir, trackerChunk!), "utf-8");
    const forbidden = [
      "PlatformAdminPage",
      "StockOverviewPage",
      "SuppliersPurchasesPage",
      "BillingPage",
      "ShiftCloseoutPage",
      "DashboardPage",
    ];
    for (const mod of forbidden) {
      expect(qrCode).not.toContain(mod);
      expect(trackerCode).not.toContain(mod);
    }
  });
});
