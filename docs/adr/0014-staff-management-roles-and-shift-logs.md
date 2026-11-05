# ADR 0014: Staff Management, Roles, and Shift Logs

## Status
Accepted

## Context
Restaurant staff operate in fast-paced shifts where terminal devices (waiter tablets, cashier POS) are shared among multiple employees. Floor staff require rapid, secure terminal switching (PIN-based) without full email/password re-authentication, alongside strict accountability for cash drawer floats and shift variances.

## Decision

### 1. Terminal Fast-Switching via Staff PIN
- Each staff member possesses a unique 4-digit or 6-digit cryptographic PIN hashed with Argon2id.
- On shared POS terminals, waiters and cashiers can lock the screen with one tap and switch users in under 2 seconds by entering their personal PIN.
- Fast-switching does not alter the underlying device's active tenant session, but tags all subsequent order mutations with the specific staff member's `operator_id`.

### 2. Shift Lifecycle & Cash Float Control
- **Shift Opening**: Cashiers must record their initial cash float (e.g., 2,000 INR paise) before taking any cash transactions.
- **Continuous Logging**: Cash in/out movements (paid-outs for ice, petty cash, change replenishment) are logged with mandatory textual notes.
- **Shift Closing**: Cashiers perform an end-of-shift physical cash count ("blind drop"). The system compares the entered count against recorded cash sales:
  - `Expected Cash = Opening Float + Sum(Cash Inflows) - Sum(Cash Outflows)`
  - `Variance = Counted Physical Cash - Expected Cash`
- Shifts cannot be reopened once closed. Variances exceeding pre-set thresholds trigger automated manager notifications and audit records.

### 3. Role-Based Permissions for Floor Staff
- `WAITER`: Can view floor layout, take orders, add items, trigger course firing, call kitchen, view their own active tables.
- `KITCHEN_STAFF`: Can view station KDS, bump tickets, mark 86 (out-of-stock) items.
- `CASHIER`: Can generate bills, apply standard discounts, settle payments, open/close cash shifts, print receipts.
- `MANAGER`: Can apply discretionary discounts, void kitchen-prepared items, transfer tables, override shift variances, view live floor metrics.
- `OWNER`: Full tenant administration, financial audits, branch settings, staff provisioning.

## Consequences
- Fast terminal switching prevents waiter queueing at peak dinner hours.
- Strict cash shift reconciliation eliminates end-of-day drawer discrepancies and internal theft risks.
