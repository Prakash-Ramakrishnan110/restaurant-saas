# ServeMyFood: Architecture & Specification Deviations Log

This document records all deliberate, accepted design decisions, deviations from initial prompt assumptions, and their authoritative tracking history.

---

## 1. Deviations Matrix

| ID | Topic | Initial Spec / Early Assumption | Production Implementation | Rationale |
|---|---|---|---|---|
| **DEV-001** | Database Host Port | `5432` host port | Loopback `127.0.0.1:5435 -> 5432` | Host development environment had existing PostgreSQL instances on 5432-5434. Binding `127.0.0.1:5435` prevents conflicts and protects from external interfaces. |
| **DEV-002** | Celery Idle Session Task | Placed directly in app services | Registered in `apps.core.tasks.expire_idle_sessions_task` which delegates to `apps.venues.services` | The Celery worker imports tasks registered in `apps.core.tasks` (confirmed via `celery inspect registered`), keeping Celery beat schedules unified while delegating execution to the venues domain service. |
| **DEV-003** | Error Code HTTP Statuses | Mixed 400s for conflict states | HTTP 409 Conflict for `LAST_OWNER`, `SESSION_ALREADY_OPEN`, `TABLE_NOT_AVAILABLE`, `DUPLICATE_LABEL` | Standard REST semantics: resource state conflicts (concurrency, existing sessions, duplicate unique identifiers, last owner removal) return HTTP 409 Conflict instead of HTTP 400 Bad Request. |
| **DEV-004** | Invariant Rules on PATCH | Full replacement check only | Invariant rules R1-R7 validated against merged state on partial `PATCH` | Ensures partial updates to single capability fields cannot put the venue configuration into an illegal state (e.g., toggling `uses_tables=False` while `has_sections=True`). |
| **DEV-005** | Streamlined Capabilities & Presets | Legacy multi-field timing & unconstrained policies | Unified 15-field matrix with locked preset values and streamlined enums | Final production preset values enforce: (1) `CAFE` `qr_ordering_mode` is `ORDER_DIRECT` and `qr_session_policy` is `CUSTOMER_CAN_OPEN`; (2) `HOTEL_RESTAURANT` `qr_session_policy` is `STAFF_ONLY`. The `QRSessionPolicy` enum is strictly limited to `CUSTOMER_CAN_OPEN` and `STAFF_ONLY` (`MANUAL_STAFF_CLOSE` does not exist). Verified via `docs/evidence/presets-proof.txt`. |
| **DEV-006** | Brand Color Accessibility | White text on Orange `#FF6A00` | Deep Navy `#0B1F3B` on Orange `#FF6A00` (5.74:1 AAA contrast) | WCAG AA compliance requires at least 4.5:1 contrast for normal text and 3:1 for large UI components. White on `#FF6A00` only achieved 2.87:1 (failing AA); Deep Navy achieves 5.74:1 (WCAG AAA compliant). |
| **DEV-007** | Permission Codes | Pluralized/mixed codes (`tables.manage`, `qrcodes.view`) | Restored exact Prompt 2 singular codes (`branch.view/manage`, `area.view/manage`, `floor.manage`, `table.view/manage/status_update/merge/assign`, `table_session.open/close`, `qr.view/manage`, `staff.view/manage`, `business.view/manage`) | Maintains strict alignment with the 72-case role-by-endpoint RBAC matrix and ensures each endpoint requires its most specific permission code. |
| **DEV-008** | Wizard Presets Scope | Food Truck / Pop-up in active wizard | 7 core presets (Tea shop, Bakery, Café, Restaurant, Fine dining, Hotel, Food court); Food Truck deferred to `docs/product/backlog.md` (`STORY-TRUCK-01`) | Prevents operational ambiguity before shifting table and GPS models are formally specified. |
| **DEV-009** | Application-Level Tenant Isolation | Database-level Postgres Row Level Security (RLS) | Application-level multi-tenant query filtering with strict scoping & `unscoped` guard | Consistent with Django ORM best practices across multi-tenant SaaS engines, verified by comprehensive tenant isolation test suites. |
| **DEV-010** | Rejection of SVG Logo Uploads | Permitting SVG uploads for restaurant branding | Strictly JPEG, PNG, and WebP raster formats permitted; SVG rejected with `INVALID_FILE_TYPE` | SVGs present severe XSS vulnerabilities (embedded JavaScript, external XML entities). Client and server strictly validate MIME magic bytes and reject SVGs. |
| **DEV-011** | Interactive Floor Map Manipulation | Interactive drag-and-drop table layout editor in Pilot 1 | Clean read-only visual floor plan grid map with side sheet status updates in Screen B5 | Interactive 2D drag-and-drop table designer deferred to post-v0.5.0 milestone (`STORY-POS-00` in `docs/product/backlog.md`). |

---

## 2. Deviations Change Log

| Date | Previous ID | New ID | Topic | Reason for Change |
|---|---|---|---|---|
| 2026-11-04 | DEV-001 | DEV-001 | Postgres Port 5435 | Preserved; stable since initial setup. |
| 2026-11-04 | DEV-002 | DEV-002 | Celery Idle Session Task | Preserved; unified under `apps.core.tasks`. |
| 2026-11-04 | DEV-003 | DEV-003 | Error Code HTTP Statuses | Preserved; standardized HTTP 409 Conflict. |
| 2026-11-04 | DEV-004 | DEV-004 | Invariant Rules on PATCH | Preserved; capability validation. |
| 2026-11-04 | DEV-005 | DEV-005 | Capabilities & Presets | Preserved; CAFE & HOTEL_RESTAURANT locked values. |
| 2026-11-05 | DEV-006 | DEV-006 | Brand Navy on Orange | Preserved; 5.74:1 AAA contrast requirement. |
| 2026-11-05 | DEV-007 | DEV-007 | Permission Codes | Preserved; Prompt 2 singular RBAC permissions. |
| 2026-11-05 | — | DEV-008 | Wizard Scope (Food Truck) | Added; deferral of non-static table preset. |
| 2026-11-06 | — | DEV-009 | App-Level Isolation | Restored historical architectural decision. |
| 2026-11-06 | — | DEV-010 | SVG Upload Rejection | Restored historical logo security decision. |
| 2026-11-06 | — | DEV-011 | Floor Plan Phased Delivery | Added; read-only grid layout in Screen B5 with drag-and-drop editor deferred. |
