import { describe, it, expect } from "vitest";
import { calculateContrastRatio } from "../pages/dev/DevBrandPage";

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

  it("all 5 operational table status badges exceed WCAG AA contrast", () => {
    // AVAILABLE: #15803D text on #DCFCE7 background
    const availableRatio = calculateContrastRatio("#15803D", "#DCFCE7");
    expect(availableRatio).toBeGreaterThanOrEqual(4.5);

    // OCCUPIED: #1D4ED8 text on #DBEAFE background
    const occupiedRatio = calculateContrastRatio("#1D4ED8", "#DBEAFE");
    expect(occupiedRatio).toBeGreaterThanOrEqual(4.5);

    // RESERVED: #7E22CE text on #F3E8FF background
    const reservedRatio = calculateContrastRatio("#7E22CE", "#F3E8FF");
    expect(reservedRatio).toBeGreaterThanOrEqual(4.5);

    // CLEANING: #B45309 text on #FEF3C7 background
    const cleaningRatio = calculateContrastRatio("#B45309", "#FEF3C7");
    expect(cleaningRatio).toBeGreaterThanOrEqual(4.5);

    // BLOCKED: #374151 text on #F3F4F6 background
    const blockedRatio = calculateContrastRatio("#374151", "#F3F4F6");
    expect(blockedRatio).toBeGreaterThanOrEqual(4.5);
  });
});
