import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

function hardwarePhotosPlugin() {
  const photosDir = path.resolve(import.meta.dirname, "assets/photos/hardware");
  return {
    name: "smf-hardware-photos",
    configureServer(server: { middlewares: { use: (fn: (req: { url?: string }, res: { setHeader: (k: string, v: string) => void; end: (b: Buffer) => void }, next: () => void) => void) => void } }) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith("/hardware-photos/")) return next();
        const file = path.basename(req.url.split("?")[0]);
        const full = path.join(photosDir, file);
        if (fs.existsSync(full) && fs.statSync(full).isFile()) {
          const ext = path.extname(file).toLowerCase();
          res.setHeader(
            "Content-Type",
            ext === ".webp" ? "image/webp" : ext === ".png" ? "image/png" : "image/jpeg"
          );
          res.end(fs.readFileSync(full));
          return;
        }
        next();
      });
    },
    writeBundle(options: { dir?: string }) {
      if (options.dir !== "dist" || !fs.existsSync(photosDir)) return;
      const outDir = path.resolve(import.meta.dirname, "dist/hardware-photos");
      const files = fs
        .readdirSync(photosDir)
        .filter((f) => /\.(webp|jpg|jpeg|png)$/i.test(f));
      if (files.length === 0) return;
      fs.mkdirSync(outDir, { recursive: true });
      for (const f of files) {
        fs.copyFileSync(path.join(photosDir, f), path.join(outDir, f));
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), hardwarePhotosPlugin()],
  server: {
    fs: {
      allow: [".."],
    },
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
    },
  },
  preview: {
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: false,
  },
});
