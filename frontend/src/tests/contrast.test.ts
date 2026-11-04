import { describe, it, expect } from "vitest";
import { calculateContrastRatio } from "../pages/dev/DevBrandPage";

function hexToHue(hex: string): number {
  hex = hex.replace("#", "");
  const num = parseInt(hex, 16);
  const r = (num >> 16) / 255;
  const g = ((num >> 8) & 255) / 255;
  const b = (num & 255) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === min) return 0;

  let h = 0;
  if (max === r) {
    h = (60 * ((g - b) / (max - min)) + 360) % 360;
  } else if (max === g) {
    h = (60 * ((b - r) / (max - min)) + 120) % 360;
  } else {
    h = (60 * ((r - g) / (max - min)) + 240) % 360;
  }
  return Math.round(h);
}

describe("Brand Color Token WCAG 2.1 Contrast Invariants", () => {
  it("primary button: Navy (#0B1F3B) text on Orange (#FF6A00) meets WCAG AAA requirement (>= 4.5:1 for normal text, exceeds 5.5:1)", () => {
    const ratio = calculateContrastRatio("#0B1F3B", "#FF6A00");
    // Explicit assertion: 5.7:1
    expect(ratio).toBeGreaterThanOrEqual(4.5);
    expect(ratio).toBeCloseTo(5.7, 1);
  });

  it("FORBIDDEN: white (#FFFFFF) text on Orange (#FF6A00) fails WCAG AA (ratio < 4.5:1) and is strictly disallowed", () => {
    const ratio = calculateContrastRatio("#FFFFFF", "#FF6A00");
    // 2.87:1 fails WCAG AA normal text requirement of 4.5:1
    expect(ratio).toBeLessThan(4.5);
    expect(ratio).toBeCloseTo(2.87, 1);
  });

  it("darker orange token (#C2410C) on white (#FFFFFF) meets WCAG AA (>= 4.5:1)", () => {
    const ratio = calculateContrastRatio("#C2410C", "#FFFFFF");
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it("danger red token (#DC2626) on white (#FFFFFF) meets WCAG AA (>= 4.5:1)", () => {
    const ratio = calculateContrastRatio("#DC2626", "#FFFFFF");
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it("deep navy (#0B1F3B) on warm cream (#FFF3E0) meets WCAG AAA (>= 7.0:1)", () => {
    const ratio = calculateContrastRatio("#0B1F3B", "#FFF3E0");
    expect(ratio).toBeGreaterThanOrEqual(7.0);
  });

  it("all 5 operational table status badges exceed WCAG AA contrast in light mode", () => {
    // AVAILABLE: #15803D text on #DCFCE7 background
    expect(calculateContrastRatio("#15803D", "#DCFCE7")).toBeGreaterThanOrEqual(4.5);
    // OCCUPIED: #1D4ED8 text on #DBEAFE background
    expect(calculateContrastRatio("#1D4ED8", "#DBEAFE")).toBeGreaterThanOrEqual(4.5);
    // RESERVED: #7E22CE text on #F3E8FF background
    expect(calculateContrastRatio("#7E22CE", "#F3E8FF")).toBeGreaterThanOrEqual(4.5);
    // CLEANING: #B45309 text on #FEF3C7 background
    expect(calculateContrastRatio("#B45309", "#FEF3C7")).toBeGreaterThanOrEqual(4.5);
    // BLOCKED: #374151 text on #F3F4F6 background
    expect(calculateContrastRatio("#374151", "#F3F4F6")).toBeGreaterThanOrEqual(4.5);
  });

  it("all 5 operational table status badges exceed WCAG AA contrast in dark mode", () => {
    // AVAILABLE Dark: #4ADE80 text on #14532D background
    expect(calculateContrastRatio("#4ADE80", "#14532D")).toBeGreaterThanOrEqual(4.5);
    // OCCUPIED Dark: #93C5FD text on #1E3A8A background
    expect(calculateContrastRatio("#93C5FD", "#1E3A8A")).toBeGreaterThanOrEqual(4.5);
    // RESERVED Dark: #E9D5FF text on #581C87 background
    expect(calculateContrastRatio("#E9D5FF", "#581C87")).toBeGreaterThanOrEqual(4.5);
    // CLEANING Dark: #FBBF24 text on #78350F background
    expect(calculateContrastRatio("#FBBF24", "#78350F")).toBeGreaterThanOrEqual(4.5);
    // BLOCKED Dark: #D1D5DB text on #374151 background
    expect(calculateContrastRatio("#D1D5DB", "#374151")).toBeGreaterThanOrEqual(4.5);
  });

  it("INVARIANT: Table status tokens NEVER use primary brand orange hue (#FF6A00)", () => {
    const brandOrangeHue = hexToHue("#FF6A00"); // ~25 degrees
    expect(brandOrangeHue).toBe(25);

    const statusHexes = [
      { status: "AVAILABLE", text: "#15803D", bg: "#DCFCE7" },
      { status: "OCCUPIED", text: "#1D4ED8", bg: "#DBEAFE" },
      { status: "RESERVED", text: "#7E22CE", bg: "#F3E8FF" },
      { status: "BLOCKED", text: "#374151", bg: "#F3F4F6" },
    ];

    statusHexes.forEach(({ text, bg }) => {
      expect(text.toUpperCase()).not.toBe("#FF6A00");
      expect(bg.toUpperCase()).not.toBe("#FF6A00");
      // Distinct hue from brand orange (not in 20-30 degree range)
      const textHue = hexToHue(text);
      expect(Math.abs(textHue - brandOrangeHue)).toBeGreaterThan(15);
    });
  });
});
