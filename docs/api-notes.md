# Fusion Engine Restaurant SaaS - Frontend Developer API Guide

This document outlines the API contracts, architectural conventions, authentication patterns, error codes, and operational guidelines for building frontend interfaces against the Fusion Engine backend.

---

## 1. Base URL & Protocol
- **API Prefix**: `/api/v1/`
- **Health Checks**: `/health/`
- **Public Endpoints**: `/api/v1/public/qr/...` (no authentication required)
- **Protected Endpoints**: Require JWT Bearer token authentication and tenant scoping.

---

## 2. Authentication & Session Management

### 2.1 Login (`POST /api/v1/auth/login/`)
- Accepts `email` and `password`.
- Returns `access` token (short-lived, 15 min), user details, active tenant ID, and memberships.
- Sets an `httpOnly`, `Secure`, `SameSite=Lax` refresh cookie (`refresh_token`).

### 2.2 Token Refresh (`POST /api/v1/auth/refresh/`)
- Automatically reads the `httpOnly` refresh cookie (or accepts `{ "refresh": "..." }` in request body).
- Performs token rotation: issues a new access token and a new rotated refresh cookie; old refresh token is blacklisted.
- Validates origin header against allowed CORS origins.

### 2.3 Logout (`POST /api/v1/auth/logout/`)
- Works with refresh cookie or request body; blacklists the refresh token and clears the cookie.
- Returns HTTP 204 No Content even if token was already invalid.

### 2.4 Password Change (`POST /api/v1/auth/change-password/`)
- Authenticated endpoint requiring `old_password` and `new_password`.
- Validates password complexity via standard rules.
- Revokes all other active sessions (blacklists all user tokens).
- Clears `user.must_change_password` flag.
- Issues fresh access token and refresh cookie in response.

### 2.5 First-Time Staff Login Flow
- When a manager or owner invites a new staff member via `POST /api/v1/staff/`, the response contains `temporary_password` **once**.
- The staff user is created with `must_change_password: true`.
- On login, frontend should inspect `user.must_change_password`. If `true`, redirect user immediately to the Change Password screen.

---

## 3. Headers & Tenant Context

| Header | Description | Required |
|---|---|---|
| `Authorization` | `Bearer <access_token>` | For all protected endpoints |
| `X-Tenant-ID` | Target Tenant UUID | When user has memberships in multiple tenants |
| `Content-Type` | `application/json` | For all JSON requests |

---

## 4. Uniform Error Schema

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

### Standard Error Codes
| Code | HTTP Status | Description |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Field-level validation failed (e.g. required field missing). |
| `INVALID_REFERENCE` | 400 | Foreign or non-existent entity referenced in body (e.g. invalid table ID, section ID). Exactly identical to random non-existent UUIDs. |
| `INVALID_CAPABILITY_COMBINATION` | 400 | Incompatible branch capability configuration rejected. |
| `AUTHENTICATION_FAILED` | 401 | Invalid or expired credentials / tokens. |
| `PERMISSION_DENIED` | 403 | Missing RBAC permission for action. |
| `ENTITLEMENT_LIMIT_REACHED` | 403 | Tenant plan limit reached (e.g. table count, floor editor disabled). |
| `NOT_FOUND` | 404 | Resource does not exist or belongs to another tenant. |
| `TENANT_SUSPENDED` | 403 | Tenant account is suspended. |
| `RATE_LIMIT_EXCEEDED` | 429 | Request throttled. |

---

## 5. Venue Capabilities & Presets

- **Available Presets**: `GET /api/v1/venues/presets/` returns preset configurations for:
  `QUICK_SERVICE`, `CAFE`, `CASUAL_DINING`, `FINE_DINING`, `HOTEL_RESTAURANT`, `FOOD_COURT`, `BAR_BREWERY`.
- **Branch Capabilities**: `GET /api/v1/branches/{id}/capabilities/` and `PATCH /api/v1/branches/{id}/capabilities/`.
- **Capability Rules**:
  1. `COUNTER_TOKEN` workflow requires `uses_token_numbers=True`
  2. `TABLE_SERVICE` workflow requires `uses_tables=True`
  3. `ROOM_SERVICE` workflow requires `allows_room_service=True`
  4. `uses_courses=True` requires `uses_tables=True`
  5. `allows_room_charge=True` requires `payment_timing != PAY_FIRST`
  6. `qr_ordering_mode in ['ORDER_WITH_APPROVAL', 'ORDER_DIRECT']` requires `allows_qr_ordering=True`

---

## 6. Table & Floor Management

- **Service Areas**: `GET /api/v1/service-areas/`, `POST /api/v1/service-areas/`
- **Sections**: `GET /api/v1/sections/`, `POST /api/v1/sections/`
- **Dining Tables**: `GET /api/v1/tables/`, `POST /api/v1/tables/`
- **Bulk Creation**: `POST /api/v1/tables/bulk-create/`
- **Floor Editor Layout**: `POST /api/v1/tables/layout/` (batch update coordinates and dimensions)
- **Table Merge/Join**: `POST /api/v1/tables/join/` (combines 2+ tables into a `TableGroup`)
- **Table Split**: `POST /api/v1/tables/split/` (releases group back to individual tables)
- **Status Transitions**: `POST /api/v1/tables/{id}/status/` (`AVAILABLE`, `OCCUPIED`, `RESERVED`, `CLEANING`, `BLOCKED`)

---

## 7. QR Code Management & Public Diner Ordering

### Staff Management
- `POST /api/v1/qr-codes/generate/`: Idempotent endpoint. If an active QR code exists for the table/branch, returns it (200 OK); otherwise creates a new one (201 Created).
- `POST /api/v1/qr-codes/{id}/rotate/`: Cryptographically rotates public token, incrementing version and invalidating old token.
- `DELETE /api/v1/qr-codes/{id}/` or `POST /api/v1/qr-codes/{id}/deactivate/`: Deactivates QR code.
- `GET /api/v1/qr-codes/{id}/image/?format=png`: Generates high-res PNG or SVG QR image for physical printing.

### Public Customer Flow (No Auth Required)
- `GET /api/v1/public/qr/{token}/`: Resolves scanned QR token. Returns venue name, logo, table label, capabilities, and active session status.
- `POST /api/v1/public/qr/{token}/session/`: Opens a customer table session (if `qr_session_policy == CUSTOMER_CAN_OPEN`).

---

## 8. Entitlements & Subscription Usage

- `GET /api/v1/entitlements/`: Returns plan name, subscription status, limits (`max_branches`, `max_service_areas`, `max_tables`, `floor_editor`, `table_merge`, `courses`), current usage count, and remaining count.
- Frontend should query this to show usage warnings (e.g. "45/50 tables used") before hitting `ENTITLEMENT_LIMIT_REACHED`.

---

## 9. Business Profile

- `GET /api/v1/business/`: Retrieve active tenant profile and business settings.
- `PATCH /api/v1/business/`: Owner can update business name, type, phone, email, timezone, and branding (`invoice_prefix`, `logo_url`, `primary_color`, `tax_mode`).

