# ADR 0007: QR Code Security Model (Non-Guessable Tokens and Rotation)

## Status
Accepted

## Context
Dine-in QR code ordering systems are susceptible to critical security vulnerabilities:
1. **Enumeration & Guessable Tokens**: Predictable URLs like `/qr/table/1` or sequential integers allow malicious users to view menus, open tabs, or place unauthorized food orders for other tables without physical presence.
2. **Photograph Staling & Remote Ordering**: A customer photographs the physical table sticker, departs the restaurant, and later places prank orders from outside the premises.
3. **Data Leakage**: Public QR scan endpoints must not leak internal database IDs, tenant metadata, or other active diners' sensitive details.

## Decision
We enforce a multi-layered cryptographic and operational security model for QR codes:
1. **Cryptographically Secure Tokens**:
   - QR code tokens are generated using Python's `secrets.token_urlsafe(24)` (providing 144 bits of entropy).
   - URLs point to `https://<domain>/qr/<public_token>`.
2. **Non-Guessable Token Lookup**:
   - The public endpoint (`GET /api/v1/public/qr/<token>/`) resolves tokens without authentication using an approved, isolated unscoped query (`get_public_qr_code(token)`).
   - If the token is invalid or deactivated (`is_active=False`), a 404 is returned immediately.
3. **Strict Information Minimization**:
   - Public scan returns only: `tenant_name`, `tenant_logo_url`, `branch_name`, `area_name`, `table_label`, `ordering_mode`, `active_session_status`, `can_open_session`, and `open_table_requires_staff`.
   - Never exposes internal primary keys (UUIDs), sales data, staff names, or pricing tiers.
4. **Token Rotation & Deactivation**:
   - Staff can rotate table QR codes at any time via `POST /api/v1/qr-codes/<id>/rotate/`.
   - Rotation increments the version, generates a brand new token, updates `rotated_at`, logs an audit entry, and immediately invalidates the previous token.
   - Previous photo captures or cached URLs cease functioning instantly.
5. **Session Cryptographic Proof**:
   - When a public customer opens an allowed session via `POST /api/v1/public/qr/<token>/session/`, the backend issues a signed HMAC token using Django's `TimestampSigner(salt="qr-session")`.
   - Subsequent ordering actions authenticate with this token to prove session ownership.
6. **Rate Limiting**:
   - Public QR endpoints are bound by `AnonRateThrottle` (100 requests per minute per IP) to mitigate brute-force attempts.

## Consequences
### Positive
- Zero possibility of sequential table scanning or automated enumeration attacks.
- Instant mitigation for compromised stickers via one-click staff rotation.
- Secure, frictionless customer onboarding without requiring mandatory customer sign-in apps or accounts.

