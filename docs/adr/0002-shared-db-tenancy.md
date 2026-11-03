# ADR 0002: Multi-Tenancy via Shared Database with Fail-Closed Isolation and Optional Row-Level Security (RLS)

## Status
Accepted

## Context
Multi-tenancy can be implemented via:
1. Separate database per tenant.
2. Separate PostgreSQL schema per tenant (django-tenants).
3. Shared database, shared schema, with `tenant_id` on every tenant-scoped table.

In a restaurant SaaS catering to thousands of restaurants across India, separate databases or schemas create significant operational overhead (running migrations across 10,000 schemas causes maintenance bottlenecks and high connection pool saturation).

## Decision
We adopt **Shared Database with Shared Schema and Mandatory `tenant_id` Foreign Keys**.

### Key Architectural Safeguards:
1. **Request-Scoped Tenant Context**:
   - Resolved via `X-Tenant-ID` header validated against authenticated user's active memberships.
   - Preserved in Python `contextvars` and automatically wiped clean at the end of each request lifecycle.
2. **Fail-Closed Custom Manager (`TenantManager`)**:
   - The default manager for all `TenantOwnedModel` instances automatically appends `.filter(tenant=current_tenant)`.
   - If no tenant context is established, it evaluates to `QuerySet.none()` (fails closed).
   - Only platform administrators and migrations explicitly access `unscoped`.
3. **Database-Level Composite Unique Constraints**:
   - All unique business constraints include `tenant_id` (e.g., `UniqueConstraint(fields=["tenant", "name"])`).
4. **Information Leakage Prevention**:
   - Unauthorized attempts to view cross-tenant objects return `404 Not Found` rather than `403 Forbidden`.

### Optional Future PostgreSQL Row-Level Security (RLS) Upgrade
While application-level fail-closed filtering provides robust isolation, PostgreSQL Native Row-Level Security (RLS) can be layered on for defense-in-depth:
```sql
ALTER TABLE tenants_branch ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants_branch FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON tenants_branch
AS RESTRICTIVE
USING (
    tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
    OR current_setting('app.is_platform_admin', true) = 'true'
);
```
Django middleware would set session settings upon acquiring a connection:
```python
with connection.cursor() as cursor:
    cursor.execute("SET LOCAL app.current_tenant_id = %s;", [str(tenant.id)])
```

## Consequences
### Positive
- Highly cost-effective and horizontally scalable to tens of thousands of tenants.
- Simple, instant database migrations across all tenants in a single migration run.
- Zero schema-switching overhead on connection pools (PgBouncer compatible).

### Negative / Trade-offs
- Developers must inherit from `TenantOwnedModel` and avoid bypassing `objects` without authorization.

