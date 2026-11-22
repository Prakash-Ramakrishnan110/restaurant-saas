import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const BASE_DIR = path.resolve(__dirname, "../../..");
export const AXE_PATH = path.join(BASE_DIR, "frontend/node_modules/axe-core/axe.min.js");
const AXE_SOURCE = fs.readFileSync(AXE_PATH, "utf8");

export async function waitUntilContentReady(page) {
  // Wait up to 10s for loading skeletons / spinners to settle
  const startWait = Date.now();
  let stillLoading = false;
  while (Date.now() - startWait < 10000) {
    stillLoading = await page.evaluate(() => {
      const els = Array.from(
        document.querySelectorAll(
          '[class*="animate-pulse"], [class*="skeleton"], [aria-busy="true"], .animate-spin'
        )
      );
      return els.some((el) => {
        // Ignore tiny inline icon spins inside disabled buttons unless page-level
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        const insideBtn = Boolean(el.closest("button"));
        return (
          !insideBtn &&
          r.width > 0 &&
          r.height > 0 &&
          s.display !== "none" &&
          s.visibility !== "hidden"
        );
      });
    });
    if (!stillLoading) break;
    await page.waitForTimeout(300);
  }
  // Also wait briefly for visible <img> decoding
  await page
    .evaluate(async () => {
      const imgs = Array.from(document.querySelectorAll("img"));
      await Promise.race([
        Promise.all(
          imgs.map((img) =>
            img.complete
              ? Promise.resolve()
              : new Promise((res) => {
                  img.addEventListener("load", res, { once: true });
                  img.addEventListener("error", res, { once: true });
                })
          )
        ),
        new Promise((res) => setTimeout(res, 2500)),
      ]);
    })
    .catch(() => {});
  return stillLoading;
}

export async function runScreenAudit(page, opts) {
  const {
    flowId,
    stepId,
    viewportName,
    shotPath,
    isCounterVenue = false,
    checkTamil = false,
    httpErrors = [],
    consoleErrors = [],
    pageErrors = [],
  } = opts;

  const minTapPx = viewportName === "mobile" ? 56 : 48;
  const skeletonAfter10s = await waitUntilContentReady(page);
  await page.waitForTimeout(250);

  fs.mkdirSync(path.dirname(shotPath), { recursive: true });
  await page.screenshot({ path: shotPath, fullPage: false });

  const hasAxe = await page.evaluate(() => typeof window.axe !== "undefined");
  if (!hasAxe) {
    await page.addScriptTag({ content: AXE_SOURCE });
  }

  const domAudit = await page.evaluate(
    ({ minTapPx, isCounterVenue, checkTamil, hasHttpErrors }) => {
      function parseRgb(str) {
        if (!str || str === "transparent") return null;
        const m = str.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
        if (!m) return null;
        return {
          r: Number(m[1]),
          g: Number(m[2]),
          b: Number(m[3]),
          a: m[4] !== undefined ? Number(m[4]) : 1,
        };
      }

      function luminance(c) {
        const toLin = (v) => {
          const s = v / 255;
          return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
        };
        return 0.2126 * toLin(c.r) + 0.7152 * toLin(c.g) + 0.0722 * toLin(c.b);
      }

      function contrastRatio(fg, bg) {
        const l1 = luminance(fg);
        const l2 = luminance(bg);
        const lighter = Math.max(l1, l2);
        const darker = Math.min(l1, l2);
        return (lighter + 0.05) / (darker + 0.05);
      }

      function getEffectiveBg(el) {
        let cur = el;
        while (cur && cur !== document.documentElement) {
          const st = getComputedStyle(cur);
          const c = parseRgb(st.backgroundColor);
          if (c && c.a >= 0.85) return c;
          cur = cur.parentElement;
        }
        const bodyBg = parseRgb(getComputedStyle(document.body).backgroundColor);
        return bodyBg && bodyBg.a > 0 ? bodyBg : { r: 255, g: 255, b: 255, a: 1 };
      }

      function isVisible(el) {
        const st = getComputedStyle(el);
        if (st.display === "none" || st.visibility === "hidden" || parseFloat(st.opacity) === 0) {
          return false;
        }
        if (el.closest('[aria-hidden="true"]') || st.clip === "rect(0px, 0px, 0px, 0px)") {
          return false;
        }
        const rect = el.getBoundingClientRect();
        return rect.width > 0.5 && rect.height > 0.5;
      }

      // 1. Horizontal scroll
      const docW = document.documentElement.scrollWidth;
      const winW = window.innerWidth;
      const horizontalScroll = docW > winW + 1;

      // 2. Tap targets under threshold (48px desktop, 56px mobile touch)
      const interactiveEls = Array.from(
        document.querySelectorAll(
          'button, a[href], input:not([type="hidden"]), select, textarea, [role="button"], [role="tab"], [role="switch"], [role="checkbox"]'
        )
      );
      const smallTapTargets = [];
      for (const el of interactiveEls) {
        if (!isVisible(el)) continue;
        const r = el.getBoundingClientRect();
        if (r.width < minTapPx || r.height < minTapPx) {
          smallTapTargets.push({
            tag: el.tagName.toLowerCase(),
            text: (el.innerText || el.getAttribute("aria-label") || el.getAttribute("placeholder") || "")
              .trim()
              .slice(0, 50),
            w: Math.round(r.width),
            h: Math.round(r.height),
            x: Math.round(r.x),
            y: Math.round(r.y),
          });
        }
      }

      // 3, 5, 6, 7: Text < 12px, contrast < 4.5, orange text, white on #FF6A00
      const smallText = [];
      const orangeText = [];
      const whiteOnOrange = [];
      const lowContrast = [];

      const textCandidates = Array.from(document.querySelectorAll("body *"));
      for (const el of textCandidates) {
        if (!isVisible(el)) continue;
        const directText = Array.from(el.childNodes)
          .filter((n) => n.nodeType === Node.TEXT_NODE && n.textContent.trim().length > 0)
          .map((n) => n.textContent.trim())
          .join(" ");
        if (!directText) continue;

        const st = getComputedStyle(el);
        const fontSize = parseFloat(st.fontSize || "14");
        const r = el.getBoundingClientRect();

        if (fontSize < 12) {
          smallText.push({
            fontSize: Math.round(fontSize * 10) / 10,
            text: directText.slice(0, 60),
            x: Math.round(r.x),
            y: Math.round(r.y),
            w: Math.round(r.width),
            h: Math.round(r.height),
          });
        }

        const fg = parseRgb(st.color);
        const bg = getEffectiveBg(el);

        if (fg && bg) {
          const ratio = contrastRatio(fg, bg);
          if (ratio < 4.5) {
            lowContrast.push({
              ratio: Math.round(ratio * 100) / 100,
              fg: st.color,
              bg: `rgb(${bg.r},${bg.g},${bg.b})`,
              text: directText.slice(0, 50),
              x: Math.round(r.x),
              y: Math.round(r.y),
              w: Math.round(r.width),
              h: Math.round(r.height),
            });
          }

          const isOrangeRgb = fg.r >= 190 && fg.g >= 65 && fg.g <= 185 && fg.b <= 75;
          const cls = typeof el.className === "string" ? el.className : "";
          const hasOrangeTextCls = /\btext-(?:orange|amber)-(?:400|500|600|700)\b/.test(cls);
          if (isOrangeRgb || hasOrangeTextCls) {
            orangeText.push({
              color: st.color,
              cls: cls.slice(0, 80),
              text: directText.slice(0, 50),
              x: Math.round(r.x),
              y: Math.round(r.y),
              w: Math.round(r.width),
              h: Math.round(r.height),
            });
          }

          const isOrangeBg =
            Math.abs(bg.r - 255) <= 20 && Math.abs(bg.g - 106) <= 25 && Math.abs(bg.b - 0) <= 20;
          const isWhiteText = fg.r >= 220 && fg.g >= 220 && fg.b >= 220;
          if (isOrangeBg && isWhiteText) {
            whiteOnOrange.push({
              fg: st.color,
              bg: `rgb(${bg.r},${bg.g},${bg.b})`,
              text: directText.slice(0, 50),
              x: Math.round(r.x),
              y: Math.round(r.y),
              w: Math.round(r.width),
              h: Math.round(r.height),
            });
          }
        }
      }

      // 8. Empty frames / broken images
      const brokenMedia = [];
      for (const img of Array.from(document.querySelectorAll("img"))) {
        const r = img.getBoundingClientRect();
        if (r.width === 0 && r.height === 0 && getComputedStyle(img).display === "none") continue;
        if (!img.complete || img.naturalWidth === 0) {
          brokenMedia.push({
            type: "img",
            src: (img.getAttribute("src") || "").slice(0, 100),
            alt: (img.getAttribute("alt") || "").slice(0, 40),
            x: Math.round(r.x),
            y: Math.round(r.y),
            w: Math.round(r.width),
            h: Math.round(r.height),
          });
        }
      }
      for (const frame of Array.from(document.querySelectorAll("iframe"))) {
        const r = frame.getBoundingClientRect();
        if (r.width > 0 && r.height > 0 && !frame.getAttribute("src")) {
          brokenMedia.push({
            type: "iframe-empty",
            src: "",
            alt: "",
            x: Math.round(r.x),
            y: Math.round(r.y),
            w: Math.round(r.width),
            h: Math.round(r.height),
          });
        }
      }

      // 9. Zeros shown after failed request
      const bodyText = (document.body && document.body.innerText) || "";
      const hasZeroMetric = /(?:₹\s*0(?:\.00)?\b|\b0\s+(?:Orders|Tables|Invoices|Bills|Items|Active)\b)/i.test(
        bodyText
      );
      const zerosAfterFailedRequest = hasHttpErrors && hasZeroMetric;

      // 11. Forbidden visible words in EN or TA
      const enForbiddenRegex =
        /\b(tenant|tenants|entitlement|entitlements|paise|preset|presets|flag|flags|ledger|ledgers|session|sessions|canvas|gst|gstin|cgst|sgst|tax|taxes|pms|fssai)\b/gi;
      const taForbiddenWords = ["குத்தகை", "வரி", "ஜிஎஸ்டி", "லெட்ஜர்", "முன்னமைவு", "உரிமை"];
      const forbiddenHits = new Set();
      let m;
      while ((m = enForbiddenRegex.exec(bodyText)) !== null) {
        forbiddenHits.add(m[0]);
      }
      for (const tw of taForbiddenWords) {
        if (bodyText.includes(tw)) forbiddenHits.add(tw);
      }

      // 12. Counter venue "table" leakage
      const counterTableHits = [];
      if (isCounterVenue) {
        const tRegex = /\btable(s)?\b/gi;
        while ((m = tRegex.exec(bodyText)) !== null) {
          counterTableHits.push(m[0]);
        }
        if (bodyText.includes("மேசை")) counterTableHits.push("மேசை");
      }

      // 13. Missing Tamil strings
      const missingTamilHits = [];
      const rawKeyMatches = bodyText.match(/\b[a-z]+\.[a-z][a-zA-Z0-9_]+\b/g) || [];
      for (const k of rawKeyMatches) {
        if (!k.includes("com") && !k.includes("in") && !k.includes("0")) {
          missingTamilHits.push(`raw_key:${k}`);
        }
      }
      if (checkTamil) {
        const lines = bodyText
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean);
        for (const line of lines) {
          if (
            /^[A-Za-z][A-Za-z\s,&/()-]{4,}$/.test(line) &&
            !/ServeMyFood|UPI|QR|PDF|POS|KDS|V\d+|T\d+/.test(line)
          ) {
            missingTamilHits.push(`en_in_ta:${line.slice(0, 40)}`);
          }
        }
      }

      return {
        url: window.location.pathname + window.location.search,
        title: document.title,
        docScrollWidth: docW,
        windowInnerWidth: winW,
        horizontalScroll,
        smallTapTargetsCount: smallTapTargets.length,
        smallTapTargets: smallTapTargets.slice(0, 12),
        smallTextCount: smallText.length,
        smallText: smallText.slice(0, 12),
        lowContrastCount: lowContrast.length,
        lowContrast: lowContrast.slice(0, 12),
        orangeTextCount: orangeText.length,
        orangeText: orangeText.slice(0, 10),
        whiteOnOrangeCount: whiteOnOrange.length,
        whiteOnOrange: whiteOnOrange.slice(0, 10),
        brokenMediaCount: brokenMedia.length,
        brokenMedia: brokenMedia.slice(0, 10),
        zerosAfterFailedRequest,
        forbiddenWords: Array.from(forbiddenHits),
        counterTableWords: Array.from(new Set(counterTableHits)),
        missingTamil: Array.from(new Set(missingTamilHits)).slice(0, 15),
      };
    },
    {
      minTapPx,
      isCounterVenue,
      checkTamil,
      hasHttpErrors: httpErrors.length > 0,
    }
  );

  let axeViolations = [];
  try {
    const axeRes = await page.evaluate(async () => {
      if (!window.axe) return { violations: [] };
      return await window.axe.run(document, {
        runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
      });
    });
    axeViolations = (axeRes.violations || [])
      .filter((v) => v.impact === "serious" || v.impact === "critical")
      .map((v) => ({
        id: v.id,
        impact: v.impact,
        help: v.help,
        nodesCount: v.nodes ? v.nodes.length : 0,
        sampleTarget: v.nodes?.[0]?.target?.join(" ") || "",
      }));
  } catch (err) {
    axeViolations = [{ id: "axe-runner-error", impact: "serious", help: String(err), nodesCount: 1 }];
  }

  return {
    flowId,
    stepId,
    viewport: viewportName,
    shotPath: path.relative(BASE_DIR, shotPath).replace(/\\/g, "/"),
    skeletonStillVisibleAfter10s: skeletonAfter10s,
    httpErrors: [...httpErrors],
    consoleErrors: [...consoleErrors],
    pageErrors: [...pageErrors],
    axeSeriousCriticalCount: axeViolations.length,
    axeViolations,
    ...domAudit,
  };
}
