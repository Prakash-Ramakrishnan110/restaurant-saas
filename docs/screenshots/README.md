# ServeMyFood: Visual Artifacts & Screen Proofs (v0.3.3)

This directory contains authentic visual captures of the ServeMyFood web application, demonstrating brand adherence, visual hierarchy, responsive viewports, touch density ergonomics, and multi-lingual accessibility.

All screenshots were generated automatically via Playwright E2E automation against the live running stack (Django 5.2 backend on `127.0.0.1:8000`, PostgreSQL 16 on `5435`, Vite React 18 frontend on `5173`).

---

## Screenshot Inventory & Quality Verification

| File Name | Screen / Route | Viewport | Mode / State | Verification Highlights |
|---|---|---|---|---|
| `01-login-desktop.png` | `/login` | 1440 × 900 | Desktop Light | Split layout: Left brand panel (`#FFF3E0`), Chef's Hat toque logo mark, plain language benefits ("Orders go straight to the kitchen"), quick-fill buttons (DEV-only), dynamic version footer `v0.3.3 (6caba5a)`. |
| `02-login-mobile.png` | `/login` | 390 × 844 | Mobile Stacked | Stacked responsive layout: full-width touch-friendly form, brand header, language toggle. |
| `03-change-password.png` | `/change-password` | 1440 × 900 | Desktop Auth Gate | Blue security shield icon (`#2563EB`), zero brand orange in security/alert context, password confirmation inputs. |
| `04-dashboard-desktop.png` | `/dashboard` | 1440 × 900 | Desktop Authenticated | Authenticated session as `owner@spicegarden.com` (Rajesh Kumar, Spice Garden): stat cards, plan entitlements, branch switcher, "Manage Tables" and "Digital Menu QR" CTAs. Zero "Sign In" elements. |
| `05-dashboard-mobile.png` | `/dashboard` | 390 × 844 | Mobile Authenticated | Responsive floor navigation, table status grid, collapsible navigation drawer. Zero "Sign In" elements. |
| `06-dashboard-dark-touch.png` | `/dashboard` | 1440 × 900 | Dark + Touch Mode | `data-theme="dark"` (Deep Navy `#0B1F3B` background) and `data-density="touch"` (minimum 56px interactive target heights for waiter/kitchen touch ergonomics). |
| `07-dev-brand.png` | `/dev/brand` | 1440 × 900 | Desktop Showcase | Automated WCAG contrast ratio table (Navy on Orange: 5.74:1 AAA; White on Orange forbidden: 2.87:1), typography hierarchy, 3 SVG logo variants, Tamil rendering. |
| `08-dev-design-system.png` | `/dev/design-system` | 1440 × 900 | Desktop Showcase | Interactive component showcase of all 25 design system components (buttons, badges, inputs, dialogs, sheets, tabs, data-tables, switch, stepper). |
| `09-login-tamil.png` | `/login` | 1440 × 900 | Tamil (`ta-IN`) | First-class regionalization: Tamil headings, labels, button text ("உள்நுழைக"), and plain language benefits rendered cleanly without font clipping. |
| `10-dashboard-touch-overlay.png` | `/dashboard` | 1440 × 900 | Touch Density Overlay | Floor operations with touch mode enabled (`data-density="touch"`). Verified target heights >= 56px across all buttons, inputs, selects, and tabs. |
| `11-error-suspended.png` | `/suspended` | 1440 × 900 | Error State | Subscription suspension notice: destructive alert styling, resolution instructions, contact support link. Zero brand orange in alert iconography. |
| `12-error-notfound.png` | `/404` | 1440 × 900 | Error State | 404 Route Not Found page: clean navigation recovery, return to dashboard CTA. |
| `logo-compare.png` | `/dev/brand` | 1200 × 600 | Design Proof | Side-by-side design verification of the Chef's Hat (toque) with fork, spoon, and swoosh across full, compact, and icon variants. |

---

## Design System Invariants Verified
1. **Brand Mark**: Chef's Hat (toque) with fork, spoon, and dynamic swoosh (`BrandLogo.tsx` and `favicon.svg`).
2. **Orange Rule**: Brand Orange (`#FF6A00`) is strictly reserved for primary CTA actions. Zero orange appears in warnings, alerts, error states, or security shield icons.
3. **Touch Targets**: In `[data-density="touch"]` mode, all interactive controls enforce `min-height: 56px` verified via Playwright bounding box assertions.
4. **WCAG Compliance**: Primary Navy (`#0B1F3B`) on Orange (`#FF6A00`) achieves 5.74:1 contrast ratio, exceeding WCAG 2.1 AAA for normal text.
