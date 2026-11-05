# ADR 0017: Sales Reporting, Financial Auditing, and Cashier Close-Out

## Status
Accepted

## Context
Restaurant owners, managers, and accountants require bulletproof financial visibility at the end of each business day. This includes real-time sales performance, item velocity reports, split tax liabilities (CGST / SGST / VAT), and tamper-evident cashier close-out (X-Reports and Z-Reports).

## Decision

### 1. Daily Close-Out Reports (X vs Z Reports)
- **X-Report (Interim Audit)**: A mid-day, read-only snapshot of current sales, open tables, cash drawer totals, and category breakdown. Can be generated multiple times without closing any financial shift.
- **Z-Report (End-of-Day Final Close)**: The authoritative financial close-out for a business date:
  - Freezes all transactions for that business day.
  - Resets active cashier registers and archives daily sequential token counters.
  - Generates immutable financial summaries stored in `FinancialDayClose`.
  - Produces printable thermal summary for the owner's safe envelope.

### 2. Multi-Tax Breakdown
- Every finalized invoice computes and records exact tax liabilities in paise:
  $$\text{Invoice Total} = \text{Taxable Subtotal} + \text{CGST} + \text{SGST} + \text{Service Charge} + \text{Rounding}$$
- Rounding follows mathematical round-half-up to the nearest integer Rupee, recorded explicitly in `rounding_paise` so `Taxable + Taxes + Rounding` equals `Total Paid` down to the exact single paisa.

### 3. Void & Discount Governance
- Any line item or whole-ticket void after kitchen transmission requires a recorded reason (`MISTAKE_ENTRY`, `CUSTOMER_CHANGED_MIND`, `QUALITY_ISSUE`, `SPILLAGE`).
- Discretionary discounts exceeding configured thresholds (e.g., > 10%) require manager PIN authorization.
- Voided items are never deleted from the database; their status is updated to `VOIDED`, preserving full audit trails.

### 4. Owner Dashboard Aggregations
- Dashboard metrics (Gross Revenue, Net Sales, Average Order Value, Table Turn Time) are pre-aggregated using cached summary windows to ensure fast dashboard load times (< 200ms) without triggering expensive whole-table database scans during peak service.

## Consequences
- Guarantees complete auditability for chartered accountants and tax authorities.
- Prevents cashier discrepancies through systematic X/Z close-out controls.

