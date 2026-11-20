/// <reference types="vitest" />
import { configDefaults, defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import type { Plugin } from "vite";

const MARKETING_DIST = path.resolve(__dirname, "../marketing/dist");
const MARKETING_PAGES = new Set([
  "/",
  "/book-demo",
  "/privacy",
  "/terms",
  "/tea-shops",
  "/restaurants",
  "/hotels",
]);
const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".vtt": "text/vtt; charset=utf-8",
  ".json": "application/json",
};

function serveMarketingOnRoot(): Plugin {
  const attach = (middlewares: { use: (fn: (req: any, res: any, next: () => void) => void) => void }) => {
    middlewares.use((req, res, next) => {
      if (!req.url || (req.method !== "GET" && req.method !== "HEAD")) return next();
      const pathname = decodeURIComponent(req.url.split("?")[0]);
      const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;

      // 1. Serve prerendered marketing HTML pages at / and marketing routes
      if (MARKETING_PAGES.has(normalized)) {
        const htmlFile =
          normalized === "/"
            ? path.join(MARKETING_DIST, "index.html")
            : path.join(MARKETING_DIST, normalized.slice(1), "index.html");
        if (fs.existsSync(htmlFile)) {
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          fs.createReadStream(htmlFile).pipe(res);
          return;
        }
      }

      // 2. Serve marketing static assets (video with Range support, fonts, brand, marketing JS)
      if (
        pathname.startsWith("/video/") ||
        pathname.startsWith("/fonts/") ||
        pathname.startsWith("/brand/") ||
        pathname.startsWith("/assets/")
      ) {
        const assetFile = path.join(MARKETING_DIST, pathname.slice(1));
        if (assetFile.startsWith(MARKETING_DIST) && fs.existsSync(assetFile) && fs.statSync(assetFile).isFile()) {
          const stat = fs.statSync(assetFile);
          const ext = path.extname(assetFile).toLowerCase();
          const mime = MIME_TYPES[ext] || "application/octet-stream";
          const range = req.headers.range;
          if (range) {
            const match = /bytes=(\d+)-(\d*)/.exec(range);
            const start = match ? parseInt(match[1], 10) : 0;
            const end = match && match[2] ? parseInt(match[2], 10) : stat.size - 1;
            res.statusCode = 206;
            res.setHeader("Content-Range", `bytes ${start}-${end}/${stat.size}`);
            res.setHeader("Accept-Ranges", "bytes");
            res.setHeader("Content-Length", end - start + 1);
            res.setHeader("Content-Type", mime);
            fs.createReadStream(assetFile, { start, end }).pipe(res);
            return;
          }
          res.setHeader("Accept-Ranges", "bytes");
          res.setHeader("Content-Length", stat.size);
          res.setHeader("Content-Type", mime);
          fs.createReadStream(assetFile).pipe(res);
          return;
        }
      }

      next();
    });
  };

  return {
    name: "serve-marketing-on-root",
    configureServer(server) {
      attach(server.middlewares);
    },
    configurePreviewServer(server) {
      attach(server.middlewares);
    },
  };
}

// Build-time git version: use `git describe --tags --always` for a human-readable tag
let gitVersion = "dev";
try {
  gitVersion = execSync("git describe --tags --always").toString().trim();
} catch {
  try {
    gitVersion = execSync("git rev-parse --short HEAD").toString().trim();
  } catch {
    // fallback
  }
}

export default defineConfig({
  plugins: [serveMarketingOnRoot(), react()],
  define: {
    __APP_VERSION__: JSON.stringify(gitVersion),
    __GIT_HASH__: JSON.stringify(gitVersion),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/tests/setup.ts"],
    testTimeout: 15000,
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    exclude: [...configDefaults.exclude, "e2e/**", "**/e2e/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/api/**", "src/context/**", "src/pages/auth/**", "src/components/**", "src/lib/**"],
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
      "/media": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
    },
  },
});
