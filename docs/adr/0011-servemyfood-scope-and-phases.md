# ADR 0011: ServeMyFood Brand Identity, Architecture, Scope, and Phased Roadmap

## Status
Accepted

## Context
As the platform expands from the core multi-tenant backend into a production-grade web application, a unified brand identity, frontend architecture, and product scope must be established. The product is named **ServeMyFood**, developed by **Fusion Engine Technology**, with the tagline *"One Platform. Every Food Business."*

The platform powers diverse food businesses—from tea shops and bakeries to fine dining and hotel chains. The frontend must deliver an accessible, fast, modern, and trustworthy user experience across both desktop management consoles and touch-friendly mobile/tablet staff interfaces.

## Decisions

### 1. Product Identity and Brand Positioning
- **Product Name**: ServeMyFood
- **Tagline**: *"One Platform. Every Food Business."*
- **Parent Company**: Fusion Engine Technology
- **Value Proposition**: A single, modern, multi-tenant POS and restaurant management SaaS that scales effortlessly from single-counter quick-service stalls to multi-branch luxury dining establishments.

### 2. Frontend Architectural Stack
- **Framework & Bundler**: React 18 with Vite and TypeScript in strict mode (`/frontend`).
- **Styling**: Tailwind CSS with custom brand token design system and utility classes.
- **UI Component Primitives**: shadcn/ui components built on Radix UI primitives for robust accessibility (ARIA-compliant, full keyboard navigation).
- **Server State & Data Fetching**: TanStack Query (React Query v5) with automated cache invalidation, deduplicated requests, and retry backoff.
- **Client Routing**: React Router v6 with layout wrappers, auth guards, and temporary password change enforcement gates.
- **API Typing**: Automated TypeScript definitions generated directly from `docs/openapi.json` via `openapi-typescript` (`npm run gen:api`).

### 3. Accessible Brand Tokens and Contrast Invariants
- **Primary Brand Color**: Vibrant Orange (`#FF6A00`).
  - *Invariant*: Text on primary orange buttons MUST be Deep Navy (`#0B1F3B`), yielding a **5.7:1** contrast ratio (exceeding WCAG AAA requirement for normal text). White text on `#FF6A00` is strictly forbidden (3.0:1 fails WCAG AA).
- **Darker Orange Token**: Deep Amber Orange (`#C2410C`), providing >= 4.5:1 contrast against pure white backgrounds for links, tags, and accent text.
- **Danger Token**: Crimson Red (`#DC2626` / `#B91C1C`), ensuring >= 4.5:1 contrast against white for destructive buttons and error states.
- **Background & Panel Cream**: Warm Cream (`#FFF3E0`), utilized for authentication side panels, empty state illustrations, and callout badges.
- **Table Status Tokens**:
  - `AVAILABLE`: Forest Green (`#16A34A` / `#DCFCE7`)
  - `OCCUPIED`: Royal Blue (`#2563EB` / `#DBEAFE`)
  - `RESERVED`: Amethyst Purple (`#9333EA` / `#F3E8FF`)
  - `CLEANING`: Warm Amber (`#D97706` / `#FEF3C7`)
  - `BLOCKED`: Cool Slate (`#4B5563` / `#F3F4F6`)

### 4. Typography and Localization
- **Headings & Buttons**: Poppins (geometric, friendly, confident).
- **Body & Tabular Data**: Inter (clean, highly legible, optimized tabular numerals for currency and metrics).
- **Tamil Language Script**: Noto Sans Tamil (ensures seamless rendering for regional operators and staff).
- **Font Delivery**: Self-hosted WOFF2 web fonts served directly from the frontend bundle to eliminate third-party CDN latency and tracking.
- **Localization Strategy**: `i18next` with English (`en`) and Tamil (`ta`) bundles, automated language detection, and header language switcher.

### 5. Multi-Tenant Custom Theme Isolation
- The backoffice operations dashboard (staff, management, reports) retains the authoritative **ServeMyFood** brand.
- Customer-facing interfaces (e.g. public QR menus, digital receipts, customer ordering screens) dynamically inherit the tenant's custom branding via a `ThemeProvider` context that overrides CSS variables (`--primary`, `--primary-foreground`, `--brand-logo`) when `tenantBrand` configuration is present.

### 6. Authentication and Token Storage Security
- **Access Tokens**: Stored strictly in-memory (React context / module scope). Never written to `localStorage`, `sessionStorage`, or unencrypted client state.
- **Refresh Tokens**: Persisted exclusively in secure, `httpOnly`, `sameSite=Lax` browser cookies.
- **Refresh Concurrency**: Single-flight promise mutex to prevent concurrent refresh race conditions.
- **Password Gate**: Immediate redirect to `/change-password` whenever `must_change_password` is flagged in `/api/v1/auth/me/`.

### 7. Staff Interface and Touch Ergonomics
- Minimum touch target size of 44x44px across all interactive controls.
- Dedicated "Touch Mode" spacing presets for tablets and POS terminals.
- High-contrast visual cues for table statuses visible from a distance of 2 meters.

### 8. Testing and Quality Assurance Contract
- **Unit & Component Testing**: Vitest with React Testing Library.
- **End-to-End Integration**: Playwright browser automation covering authentication, password change, brand showcase, and responsive layouts.
- **Automated Accessibility Testing**: Programmatic WCAG 2.1 AA contrast ratio assertions on all token combinations.

### 9. Dev Showcase Routes
- `/dev/brand`: Live visual inspection of color swatches, contrast compliance scores, typographic scales, and logo variants.
- `/dev/design-system`: Interactive gallery of all shadcn/ui components, buttons, badges, tables, and modal dialogs.

### 10. Phased Engineering Roadmap
- **Phase 1 (Prompt 3A - Current)**: Brand foundation, design system, typography, auth flow, dashboard shell, dev brand routes.
- **Phase 2 (Prompt 3B)**: Multi-step onboarding wizard, venue setup, floor plan editor, table grid, bulk table generator.
- **Phase 3 (Prompt 3C)**: Live floor plan operations, table session lifecycles, waitstaff section assignments, QR code management and printable PDF export.
- **Phase 4**: Order placement, KDS order routing, billing & invoice generation, analytics and reporting.
