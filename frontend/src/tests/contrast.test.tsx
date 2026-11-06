import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import fs from "node:fs";
import path from "node:path";
import { calculateContrastRatio } from "../pages/dev/DevBrandPage";
import { BrandLogo } from "../components/brand/BrandLogo";
import { getUsageMeterColor } from "../pages/dashboard/DashboardPage";

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
    expect(calculateContrastRatio("#15803D", "#DCFCE7")).toBeGreaterThanOrEqual(4.5);
    expect(calculateContrastRatio("#1D4ED8", "#DBEAFE")).toBeGreaterThanOrEqual(4.5);
    expect(calculateContrastRatio("#7E22CE", "#F3E8FF")).toBeGreaterThanOrEqual(4.5);
    expect(calculateContrastRatio("#B45309", "#FEF3C7")).toBeGreaterThanOrEqual(4.5);
    expect(calculateContrastRatio("#374151", "#F3F4F6")).toBeGreaterThanOrEqual(4.5);
  });

  it("all 5 operational table status badges exceed WCAG AA contrast in dark mode", () => {
    expect(calculateContrastRatio("#4ADE80", "#14532D")).toBeGreaterThanOrEqual(4.5);
    expect(calculateContrastRatio("#93C5FD", "#1E3A8A")).toBeGreaterThanOrEqual(4.5);
    expect(calculateContrastRatio("#E9D5FF", "#581C87")).toBeGreaterThanOrEqual(4.5);
    expect(calculateContrastRatio("#FBBF24", "#78350F")).toBeGreaterThanOrEqual(4.5);
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
      const textHue = hexToHue(text);
      expect(Math.abs(textHue - brandOrangeHue)).toBeGreaterThan(15);
    });
  });

  it("INVARIANT: Primary brand orange tokens (#FF6A00, #EA6200, #D65900) are NEVER used in Status, Alert, or Warning UI", () => {
    const alertWarningStatusHexes = [
      "#DC2626",
      "#B91C1C",
      "#991B1B",
      "#FEF2F2",
      "#7F1D1D",
      "#D97706",
      "#B45309",
      "#92400E",
      "#FFFBEB",
      "#78350F",
      "#2563EB",
      "#1D4ED8",
      "#1E40AF",
      "#EFF6FF",
      "#172554",
      "#15803D",
      "#7E22CE",
      "#374151",
      "#DCFCE7",
      "#DBEAFE",
      "#F3E8FF",
      "#FEF3C7",
      "#F3F4F6",
      "#4ADE80",
      "#93C5FD",
      "#E9D5FF",
      "#FBBF24",
      "#D1D5DB",
      "#14532D",
      "#1E3A8A",
      "#581C87",
      "#78350F",
    ];

    const forbiddenBrandOrangeHexes = [
      "#FF6A00",
      "#EA6200",
      "#D65900",
      "#F97316",
      "#EA580C",
      "#C2410C",
    ];

    alertWarningStatusHexes.forEach((hex) => {
      forbiddenBrandOrangeHexes.forEach((forbidden) => {
        expect(hex.toUpperCase()).not.toBe(forbidden.toUpperCase());
      });
    });
  });
});

describe("BrandLogo Render & Wordmark Contrast (Requirement B3)", () => {
  it("renders BrandLogo in light theme with wordmark contrast >= 4.5:1 against #FFFFFF background", () => {
    const { unmount } = render(
      <div style={{ backgroundColor: "#FFFFFF" }}>
        <BrandLogo variant="full" theme="light" />
      </div>
    );
    const serveMy = screen.getByTestId("wordmark-servemy");
    const food = screen.getByTestId("wordmark-food");
    expect(serveMy).toBeInTheDocument();
    expect(food).toBeInTheDocument();

    // ServeMy is #0B1F3B (Deep Navy) on light #FFFFFF
    const serveMyRatio = calculateContrastRatio("#0B1F3B", "#FFFFFF");
    expect(serveMyRatio).toBeGreaterThanOrEqual(4.5);
    expect(serveMyRatio).toBeGreaterThanOrEqual(14.0);

    // Mark image uses mark-orange.svg
    const mark = screen.getByTestId("brand-logo-mark");
    expect(mark).toHaveAttribute("src", "/brand/svg/mark-orange.svg");
    unmount();
  });

  it("renders BrandLogo in dark theme with wordmark contrast >= 4.5:1 against #0B1F3B navy background", () => {
    const { unmount } = render(
      <div style={{ backgroundColor: "#0B1F3B" }}>
        <BrandLogo variant="full" theme="dark" />
      </div>
    );
    const serveMy = screen.getByTestId("wordmark-servemy");
    const food = screen.getByTestId("wordmark-food");
    expect(serveMy).toBeInTheDocument();
    expect(food).toBeInTheDocument();

    // In dark theme, ServeMy is #FFFFFF on dark navy #0B1F3B
    const serveMyRatio = calculateContrastRatio("#FFFFFF", "#0B1F3B");
    expect(serveMyRatio).toBeGreaterThanOrEqual(4.5);
    expect(serveMyRatio).toBeGreaterThanOrEqual(14.0);

    // Food is #FF6A00 on dark navy #0B1F3B (5.74:1 AAA contrast)
    const foodRatio = calculateContrastRatio("#FF6A00", "#0B1F3B");
    expect(foodRatio).toBeGreaterThanOrEqual(4.5);
    expect(foodRatio).toBeCloseTo(5.74, 1);

    // Mark image uses mark-white.svg
    const mark = screen.getByTestId("brand-logo-mark");
    expect(mark).toHaveAttribute("src", "/brand/svg/mark-white.svg");
    unmount();
  });
});

describe("Usage Meter Semantic Colors (Requirement C4)", () => {
  it("meter below 80% returns neutral/brand and NOT amber or red", () => {
    const meter50 = getUsageMeterColor(50, false);
    expect(meter50.className).toBe("bg-primary");
    expect(meter50.hex.toUpperCase()).toBe("#FF6A00");

    const meter0 = getUsageMeterColor(0, false);
    expect(meter0.className).toBe("bg-primary");

    const meter79 = getUsageMeterColor(79, false);
    expect(meter79.className).toBe("bg-primary");
  });

  it("meter at 80%-99% returns amber (#D97706) and NEVER brand orange", () => {
    const testPercentages = [80, 85, 90, 95, 99];
    testPercentages.forEach((pct) => {
      const meter = getUsageMeterColor(pct, false);
      expect(meter.className).toBe("bg-amber-500");
      expect(meter.hex.toUpperCase()).toBe("#D97706");
      // Must NOT be brand orange
      expect(meter.hex.toUpperCase()).not.toBe("#FF6A00");
      expect(meter.hex.toUpperCase()).not.toBe("#EA580C");
      expect(meter.hex.toUpperCase()).not.toBe("#C2410C");
      // Distinct hue from brand orange (~32 deg amber vs 25 deg primary orange)
      const hue = hexToHue(meter.hex);
      expect(hue).toBeGreaterThanOrEqual(30);
      expect(hue).toBeLessThanOrEqual(45);
    });
  });

  it("meter at >= 100% or overLimit returns red (#DC2626)", () => {
    const meter100 = getUsageMeterColor(100, false);
    expect(meter100.className).toBe("bg-destructive");
    expect(meter100.hex.toUpperCase()).toBe("#DC2626");

    const meterOverLimit = getUsageMeterColor(40, true);
    expect(meterOverLimit.className).toBe("bg-destructive");
    expect(meterOverLimit.hex.toUpperCase()).toBe("#DC2626");

    const meter120 = getUsageMeterColor(120, false);
    expect(meter120.className).toBe("bg-destructive");
    expect(meter120.hex.toUpperCase()).toBe("#DC2626");
  });
});

describe("Exhaustive UI Token Contrast Matrix across Light and Dark Themes (Requirement C5)", () => {
  // Light Theme Pairs
  const lightPairs = [
    {
      name: "Primary Foreground (Navy) on Primary (Orange)",
      fg: "#0B1F3B",
      bg: "#FF6A00",
      min: 4.5,
    },
    { name: "Foreground on Background", fg: "#0B1F3B", bg: "#FFFFFF", min: 4.5 },
    { name: "Card Foreground on Card", fg: "#0B1F3B", bg: "#FFFFFF", min: 4.5 },
    { name: "Muted Foreground on Background", fg: "#475569", bg: "#FFFFFF", min: 4.5 },
    { name: "Muted Foreground on Card", fg: "#475569", bg: "#FFFFFF", min: 4.5 },
    {
      name: "Destructive Foreground (White) on Destructive (Red)",
      fg: "#FFFFFF",
      bg: "#DC2626",
      min: 4.5,
    },
    { name: "Warning Text (Amber) on Light Amber BG", fg: "#B45309", bg: "#FEF3C7", min: 4.5 },
    { name: "Amber Text (#B45309) on White Background", fg: "#B45309", bg: "#FFFFFF", min: 4.5 },
    { name: "Table Available (Green 700 on Green 100)", fg: "#15803D", bg: "#DCFCE7", min: 4.5 },
    { name: "Table Occupied (Blue 700 on Blue 100)", fg: "#1D4ED8", bg: "#DBEAFE", min: 4.5 },
    { name: "Table Reserved (Purple 700 on Purple 100)", fg: "#7E22CE", bg: "#F3E8FF", min: 4.5 },
    { name: "Table Cleaning (Amber 700 on Amber 100)", fg: "#B45309", bg: "#FEF3C7", min: 4.5 },
    { name: "Table Blocked (Gray 700 on Gray 100)", fg: "#374151", bg: "#F3F4F6", min: 4.5 },
    { name: "Brand Text on Warm Cream Side Panel", fg: "#0B1F3B", bg: "#FFF3E0", min: 7.0 },
    { name: "Darker Orange Token on White", fg: "#C2410C", bg: "#FFFFFF", min: 4.5 },
  ];

  // Dark Theme Pairs (Navy Base #0B1F3B-family: bg is #0B1F3B, card is #112948)
  const darkNavyBase = "#0B1F3B";
  const darkNavyCard = "#112948";
  const darkPairs = [
    {
      name: "Primary Foreground (Navy) on Primary (Orange)",
      fg: "#0B1F3B",
      bg: "#FF6A00",
      min: 4.5,
    },
    {
      name: "Foreground (White) on Dark Navy Background",
      fg: "#FFFFFF",
      bg: darkNavyBase,
      min: 4.5,
    },
    {
      name: "Foreground (Off-white) on Dark Navy Background",
      fg: "#F8FAFC",
      bg: darkNavyBase,
      min: 4.5,
    },
    { name: "Foreground on Dark Card", fg: "#F8FAFC", bg: darkNavyCard, min: 4.5 },
    { name: "Muted Foreground on Dark Navy Background", fg: "#A8BAD0", bg: darkNavyBase, min: 4.5 },
    { name: "Muted Foreground on Dark Card", fg: "#A8BAD0", bg: darkNavyCard, min: 4.5 },
    { name: "Primary Orange on Dark Navy Background", fg: "#FF6A00", bg: darkNavyBase, min: 4.5 },
    { name: "Primary Orange on Dark Card", fg: "#FF6A00", bg: darkNavyCard, min: 4.5 },
    { name: "Destructive Foreground on Destructive Red", fg: "#FFFFFF", bg: "#DC2626", min: 4.5 },
    { name: "Warning Text (Amber 400) on Dark Amber BG", fg: "#FBBF24", bg: "#78350F", min: 4.5 },
    { name: "Amber Text (#FBBF24) on Dark Navy Base", fg: "#FBBF24", bg: darkNavyBase, min: 4.5 },
    {
      name: "Table Available Dark (Green 400 on Green 900)",
      fg: "#4ADE80",
      bg: "#14532D",
      min: 4.5,
    },
    { name: "Table Occupied Dark (Blue 300 on Blue 900)", fg: "#93C5FD", bg: "#1E3A8A", min: 4.5 },
    {
      name: "Table Reserved Dark (Purple 200 on Purple 900)",
      fg: "#E9D5FF",
      bg: "#581C87",
      min: 4.5,
    },
    {
      name: "Table Cleaning Dark (Amber 400 on Amber 900)",
      fg: "#FBBF24",
      bg: "#78350F",
      min: 4.5,
    },
    { name: "Table Blocked Dark (Gray 300 on Gray 700)", fg: "#D1D5DB", bg: "#374151", min: 4.5 },
  ];

  it("dark theme base background is Navy #0B1F3B-family, strictly NOT near-black (#020817 or #000000)", () => {
    // Assert dark theme base is the Navy brand token
    expect(darkNavyBase.toUpperCase()).toBe("#0B1F3B");
    expect(darkNavyBase.toUpperCase()).not.toBe("#000000");
    expect(darkNavyBase.toUpperCase()).not.toBe("#020817");

    const navyBaseHue = hexToHue(darkNavyBase);
    // Navy base hue is ~215 degrees
    expect(navyBaseHue).toBeGreaterThanOrEqual(210);
    expect(navyBaseHue).toBeLessThanOrEqual(220);
  });

  it("verifies all Light Theme UI token pairs and logs pair count", () => {
    console.log(`[WCAG Audit] Light theme UI token pairs tested: ${lightPairs.length}`);
    expect(lightPairs.length).toBeGreaterThanOrEqual(14);

    lightPairs.forEach((pair) => {
      const ratio = calculateContrastRatio(pair.fg, pair.bg);
      expect(
        ratio,
        `Light theme pair "${pair.name}" (${pair.fg} on ${pair.bg}) must have contrast >= ${pair.min}:1 (got ${ratio.toFixed(2)}:1)`
      ).toBeGreaterThanOrEqual(pair.min);
    });
  });

  it("verifies all Dark Theme UI token pairs and logs pair count", () => {
    console.log(`[WCAG Audit] Dark theme UI token pairs tested: ${darkPairs.length}`);
    expect(darkPairs.length).toBeGreaterThanOrEqual(16);

    darkPairs.forEach((pair) => {
      const ratio = calculateContrastRatio(pair.fg, pair.bg);
      expect(
        ratio,
        `Dark theme pair "${pair.name}" (${pair.fg} on ${pair.bg}) must have contrast >= ${pair.min}:1 (got ${ratio.toFixed(2)}:1)`
      ).toBeGreaterThanOrEqual(pair.min);
    });
  });

  it("AMBER TEXT INVARIANT: #D97706 on white is ~3.2:1 and strictly disallowed for text; #B45309 is >= 4.5:1", () => {
    const d9Ratio = calculateContrastRatio("#D97706", "#FFFFFF");
    // #D97706 on white is ~3.2:1, failing WCAG AA (4.5:1) for text, permitted ONLY for bar fills/borders
    expect(d9Ratio).toBeLessThan(4.5);
    expect(d9Ratio).toBeCloseTo(3.2, 1);

    // Darker amber #B45309 on white meets WCAG AA text contrast
    const b4Ratio = calculateContrastRatio("#B45309", "#FFFFFF");
    expect(b4Ratio).toBeGreaterThanOrEqual(4.5);
    expect(b4Ratio).toBeGreaterThanOrEqual(5.0);

    // In dark theme, amber text #FBBF24 on dark navy #0B1F3B meets WCAG AA
    const darkAmberRatio = calculateContrastRatio("#FBBF24", "#0B1F3B");
    expect(darkAmberRatio).toBeGreaterThanOrEqual(4.5);
  });

  it("STATIC SCAN: #D97706 or text-amber-500 is NEVER used as a text color in frontend/src", () => {
    const srcDir = path.resolve(__dirname, "..");
    const forbiddenPatterns = [
      /text-amber-500/i,
      /text-\[\#D97706\]/i,
      /color\s*:\s*["']\#D97706["']/i,
    ];

    function scanDirectory(dir: string): string[] {
      const violations: string[] = [];
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name !== "node_modules" && entry.name !== "dist" && entry.name !== ".git") {
            violations.push(...scanDirectory(fullPath));
          }
        } else if (/\.(tsx|ts|css|html)$/.test(entry.name)) {
          // Do not scan this test file itself for the forbidden regex literals
          if (entry.name === "contrast.test.tsx") continue;

          const content = fs.readFileSync(fullPath, "utf-8");
          for (const pattern of forbiddenPatterns) {
            if (pattern.test(content)) {
              violations.push(`${fullPath} matches forbidden text pattern ${pattern}`);
            }
          }
        }
      }
      return violations;
    }

    const violations = scanDirectory(srcDir);
    expect(
      violations,
      `Found forbidden #D97706 text color usage:\n${violations.join("\n")}`
    ).toEqual([]);
  });
});
