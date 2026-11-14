# Hidden Modules and Later Phase Inventory

Per **STEP 5 SCOPE**, pages for later phases (inventory, customers, rooms, room charges, takeaway, reports, and unbuilt future modules) stay hidden from default role navigation and are locked down. No mock, random, or hardcoded fake data is permitted.

This document inventories every hidden page, its roadmap phase (as defined in `docs/product/sidebar-map.md`), whether it uses backend API endpoints, and its current test status.

---

## 1. Routed Pages Hidden from Main Navigation

| Route | Page Component | Phase | Uses Backend API | Test Status | Notes |
|---|---|---|---|---|---|
| `/inventory` | `StockOverviewPage.tsx` | P3 | Yes (`/api/v1/inventory/ingredients/`) | Vitest Covered (`inventory-p3.test.tsx`) | Hidden from sidebar navigation. Accessible via direct URL or inventory manager role. |
| `/inventory/recipes` | `RecipesPage.tsx` | P3 | Yes (`/api/v1/inventory/recipes/`, `/api/v1/menu/items/`) | Vitest Covered | Hidden from sidebar navigation. |
| `/inventory/purchases` | `SuppliersPurchasesPage.tsx` | P3 | Yes (`/api/v1/inventory/purchases/`, `/api/v1/inventory/suppliers/`) | Vitest Covered | Uses server-generated PO numbers. Zero floats. |
| `/inventory/wastage` | `WastagePage.tsx` | P3 | Yes (`/api/v1/inventory/wastage/`) | Vitest Covered | Hidden from sidebar navigation. |
| `/inventory/reports` | `InventoryReportsPage.tsx` | P3 | Yes (`/api/v1/inventory/reports/variance/`, `.../low-stock/`) | Vitest Covered | Hidden from sidebar navigation. |
| `/customers` | `CustomersPage.tsx` | P2 | Yes (`/api/v1/customers/`) | Vitest Covered (`p2-features.test.tsx`) | CRM / guest database with privacy consent flags. |
| `/venue/rooms` | `RoomsPage.tsx` | P2 | Yes (`/api/v1/sections/`, `/api/v1/tables/`) | Vitest Covered (`venue-adaptive.test.tsx`) | Exclusive to hotel profile. Replaced by dining tables for standard venues. |
| `/room-service` | `RoomServicePage.tsx` | P2 | Yes (`/api/v1/orders/`) | Vitest Covered (`p2-features.test.tsx`) | Hotel in-room dining order tracking. |
| `/billing/room-charges` | `RoomChargesPage.tsx` | P2 | Yes (`/api/v1/invoices/`) | Vitest Covered (`p2-features.test.tsx`) | Hotel folio charges ledger. |
| `/takeaway` | `TakeawayPage.tsx` | P2 | Yes (`/api/v1/orders/`) | Vitest Covered (`p2-features.test.tsx`) | Counter parcel packing and pickup verification. |
| `/reports/sales` | `SalesReportsPage.tsx` | P1 / P2 | Yes (`/api/v1/reports/range/`) | Vitest Covered (`reports-and-settings.test.tsx`) | Date-range revenue analytics. |
| `/reports/items` | `ItemReportsPage.tsx` | P1 / P2 | Yes (`/api/v1/reports/range/`) | Vitest Covered (`reports-and-settings.test.tsx`) | Category and item velocity breakdown. |
| `/reports/payments` | `PaymentReportsPage.tsx` | P1 / P2 | Yes (`/api/v1/reports/range/`) | Vitest Covered (`reports-and-settings.test.tsx`) | Tender mix (Cash, UPI, Card, Room Folio). |
| `/reports/exceptions` | `ExceptionsReportPage.tsx` | P2 | Yes (`/api/v1/reports/exceptions/`) | Vitest Covered (`reports-and-settings.test.tsx`) | Voids, discounts, cancellations audit. |
| `/reports/staff` | `StaffReportPage.tsx` | P2 | Yes (`/api/v1/reports/staff/`) | Vitest Covered (`reports-and-settings.test.tsx`) | Waiter order volume and table turn time. |
| `/reports/outlets` | `OutletComparisonPage.tsx` | P2 | Yes (`/api/v1/reports/outlets/`) | Vitest Covered (`reports-and-settings.test.tsx`) | Multi-branch / multi-outlet sales benchmark. |
| `/activity` | `ActivityLogPage.tsx` | P1 | Yes (`/api/v1/audit-logs/`) | Vitest Covered (`reports-and-settings.test.tsx`) | Operational audit logs. |
| `/menu/options` | `MenuOptionsPage.tsx` | P1 | Yes (`/api/v1/menu/option-groups/`) | Vitest Covered (`menu.test.tsx`) | Add-on groups and variant configuration. |
| `/settings/sound` | `SoundSettingsPage.tsx` | P1 | No (Web Audio API synthesis) | Vitest Covered (`reports-and-settings.test.tsx`) | KDS/order sound frequency triggers. |
| `/settings/devices` | `DeviceSettingsPage.tsx` | P1 | Yes (`/api/v1/devices/`) | Vitest Covered (`reports-and-settings.test.tsx`) | Thermal receipt & KOT printer configuration. |
| `/team/roles` | `RolesGuidePage.tsx` | P2 | No (Static documentation) | Vitest Covered (`p2-features.test.tsx`) | Bilingual English/Tamil staff training guide. |

---

## 2. Planned / Future Modules (Unrouted & Excluded)

These modules are defined in the product roadmap (`docs/product/sidebar-map.md`) for future delivery or awaiting professional advice. They are **not routed**, contain no stubs, and have zero active endpoints.

| Feature Area | Route (Future) | Target Phase | Status | Reason |
|---|---|---|---|---|
| Reservations | `/reservations` | LATER | Unrouted | Advance table booking engine. |
| Events & Banquets | `/events` | LATER | Unrouted | Hotel banquet and hall event manager. |
| Menu Import | `/menu/import` | P2 | Unrouted | Excel / CSV bulk menu ingestion. |
| Day-Part Pricing | `/menu/prices` | P2 | Unrouted | Dynamic time-of-day pricing rules. |
| Offers & Coupons | `/offers` | LATER | Unrouted | Promotional discount coupon engine. |
| Tax Reports | `/reports/taxes` | ADVICE | Unrouted | Awaiting chartered accountant / GST advice. |
| Tax Settings | `/settings/taxes` | ADVICE | Unrouted | Awaiting tax compliance legal review. |
| Online Payments | `/settings/payments` | P2 | Unrouted | Razorpay / Pine Labs payment gateway keys. |
| Notifications | `/settings/notifications` | P2 | Unrouted | SMS / WhatsApp transactional alerts. |
| Integrations | `/settings/integrations` | LATER | Unrouted | Third-party delivery aggregators (Swiggy / Zomato). |
| Platform Subscriptions | `/admin/subscriptions` | P2 | Unrouted | Recurring billing invoice manager. |
| Setup Templates | `/admin/templates` | P2 | Unrouted | Custom tenant seed templates. |
| Platform Admin Users | `/admin/users` | P2 | Unrouted | Multi-role platform administrative access. |
| Data Subject Requests | `/admin/requests` | ADVICE, LATER | Unrouted | GDPR / DPDPA customer data deletion compliance. |
| Platform Global Settings | `/admin/settings` | LATER | Unrouted | Global feature flags and system variables. |

---

## 3. Strict Compliance Verification

1. **No Fake / Mock Data**: All routed pages either fetch live data through `apiClient` / `ordersApi` or render deterministic functional components (like the Web Audio synthesizer in `SoundSettingsPage` or the bilingual training documentation in `RolesGuidePage`).
2. **Permission Integrity**: All routed pages are wrapped in `<ProtectedRoute>` and evaluate active user role and tenant memberships.
3. **No Dead Stubs**: The previous 8-line stub at `/onboarding` was eliminated in STEP 1; `/onboarding` now mounts `OnboardingWizardPage.tsx` with full business-type adaptive behavior.

