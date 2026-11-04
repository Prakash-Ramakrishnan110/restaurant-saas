# ADR 0011: ServeMyFood Product Scope, Boundary Decisions, and Phased Roadmap

## Status
Accepted

## Context
ServeMyFood is a comprehensive multi-tenant restaurant and food service operating system. Clear boundary decisions are required to define what is in scope for the core MVP and what is deferred to subsequent phases. This prevents scope creep while guaranteeing technical excellence in multi-tenancy, transactional consistency, and data security.

## Decisions: The 10 Product Architecture Decisions

### 1. Core Functional Scope
- **Included**: Dine-in table management, service areas and sections, table sessions as the atomic order anchor, QR digital menus with configurable ordering policies (`BROWSE_ONLY`, `ORDER_WITH_APPROVAL`, `ORDER_DIRECT`), waiter ordering terminals, kitchen display system (KDS) dispatch, and daily sequential counter tokens (`COUNTER_TOKEN`).
- **Target Segments**: Quick Service, Cafés, Casual Dining, Fine Dining, Hotel In-Room Dining, Food Courts, and Bars/Breweries.

### 2. Payment Processing
- **Phase 1 (MVP)**: Manual cash handling, external counter POS reconciliation, and manual UPI QR reconciliation with cashier status confirmation.
- **Phase 2**: Integrated payment gateways (Razorpay, Stripe) with automated webhook settlement, split billing, and digital customer receipts.

### 3. Real-Time Updates & Synchronization
- **Phase 1 (MVP)**: Short polling (TanStack Query refetch intervals on active views) and optimistic UI updates for floor status changes.
- **Phase 2**: Push-based real-time event streaming via WebSockets / Server-Sent Events (SSE) backed by Redis pub/sub for instant KDS tickets and waiter notifications.

### 4. Voice AI & Conversational Ordering
- **Decision**: Explicitly **OUT OF SCOPE** for the core restaurant SaaS platform.
- **Rationale**: High audio ambient noise in busy commercial kitchens and restaurants yields unreliable speech-to-text accuracy. Deferred to future conversational AI sidecar plugins once core ordering reaches operational maturity.

### 5. Server-Side Authoritative Pricing
- **Decision**: All menu item prices, discount deductions, tax rates (GST / VAT), service charges, line item subtotals, and final bill amounts are computed **exclusively** on the backend.
- **Rule**: The frontend client never calculates, submits, or overrides prices. Any cart payload submitted by a client sends only `{ menu_item_id, quantity, modifier_ids }`.

### 6. Image Storage & Asset Delivery
- **Decision**: Media assets (restaurant logos, menu item photography) are stored on Cloudflare R2 / AWS S3-compatible object storage via pre-signed direct upload URLs.
- **Rule**: Backend application servers never receive raw image byte streams directly. Only validated URLs and metadata are stored in PostgreSQL.

### 7. Customer Sign-In & Frictionless Dining
- **Decision**: Zero-friction customer experience. Diners scanning a table QR code are never required to create an account, enter a password, or download an application.
- **Rationale**: Friction at the dining table causes customer abandonment. Sessions are anchored directly to the table session or ephemeral token.

### 8. Multi-Tenancy & Data Isolation
- **Decision**: Shared PostgreSQL database with Row-Level Security (RLS) and strict tenant-scoped querysets (`TenantModel.objects` vs `TenantModel.unscoped`).
- **Rule**: Every tenant request carries an authoritative JWT and optional `X-Tenant-ID` header. Cross-tenant access attempts immediately return HTTP 404 to avoid disclosing entity existence.

### 9. Offline Resilience & Degraded State Handling
- **Decision**: Graceful degradation under network dropouts.
- **Rule**: The frontend provides read-only local caching of floor layouts, active menus, and recent orders. All write mutations require active server connectivity. When offline, mutation controls display a prominent offline warning banner and disable destructive actions.

### 10. Multi-Language & Internationalization
- **Decision**: Built-in multi-language and regional support from day one.
- **Languages**: Full translation bundles for English (`en`) and Tamil (`ta-IN`) with instant language toggle and localized number/currency formatting (INR paise integer representation).

---

## Phased Delivery Roadmap

| Phase | Milestone | Core Deliverables |
|:---:|---|---|
| **Phase 1** | **Foundations & Venue Setup** | Brand identity, accessible design system, JWT auth with httpOnly refresh cookies, RBAC, multi-tenant branch setup, service areas, floor layout editor, and bulk table creation. |
| **Phase 2** | **Live Operations & QR Engine** | Live floor management, waiter section assignments, table sessions lifecycle, QR code generation and PDF printouts, diner browse/order flows. |
| **Phase 3** | **KDS & Order Lifecycle** | Kitchen display routing, course management, order status transitions, waiter call bells, and bill generation. |
| **Phase 4** | **Payments & Integrations** | Gateway integrations (Razorpay), split payments, inventory synchronization, and daily sales analytics. |
