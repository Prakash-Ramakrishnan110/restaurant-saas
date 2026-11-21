# ADR 0025: Stage B Operational Hardening — Shift Handover, Partial Refunds, Split/Merge Tables & Thermal Printer Bridge

- **Status:** Accepted
- **Date:** 2026-11-21
- **Stage:** Stage B (`v1.3.0-ops-b`)

## 1. Context & Problem Statement

Daily restaurant and tea-shop operations require four financial and floor-control safeguards beyond happy-path order taking and full-bill settlement:

1. **Shift Cash Handover (Blind Count & Cash Movements):** If a cashier sees the system's expected cash total before entering their drawer count, they can type the expected number and pocket any overage or hide a shortage. Mid-shift cash movements (opening float additions, safe drops, petty cash payouts, cash refunds) must also be tracked and locked once a shift is closed.
2. **Partial Refunds & Bill Adjustments:** After a bill is settled, a guest may return a dish, report a quality issue, or point out an overcharge. Mutating `BillInvoice.total_paise` corrupts historical audit trails. Refunds must be append-only records with mandatory reason codes, cumulative total guards, manager approval thresholds, and separate `Gross Collected | Refunds | Net Collected` reporting.
3. **Split & Merge Tables / Move Items:** Guests frequently ask to split a bill equally across $N$ diners or by specific items, move dishes to another table, or combine two open tables into one bill. Integer paise math must guarantee that an $N$-way split sums to the exact invoice total with zero lost or invented paise.
4. **Thermal Printer & Hardware Bridge:** Restaurants use `80mm` (`72mm` printable) and `58mm` (`48mm` printable) thermal printers for Kitchen Tickets (KOT), Customer Bills, Token Slips, Shift Z-Slips, and Refund Slips. Browser printing must work out-of-the-box with zero drivers, while supporting an optional local ESC/POS HTTP/WebSocket bridge (`127.0.0.1:9100`) that falls back cleanly to browser print when offline.

## 2. Decisions

### B1. Shift Cash Handover (`CashierShiftCloseout` & `CashMovement`)

- **`CashierShiftCloseout` lifecycle:**
  - `status`: `OPEN` -> `CLOSED` (`is_locked=True`).
  - While `status == "OPEN"`, `GET /api/v1/orders/shifts/current/` masks `expected_cash_paise` and `cash_variance_paise` (`null`) to enforce a **blind count**.
  - Expected cash formula (all integer paise):
    $$\text{expected\_cash\_paise} = \text{opening\_cash\_paise} + \text{cash\_sales\_paise} + \text{cash\_in\_paise} - \text{cash\_out\_paise} - \text{cash\_refunds\_paise}$$
  - When closing the shift (`POST /api/v1/orders/shifts/close/`), the cashier submits `actual_cash_paise` and optional `denominations_snapshot` (`₹2000`, `₹500`, `₹200`, `₹100`, `₹50`, `₹20`, `₹10`, `coins`).
  - If $|\text{actual\_cash\_paise} - \text{expected\_cash\_paise}| > \text{variance\_threshold\_paise}$ (default `10000` paise = ₹100.00), a `variance_reason_code` (`CHANGE_ERROR`, `FLOAT_ERROR`, `DROP_MISSING`, `OTHER`) is mandatory.
  - Once closed, `is_locked = True`; any attempt to post a `CashMovement` or re-close the shift returns `400 SHIFT_LOCKED`.
- **`CashMovement` (append-only):**
  - Types: `FLOAT_IN`, `CASH_DROP`, `PETTY_CASH_OUT`, `REFUND_CASH_OUT`.
  - All amounts are positive integer paise (`BigIntegerField`).

### B2. Partial Refunds & Bill Adjustments (`InvoiceRefund`)

- **Append-only `InvoiceRefund` model:**
  - Linked to `BillInvoice` via `PROTECT`. `BillInvoice.total_paise` is **never** modified after settlement.
  - Sequential `refund_number` (`RFD-YYYYMM-XXXX`).
  - Mandatory `reason_code`: `ITEM_RETURNED`, `QUALITY_ISSUE`, `WRONG_ITEM`, `OVERCHARGED`, `CUSTOMER_CANCELLED`.
  - Optional `restock_action`: `NONE`, `RESTOCK`, `WASTE`.
  - **Cumulative invariant:**
    $$1 \le \text{amount\_paise} \le \text{invoice.total\_paise} - \sum \text{existing\_refunds.amount\_paise}$$
  - **Role & threshold guard:** Refunds above `50000` paise (₹500.00) require `OWNER` or `BRANCH_MANAGER` role (`403 MANAGER_APPROVAL_REQUIRED` for `CASHIER`).
  - **Reporting:** Daily and date-range reports expose `gross_sales_paise` (aliased to `sales_paise`), `refunds_paise`, and `net_sales_paise = gross_sales_paise - refunds_paise`.

### B3. Split & Merge Tables / Move Items

- **Equal $N$-way split integer paise invariant:**
  - Given `total_paise` and $N \ge 2$:
    - $\text{base} = \lfloor \text{total\_paise} / N \rfloor$
    - $\text{rem} = \text{total\_paise} - \text{base} \times N$
    - Share 1 receives $\text{base} + \text{rem}$; Shares $2 \dots N$ each receive $\text{base}$.
    - $\sum_{i=1}^{N} \text{share}_i = \text{total\_paise}$ with zero rounding drift.
- **Itemized split:** Computes exact paise subtotals for selected `OrderItem` IDs versus remaining items.
- **Move items between open sessions:** Moves selected `OrderItem` rows from `source_session` to an open `Order` on `target_session`, logging `OrderEvent` and `AuditLog`.
- **Merge open sessions:** Reassigns all active orders from `source_session` to `target_session`, marks `source_session` `CLOSED`, frees `source_session.table` to `AVAILABLE`, and logs `OrderEvent` + `AuditLog`.

### B4. Thermal Printer & Hardware Bridge

- **5 Standardized Thermal Templates (`80mm` and `58mm`):**
  1. Kitchen Ticket (`KOT`)
  2. Customer Bill (`"NOT A TAX INVOICE"`, zero tax/GST terms per ADR 0021)
  3. Counter Token Slip
  4. Shift Z-Slip
  5. Refund / Credit Slip (`"NOT A TAX INVOICE"`)
- **Local ESC/POS Bridge with Browser Fallback:**
  - When `LOCAL_BRIDGE` mode is configured, the client POSTs the structured print payload to `http://<ip>:<port>/print` with a 1.5s timeout and automatically falls back to browser print if unreachable.
