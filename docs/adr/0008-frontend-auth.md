# ADR 0008: Frontend Authentication, Session Management, and Security Model

## Status
Accepted

## Context
Restaurant management applications handle sensitive operational data, staff roles, and financial records across shared devices (e.g. counter POS tablets, manager workstations). Client-side authentication must guard against Cross-Site Scripting (XSS), token theft, concurrent request races, and unauthorized cross-tenant operations.

## Decisions

### 1. In-Memory Access Token Storage
- **Decision**: The short-lived JWT access token (15-minute lifetime) is stored **strictly in application memory** (within a React context module state).
- **Rule**: Access tokens are NEVER stored in `localStorage`, `sessionStorage`, `indexedDB`, or non-httpOnly browser cookies.
- **Security Rationale**: In the event of an XSS vulnerability, an attacker cannot extract or exfiltrate the access token from persistent storage APIs.

### 2. httpOnly Rotating Refresh Token Cookie
- **Decision**: Refresh tokens are stored exclusively in an `httpOnly`, `Secure` (in production/HTTPS), `SameSite=Lax` cookie named `fusion_refresh_token`.
- **Rule**: JavaScript running in the browser cannot read, copy, or manipulate the refresh cookie.
- **Rotation**: Every successful call to `POST /api/v1/auth/refresh/` blacklists the old refresh token, issues a new short-lived access token in the JSON response body, and sets a new rotated refresh token in the `httpOnly` cookie.

### 3. Single-Flight Refresh Mutex Pattern
- **Decision**: All API requests pass through an HTTP interceptor client (`src/api/client.ts`).
- **Race Condition Prevention**: When multiple parallel asynchronous requests encounter HTTP 401 Unauthorized (e.g. 5 parallel API calls when the access token expires), they MUST NOT fire 5 independent refresh calls.
- **Implementation**: A single refresh Promise mutex is instantiated on the first 401. Subsequent 401s latch onto this pending promise. Exactly **one** refresh request is dispatched to `/api/v1/auth/refresh/`. Upon resolution, the new access token is distributed to all queued requests and they are replayed seamlessly without user interruption.

### 4. Origin & CORS Security
- The refresh endpoint enforces strict `Origin` header validation against `CORS_ALLOWED_ORIGINS` and `CSRF_TRUSTED_ORIGINS`. Untrusted origins receive HTTP 403 `INVALID_ORIGIN`.

### 5. Session Termination & Logout Contract
- `POST /api/v1/auth/logout/` operates with `AllowAny` permissions and requires only the refresh cookie.
- It blacklists the refresh token in Redis/DB, instructs the browser to delete the cookie via `Max-Age=0`, wipes in-memory access tokens, and returns HTTP 204 No Content.
- Even if the token is already expired or invalid, logout always succeeds and wipes client state.

### 6. Enforced Password Change Gate
- First-time staff members are assigned a temporary password with `must_change_password = true`.
- The frontend auth state synchronizes with `/api/v1/auth/me/`. If `user.must_change_password` is `true`, all navigation is forcibly intercepted and redirected to `/change-password` until a new secure password is established.

### 7. Tenant Scoping Header
- Every authenticated API call automatically attaches the active tenant UUID via the `X-Tenant-ID` header.
- Switching active branches or tenants updates this header and re-fetches user permissions.
