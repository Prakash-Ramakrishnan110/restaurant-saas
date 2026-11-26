# Stage 4 — Visual & Accessibility Review Round 3 (`stage4-round3`)

Reviewed `1440x900` and `390x844` full-page captures (`home`, `home-ta`, `hardware`, `hardware-ta`, `tea-shops`, `tea-shops-ta`) and SSR/console output.

## 15 Final Polish Refinements Applied in Round 3

1. **R3-01 — React 18 SSR `fetchPriority` console warning (`DeviceFrame.tsx`)**: Removed non-standard React 18 `fetchPriority` prop while keeping explicit `width`/`height` and `loading="eager"`.
2. **R3-02 — Clip H play button overlapped `#76` / `#77` token tiles on `390px` mobile (`VenuePage.tsx`, `tea-shops-390.png`)**: Positioned `"Watch kitchen-to-TV clip"` compactly at bottom-right (`items-end justify-end p-2.5 sm:p-3`) so `#76` and `#77` remain unobstructed.
3. **R3-03 — Poster helper text (`"Press Play above"`) mismatched bottom Play CTA (`demo-poster.svg`, `tea-shops-1440.png`)**: Updated poster SVG subtext to `"Tap Play below to load video (zero auto-download)"`.
4. **R3-04 — Uneven badge wrapping in `comparison-coming-soon` 3-column grid (`ComparisonSection.tsx`, `home-1440.png`)**: Added `shrink-0` to the `"Coming soon"` pill and aligned card header rows consistently.
5. **R3-05 — Visual whitespace at bottom of right `"Coming soon"` card (`HomePage.tsx`, `home-1440.png`)**: Added a balanced footer note (`"Only live, tested features are listed as active."`) with `flex flex-col justify-between`.
6. **R3-06 — Non-button orange decorative icons in `StepScreenPreview` (`LiveAppPreview.tsx`)**: Changed `Smartphone`, `Flame`, and `Receipt` icons from `text-[#FF6A00]` to `text-[#0B1F3B]`.
7. **R3-07 — Non-button orange border on selected Cash tile (`LiveAppPreview.tsx`)**: Changed `border-[#FF6A00]` to `border-[#0B1F3B]` so orange is reserved strictly for brand mark and primary CTA buttons.
8. **R3-08 — Screen-reader number announcement on 3-step hardware badges (`HardwarePage.tsx`)**: Marked numeric step circles `1`/`2`/`3` as `aria-hidden="true"`.
9. **R3-09 — Missing `data-testid` on pending hardware kits notice (`HardwareSection.tsx`)**: Added `data-testid="hardware-kits-pending"` for deterministic verification.
10. **R3-10 — Explicit brand home link `aria-label` (`Layout.tsx`)**: Added `aria-label="ServeMyFood Home"` on header and footer brand logo links.
11. **R3-11 — English footer address on `/ta/` routes (`Layout.tsx`)**: Localized Dharmapuri address to `"தருமபுரி, தமிழ்நாடு, இந்தியா"` when `lang === "ta"`.
12. **R3-12 — Missing `<caption>` on desktop comparison `<table>` (`ComparisonSection.tsx`)**: Added `<caption className="sr-only">` for assistive technology users.
13. **R3-13 — Missing `<caption>` on tested devices `<table>` (`HardwareSection.tsx`)**: Added `<caption className="sr-only">` for assistive technology users.
14. **R3-14 — Missing `<meta name="theme-color">` in prerendered HTML (`prerender.mjs`)**: Added `<meta name="theme-color" content="#0B1F3B" />` across all 17 prerendered pages.
15. **R3-15 — Bilingual Tamil Stage 4 E2E coverage (`marketing.spec.ts`)**: Added `/ta/` comparison heading assertion and `/ta/tea-shops/` zero-`table`/`மேஜை`/`மேசை` check to Playwright suite.
