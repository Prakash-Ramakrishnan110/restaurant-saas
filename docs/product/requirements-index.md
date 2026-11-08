# ServeMyFood: Requirements Index & Traceability Matrix

## 1. Product Mission & Architecture Baseline
ServeMyFood is a resilient, multi-tenant restaurant management and digital floor operating system. The platform balances high operational velocity in fast-paced dining environments (touchscreen POS, kitchen display system, quick token generation) with fail-closed tenant data isolation, strict financial ledger accuracy (all money stored in integer paise), and multi-lingual accessibility (English and Tamil `ta-IN`).

---

## 2. Requirement Domains & Traceability

| Req ID | Domain | Requirement Summary | Architectural Anchors & Evidence | Status |
|---|---|---|---|---|
| **REQ-AUTH-01** | Identity & Access | Multi-tenant JWT auth with in-memory short-lived access tokens and httpOnly rotating refresh cookies. | `apps.users`, ADR 0004, ADR 0008, `docs/evidence/teeth-4.txt` | **PROVEN (v0.2.7 / v0.3.3)** |
| **REQ-AUTH-02** | Multi-Tenancy | Fail-closed tenant isolation. Request scoping via `X-Tenant-ID`. Non-platform users receive 404 on foreign tenant resources. | `apps.core.models.TenantModel`, ADR 0002, `teeth-1.txt` | **PROVEN (v0.2.7 / v0.3.3)** |
| **REQ-AUTH-03** | Credential Lifecycle | Mandatory password change on first sign-in. Force-change gate blocks all operational APIs until completed. | `apps.users.views.PasswordGate`, ADR 0008, `teeth-3.txt` | **PROVEN (v0.2.7 / v0.3.3)** |
| **REQ-AUTH-04** | Role Invariants | `LAST_OWNER` demotion or deactivation protection to prevent orphaned tenants. | `apps.users.models.Membership`, `teeth-2.txt` | **PROVEN (v0.2.7 / v0.3.3)** |
| **REQ-VENUE-01** | Operational Diversity | Unified venue configuration covering Tea Shops, Cafes, Casual Dining, and Hotel Restaurants without code branching. | `apps.venues.models.VenueProfile`, ADR 0005 | **PROVEN (v0.2.7 / v0.3.3)** |
| **REQ-VENUE-02** | Service Floor Setup | Hierarchical service areas (indoor, terrace, patio) with table layout grid and bulk table generator. | `apps.venues.models.Table`, ADR 0006 | **PROVEN (v0.2.7 / v0.3.3)** |
| **REQ-TABLE-01** | Table Sessions | Atomic table sessions serving as transaction anchors. Prevents duplicate open sessions on active tables. | `apps.venues.models.TableSession`, ADR 0006 | **PROVEN (v0.2.7 / v0.3.3)** |
| **REQ-TABLE-02** | Daily Token Sequence | Race-free sequential daily counter tokens (`COUNTER_TOKEN`) utilizing atomic PostgreSQL sequences. | `apps.venues.services`, ADR 0010 | **PROVEN (v0.2.7 / v0.3.3)** |
| **REQ-BRAND-01** | Brand Identity | High-contrast Chef's Hat (toque) with fork, spoon, and swoosh logo mark. Dynamic SVG variants (mark, wordmark, horizontal, dark). | `frontend/src/components/brand`, ADR 0012 | **PROVEN (v0.3.3)** |
| **REQ-A11Y-01** | Visual Compliance | Strict WCAG AAA compliance for Primary Action (Navy on Orange >= 5.7:1). Zero brand orange in alert/status UI. | `frontend/src/tests/contrast.test.ts`, ADR 0012 | **PROVEN (v0.3.3)** |
| **REQ-UI-01** | Ergonomics & Touch | Touch target density switch (`data-density="touch"`) guaranteeing >= 56px heights for floor staff and kitchen. | `frontend/src/index.css`, ADR 0012 | **PROVEN (v0.3.3)** |
| **REQ-I18N-01** | Regionalization | First-class Tamil (`ta-IN`) localization across authentication, floor terminology, and branded print assets. | `frontend/src/i18n/index.ts`, ADR 0011 | **PROVEN (v0.3.3)** |
| **REQ-ONBD-01** | Onboarding Wizard | Step-by-step business setup wizard, brand customization, and printable branded QR code sheets. | ADR 0015, Prompt 3B Specification | **PROVEN (v0.4.0)** |
| **REQ-ORD-01** | Staff Dine-In Orders | Pilot 1: Waiter/staff ordering interface with instant table dispatch, item modifiers, and kitchen routing. | ADR 0013, Pilot 1 Milestone | **PROVEN (v0.8.0)** |
| **REQ-ORD-02** | Takeaway & Walk-In | Pilot 1: Quick counter order flow with sequential token dispatch and pickup customer tracking. | ADR 0016, Pilot 1 Milestone | **PROVEN (v0.8.0)** |
| **REQ-KDS-01** | Kitchen Display | Pilot 1: Live kitchen station tickets, prep countdowns, course bumping, and item status callbacks. | ADR 0013, Pilot 1 Milestone | **PROVEN (v0.8.0)** |
| **REQ-BILL-01** | Cashier & Billing | Pilot 1: Cash/UPI reconciliation, and printable thermal demo receipts without tax lines. | ADR 0017, Pilot 1 Milestone | **PROVEN (v0.8.0)** |
| **REQ-RPT-01** | Sales & Close-Out | Pilot 1: Owner daily sales dashboard, shift close-out (Z-report), and cashier cash drawer reconciliation. | ADR 0017, Pilot 1 Milestone | **PROVEN (v0.8.0)** |

---

## 3. Problem Register Traceability (v0.8.0 / v0.9.0)

See [problem-register.md](problem-register.md) and [sidebar-map.md](sidebar-map.md) for full details.

- **Hotel Owner / GM (H-01 to H-25)**:
  - H-01 (Money leaks): Partial (`AuditLog` and cancel reasons built; exceptions report in P2).
  - H-02 (Shift close cash match): Built in `/billing/closeout`.
  - H-03 (Multiple outlets / Floors & Outlets): Built in `/branches` and `/venue/areas`.
  - H-04 (Off-site owner dashboard): Built in `/dashboard` (Sales, orders, payment splits from `/reports/today/`).
  - H-10 (Staff access switch-off): Built in `/staff` (instant toggle, `LAST_OWNER` guard).
  - H-12 (Stock-out switches): Built in `/menu/availability`.
  - H-13 (Dietary marks): Built in `/menu` (Veg/Non-veg/Egg badges).
- **Restaurant / Tea Shop Owner (R-01 to R-11)**:
  - R-01 (Long counter queues, tokens): Built in `/pos` (Counter mode) and `/venue/counters`.
  - R-02 (Direct kitchen display): Built in `/kds`.
  - R-03 (Dish availability toggle): Built in `/menu/availability`.
  - R-04 (Daily sales dashboard): Built in `/dashboard` from `/reports/today/`.
  - R-07 (Menu editor): Built in `/menu`.
  - R-08 (Tamil localization): Partial (Tamil on core UI, auth, and receipts).
  - R-10 (Simple counter mode for tea shops): Built (word "table" completely omitted in counter venues).
- **Staff (Waiter, Cashier, Kitchen)**:
  - W-01 (Food ready alert): Built in `/orders/ready`.
  - W-02 (Order entry with notes): Built in `/pos`.
  - C-01 (Authoritative server billing): Built in `/billing`.
  - C-02 (Receipt reprint): Built in `/billing/invoices` ("DEMO RECEIPT - NOT A TAX INVOICE").
  - K-01 (Kitchen queue with timer): Built in `/kds`.
- **Platform Admin (A-01 to A-10)**:
  - A-01 (New customer creation): Built in `/admin/tenants/new` (New Customer Wizard).
  - A-02 (Customer directory & usage): Built in `/admin/tenants`.
  - A-03 (Reset owner password): Built in `/admin/tenants/:id` (temp password shown once).
  - A-07 (Tenant isolation & platform audit): Built in `/admin/activity` (Admin never sees restaurant data).
  - A-08 (Plan mix & limits): Built in `/admin/plans` (Starter, Professional, Business, Enterprise).

---

## 4. Scope Boundaries & Deferrals
- **No Tax Rates / Rules**: All tax logic strictly deferred pending certified accountant advice (ADVICE items).
- **External Delivery Apps (Swiggy / Zomato)**: Deferred to Phase 2 via official APIs.
- **Hotel PMS Integration**: Deferred to Phase 2.
- **Voice AI Ordering**: Formally excluded per ADR 0011.
