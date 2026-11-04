import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle2, XCircle } from "lucide-react";
import { BrandLogo } from "../../components/brand/BrandLogo";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Card } from "../../components/ui/card";

// Relative luminance formula per WCAG 2.1
function getLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

export function calculateContrastRatio(hex1: string, hex2: string): number {
  const parseHex = (hex: string) => {
    hex = hex.replace("#", "");
    if (hex.length === 3) {
      hex = hex
        .split("")
        .map((c) => c + c)
        .join("");
    }
    const num = parseInt(hex, 16);
    return [num >> 16, (num >> 8) & 255, num & 255];
  };

  const [r1, g1, b1] = parseHex(hex1);
  const [r2, g2, b2] = parseHex(hex2);

  const l1 = getLuminance(r1, g1, b1);
  const l2 = getLuminance(r2, g2, b2);

  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);

  return parseFloat(((lighter + 0.05) / (darker + 0.05)).toFixed(2));
}

export const DevBrandPage: React.FC = () => {
  const navigate = useNavigate();

  // Token definitions with computed contrast ratios
  const contrastPairs = [
    {
      name: "Primary Button (Navy on Orange)",
      foreground: "#0B1F3B",
      background: "#FF6A00",
      usage: "Primary CTA buttons, active state highlights",
      requirement: "WCAG AAA (>= 4.5:1 for normal text)",
      forbidden: false,
    },
    {
      name: "FORBIDDEN Anti-Pattern (White on Orange)",
      foreground: "#FFFFFF",
      background: "#FF6A00",
      usage: "STRICTLY FORBIDDEN: Fails accessibility requirements",
      requirement: "Fails WCAG AA (requires 4.5:1, gets 3.0:1)",
      forbidden: true,
    },
    {
      name: "Darker Orange Token (on White)",
      foreground: "#C2410C",
      background: "#FFFFFF",
      usage: "Accent links, secondary tags, warning borders",
      requirement: "WCAG AA (>= 4.5:1)",
      forbidden: false,
    },
    {
      name: "Danger Red Token (on White)",
      foreground: "#DC2626",
      background: "#FFFFFF",
      usage: "Destructive actions, error badges",
      requirement: "WCAG AA (>= 4.5:1)",
      forbidden: false,
    },
    {
      name: "Deep Navy (on Warm Cream)",
      foreground: "#0B1F3B",
      background: "#FFF3E0",
      usage: "Login left brand panel, card highlights",
      requirement: "WCAG AAA (>= 7.0:1)",
      forbidden: false,
    },
    {
      name: "Table Status: AVAILABLE",
      foreground: "#15803D",
      background: "#DCFCE7",
      usage: "Available dining tables and counters",
      requirement: "WCAG AA (>= 4.5:1)",
      forbidden: false,
    },
    {
      name: "Table Status: OCCUPIED",
      foreground: "#1D4ED8",
      background: "#DBEAFE",
      usage: "Occupied seated tables with open sessions",
      requirement: "WCAG AA (>= 4.5:1)",
      forbidden: false,
    },
    {
      name: "Table Status: RESERVED",
      foreground: "#7E22CE",
      background: "#F3E8FF",
      usage: "Reserved tables awaiting guest arrival",
      requirement: "WCAG AA (>= 4.5:1)",
      forbidden: false,
    },
    {
      name: "Table Status: CLEANING",
      foreground: "#B45309",
      background: "#FEF3C7",
      usage: "Dirty tables being sanitized between parties",
      requirement: "WCAG AA (>= 4.5:1)",
      forbidden: false,
    },
    {
      name: "Table Status: BLOCKED",
      foreground: "#374151",
      background: "#F3F4F6",
      usage: "Maintenance, offline, or unavailable tables",
      requirement: "WCAG AAA (>= 7.0:1)",
      forbidden: false,
    },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground p-6 sm:p-12 font-sans">
      <div className="max-w-6xl mx-auto space-y-12">
        {/* Navigation & Header */}
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/dashboard")}
            className="mb-4 text-xs font-semibold"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Dashboard
          </Button>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-6">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight font-display text-[#0B1F3B] dark:text-white">
                ServeMyFood Brand & Token System
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Automated WCAG contrast compliance ratios, typographic hierarchy, and SVG logo
                variants.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => navigate("/dev/design-system")}>
                View Component Showcase
              </Button>
            </div>
          </div>
        </div>

        {/* Section 1: Logo Variants */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold font-display">1. Logo Variants & Clear Space</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="p-6 flex flex-col items-center justify-center space-y-4 bg-white border">
              <span className="text-xs font-semibold text-muted-foreground uppercase">
                Full Logo (Light Theme)
              </span>
              <BrandLogo variant="full" theme="light" size={40} />
              <div className="text-[11px] text-muted-foreground text-center">
                Wordmark: Navy (#0B1F3B) + Vibrant Orange (#FF6A00)
              </div>
            </Card>

            <Card className="p-6 flex flex-col items-center justify-center space-y-4 bg-[#0B1F3B] border border-slate-800 text-white">
              <span className="text-xs font-semibold text-gray-400 uppercase">
                Full Logo (Dark Theme)
              </span>
              <BrandLogo variant="full" theme="dark" size={40} />
              <div className="text-[11px] text-gray-400 text-center">
                Wordmark: White (#FFFFFF) + Vibrant Orange (#FF6A00)
              </div>
            </Card>

            <Card className="p-6 flex flex-col items-center justify-center space-y-4 bg-gray-100 border">
              <span className="text-xs font-semibold text-muted-foreground uppercase">
                Icon Only & Favicon
              </span>
              <div className="flex items-center gap-4">
                <BrandLogo variant="icon" theme="light" size={48} />
                <BrandLogo variant="icon" theme="light" size={32} />
                <BrandLogo variant="icon" theme="light" size={24} />
              </div>
              <div className="text-[11px] text-muted-foreground text-center">
                Geometric cloche glyph at 48px, 32px, 24px
              </div>
            </Card>
          </div>
        </section>

        {/* Section 2: Automated WCAG Contrast Verification */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold font-display">2. Automated WCAG Contrast Matrix</h2>
            <span className="text-xs text-muted-foreground">
              Thresholds: AA &gt;= 4.5:1 • AAA &gt;= 7.0:1
            </span>
          </div>

          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b">
                <tr>
                  <th className="p-4">Color Combination</th>
                  <th className="p-4">Visual Sample</th>
                  <th className="p-4">Computed Contrast</th>
                  <th className="p-4">Compliance Status</th>
                  <th className="p-4">Intended Usage</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {contrastPairs.map((pair, idx) => {
                  const ratio = calculateContrastRatio(pair.foreground, pair.background);
                  const passesAA = ratio >= 4.5;
                  const passesAAA = ratio >= 7.0;

                  return (
                    <tr
                      key={idx}
                      className={
                        pair.forbidden ? "bg-red-50/70 dark:bg-red-950/20" : "hover:bg-muted/50"
                      }
                    >
                      <td className="p-4 font-semibold text-foreground">
                        <div className="flex items-center gap-2">
                          {pair.forbidden ? (
                            <XCircle className="w-4 h-4 text-red-600 shrink-0" />
                          ) : (
                            <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                          )}
                          <span>{pair.name}</span>
                        </div>
                        <div className="text-xs text-muted-foreground font-mono mt-0.5">
                          {pair.foreground} on {pair.background}
                        </div>
                      </td>
                      <td className="p-4">
                        <div
                          className="inline-block px-3 py-1.5 rounded-md font-bold text-xs shadow-sm border"
                          style={{
                            color: pair.foreground,
                            backgroundColor: pair.background,
                            borderColor: pair.forbidden ? "#DC2626" : "transparent",
                          }}
                        >
                          Sample Text 123
                        </div>
                      </td>
                      <td className="p-4 font-mono font-bold text-base">
                        <span
                          className={
                            pair.forbidden ? "text-red-600" : "text-green-600 dark:text-green-400"
                          }
                        >
                          {ratio}:1
                        </span>
                      </td>
                      <td className="p-4">
                        {pair.forbidden ? (
                          <Badge variant="destructive" className="font-bold">
                            FORBIDDEN (FAIL)
                          </Badge>
                        ) : passesAAA ? (
                          <Badge variant="available" className="font-bold">
                            WCAG AAA PASS
                          </Badge>
                        ) : passesAA ? (
                          <Badge variant="available" className="font-bold">
                            WCAG AA PASS
                          </Badge>
                        ) : (
                          <Badge variant="destructive">FAIL</Badge>
                        )}
                      </td>
                      <td className="p-4 text-xs text-muted-foreground max-w-xs">{pair.usage}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 3: Typographic Hierarchy */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold font-display">
            3. Typography Scale & Multilingual Support
          </h2>
          <Card className="p-6 space-y-6">
            <div className="space-y-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase">
                Display Font: Poppins (Semi-Bold 600, Bold 700)
              </span>
              <div className="space-y-2">
                <h1 className="text-4xl font-bold font-display text-[#0B1F3B] dark:text-white">
                  H1. One Platform. Every Food Business. (36px)
                </h1>
                <h2 className="text-2xl font-bold font-display text-[#0B1F3B] dark:text-white">
                  H2. Real-Time Table & Kitchen Operations (24px)
                </h2>
                <h3 className="text-xl font-semibold font-display text-[#0B1F3B] dark:text-white">
                  H3. Granular Multi-Tenant Access Controls (20px)
                </h3>
              </div>
            </div>

            <div className="space-y-2 pt-4 border-t">
              <span className="text-xs font-semibold text-muted-foreground uppercase">
                Body & Numeric Font: Inter (Regular 400, Medium 500, Semi-Bold 600)
              </span>
              <p className="text-base text-foreground font-sans">
                ServeMyFood handles high-throughput hospitality transactions with sub-millisecond
                response latency and strict row-level tenant boundary isolation.
              </p>
              <div className="text-sm font-mono bg-muted p-3 rounded font-semibold">
                Tabular Numerals: ₹4,999.00 • 1,280 Orders • Table T12 • Token #042
              </div>
            </div>

            <div className="space-y-2 pt-4 border-t">
              <span className="text-xs font-semibold text-muted-foreground uppercase">
                Tamil Script Fallback: Noto Sans Tamil (Regular 400, Semi-Bold 600)
              </span>
              <div className="p-4 rounded-lg bg-orange-50/60 dark:bg-slate-900 border border-orange-200 dark:border-navy-800 space-y-2">
                <div
                  data-testid="tamil-heading"
                  className="text-2xl font-bold text-[#0B1F3B] dark:text-white font-display"
                >
                  ஒரே தளம். அனைத்து உணவு வணிகங்களுக்கும்.
                </div>
                <div
                  data-testid="tamil-body"
                  className="text-sm text-gray-700 dark:text-gray-300 font-sans"
                >
                  மேஜைகள், தள வரைபடம், சமையலறை ஆர்டர்கள் மற்றும் பணியாளர் மேலாண்மை ஆகியவற்றை ஒரே
                  தளத்தில் திறம்பட கையாளுங்கள்.
                </div>
                <div className="flex gap-2 pt-2">
                  <Badge variant="available">கிடைக்கக்கூடியது (AVAILABLE)</Badge>
                  <Badge variant="occupied">நிரம்பியது (OCCUPIED)</Badge>
                  <Badge variant="reserved">முன்பதிவு (RESERVED)</Badge>
                </div>
              </div>
            </div>
          </Card>
        </section>
      </div>
    </div>
  );
};
