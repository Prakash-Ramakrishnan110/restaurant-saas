import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const rootDir = path.resolve(import.meta.dirname, "..");
const distDir = path.join(rootDir, "dist");

const htmlFiles = [
  "index.html",
  "ta/index.html",
  "tea-shops/index.html",
  "ta/tea-shops/index.html",
  "restaurants/index.html",
  "ta/restaurants/index.html",
  "hotels/index.html",
  "ta/hotels/index.html",
  "hardware/index.html",
  "ta/hardware/index.html",
  "book-demo/index.html",
  "ta/book-demo/index.html",
  "privacy/index.html",
  "ta/privacy/index.html",
  "terms/index.html",
  "ta/terms/index.html",
  "404.html",
];

const forbiddenPatterns = [
  { name: "tax", re: /\btax\b/i },
  { name: "GST", re: /\bGST\b/i },
  { name: "Swiggy", re: /\bSwiggy\b/i },
  { name: "Zomato", re: /\bZomato\b/i },
  { name: "offline", re: /\boffline\b/i },
  { name: "bank-grade", re: /bank-grade/i },
  { name: "100%", re: /100%/i },
  { name: "trusted by", re: /trusted by/i },
  { name: "AI", re: /\bAI\b/ },
  { name: "tenant", re: /\btenant\b/i },
  { name: "entitlement", re: /\bentitlement\b/i },
  { name: "paise", re: /\bpaise\b/i },
  { name: "preset", re: /\bpreset\b/i },
  { name: "flag", re: /\bflag\b/i },
  { name: "better than", re: /\bbetter than\b/i },
  { name: "Petpooja", re: /\bPetpooja\b/i },
  { name: "Posist", re: /\bPosist\b/i },
  { name: "DotPe", re: /\bDotPe\b/i },
  { name: "Toast POS", re: /\bToast\b/ },
  { name: "Tamil tax (வரி ரசீது)", re: /வரி\s*ரசீது/ },
  { name: "Tamil GST (ஜிஎஸ்டி)", re: /ஜிஎஸ்டி/ },
];

const errors = [];

for (const rel of htmlFiles) {
  const fullPath = path.join(distDir, rel);
  if (!fs.existsSync(fullPath)) {
    errors.push(`Missing prerendered file: ${rel}`);
    continue;
  }
  const html = fs.readFileSync(fullPath, "utf-8");
  const textOnly = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");

  if (!/<h1[\s>]/i.test(html)) {
    errors.push(`No <h1> found in no-JS HTML: ${rel}`);
  }
  if (textOnly.trim().length < 80) {
    errors.push(`Too little visible text in no-JS HTML: ${rel}`);
  }

  for (const rule of forbiddenPatterns) {
    if (rule.re.test(textOnly)) {
      errors.push(`Forbidden term "${rule.name}" found in ${rel}`);
    }
  }

  if (rel.includes("tea-shops")) {
    if (/\btable\b/i.test(textOnly) || /மேஜை/.test(textOnly) || /மேசை/.test(textOnly)) {
      errors.push(`Forbidden word "table" / "மேஜை" / "மேசை" found on tea-shops page: ${rel}`);
    }
  }
}

for (const requiredFile of ["sitemap.xml", "robots.txt", "og-image.svg"]) {
  if (!fs.existsSync(path.join(distDir, requiredFile))) {
    errors.push(`Missing generated file: dist/${requiredFile}`);
  }
}

// Check initial JS bundle gzip <= 150 KB
const homeHtml = fs.readFileSync(path.join(distDir, "index.html"), "utf-8");
const scriptMatch = homeHtml.match(/(?:src="|import\(")(\/assets\/index-[^"]+\.js)"/);
if (scriptMatch) {
  const jsBuf = fs.readFileSync(path.join(distDir, scriptMatch[1].replace(/^\//, "")));
  const gzipKb = zlib.gzipSync(jsBuf).length / 1024;
  console.log(`Initial home JS gzip size: ${gzipKb.toFixed(2)} KB (limit: 150 KB)`);
  if (gzipKb > 150) {
    errors.push(`Initial JS bundle ${gzipKb.toFixed(2)} KB exceeds 150 KB gzip limit`);
  }
} else {
  errors.push("Could not find main entry JS script in dist/index.html");
}

if (errors.length > 0) {
  console.error("STATIC CHECKS FAILED:\n- " + errors.join("\n- "));
  process.exit(1);
}

console.log(`PASS: Verified ${htmlFiles.length} prerendered pages, forbidden claims, tea-shop zero-table rule, and JS budget.`);
