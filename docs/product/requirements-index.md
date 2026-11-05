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
| **REQ-ONBD-01** | Onboarding Wizard | Prompt 3B: Step-by-step business setup wizard, brand customization, and printable branded QR code sheets. | ADR 0015, Prompt 3B Specification | **READY FOR 3B** |
| **REQ-ORD-01** | Staff Dine-In Orders | Pilot 1: Waiter/staff ordering interface with instant table dispatch, item modifiers, and kitchen routing. | ADR 0013, Pilot 1 Milestone | **READY FOR PILOT 1** |
| **REQ-ORD-02** | Takeaway & Walk-In | Pilot 1: Quick counter order flow with sequential token dispatch and pickup customer tracking. | ADR 0016, Pilot 1 Milestone | **READY FOR PILOT 1** |
| **REQ-KDS-01** | Kitchen Display | Pilot 1: Live kitchen station tickets, prep countdowns, course bumping, and item status callbacks. | ADR 0013, Pilot 1 Milestone | **READY FOR PILOT 1** |
| **REQ-BILL-01** | Cashier & Billing | Pilot 1: Split billing, discount application, cash/UPI reconciliation, and printable thermal tax receipts. | ADR 0017, Pilot 1 Milestone | **READY FOR PILOT 1** |
| **REQ-RPT-01** | Sales & Close-Out | Pilot 1: Owner daily sales dashboard, shift close-out (Z-report), and cashier cash drawer reconciliation. | ADR 0017, Pilot 1 Milestone | **READY FOR PILOT 1** |

---

## 3. Scope Boundaries & Deferrals
- **Customer QR Ordering App**: Designed to follow Pilot 1 staff-entered dining to validate core kitchen and billing lifecycles under controlled conditions first.
- **Automated Payment Gateways (Razorpay/Stripe)**: Scheduled for Phase 2; Pilot 1 supports manual cash and external UPI QR reconciliation.
- **Voice AI Ordering**: Formally excluded per ADR 0011.
