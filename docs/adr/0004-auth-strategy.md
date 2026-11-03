# ADR 0004: Authentication, Cookie Security, and RBAC Strategy

## Status
Accepted

## Context
Multi-tenant restaurant applications require high security:
- Staff login frequently from POS terminals, handheld tablets, and personal devices.
- Long-lived access tokens or tokens stored in `localStorage` are vulnerable to Cross-Site Scripting (XSS) credential theft.
- Role-based permissions must strictly isolate tenant data and respect branch boundaries.

## Decision
We implement a hybrid JWT authentication strategy:
1. **Short-Lived Access Tokens**:
   - 15-minute validity window.
   - Returned in response payload for standard `Authorization: Bearer <token>` API requests.
2. **HttpOnly, Secure Refresh Token Cookies**:
   - Refresh token is stored in an `httpOnly`, `Secure`, `SameSite=Lax` cookie restricted to the `/api/v1/auth/` path.
   - Inaccessible to client-side JavaScript, neutralizing token exfiltration via XSS.
   - **Rotation & Blacklisting**: Each token refresh issues a new refresh token and immediately blacklists the previous one (`token_blacklist`).
   - Logging out invalidates the token server-side and clears the cookie.
3. **Password Security**:
   - Primary password hashing uses Argon2 (`Argon2PasswordHasher`), which provides memory-hard protection against ASIC/GPU brute-force attacks.
4. **Anti-Enumeration & Throttling**:
   - Failed logins return identical generic error messages.
   - IP-level and email-level rate limiting throttles brute-force attempts.
   - All login attempts (success and failure) generate immutable `AuditLog` records.
5. **Multi-Tenant RBAC Matrix**:
   - Centralized in `apps.rbac.matrix.ROLE_PERMISSIONS`.
   - `HasTenantPermission` verifies active tenant standing, role permissions, and branch scoping.
   - Cross-tenant queries fail with `404 Not Found` rather than `403 Forbidden` to prevent object existence enumeration.

## Consequences
### Positive
- Robust defense against XSS, token replay, credential stuffing, and user enumeration attacks.
- High auditing visibility across all authentication actions.

### Negative / Trade-offs
- Refresh token endpoints require cookie support or CORS configuration with credentials enabled (`credentials: 'include'`).

