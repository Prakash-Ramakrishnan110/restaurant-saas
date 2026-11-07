# Fusion Engine Restaurant SaaS - Frontend Developer API Guide

This document outlines the API contracts, architectural conventions, authentication patterns, error codes, and operational guidelines for building frontend interfaces against the Fusion Engine backend.

---

## 1. Base URL & Protocol
- **API Prefix**: `/api/v1/`
- **Health Checks**: `/health` and `/health/` (both return `200 OK` without redirect)
- **Public Endpoints**: `/api/v1/public/qr/...` (no authentication required)
- **Protected Endpoints**: Require JWT Bearer token authentication and tenant scoping.

---

## 2. Authentication & Session Management

### 2.1 Login (`POST /api/v1/auth/login/`)
- Accepts `email` and `password`.
- Returns `access` token (short-lived, 15 min), user details, active tenant ID, and memberships.
- Sets an `httpOnly`, `Secure` (env-driven), `SameSite` refresh cookie (`fusion_refresh_token`).

### 2.2 Token Refresh (`POST /api/v1/auth/refresh/`)
- Canonical single refresh endpoint (no duplicate `/token/refresh/` alias).
- Reads the `httpOnly` refresh cookie (or accepts `{ "refresh": "..." }` in request body).
- Performs token rotation: issues a new `access` token in the JSON body and sets a rotated `httpOnly` refresh cookie; blacklists the old refresh token.
- Validates `Origin` header against `CORS_ALLOWED_ORIGINS`.

### 2.3 Logout (`POST /api/v1/auth/logout/`)
- Works with the refresh cookie alone (`AllowAny` + `Origin` allow-list check).
- Blacklists the refresh token, always clears the cookie, and returns `204 No Content` even if the access token is expired or the refresh token is already invalid.

### 2.4 Password Change (`POST /api/v1/auth/change-password/`)
- Authenticated endpoint requiring `current_password` and `new_password` (rate-limited via `change_password` throttle scope).
- Validates password complexity via standard Django password validators.
- Blacklists all outstanding refresh tokens for the user (revoking other active sessions).
- Clears `user.must_change_password` flag and writes an `auth.password_change` `AuditLog` entry.
- Returns `{ "message": "Password changed successfully.", "access": "<jwt>" }` in the JSON body (never returns a refresh token in the JSON body) and sets the new refresh token in the `httpOnly` cookie.

### 2.5 First-Time Staff Login & Backend `PASSWORD_CHANGE_REQUIRED` Gate
- When a manager or owner invites a new staff member via `POST /api/v1/staff/`, the response contains `temporary_password` **once** (never written to `AuditLog`, application logs, or subsequent `GET` responses).
- The staff user is created with `must_change_password = true`.
- **Backend Gate**: While `user.must_change_password` is `true`, every authenticated endpoint except `/api/v1/auth/me/`, `/api/v1/auth/change-password/`, `/api/v1/auth/logout/`, and `/api/v1/auth/refresh/` returns `403 Forbidden` with error code `PASSWORD_CHANGE_REQUIRED`.

---

## 3. Headers & Tenant Context

| Header | Description | Required |
|---|---|---|
| `Authorization` | `Bearer <access_token>` | For all protected endpoints |
| `X-Tenant-ID` | Target Tenant UUID | Optional override when user has memberships in multiple tenants |
| `Content-Type` | `application/json` | For all JSON requests |

---

## 4. Uniform Error Schema & Complete Error-Code Reference

Every 4xx and 5xx response adheres to this deterministic schema:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable summary.",
    "details": {}
  }
}
```

### Complete Error-Code List
| Error Code | HTTP Status | Structured Details Schema | When It Occurs |
|---|:---:|---|---|
| `VALIDATION_ERROR` | 400 | `{ "<field>": ["<message>"] }` | Request body or query parameter fails serializer validation (missing field, invalid choice, weak password). |
| `INVALID_REFERENCE` | 400 | `{ "detail": "Invalid reference..." }` | Request references foreign-tenant, cross-branch, or non-existent UUID. |
| `INVALID_STATUS_TRANSITION` | 400 | `{ "from": "<status>", "to": "<status>", "allowed": ["<status>"] }` | Attempted table status transition is not permitted by state machine. |
| `TABLES_NOT_COMBINABLE` | 400 | `{ "reason": "<explanation>" }` | Tables cannot be joined (e.g. cross-branch, cross-service-area, already occupied, inactive). |
| `INVALID_CAPABILITY_COMBINATION` | 400 | `{ "<field>": "<rule violation>" }` | `PATCH /branches/{id}/capabilities/` violates invariant rules R1–R7. |
| `MISSING_TOKEN` | 400 | `{}` | `POST /api/v1/auth/refresh/` called without refresh cookie or body field. |
| `AUTHENTICATION_FAILED` | 401 | `{}` | Missing, expired, or invalid JWT access/refresh token, or invalid login credentials. |
| `PERMISSION_DENIED` | 403 | `{}` | User lacks required RBAC permission or active membership in target tenant. |
| `ROLE_NOT_ALLOWED` | 403 | `{ "attempted_role": "<role>", "user_role": "<role>" }` | Actor lacks authority to assign or edit a role equal to or higher than their own. |
| `PASSWORD_CHANGE_REQUIRED` | 403 | `{}` | User has `must_change_password = true` and calls non-exempt endpoint. |
| `TENANT_SUSPENDED` | 403 | `{}` | Active tenant status is `SUSPENDED` or `ARCHIVED`, or has no active subscription. |
| `ENTITLEMENT_LIMIT_REACHED` | 403 | `{ "limit_key": "<key>", "limit": <int>, "current": <int> }` | Operation exceeds subscription limits (`max_branches`, `max_tables`, etc.). |
| `INVALID_ORIGIN` | 403 | `{}` | Refresh or logout request has origin not in CORS allow-list. |
| `NO_TENANT_CONTEXT` | 403 | `{}` | Authenticated user lacks active tenant context for tenant-scoped endpoint. |
| `STAFF_ACTION_REQUIRED` | 403 | `{}` | Customer scans table with `STAFF_ONLY` session policy when no session is open. |
| `NOT_FOUND` | 404 | `{}` | Requested resource does not exist or belongs to another tenant. |
| `METHOD_NOT_ALLOWED` | 405 | `{}` | HTTP verb is not supported by the endpoint. |
| `SESSION_ALREADY_OPEN` | 409 | `{ "session_code": "<code-or-null>" }` | Attempting to open a session on a table or group that already has an active session. |
| `TABLE_NOT_AVAILABLE` | 409 | `{ "table_id": "<uuid>", "status": "<status>" }` | Attempting to seat or open session on a table that is BLOCKED or CLEANING. |
| `DUPLICATE_LABEL` | 409 | `{ "label": "<label>", "service_area_id": "<uuid>" }` | Creating or updating table with a label already in use within the service area. |
| `LAST_OWNER` | 409 | `{ "message": "Cannot demote or deactivate the last active owner." }` | Attempting to deactivate or demote the last remaining active owner of a tenant. |
| `RATE_LIMITED` | 429 | `{}` | Request exceeded rate limit on sensitive endpoints. |
| `INTERNAL_SERVER_ERROR` | 500 | `{}` | Unhandled server exception. |

---

## 5. Venue Capabilities & Presets

- **Available Presets**: `GET /api/v1/venues/presets/` returns preset configurations for:
  `QUICK_SERVICE`, `CAFE`, `CASUAL_DINING`, `FINE_DINING`, `HOTEL_RESTAURANT`, `FOOD_COURT`, `BAR_BREWERY`.
- **Branch Capabilities**: `GET /api/v1/branches/{id}/capabilities/` and `PATCH /api/v1/branches/{id}/capabilities/`.
- **15 Capability Fields**: `uses_tables`, `uses_kds`, `uses_token_numbers`, `allows_takeaway`, `allows_room_service`, `allows_room_charge`, `allows_qr_ordering`, `has_sections`, `has_seat_ordering`, `supports_courses`, `allows_table_transfer`, `payment_timing`, `qr_ordering_mode`, `qr_session_policy`, `order_workflow`.

---

## 6. Table & Floor Management

- **Service Areas**: `GET /api/v1/service-areas/`, `POST /api/v1/service-areas/`
- **Sections**: `GET /api/v1/sections/`, `POST /api/v1/sections/`
- **Dining Tables**: `GET /api/v1/tables/`, `POST /api/v1/tables/`
- **Bulk Creation**: `POST /api/v1/tables/bulk-create/`
- **Floor Editor Layout**: `POST /api/v1/tables/layout/` and `PATCH /api/v1/tables/layout/` (batch update coordinates and dimensions)
- **Table Merge/Join**: `POST /api/v1/tables/join/` (combines 2+ tables into a `TableGroup`)
- **Table Split**: `POST /api/v1/tables/split/` (releases group back to individual tables)
- **Status Transitions**: `POST /api/v1/tables/{id}/status/` (`AVAILABLE`, `OCCUPIED`, `RESERVED`, `CLEANING`, `OUT_OF_SERVICE`)

---

## 7. QR Code Management & Public Diner Ordering

### Staff Management
- `POST /api/v1/qr-codes/generate/`: Idempotent endpoint. If an active QR code exists for the target `(branch, target_type, table, service_area)`, returns it (`200 OK`); otherwise creates a new one (`201 Created`).
- `POST /api/v1/qr-codes/{id}/rotate/`: Cryptographically rotates public token, incrementing version and invalidating old token.
- `DELETE /api/v1/qr-codes/{id}/`: Canonical single deactivation route. Soft-deactivates QR code (`is_active = False`) and returns `204 No Content`.
- `GET /api/v1/qr-codes/{id}/image/?format=png`: Generates PNG or SVG QR image for physical printing.

### Public Customer Flow (No Auth Required)
- `GET /api/v1/public/qr/{token}/`: Resolves scanned QR token. Returns venue name, logo, table label, capabilities, and active session status.
- `POST /api/v1/public/qr/{token}/session/`: Opens or rejoins a customer table session (if `qr_session_policy == CUSTOMER_CAN_OPEN`).

---

## 8. Entitlements & Subscription Usage

- `GET /api/v1/entitlements/`: Returns plan name, subscription status, limits (`max_branches`, `max_service_areas`, `max_tables`, `floor_editor`, `table_merge`, `courses`), current usage count, and remaining count.

---

## 9. Business Profile

- `GET /api/v1/business/`: Retrieve active tenant profile and business settings (`business.view` permission: `OWNER`, `BRANCH_MANAGER`).
- `PATCH /api/v1/business/`: Update business name, type, phone, email, timezone, and branding (`invoice_prefix`, `logo_url`, `primary_color`, `tax_mode`) (`business.manage` permission: `OWNER` only).

---

## 10. Spec Deviations & Clarifications Table

| Area | Spec / Earlier Draft | Final Implementation | Rationale |
|---|---|---|---|
| Change-password input field | `old_password` in initial Prompt 2 draft | `current_password` | Standardized on `current_password` per Addendum 3 Item 4; returns new `access` token in JSON body and sets refresh token exclusively in `httpOnly` cookie. |
| Capability field `supports_courses` | `uses_courses` in Addendum 1 | `supports_courses` | Renamed via data-preserving `RenameField` migration `0006` and removed duplicate property aliases (`has_table_management`, `supports_courses`) so model and OpenAPI schema expose 15 canonical fields. |
| Food Court model | Mall multi-vendor settlement vs. counter stall | Counter-style stall (`FOOD_COURT_COUNTER` service areas, `uses_tables=False`, `uses_token_numbers=True`, `PAY_FIRST`, `ORDER_DIRECT`, tokens per counter) | Multi-vendor mall operator cart/settlement is deferred to a future milestone (documented in ADR 0005). |
| Refresh endpoint | `/api/v1/auth/refresh/` + `/api/v1/auth/token/refresh/` | Single `/api/v1/auth/refresh/` | Removed duplicate alias so the API surface has one canonical route per operation. |
| QR deactivation endpoint | `DELETE /api/v1/qr-codes/{id}/` + `POST /api/v1/qr-codes/{id}/deactivate/` | Single `DELETE /api/v1/qr-codes/{id}/` returning `204 No Content` | Removed duplicate POST action; `DELETE` soft-deactivates the QR code (`is_active=False`) and returns 204. |
| Host PostgreSQL port | `127.0.0.1:5432:5432` | Configurable `127.0.0.1:${POSTGRES_HOST_PORT:-5435}:5432` | Windows host runs native PostgreSQL 15/17/18 services on ports 5432, 5433, and 5434; configurable `POSTGRES_HOST_PORT` (default 5435) binds Docker's PostgreSQL 16 to loopback without conflicting with host OS services. |


---

## 7. Orders, Invoices, Reports & Audit Trail Endpoints (v0.8.0)

| Method | Endpoint | Allowed Roles | Description |
|---|---|---|---|
| `POST` | `/api/v1/orders/` | OWNER, BRANCH_MANAGER, CASHIER, WAITER | Place kitchen order ticket; authoritative server-side pricing snapshots line items. |
| `GET` | `/api/v1/orders/` | OWNER, BRANCH_MANAGER, CASHIER, WAITER, KITCHEN | Query orders. Query params: `branch_id`, `status`, `workflow`, `session_id`, `date`, `q`. |
| `GET` | `/api/v1/orders/{id}/` | OWNER, BRANCH_MANAGER, CASHIER, WAITER, KITCHEN | Retrieve order ticket details, line items, and audit transition events. |
| `POST` | `/api/v1/orders/{id}/cancel/` | OWNER, BRANCH_MANAGER | Cancel order. Payload requires `{"reason": "..."}`. Logs `OrderEvent`. |
| `POST` | `/api/v1/orders/{id}/serve/` | OWNER, BRANCH_MANAGER, WAITER | Transition READY order to SERVED. |
| `GET` | `/api/v1/orders/kds/` | OWNER, BRANCH_MANAGER, KITCHEN | Active KDS kitchen display queue filtered by optional `station`. |
| `POST` | `/api/v1/orders/kds/{id}/bump/` | OWNER, BRANCH_MANAGER, KITCHEN | Bump bar progression: PLACED -> PREPARING -> READY -> SERVED. |
| `GET` | `/api/v1/orders/billing/session/{session_id}/` | OWNER, BRANCH_MANAGER, CASHIER | Compute authoritative bill breakdown (subtotal, lines, zero tax). |
| `POST` | `/api/v1/orders/billing/session/{session_id}/settle/` | OWNER, BRANCH_MANAGER, CASHIER | Settle table session bill, generate sequential invoice, mark session CLOSED, free table. |
| `POST` | `/api/v1/orders/billing/order/{order_id}/settle/` | OWNER, BRANCH_MANAGER, CASHIER | Settle counter/token order directly. |
| `GET` | `/api/v1/invoices/` | OWNER, BRANCH_MANAGER, CASHIER | History of settled invoices & receipts. Filters: `date`, `payment_method`, `q`. |
| `GET` | `/api/v1/invoices/{id}/` | OWNER, BRANCH_MANAGER, CASHIER | Retrieve specific invoice with line item snapshots. |
| `GET` | `/api/v1/reports/today/` | OWNER, BRANCH_MANAGER | Real-time sales, order counts, payment split, and top 5 items. |
| `GET` | `/api/v1/audit-logs/` | PLATFORM_ADMIN, OWNER, BRANCH_MANAGER | Sanitized, append-only operational audit trail (passwords & tokens redacted). |
| `PATCH` | `/api/v1/auth/me/` | Any Authenticated | Self-service profile update (`full_name`, `phone`). |
| `GET` | `/api/v1/platform/summary/` | PLATFORM_ADMIN only | Platform health, tenant count, plan distribution. Zero tenant-data leakage. |
