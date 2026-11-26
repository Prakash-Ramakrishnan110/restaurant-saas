# Stage 4 — Visual & Accessibility Review Round 1 (`stage4-round1`)

Reviewed `1440x900` and `390x844` full-page captures (`home`, `home-ta`, `hardware`, `hardware-ta`, `tea-shops`, `tea-shops-ta`) plus automated axe + responsive width checks (`320`, `360`, `390`, `768`, `1440`).

## 16 Defects Identified & Fixed in Round 1 -> Round 2

1. **R1-01 — Mobile sticky header overlap after scroll reset (`home-390.png`, `hardware-390.png`)**: Added `scroll-padding-top: 88px` in `index.css` and settled scroll state at `scrollY = 0` before full-page capture so the sticky header never masks the top of `<h1>`.
2. **R1-02 — WCAG 2.5.3 `label-content-name-mismatch` (serious) on header language switch (`Layout.tsx`)**: Updated `aria-label` to begin with the exact visible text (`EN — Switch to English` / `தமிழ் — Switch to Tamil`).
3. **R1-03 — WCAG 2.5.3 `label-content-name-mismatch` (serious) on Tamil hero Pause/Play button (`HomePage.tsx`)**: Included visible Tamil button text in `aria-label` while preserving English animation label matching.
4. **R1-04 — WCAG 1.4.3 `color-contrast` (serious) on active `"Hardware"` nav item (`Layout.tsx`)**: Removed low-contrast `text-[#FF6A00]` on white (`2.88:1`); replaced with `#0B1F3B` navy text and `#FF6A00` 2px underline (`>= 15:1` contrast, obeying the orange-buttons-only rule).
5. **R1-05 — WCAG 1.4.3 `color-contrast` (serious) on Coming Soon cards (`ComparisonSection.tsx`)**: Removed `opacity-80` and translucent navy text on cream; switched to neutral `bg-slate-50` with `#0B1F3B` / `text-slate-700` (`>= 7:1` contrast).
6. **R1-06 — Borderline contrast on mobile comparison sub-labels (`ComparisonSection.tsx`)**: Darkened `11px` uppercase mobile card labels from `text-[#0B1F3B]/65` to `text-[#0B1F3B]/85`.
7. **R1-07 — `heading-order` (`h1` -> `h3` skip) on `/hardware/` and `/ta/hardware/` (`HardwareSection.tsx`)**: Rendered device card titles as `<h2>` when `isFullPage` is true (and `<h3>` when nested under `<h2>` on Home).
8. **R1-08 — Tea Shop `VideoSection` poster & caption mismatch (`VideoSection.tsx`)**: Updated counter variant subtitle and poster layout so `/tea-shops/` describes counter token workflow rather than waiter table workflow.
9. **R1-09 — Waiter dining-room transcript shown on Tea Shop page (`VideoSection.tsx`)**: Added dedicated counter-only transcript steps (zero `"table"` / `"மேஜை"` wording) when `variant === "counter"`.
10. **R1-10 — `demo-poster.svg` center headline collided with centered Play button (`demo-poster.svg`)**: Repositioned SVG poster headline/subtitle to the upper third (`y=150..195`) so the centered Play button sits in open navy space.
11. **R1-11 — Unequal card heights and top-edge misalignment in Tea Shop Token TV showcase (`VenuePage.tsx`)**: Added a matching dark browser/monitor top bar (`Clip H · Kitchen → Token TV`) on the right video frame to align symmetrically with `DeviceFrame` on desktop.
12. **R1-12 — Flat white header on `/hardware/` lacked visual separation (`HardwareSection.tsx`, `HardwarePage.tsx`)**: Added a warm `#FFF3E0` hero header band on `/hardware/` matching the venue pages, followed by white device cards.
13. **R1-13 — Orphan half-width 5th step button (`5. Sales`) on mobile 2-column grid (`HomePage.tsx`)**: Made the 5th step tab `col-span-2 sm:col-span-1` on mobile so the tab grid forms a clean symmetric block at `390px`.
14. **R1-14 — Inconsistent mobile CTA widths in Hardware section (`HardwareSection.tsx`)**: Standardized `"See hardware guide"` and `"Ask during your demo"` to full-width (`w-full sm:w-auto`) on narrow mobile viewports.
15. **R1-15 — Link hover states used orange text (`Layout.tsx`)**: Replaced `hover:text-[#FF6A00]` text coloring with navy text + orange underline accent so orange is reserved strictly for brand mark and primary buttons with navy text.
16. **R1-16 — `/ta/privacy/` and `/ta/terms/` lacked Tamil header context (`LegalPage.tsx`)**: Added a bilingual Tamil summary header block on Tamil legal routes (`lang === "ta"`).
