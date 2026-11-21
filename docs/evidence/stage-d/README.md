# Stage D Evidence — Scale & Polish (`v1.5.0-scale-d`)

## Summary of Capabilities & Visual Proof

1. **Multi-Outlet Consolidated Analytics & Inter-Branch Stock Transfers (`D1`)**:
   - `GET /api/v1/reports/outlets/` computes per-branch and group-level `Gross Sales`, `Refunds`, `Net Sales`, `COGS`, `Gross Margin (₹ & %)`, `Wastage`, and `Average Ticket`.
   - `/api/v1/inventory/transfers/` implements `DRAFT -> APPROVED (IN_TRANSIT) -> COMPLETED` inter-branch stock transfers posting append-only `TRANSFER_OUT` and `TRANSFER_IN` movements preserving WAC valuation (`multi-outlet-transfers.png`).
2. **Purchase Orders & One-Click Convert to Goods Receipt (`D2`)**:
   - `/api/v1/inventory/purchase-orders/` supports manual PO creation, `auto-draft-low-stock`, `send`, and one-click `receive` (converting the PO into an inward `GoodsReceipt`, updating stock levels & WAC, and flagging supplier price jumps `> 15%`) (`purchase-orders-grn.png`).
3. **Guest Loyalty Points & Phone Lookup at Billing (`D3`)**:
   - Consent-gated guest loyalty points (`1 pt earned per ₹100 / 10,000 paise`, `1 pt redeemed = ₹1 / 100 paise discount`) on `/customers` (`guest-loyalty-directory.png`) and `/billing`.
4. **100% EN/TA Translation Parity & Accessibility Hardening (`D4`)**:
   - Full English (`en`) and Tamil (`ta`) translation parity and zero serious/critical `vitest-axe` violations across Stage D screens.
