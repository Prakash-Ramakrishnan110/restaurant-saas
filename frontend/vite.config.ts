/// <reference types="vitest" />
import { configDefaults, defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";
import { execSync } from "child_process";

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
  plugins: [react()],
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
    },
  },
});
