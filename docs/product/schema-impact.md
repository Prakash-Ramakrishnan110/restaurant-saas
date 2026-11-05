# ServeMyFood: Database Schema Impact Analysis

## 1. Overview & Architectural Principles
All future database schema additions adhere strictly to the foundational architectural standards proven in v0.2.7 / v0.3.3:
1. **Shared-Database Multi-Tenancy**: All domain tables inherit `TenantModel` with non-nullable `tenant_id` foreign keys indexed with `db_index=True`.
2. **Integer Monetary Fields**: All monetary values (prices, subtotals, taxes, discounts, totals) are stored as 64-bit integer paise (`BigIntegerField` or `PositiveIntegerField`) to prevent IEEE 754 floating-point inaccuracies.
3. **Optimistic Locking & State Audit**: High-contention entities (Orders, Shifts, Cash Drawers) utilize `version` fields for optimistic locking, with all state changes audited in `AuditLog`.

---

## 2. Upcoming Schema Additions for Pilot 1

### A. Orders & Fulfilment Domain (`apps.orders`)
```sql
-- Core Order Aggregate Root
CREATE TABLE orders_order (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants_tenant(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES venues_branch(id) ON DELETE CASCADE,
    order_type VARCHAR(32) NOT NULL, -- DINE_IN, TAKEAWAY, DELIVERY
    status VARCHAR(32) NOT NULL,     -- DRAFT, PLACED, PREPARING, READY, SERVED, COMPLETED, CANCELLED
    table_session_id UUID REFERENCES venues_tablesession(id) ON DELETE SET NULL,
    daily_token_number INTEGER,      -- Populated for TAKEAWAY via COUNTER_TOKEN sequence
    server_staff_id UUID REFERENCES users_user(id) ON DELETE SET NULL,
    subtotal_paise BIGINT NOT NULL DEFAULT 0,
    discount_paise BIGINT NOT NULL DEFAULT 0,
    tax_paise BIGINT NOT NULL DEFAULT 0,
    total_paise BIGINT NOT NULL DEFAULT 0,
    special_instructions TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_orders_tenant_status ON orders_order(tenant_id, status);
CREATE INDEX idx_orders_branch_created ON orders_order(branch_id, created_at);

-- Order Line Items
CREATE TABLE orders_lineitem (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants_tenant(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES orders_order(id) ON DELETE CASCADE,
    menu_item_id UUID NOT NULL REFERENCES menu_item(id),
    name_snapshot VARCHAR(255) NOT NULL,
    unit_price_paise BIGINT NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    total_price_paise BIGINT NOT NULL,
    course VARCHAR(32) NOT NULL DEFAULT 'MAIN', -- STARTER, MAIN, DESSERT, BEVERAGE
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING', -- PENDING, PREPARING, READY, SERVED, VOIDED
    station VARCHAR(32) NOT NULL DEFAULT 'MAIN_KITCHEN', -- KITCHEN, BAR, GRILL, DESSERT
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### B. Staff Shifts & Cash Management (`apps.staff`)
```sql
-- Cashier & Floor Staff Shifts
CREATE TABLE staff_shift (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants_tenant(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES venues_branch(id) ON DELETE CASCADE,
    staff_id UUID NOT NULL REFERENCES users_user(id) ON DELETE CASCADE,
    role VARCHAR(32) NOT NULL,
    opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at TIMESTAMPTZ,
    opening_float_paise BIGINT NOT NULL DEFAULT 0,
    expected_cash_paise BIGINT,
    actual_cash_paise BIGINT,
    variance_paise BIGINT,
    notes TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'OPEN' -- OPEN, CLOSED, RECONCILED
);
CREATE INDEX idx_shifts_tenant_staff ON staff_shift(tenant_id, staff_id, status);
```

### C. Cashier Invoices & Billing Settlements (`apps.billing`)
```sql
-- Tax Invoices
CREATE TABLE billing_invoice (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants_tenant(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES venues_branch(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES orders_order(id),
    invoice_number VARCHAR(64) NOT NULL, -- Continuous sequential per branch/financial year
    subtotal_paise BIGINT NOT NULL,
    cgst_paise BIGINT NOT NULL DEFAULT 0,
    sgst_paise BIGINT NOT NULL DEFAULT 0,
    service_charge_paise BIGINT NOT NULL DEFAULT 0,
    rounding_paise INTEGER NOT NULL DEFAULT 0,
    net_payable_paise BIGINT NOT NULL,
    payment_status VARCHAR(32) NOT NULL DEFAULT 'UNPAID', -- UNPAID, PARTIAL, PAID, REFUNDED
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_branch_invoice_num UNIQUE(branch_id, invoice_number)
);

-- Payment Transactions
CREATE TABLE billing_payment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants_tenant(id) ON DELETE CASCADE,
    invoice_id UUID NOT NULL REFERENCES billing_invoice(id) ON DELETE CASCADE,
    payment_method VARCHAR(32) NOT NULL, -- CASH, UPI_QR, CARD, SPLIT
    amount_paise BIGINT NOT NULL,
    reference_number VARCHAR(128),
    received_by_id UUID REFERENCES users_user(id),
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## 3. Migration Plan & Safety Guards
- All foreign keys enforce `ON DELETE CASCADE` for parent-tenant cascades and `ON DELETE PROTECT` or `SET NULL` for transactional records.
- Migrations will be executed in separate atomic batches with zero table locking downtime.
- Reverse migrations (`migrate <app> <prev_num>`) are verified in local CI before release.
