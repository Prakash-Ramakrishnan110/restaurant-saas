import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parseHardwareKitsFromTs, validateHardwareKits } from "./validate_hardware.mjs";

const rootDir = path.resolve(import.meta.dirname, "..");
const distDir = path.join(rootDir, "dist");
const ssrDir = path.join(rootDir, "dist-ssr");

// Always enforce READY hardware kit rules (cannot be bypassed by MARKETING_ALLOW_DRAFT)
const hardwareSource = fs.readFileSync(path.join(rootDir, "content/hardware.ts"), "utf-8");
const hardwareErrors = validateHardwareKits(
  parseHardwareKitsFromTs(hardwareSource),
  path.join(rootDir, "assets/photos/hardware")
);
if (hardwareErrors.length > 0) {
  console.error("HARDWARE BUILD GATE FAILED:\n- " + hardwareErrors.join("\n- "));
  process.exit(1);
}

const allowDraft = process.env.MARKETING_ALLOW_DRAFT === "1";

const siteContent = fs.readFileSync(path.join(rootDir, "content/site.ts"), "utf-8");
const legalContent = fs.readFileSync(path.join(rootDir, "src/pages/LegalPage.tsx"), "utf-8");

if (!allowDraft) {
  const errors = [];
  if (/TODO:/i.test(siteContent)) {
    errors.push("marketing/content/site.ts still contains TODO placeholders.");
  }
  if (/DRAFT FOR LAWYER REVIEW/i.test(legalContent)) {
    errors.push("marketing/src/pages/LegalPage.tsx still contains DRAFT FOR LAWYER REVIEW.");
  }
  if (errors.length > 0) {
    console.error("PRODUCTION BUILD BLOCKED:\n- " + errors.join("\n- "));
    process.exit(1);
  }
}

const templateRaw = fs.readFileSync(path.join(distDir, "index.html"), "utf-8");
let template = templateRaw;
const cssMatch = templateRaw.match(/<link rel="stylesheet"[^>]*href="(\/assets\/[^"]+\.css)"[^>]*>/);
if (cssMatch) {
  const cssPath = path.join(distDir, cssMatch[1].replace(/^\//, ""));
  if (fs.existsSync(cssPath)) {
    const cssText = fs.readFileSync(cssPath, "utf-8");
    template = template.replace(cssMatch[0], `<style>${cssText}</style>`);
  }
}
const scriptTagMatch = template.match(/<script type="module"[^>]*src="(\/assets\/index-[^"]+\.js)"[^>]*><\/script>/);
if (scriptTagMatch) {
  const entrySrc = scriptTagMatch[1];
  const lazyLoader = `<script>(function(){var s=false;function l(){if(s)return;s=true;import("${entrySrc}");}if(window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches){l();}["pointerdown","keydown","touchstart","focusin"].forEach(function(e){window.addEventListener(e,l,{capture:true,once:true,passive:true});});window.addEventListener("load",function(){setTimeout(l,5500);});})();</script>`;
  template = template.replace(scriptTagMatch[0], lazyLoader);
}
const ssrModule = await import(pathToFileURL(path.join(ssrDir, "entry-server.js")).href);

const baseUrl = "https://servemyfood.in";

const routeList = [
  {
    url: "/",
    enUrl: "/",
    taUrl: "/ta/",
    lang: "en",
    title: "ServeMyFood — Take orders. Run the kitchen. Get paid. See today's sales.",
    desc: "One simple system for tea shops, cafes, restaurants and hotels. Works on a phone, tablet or computer. In Tamil and English.",
  },
  {
    url: "/ta/",
    enUrl: "/",
    taUrl: "/ta/",
    lang: "ta",
    title: "ServeMyFood — ஆர்டர் எடுங்கள். சமையலறையை இயக்குங்கள். பணம் பெறுங்கள்.",
    desc: "தேநீர்க் கடை, கஃபே, உணவகம், ஹோட்டல் அனைத்திற்கும் ஒரே எளிய அமைப்பு. தமிழ் மற்றும் ஆங்கிலத்தில்.",
  },
  {
    url: "/tea-shops/",
    enUrl: "/tea-shops/",
    taUrl: "/ta/tea-shops/",
    lang: "en",
    title: "ServeMyFood for Tea Shops & Bakeries — Fast Counter & Token Billing",
    desc: "Take counter orders quickly, issue token numbers, send items to the kitchen, and check daily cash and UPI totals.",
  },
  {
    url: "/ta/tea-shops/",
    enUrl: "/tea-shops/",
    taUrl: "/ta/tea-shops/",
    lang: "ta",
    title: "தேநீர்க் கடை மற்றும் பேக்கரிகளுக்கான ServeMyFood — டோக்கன் மற்றும் கவுண்டர் பில்லிங்",
    desc: "கவுண்டரில் விரைவாக ஆர்டர் எடுத்து, டோக்கன் எண் வழங்கி, தினசரி விற்பனையை உடனே பாருங்கள்.",
  },
  {
    url: "/restaurants/",
    enUrl: "/restaurants/",
    taUrl: "/ta/restaurants/",
    lang: "en",
    title: "ServeMyFood for Restaurants & Cafes — Table Orders, Kitchen Screen & Billing",
    desc: "Waiters take orders on a phone, the kitchen sees tickets with a sound alert, and cashiers settle bills cleanly.",
  },
  {
    url: "/ta/restaurants/",
    enUrl: "/restaurants/",
    taUrl: "/ta/restaurants/",
    lang: "ta",
    title: "உணவகம் மற்றும் கஃபேக்களுக்கான ServeMyFood — ஆர்டர், சமையலறை மற்றும் பில்லிங்",
    desc: "பணியாளர் போனில் ஆர்டர் எடுப்பார், சமையலறைக்கு ஒலி அறிவிப்புடன் செல்லும், கேஷியர் எளிதாக பில் போடுவார்.",
  },
  {
    url: "/hotels/",
    enUrl: "/hotels/",
    taUrl: "/ta/hotels/",
    lang: "en",
    title: "ServeMyFood for Hotel Restaurants — Multi-Outlet Dining & Kitchen Control",
    desc: "Run your hotel dining room, cafe and kitchen screen in one place. Room service and room charges are coming soon.",
  },
  {
    url: "/ta/hotels/",
    enUrl: "/hotels/",
    taUrl: "/ta/hotels/",
    lang: "ta",
    title: "ஹோட்டல் உணவகங்களுக்கான ServeMyFood — கிளை மற்றும் சமையலறை மேலாண்மை",
    desc: "உங்கள் ஹோட்டல் உணவகம் மற்றும் சமையலறையை ஒரே இடத்தில் இயக்குங்கள். அறை சேவை விரைவில்.",
  },
  {
    url: "/hardware/",
    enUrl: "/hardware/",
    taUrl: "/ta/hardware/",
    lang: "en",
    title: "Devices & Hardware Guide — ServeMyFood",
    desc: "Run ServeMyFood in a browser on your own phone, tablet, laptop, or TV screen.",
  },
  {
    url: "/ta/hardware/",
    enUrl: "/hardware/",
    taUrl: "/ta/hardware/",
    lang: "ta",
    title: "சாதனங்கள் மற்றும் உபகரண வழிகாட்டி — ServeMyFood",
    desc: "உங்களிடம் உள்ள போன், டேப்லெட், லேப்டாப் அல்லது டிவி திரையின் உலாவியில் ServeMyFood-ஐ இயக்குங்கள்.",
  },
  {
    url: "/book-demo/",
    enUrl: "/book-demo/",
    taUrl: "/ta/book-demo/",
    lang: "en",
    title: "Book a Free Demo — ServeMyFood",
    desc: "Request a free live walkthrough for your tea shop, bakery, cafe, restaurant or hotel.",
  },
  {
    url: "/ta/book-demo/",
    enUrl: "/book-demo/",
    taUrl: "/ta/book-demo/",
    lang: "ta",
    title: "இலவச டெமோ பதிவு செய்யுங்கள் — ServeMyFood",
    desc: "உங்கள் தேநீர்க் கடை, பேக்கரி, கஃபே, உணவகம் அல்லது ஹோட்டலுக்கான இலவச டெமோவை பதிவு செய்யுங்கள்.",
  },
  {
    url: "/privacy/",
    enUrl: "/privacy/",
    taUrl: "/ta/privacy/",
    lang: "en",
    title: "Privacy Notice — ServeMyFood",
    desc: "How Fusion Engine Technology collects and handles demo request details.",
  },
  {
    url: "/ta/privacy/",
    enUrl: "/privacy/",
    taUrl: "/ta/privacy/",
    lang: "ta",
    title: "தனியுரிமைக் கொள்கை — ServeMyFood",
    desc: "டெமோ கோரிக்கை விவரங்களை Fusion Engine Technology எவ்வாறு கையாள்கிறது.",
  },
  {
    url: "/terms/",
    enUrl: "/terms/",
    taUrl: "/ta/terms/",
    lang: "en",
    title: "Terms of Use — ServeMyFood",
    desc: "Plain-language terms for using the ServeMyFood website and booking a demo.",
  },
  {
    url: "/ta/terms/",
    enUrl: "/terms/",
    taUrl: "/ta/terms/",
    lang: "ta",
    title: "பயன்பாட்டு விதிமுறைகள் — ServeMyFood",
    desc: "ServeMyFood இணையதளத்தை பயன்படுத்துவதற்கான எளிய விதிமுறைகள்.",
  },
  {
    url: "/404.html",
    enUrl: "/",
    taUrl: "/ta/",
    lang: "en",
    title: "Page Not Found — ServeMyFood",
    desc: "The page you requested could not be found.",
  },
];

const jsonLd = JSON.stringify([
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Fusion Engine Technology",
    url: baseUrl,
  },
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "ServeMyFood",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
  },
]);

for (const route of routeList) {
  const appHtml = ssrModule.render(route.url === "/404.html" ? "/missing-page" : route.url);
  const headTags = [
    `<meta name="description" content="${route.desc}" />`,
    `<meta name="theme-color" content="#0B1F3B" />`,
    `<link rel="preload" as="font" type="font/woff2" href="/fonts/poppins-700.woff2" crossorigin />`,
    `<link rel="canonical" href="${baseUrl}${route.url}" />`,
    `<link rel="alternate" hreflang="en" href="${baseUrl}${route.enUrl}" />`,
    `<link rel="alternate" hreflang="ta" href="${baseUrl}${route.taUrl}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:title" content="${route.title}" />`,
    `<meta property="og:description" content="${route.desc}" />`,
    `<meta property="og:image" content="${baseUrl}/og-image.svg" />`,
    `<script type="application/ld+json">${jsonLd}</script>`,
  ].join("\n    ");

  let html = template
    .replace(`<html lang="en">`, `<html lang="${route.lang}">`)
    .replace(/<title>.*?<\/title>/, `<title>${route.title}</title>`)
    .replace("<!--HEAD_PLACEHOLDER-->", headTags)
    .replace("<!--APP_HTML-->", appHtml);

  const outPath =
    route.url === "/"
      ? path.join(distDir, "index.html")
      : route.url === "/404.html"
        ? path.join(distDir, "404.html")
        : path.join(distDir, route.url.replace(/^\/|\/$/g, ""), "index.html");

  if (/PHOTO NEEDED/i.test(html)) {
    console.error(`PRODUCTION BUILD BLOCKED: Built HTML for ${route.url} contains "PHOTO NEEDED".`);
    process.exit(1);
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, html, "utf-8");
}

const sitemapUrls = routeList
  .filter((r) => r.url !== "/404.html")
  .map((r) => `  <url><loc>${baseUrl}${r.url}</loc></url>`)
  .join("\n");

fs.writeFileSync(
  path.join(distDir, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapUrls}\n</urlset>\n`,
  "utf-8"
);

fs.writeFileSync(
  path.join(distDir, "robots.txt"),
  `User-agent: *\nAllow: /\nSitemap: ${baseUrl}/sitemap.xml\n`,
  "utf-8"
);

fs.rmSync(ssrDir, { recursive: true, force: true });
console.log(`Prerendered ${routeList.length} pages + sitemap.xml + robots.txt`);
