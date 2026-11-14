import { describe, it, expect } from "vitest";
import { defaultResources } from "../i18n/index";

describe("i18n Plain Language & Jargon Invariants (Step 3.3)", () => {
  const forbiddenPatterns = [
    { pattern: /\btenant\b/i, word: "tenant" },
    { pattern: /\bpaise\b/i, word: "paise" },
    { pattern: /\binteger\b/i, word: "integer" },
    { pattern: /\bpreset(s)?\b/i, word: "preset" },
    { pattern: /\bflag(s)?\b/i, word: "flag" },
  ];

  function extractStrings(obj: any, prefix = ""): { path: string; val: string }[] {
    const results: { path: string; val: string }[] = [];
    if (!obj || typeof obj !== "object") return results;

    for (const key of Object.keys(obj)) {
      const val = obj[key];
      const curPath = prefix ? `${prefix}.${key}` : key;
      if (typeof val === "string") {
        results.push({ path: curPath, val });
      } else if (typeof val === "object") {
        results.push(...extractStrings(val, curPath));
      }
    }
    return results;
  }

  it("verifies English (en) dictionary contains zero jargon words", () => {
    const enStrings = extractStrings(defaultResources.en.translation, "en");
    expect(enStrings.length).toBeGreaterThan(50);

    const violations: string[] = [];
    for (const item of enStrings) {
      for (const { pattern, word } of forbiddenPatterns) {
        if (pattern.test(item.val)) {
          violations.push(`[en] "${item.path}": "${item.val}" contains forbidden word "${word}"`);
        }
      }
    }

    expect(violations, `Found jargon in English i18n resources:\n${violations.join("\n")}`).toEqual(
      []
    );
  });

  it("verifies Tamil (ta) dictionary contains zero technical jargon words", () => {
    const taStrings = extractStrings(defaultResources.ta.translation, "ta");
    expect(taStrings.length).toBeGreaterThan(50);

    const violations: string[] = [];
    for (const item of taStrings) {
      for (const { pattern, word } of forbiddenPatterns) {
        if (pattern.test(item.val)) {
          violations.push(`[ta] "${item.path}": "${item.val}" contains forbidden word "${word}"`);
        }
      }
    }

    expect(violations, `Found jargon in Tamil i18n resources:\n${violations.join("\n")}`).toEqual(
      []
    );
  });

  it("verifies parity between en and ta translation keys", () => {
    const enStrings = extractStrings(defaultResources.en.translation);
    const taStrings = extractStrings(defaultResources.ta.translation);

    const enKeys = new Set(enStrings.map((s) => s.path));
    const taKeys = new Set(taStrings.map((s) => s.path));

    const missingInTa = [...enKeys].filter((k) => !taKeys.has(k));
    const extraInTa = [...taKeys].filter((k) => !enKeys.has(k));

    expect(missingInTa, `Keys present in en but missing in ta: ${missingInTa.join(", ")}`).toEqual(
      []
    );
    expect(extraInTa, `Keys present in ta but missing in en: ${extraInTa.join(", ")}`).toEqual([]);
  });
});
