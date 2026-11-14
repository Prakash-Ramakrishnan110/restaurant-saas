/**
 * Color and GSTIN utilities for ServeMyFood frontend.
 * Conforms to WCAG 2.1 relative luminance and contrast specifications.
 */

export function parseHexColor(hexStr: string): [number, number, number] | null {
  if (!hexStr || typeof hexStr !== "string") return null;
  let clean = hexStr.trim().replace(/^#/, "");
  if (clean.length === 3) {
    clean = clean
      .split("")
      .map((c) => c + c)
      .join("");
  }
  if (clean.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(clean)) {
    return null;
  }
  const num = parseInt(clean, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

export function relativeLuminance(r: number, g: number, b: number): number {
  const channel = (c: number): number => {
    const val = c / 255;
    return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function calculateContrastRatio(hex1: string, hex2: string): number {
  const rgb1 = parseHexColor(hex1);
  const rgb2 = parseHexColor(hex2);
  if (!rgb1 || !rgb2) return 1.0;
  const l1 = relativeLuminance(rgb1[0], rgb1[1], rgb1[2]);
  const l2 = relativeLuminance(rgb2[0], rgb2[1], rgb2[2]);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export const NAVY_HEX = "#0B1F3B";
export const WHITE_HEX = "#FFFFFF";

export interface ColorContrastCheck {
  isValidHex: boolean;
  contrastAgainstWhite: number;
  contrastAgainstNavy: number;
  passesThreshold: boolean; // >= 4.5:1 against white OR navy
  bestContrast: number;
  recommendedTextHex: string; // "#FFFFFF" or "#0B1F3B"
}

export function evaluateBrandColor(hex: string): ColorContrastCheck {
  const rgb = parseHexColor(hex);
  if (!rgb) {
    return {
      isValidHex: false,
      contrastAgainstWhite: 1,
      contrastAgainstNavy: 1,
      passesThreshold: false,
      bestContrast: 1,
      recommendedTextHex: "#FFFFFF",
    };
  }

  const normalizedHex = hex.startsWith("#") ? hex.toUpperCase() : `#${hex.toUpperCase()}`;
  const cWhite = calculateContrastRatio(normalizedHex, WHITE_HEX);
  const cNavy = calculateContrastRatio(normalizedHex, NAVY_HEX);
  const passes = Math.max(cWhite, cNavy) >= 4.5;
  const bestText = cWhite >= cNavy ? WHITE_HEX : NAVY_HEX;

  return {
    isValidHex: true,
    contrastAgainstWhite: Math.round(cWhite * 100) / 100,
    contrastAgainstNavy: Math.round(cNavy * 100) / 100,
    passesThreshold: passes,
    bestContrast: Math.round(Math.max(cWhite, cNavy) * 100) / 100,
    recommendedTextHex: bestText,
  };
}

export const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

export function isValidGSTIN(val: string): boolean {
  if (!val) return true; // Optional field
  const clean = val.trim().toUpperCase();
  if (!clean) return true;
  return GSTIN_REGEX.test(clean);
}
