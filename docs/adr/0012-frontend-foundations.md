# ADR 0012: Frontend Foundations, Design System, Brand Tokens, and Localization

## Status
Accepted

## Context
As ServeMyFood expands from the core multi-tenant backend into a production-grade web application, a unified frontend architecture, design system, and accessibility framework must be established. The product is named **ServeMyFood**, developed by **Fusion Engine Technology**, with the tagline *"One Platform. Every Food Business."*

The frontend serves both desktop management consoles and touch-friendly mobile/tablet staff interfaces across diverse food businesses.

## Decisions

### 1. Frontend Architectural Stack
- **Framework & Bundler**: React 18 with Vite and TypeScript in strict mode (`/frontend`).
- **Styling**: Tailwind CSS with custom brand token design system and utility classes.
- **UI Component Primitives**: shadcn/ui components built on Radix UI primitives for robust accessibility (ARIA-compliant, full keyboard navigation).
- **Server State & Data Fetching**: TanStack Query (React Query v5) with automated cache invalidation, deduplicated requests, and retry backoff.
- **Client Routing**: React Router v6 with layout wrappers, auth guards, and temporary password change enforcement gates.
- **API Typing**: Automated TypeScript definitions generated directly from `docs/openapi.json` via `openapi-typescript` (`npm run gen:api`).

### 2. Accessible Brand Tokens and Contrast Invariants
- **Primary Brand Color**: Vibrant Orange (`#FF6A00`).
  - *Invariant*: Text on primary orange buttons MUST be Deep Navy (`#0B1F3B`), yielding a **5.7:1** contrast ratio (exceeding WCAG AAA requirement for normal text). White text on `#FF6A00` is strictly forbidden (2.87:1 fails WCAG AA).
- **Darker Orange Token**: Deep Amber Orange (`#C2410C`), providing >= 4.5:1 contrast against pure white backgrounds for links, tags, and accent text.
- **Danger Token**: Crimson Red (`#DC2626` / `#B91C1C`), ensuring >= 4.5:1 contrast against white for destructive buttons and error states.
- **Background & Panel Cream**: Warm Cream (`#FFF3E0`), utilized for authentication side panels, empty state illustrations, and callout badges.
- **Table Status Tokens**:
  - `AVAILABLE`: Forest Green (`#16A34A` / `#DCFCE7`)
  - `OCCUPIED`: Royal Blue (`#2563EB` / `#DBEAFE`)
  - `RESERVED`: Amethyst Purple (`#9333EA` / `#F3E8FF`)
  - `CLEANING`: Warm Amber (`#D97706` / `#FEF3C7`)
  - `BLOCKED`: Cool Slate (`#4B5563` / `#F3F4F6`)
  - *Rule*: Orange is NEVER used for status or warning states to avoid semantic collision with primary brand action colors.

### 3. Typography and Localization
- **Headings & Buttons**: Poppins (geometric, friendly, confident).
- **Body & Tabular Data**: Inter (clean, highly legible, optimized tabular numerals for currency and metrics).
- **Tamil Language Script**: Noto Sans Tamil (ensures seamless rendering for regional operators and staff).
- **Font Delivery**: Self-hosted WOFF2 web fonts served directly from the frontend bundle to eliminate third-party CDN latency and tracking.
- **Localization Strategy**: `i18next` with English (`en`) and Tamil (`ta`) bundles, automated language detection, and header language switcher.

### 4. Multi-Tenant Custom Theme Isolation
- The backoffice operations dashboard (staff, management, reports) retains the authoritative **ServeMyFood** brand.
- Customer-facing interfaces (e.g. public QR menus, digital receipts) dynamically inherit the tenant's custom branding via a `ThemeProvider` context that overrides CSS variables (`--primary`, `--primary-foreground`, `--brand-logo`) when `tenantBrand` configuration is present.

### 5. Staff Interface and Touch Ergonomics
- Minimum touch target size of 44x44px for standard comfortable mode.
- Dedicated "Touch Mode" spacing presets with minimum 56x56px touch target size for tablets, handheld waiter devices, and counter POS terminals.
- High-contrast visual cues for table statuses visible from a distance of 2 meters.

### 6. Dev Showcase Routes
- `/dev/brand`: Live visual inspection of color swatches, contrast compliance scores, typographic scales, and logo variants.
- `/dev/design-system`: Interactive gallery of all UI components in light, dark, comfortable, and touch densities.
