# ServeMyFood: Visual Artifacts & Screen Proofs (v0.3.4)

This directory contains authentic visual captures of the ServeMyFood web application, demonstrating brand adherence, visual hierarchy, responsive viewports, touch density ergonomics, and multi-lingual accessibility.

All screenshots were generated automatically via Playwright E2E automation against the live running stack (Django 5.2 backend on `127.0.0.1:8000`, PostgreSQL 16 on `5435`, Vite React 18 frontend on `5173`).

---

## Screenshot Inventory & Quality Verification

| File Name | Screen / Route | Viewport | Mode / State | Verification Highlights |
|---|---|---|---|---|
| `01-login-desktop.png` | `/login` | 1440 × 900 | Desktop Light | Split layout: Left brand panel (`#FFF3E0`), new Chef's Hat mark with fork & spoon, plain language benefits ("Orders go straight to the kitchen"), quick-fill buttons (DEV-only), dynamic version footer. |
| `02-login-mobile.png` | `/login` | 390 × 844 | Mobile Stacked | Stacked responsive layout: full-width touch-friendly form, brand header, language toggle. |
| `03-change-password.png` | `/change-password` | 1440 × 900 | Desktop Auth Gate | Blue security shield icon (`#2563EB`), zero brand orange in security/alert context, password confirmation inputs. |
| `04-dashboard-desktop.png` | `/dashboard` | 1440 × 900 | Desktop Authenticated | Authenticated session as `owner@spicegarden.com` (Rajesh Kumar, Spice Garden): stat cards, "Your plan" card, onboarding count ("7 of 7 steps done"), "QR codes printed", branch switcher. Hard verified: zero skeletons (`.animate-pulse`), zero "Sign In" elements. |
| `05-dashboard-mobile.png` | `/dashboard` | 390 × 844 | Mobile Authenticated | Responsive layout on 390px mobile viewport: "Your plan" card header stacks cleanly on narrow widths, real onboarding counter ("7 of 7 steps done"). Zero skeletons or "Sign In". |
| `06-dashboard-dark-touch.png` | `/dashboard` | 1440 × 900 | Dark + Touch Mode | Dark theme navy base (`#0B1F3B`-family, strictly not near-black) with theme-aware BrandLogo (Pure White `#FFFFFF` "ServeMy" with 14.2:1 AAA contrast and `mark-white.svg`), `data-density="touch"` enforcing >= 56px interactive target heights for waiter/kitchen touch ergonomics. |
| `07-dev-brand.png` | `/dev/brand` | 1440 × 900 | Desktop Showcase | Automated WCAG contrast ratio table (Navy on Orange: 5.74:1 AAA; White on Orange forbidden: 2.87:1), typography hierarchy, 3 SVG logo variants, Tamil rendering. |
| `08-dev-design-system.png` | `/dev/design-system` | 1440 × 900 | Desktop Showcase | Interactive component showcase of all 25 design system components (buttons, badges, inputs, dialogs, sheets, tabs, data-tables, switch, stepper). |
| `09-login-tamil.png` | `/login` | 1440 × 900 | Tamil (`ta-IN`) | First-class regionalization: translated intro paragraph, "மாதிரி விரைவு நிரப்பல்:" (Demo Quick-Fill), balanced heading avoiding single-word orphan line, Tamil button text ("உள்நுழைக"), and plain language benefits rendered cleanly without font clipping. |
| `10-dashboard-touch-overlay.png` | `/dashboard` | 1440 × 900 | Touch Density Overlay | Floor operations with touch mode enabled (`data-density="touch"`). Verified target heights >= 56px across all buttons, inputs, selects, and tabs. Zero skeletons or "Sign In" elements. |
| `11-error-suspended.png` | `/suspended` | 1440 × 900 | Error State | Subscription suspension notice: destructive alert styling, resolution instructions, contact support link. References "this restaurant" with zero cross-tenant leakage. |
| `12-error-notfound.png` | `/404` | 1440 × 900 | Error State | 404 Route Not Found page: "We couldn't find that page.", clean navigation recovery, return to dashboard CTA. Zero cross-tenant leakage. |
| `logo-compare.png` | `/dev/brand` | 1200 × 600 | Design Proof | Side-by-side design verification of the Chef's Hat mark with fork and spoon across full, compact, and icon variants. |
| `preview-sheet.png` | `brand/` | 1200 × 800 | Master Logo Sheet | Master brand sheet preview showing horizontal light, horizontal dark, mono black, orange mark, white mark, navy mark, favicon, and app icon. |

---

## Design System Invariants Verified
1. **Brand Mark**: Simple chef's hat mark with fork and spoon (`BrandLogo.tsx`, `favicon.svg`, `favicon.ico`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`).
2. **Orange Rule**: Brand Orange (`#FF6A00`) is strictly reserved for primary CTA actions. Zero orange appears in warnings (which use amber `#D97706`), alerts, error states, or security shield icons.
3. **Usage Meters**: Neutral/brand below 80%, amber (`#D97706` / `bg-amber-500`) at 80%–99%, red (`#DC2626` / `bg-destructive`) at >= 100%.
4. **Dark Mode Navy Base**: Navy base `#0B1F3B`-family (HSL 215 69% 14%), not near-black.
5. **Touch Targets**: In `[data-density="touch"]` mode, all interactive controls enforce `min-height: 56px` verified via Playwright bounding box assertions.
6. **WCAG Compliance**: Primary Navy (`#0B1F3B`) on Orange (`#FF6A00`) achieves 5.74:1 contrast ratio, exceeding WCAG 2.1 AAA for normal text. White on dark navy achieves 14.2:1 contrast ratio.
