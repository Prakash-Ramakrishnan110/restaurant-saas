# ADR 0027: Scale & Polish — Multi-Outlet Consolidated Analytics, Inter-Branch Transfers, Purchase Orders, Guest Loyalty & Bilingual Accessibility (Stage D)

- **Status:** Accepted
- **Date:** 2026-11-21
- **Stage:** Stage D (`v1.5.0-scale-d`)

## Context

As single-outlet restaurants expand into multi-branch groups on ServeMyFood, owners and managers need:
1. **Consolidated Multi-Outlet Analytics & Inter-Branch Stock Transfers (`D1`)**: A single side-by-side financial and inventory performance view across all branches (`Gross Sales`, `Refunds`, `Net Sales`, `COGS`, `Gross Margin`, `Wastage`, `Order Count`, `Average Ticket`), paired with an audited inter-branch stock transfer workflow (`DRAFT -> APPROVED (Dispatched) -> COMPLETED (Received)`) that posts append-only `TRANSFER_OUT` and `TRANSFER_IN` stock movements while preserving Weighted Average Cost (WAC) valuation.
2. **Purchase Orders & One-Click Convert to Goods Receipt (`D2`)**: Formal supplier Purchase Orders (`DRAFT -> SENT -> PARTIAL / RECEIVED`) with one-click auto-drafting from low-stock items and one-click conversion into an inward `GoodsReceipt` with automatic price-jump alerts when supplier unit costs rise beyond the branch threshold (`15%`).
3. **Guest Loyalty Points & Phone Lookup at Billing (`D3`)**: Consent-gated guest loyalty points (`1 point earned per ₹100 / 10,000 paise spent`, `1 point redeemed = ₹1 / 100 paise discount`) integrated directly into the guest directory (`/customers`) and the cashier billing checkout (`/billing`).
4. **100% EN/TA Translation Parity & Accessibility Hardening (`D4`)**: Complete English (`en`) and Tamil (`ta`) translation key parity with zero developer jargon, and zero serious/critical WCAG 2.1 AA (`vitest-axe`) violations across operational and scale screens.

## Decisions

### 1. Multi-Outlet Consolidated Report & Inter-Branch Stock Transfers (`D1`)
- `get_outlets_report` in `backend/apps/orders/services.py` aggregates per-branch metrics across all active branches of the tenant:
  - `gross_sales_paise`, `refunds_paise`, `net_sales_paise` (`max(0, gross - refunds)`).
  - `cogs_paise` (`SUM(ABS(value_paise))` across `SALE_USAGE`, `PRODUCTION_USAGE`, `PACKAGING_USAGE`).
  - `wastage_paise` (`SUM(ABS(value_paise))` across `WASTE` movements).
  - `gross_margin_paise` (`net_sales_paise - cogs_paise`) and `gross_margin_percent`.
- Inter-branch transfers use `StockTransfer` and `StockTransferLine`:
  - `create_stock_transfer` creates a `DRAFT` transfer between two distinct branches of the same tenant.
  - `dispatch_stock_transfer` (`POST /api/v1/inventory/transfers/<id>/dispatch/`) atomically locks the transfer, posts append-only `TRANSFER_OUT` movements on `from_branch` at the source branch's current WAC, and transitions the transfer to `APPROVED` (In-Transit / Dispatched).
  - `receive_stock_transfer` (`POST /api/v1/inventory/transfers/<id>/receive/`) atomically locks the transfer, reads the source `TRANSFER_OUT` unit cost, posts append-only `TRANSFER_IN` movements on `to_branch` (recalculating destination WAC), and transitions the transfer to `COMPLETED`.

### 2. Purchase Orders & One-Click Goods Receipt Conversion (`D2`)
- `PurchaseOrderViewSet` (`/api/v1/inventory/purchase-orders/`) supports:
  - Creating a `PurchaseOrder` with nested `PurchaseOrderLine` items and integer paise costs.
  - `POST /api/v1/inventory/purchase-orders/auto-draft-low-stock/` to auto-populate a `DRAFT` PO from items below `reorder_level`.
  - `POST /api/v1/inventory/purchase-orders/<id>/send/` to transition `DRAFT -> SENT`.
  - `POST /api/v1/inventory/purchase-orders/<id>/receive/` to convert the PO into a `GoodsReceipt` via `create_goods_receipt`, compare each received unit cost against the item's previous WAC to surface `price_jump_alerts` when the increase exceeds `price_jump_alert_percent` (`15%`), update `quantity_received` per line, and transition the PO to `PARTIAL` or `RECEIVED`.

### 3. Consent-Gated Guest Loyalty Points & Billing Phone Lookup (`D3`)
- `Customer` stores `loyalty_points`, `lifetime_points_earned`, and `lifetime_points_redeemed` (all non-negative integers).
- Earning and redeeming points strictly requires `customer.consent_given == True`:
  - **Earn rule:** `earned_points = net_bill_paise // 10000` (1 point per ₹100 settled).
  - **Redeem rule:** `1 point = 100 paise` (₹1.00) added to `discount_paise` during `settle_bill`, capped at available `customer.loyalty_points` and bill subtotal.

## Consequences
- All monetary values and inventory valuations remain 100% integer paise (`_paise`) and `Decimal(14,3)` base quantities with zero floating-point arithmetic.
- All stock transfers and PO receipts post through `post_stock_movement`, preserving the invariant `StockLevel.quantity == SUM(StockMovement.quantity)`.
