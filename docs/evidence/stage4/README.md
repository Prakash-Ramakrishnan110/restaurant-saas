# Stage 4 Evidence — Landing Page Additions

- **Target Tag:** `v1.8.1-landing-hardware`
- **Owner Design Direction:** Minimal single-page landing layout preserving the `#0B1F3B` Hero section, paired with clean custom SVG illustrations, plain-language English & Tamil copy, and zero visual clutter.

## What Was Delivered

1. **Minimal Landing Page Redesign (`marketing/src/pages/HomePage.tsx`, `MinimalIllustrations.tsx`)**
   - Preserved the exact Hero section (`#0B1F3B` navy, video/poster, Pause button).
   - Replaced heavy interactive tabs/mockups with a clean 4-step illustrated flow (`1. Take orders`, `2. Kitchen alert`, `3. Token TV & serve`, `4. Pay & daily sales`), 3 illustrated shop format cards (`Tea shop & bakery`, `Cafe & restaurant`, `Hotel restaurant`), compact comparison table, hardware overview, 4-question FAQ, and Book a demo form.
2. **Hardware Registry & Page (`marketing/content/hardware.ts`, `validate_hardware.mjs`, `HardwareSection.tsx`, `HardwarePage.tsx`, `/hardware/`, `/ta/hardware/`)**
   - Starter kits remain `DRAFT` (`ownerApproved: false`) until real kit photos are added; build validation fails if any `READY` kit lacks `ownerApproved: true`, a local photo in `marketing/assets/photos/hardware/`, or bilingual contents.
   - Tested devices table (`data-testid="tested-devices-table"`) is omitted while `docs/help/printers-tested.md` has 0 data rows.
3. **Comparison Table (`marketing/src/components/ComparisonSection.tsx`, `marketing/content/claims.ts`)**
   - `"Paper slips and WhatsApp versus ServeMyFood"` lists only `LIVE` features in `claims.ts` with zero competitor names or `"better than"` phrasing, followed by a muted `Coming soon` strip.
4. **Tea Shop Token TV + Clip H (`marketing/src/pages/VenuePage.tsx`, `scripts/marketing/record_film.mjs`)**
   - `/tea-shops/` and `/ta/tea-shops/` feature `/shots/token-tv-live.webp` and Clip H (`/video/token-tv-clip-h.mp4`, `.webm`, `token-tv-poster.webp`) with zero `"table"` / `"மேஜை"` / `"மேசை"` occurrences enforced by `check_static.mjs`.

## Verification Gates (`scripts/marketing/verify.ps1`)

- Gate 1: Marketing TypeScript Typecheck — **PASS**
- Gate 2: Prerender Build (17 pages + sitemap + robots, 76.41 KB gzipped initial JS) — **PASS**
- Gate 3: Static HTML, Forbidden Claims, Tea-Shop Zero-Table & JS Budget — **PASS**
- Gate 4: Playwright A11y, Responsive, Animation, Form & 3rd-Party Checks — **PASS**
- Gate 5: Lighthouse Mobile Audit (`/`): Performance `90`, Accessibility `100`, SEO `100` — **PASS**

## Screenshots

- `home-1440.png`, `home-390.png`, `home-ta-1440.png`
- `hardware-1440.png`, `hardware-390.png`
- `tea-shops-1440.png`, `tea-shops-390.png`, `tea-shops-ta-1440.png`
