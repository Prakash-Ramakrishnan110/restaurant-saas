# ServeMyFood: Visual Artifacts & Screen Proofs (v0.4.1)

This directory contains authentic visual captures of the ServeMyFood web application, demonstrating brand adherence, visual hierarchy, responsive viewports, touch density ergonomics, multi-lingual accessibility, and end-to-end onboarding workflows.

All screenshots were generated automatically via Playwright E2E automation against the running stack (Vite React 18 frontend on `5173`, Django REST backend on `8000`).

---

## 1. Core Visual Inventory & Quality Verification

| File Name | Screen / Route | Viewport | Mode / State | Verification Highlights |
|---|---|---|---|---|
| `01-login-desktop.png` | `/login` | 1440 × 900 | Desktop Light | Split layout: Left brand panel (`#FFF3E0`), chef's hat mark with fork & spoon, plain language benefits ("Orders go straight to the kitchen"), quick-fill buttons (DEV-only), dynamic version footer `v0.4.1 (e0387e9)`. |
| `02-login-mobile.png` | `/login` | 390 × 844 | Mobile Stacked | Stacked responsive layout: full-width touch-friendly form, brand header, language toggle. |
| `03-change-password.png` | `/change-password` | 1440 × 900 | Desktop Auth Gate | Blue security shield icon (`#2563EB`), zero brand orange in security/alert context, password confirmation inputs. |
| `04-dashboard-desktop.png` | `/dashboard` | 1440 × 900 | Desktop Authenticated | Grouped sidebar (`Daily work`, `Restaurant setup`, `Team`, `Settings`), renamed "Areas" and "Tables", "How much of your plan you have used", "Print QR codes" CTA, version footer. |
| `05-dashboard-mobile.png` | `/dashboard` | 390 × 844 | Mobile Authenticated | Responsive layout on 390px mobile viewport: "Your plan" card header stacks cleanly, bottom navigation bar with role-based links. |
| `06-dashboard-dark-touch.png` | `/dashboard` | 1440 × 900 | Dark + Touch Mode | Dark theme navy base (`#0B1F3B`-family, strictly not near-black), theme-aware BrandLogo with White `#FFFFFF` "ServeMy" text (15.9:1 contrast), touch density enforcing >= 56px interactive target heights. |
| `07-dev-brand.png` | `/dev/brand` | 1440 × 900 | Desktop Showcase | Automated WCAG contrast ratio table (Navy on Orange: 5.74:1 AAA; White on Orange forbidden: 2.87:1), typography hierarchy, 3 SVG logo variants. |
| `08-dev-design-system.png` | `/dev/design-system` | 1440 × 900 | Desktop Showcase | Interactive component showcase of all 25 design system components (buttons, badges, inputs, dialogs, sheets, tabs, data-tables, switch, stepper). |
| `09-login-tamil.png` | `/login` | 1440 × 900 | Tamil (`ta-IN`) | Regionalization: translated intro paragraph, demo quick-fill, balanced heading, Tamil button text ("உள்நுழைக"), plain language benefits. |
| `10-dashboard-touch-overlay.png` | `/dashboard` | 1440 × 900 | Touch Density Overlay | Floor operations with touch mode enabled (`data-density="touch"`). Verified target heights >= 56px across all buttons, inputs, selects, and tabs. |
| `11-error-suspended.png` | `/suspended` | 1440 × 900 | Error State | Subscription suspension notice: destructive alert styling, resolution instructions, contact support link. References "this restaurant" with zero cross-tenant leakage. |
| `12-error-notfound.png` | `/404` | 1440 × 900 | Error State | 404 Route Not Found page: "We couldn't find that page.", clean navigation recovery, return to dashboard CTA. Zero cross-tenant leakage. |
| `15-settings-branding.png` | `/settings/branding` | 1440 × 900 | Desktop Management | Branding settings: logo upload (PNG/JPEG <= 2MB, rejects SVG), hex color picker, live WCAG AA contrast calculation, customer QR card preview with dark QR and "Sample" badge. |
| `qr-codes-page.png` | `/qr` | 1440 × 900 | Desktop Management | QR codes management table: client-side high-contrast QR generation (EC level H), table standees, token rotation action, "Print QR Sheet" launcher. |
| `18-branches-desktop.png` | `/branches` | 1440 × 900 | Desktop Management | Branches management: outlet cards (Main Outlet, Express Kiosk), active status badge, plan limit usage, Add New Branch modal trigger. |
| `19-areas-sections-desktop.png` | `/venue/areas` | 1440 × 900 | Desktop Management | Service Areas tree view: Ground Floor Dining, First Floor Banquet, child sections (Family AC Hall, Garden Verandah, VIP Suite) with color swatches. |
| `20-tables-datatable-desktop.png` | `/venue/tables` | 1440 × 900 | Desktop Management | Dining Tables DataTable: natural sorting (T1, T2, T3, T4, T10), status badges, capacity, area filters, Bulk Create dialog trigger. |
| `21-floor-plan-desktop.png` | `/venue/floor` | 1440 × 900 | Desktop Management | Floor Plan map: read-only visual table map, status-coded table cards (Available, Occupied, Billing, Reserved), "Drag-and-drop editing comes later" banner. |
| `22-floor-plan-dark-touch.png` | `/venue/floor` | 1440 × 900 | Dark + Touch Mode | Floor Plan in Dark Mode + Touch Density (>= 56px touch targets, deep navy background `#0B1F3B`, high contrast status accents). |
| `23-counters-tokens-desktop.png` | `/venue/counters` | 1440 × 900 | Desktop Management | Quick Service / Tea Shop Counters & Tokens station: Now Serving #101 token card, active pickup counters list, ZERO occurrences of "table". |
| `24-counters-tokens-mobile.png` | `/venue/counters` | 412 × 915 | Mobile Stacked | Mobile view of Counters & Tokens station on Pixel 7 viewport with full responsive touch ergonomics and zero table references. |
| `25-staff-management-desktop.png` | `/staff` | 1440 × 900 | Desktop Management | Staff Management: team members table with role badges (Owner, Branch Manager, Cashier, Waiter), branch assignments, Reset Password, Add Member. |
| `26-settings-venue-desktop.png` | `/settings/venue` | 1440 × 900 | Desktop Management | Venue Settings: capability switches grouped into Dining & Floor Layout and Ordering & Workflow, plan upgrade locks, Reset to Venue Defaults. |
| `logo-preview-sheet.png` | `/dev/brand` | 1200 × 600 | Design Proof | Chef's Hat mark with fork and spoon across full, compact, and icon variants (renamed from `logo-compare.png`). |

---

## 2. Onboarding Wizard Screen Proofs (Cafe vs Tea Shop)

### Café Onboarding Workflow (7 Steps)
- `onboarding-cafe-step1.png`: Step 1 Business details with 7 hospitality presets (Tea shop, Bakery, Café default selected, Restaurant, Fine dining, Hotel, Food court).
- `onboarding-cafe-step2.png`: Step 2 Branch setup (Name, address, phone, day-by-day operating hours with "Apply to all days" helper).
- `onboarding-cafe-step3.png`: Step 3 Service style (Pre-configured table service workflow, customer-can-open QR policy, either pay timing).
- `onboarding-cafe-step4.png`: Step 4 Layout selection (Cozy Café template with 10 tables, capacity limits preview).
- `onboarding-cafe-step5.png`: Step 5 Table standee QR generation (Client-side rendering, download, and print preview triggers).
- `onboarding-cafe-step6.png`: Step 6 Team invitation (Manager/Cashier/Waiter/Kitchen role selector, temporary password display).
- `onboarding-cafe-step7.png`: Step 7 Setup completion celebration (All 6 checklist items checked, "Go to Dashboard" CTA).

### Tea Shop Onboarding Workflow (7 Steps - Zero Table Invariant)
- `onboarding-teashop-step1.png`: Step 1 Tea shop preset selected (Quick Service / Tea Shop profile, counter mode enabled).
- `onboarding-teashop-step2.png`: Step 2 Tea shop outlet details and operational hours.
- `onboarding-teashop-step3.png`: Step 3 Counter-token workflow (Sequential atomic token numbers, Pay-First timing).
- `onboarding-teashop-step4.png`: Step 4 Counter stations layout template (Zero occurrences of "table" or "மேஜை").
- `onboarding-teashop-step5.png`: Step 5 Counter QR codes (Order Counter 1 QR standee, zero table references).
- `onboarding-teashop-step6.png`: Step 6 Staff invitation (Cashier role invitation for takeaway service).
- `onboarding-teashop-step7.png`: Step 7 Completion screen configured for counter takeaway operations.

### Responsive Mobile Step 4
- `onboarding-step4-mobile.png`: Layout selection card rendered on 390px mobile viewport, clean stacking and touch targets >= 44px.

---

## 3. Printable QR Standee Sheets & Public Guest Landing Pages

### A4 Printable QR Standee Sheets
- `qr-print-sheet-6-en.png`: 6 large standees per A4 sheet in English, client-side QR canvas (EC level H, dark color `#0B1F3B`), scissors cut dashed guides, table badges, and brand top strip.
- `qr-print-sheet-12-en.png`: 12 compact tent cards per A4 sheet in English with high-density layout.
- `qr-print-sheet-6-ta.png`: 6 large standees per A4 sheet in Bilingual English + Tamil ("மெனுவைப் பார்க்க ஸ்கேன் செய்யவும்", "கோடுகளின் வழியே வெட்டவும்").
- `qr-print-sheet-12-ta.png`: 12 compact tent cards per A4 sheet in Bilingual English + Tamil.

### Public Customer Landing Pages (`/q/:token`)
- `public-qr-valid.png`: Mobile landing page for valid scanned QR token: tenant brand strip, high-contrast initials badge (`#0B1F3B` on `#FF6A00`), outlet name, section & table identifier, friendly "Online Ordering Coming Soon" status notice, footer "Powered by ServeMyFood". Zero duplicated notices, zero "Digital Dining" chip.
- `public-qr-invalid.png`: Mobile error landing page for expired or rotated QR tokens: friendly "QR Code Inactive or Expired" notice, assistance instructions, and zero secret token leakage.

---

## 4. Design & Ergonomic Invariants Verified
1. **Brand Mark**: Simple chef's hat mark with fork and spoon (`BrandLogo.tsx`, `favicon.svg`, `favicon.ico`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`).
2. **Orange Rule**: Brand Orange (`#FF6A00`) is strictly reserved for primary CTA actions. Zero orange appears in warnings (which use amber `#D97706`), alerts, error states, or security shield icons. White text on `#FF6A00` is strictly forbidden across all screens.
3. **Usage Meters**: Neutral/brand below 80%, amber (`#D97706` / `bg-amber-500`) at 80%–99%, red (`#DC2626` / `bg-destructive`) at >= 100%.
4. **Dark Mode Navy Base**: Navy base `#0B1F3B`-family (HSL 215 69% 14%), not near-black. "ServeMy" text color in header switches to `#FFFFFF` for 15.9:1 contrast ratio.
5. **Touch Targets**: In `[data-density="touch"]` mode, all interactive controls enforce `min-height: 56px` verified via Playwright bounding box assertions.
6. **WCAG Compliance**: Primary Navy (`#0B1F3B`) on Orange (`#FF6A00`) achieves 5.74:1 contrast ratio, exceeding WCAG 2.1 AAA for normal text.
7. **Client-Side QR Rendering**: All QR images generated client-side with Error Correction Level H, dark color `#0B1F3B` (contrast >= 7:1 against white), and embedded center logo <= 20% area.
8. **Security & Zero Token Leakage**: No secret tokens (`sec_token_...`) or token fragments are exposed in DOM text, cards, or URLs shown to users.
