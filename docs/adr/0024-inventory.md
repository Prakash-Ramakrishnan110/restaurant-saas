# ADR 0024: Inventory Core Architecture (Stage A)

**Status:** Accepted  
**Date:** 2026-11-20  
**Target Tag:** `v1.2.0-inventory-a`

---

## Context
ServeMyFood needs a production-grade, multi-tenant, branch-aware inventory system that works cleanly across all Indian venue profiles (Tea Shop, Food Court, Bakery, Café, Casual Dining, Fine Dining, Hotel) without slowing down order taking, without introducing any tax/GST fields, and without floating-point errors.

A P3 prototype existed in `apps/inventory/` with mutable `StockTransaction` rows, tenant-wide `Ingredient.current_stock`, no branch locations, a prohibited `gstin` field on `Supplier`, no cost-hiding permission, and no post-commit order deduction. Rather than building a duplicate app, Stage A evolves `apps/inventory/` in-place into the full Inventory Core architecture.

---

## Architectural Decisions

### 1. Append-Only Stock Ledger & Recomputable Cached Levels
- **`StockMovement`** is strictly append-only at both the model (`save()` rejects updates, `delete()` raises `PermissionError`) and queryset (`update()` and `delete()` raise `PermissionError`) levels.
- **Movement Types (12):** `OPENING`, `PURCHASE`, `SALE_USAGE`, `PRODUCTION_IN`, `PRODUCTION_USAGE`, `WASTE`, `ADJUSTMENT`, `COUNT_VARIANCE`, `TRANSFER_OUT`, `TRANSFER_IN`, `SUPPLIER_RETURN`, `PACKAGING_USAGE`.
- Every movement records: `tenant`, `branch`, `location`, `item`, `movement_type`, signed `quantity` (`Decimal`, `NUMERIC(14,3)` in base unit), `unit_cost_paise` (snapshot), `value_paise` (whole paise, `ROUND_HALF_UP`), `reference_type`, `reference_id`, `reason_code`, `notes`, `actor`, `created_at`, and a strictly monotonic per-branch `sequence_number` assigned under row lock.
- **`StockLevel(branch, location, item)`** stores the cached `quantity` (`NUMERIC(14,3)`) and per-branch `weighted_avg_cost_paise` (`BigIntegerField`). It is always derivable from `SUM(StockMovement.quantity)` and verified via `python manage.py rebuild_stock_levels [--check]`.

### 2. Item Types, Units & Locations
- **`InventoryItem`**: UUID PK, tenant-scoped, audited. Fields: `name`, `name_ta`, `item_type` (`INGREDIENT`, `PREPARED`, `FINISHED`, `PACKAGING`, `SUPPLY`), `base_unit` (`g`, `ml`, `piece`), `category`, `barcode` (optional), `is_active`, `track_expiry`, `shelf_life_days`, `reorder_level`, `par_level`, `default_supplier`.
  - Constraints: unique `(tenant, name)`, `reorder_level <= par_level` (when `par_level > 0`).
- **`UnitConversion`**: `(item, unit_name, factor_to_base)` with `factor_to_base > 0` (`NUMERIC(14,6)`).
- **`StockLocation`**: per-branch (`STORE`, `KITCHEN`, `BAR`, `COUNTER`, `is_default`). Simple mode uses one hidden default location per branch.

### 3. Costing & Negative Stock
- **Weighted Average Cost (WAC):** Recomputed per `(branch, item)` on every `PURCHASE` receipt using `Decimal` arithmetic and `ROUND_HALF_UP` to integer paise. No `float` anywhere in `apps/inventory`.
- **Negative Stock:** Allowed (never blocks POS or QR ordering), displayed in red, and surfaced in read-time low/negative stock alerts.
- **No Tax Fields:** Zero tax rates, tax names, or tax columns in any model, serializer, CSV export, or UI string.

### 4. Post-Commit Order Deduction Engine & Packaging
- **Trigger:** When an order line first enters `PREPARING` or the order is `PAID` (whichever occurs first), `transaction.on_commit` enqueues an idempotent Celery task `deduct_order_line_stock.delay(order_line_id)`.
- **Idempotency:** `OrderLineStockDeduction` has a `OneToOneField` / unique constraint on `order_line`. Re-running deducts zero additional stock.
- **Recipe Snapshot & Scaling:** Deducts `quantity_per_portion * order_line.quantity * (1 + waste_percent / 100) / yield_portions` using the matching `(menu_item, variant)` recipe (falling back to `(menu_item, None)`), recursively expanding `PREPARED` items (cycle-checked on save).
- **Failure Isolation:** Exceptions are caught, logged onto `OrderLineStockDeduction(status=FAILED, error_message=...)`, never roll back or block the order, and appear in **Stock Health** with a one-click **Retry** action.
- **Cancellations:**
  - Cancelled before `PREPARING` (and before deduction): no deduction.
  - Cancelled after `PREPARING` (when deduction succeeded): creates a `WASTE` movement with `reason_code = CANCELLED_AFTER_COOKING`.
- **Takeaway Packaging:** Takeaway orders deduct configured `PACKAGING` items per order or per item via `PACKAGING_USAGE` movements.

### 5. Modes, Entitlements & Permissions
- **Branch Modes (`InventorySettings.mode`):**
  - `SIMPLE`: Stock, quick count, wastage, low-stock list, receiving. Default for `TEA_SHOP`, `FOOD_COURT`.
  - `STANDARD`: Adds recipes, deduction, costs/margins, suppliers. Default for `BAKERY`, `CAFE`, `RESTAURANT`, `FINE_DINING`.
  - `ADVANCED`: Adds batches with expiry, transfers, approvals, production. Default for `HOTEL`.
- **Plan Entitlements:** `inventory` (bool), `max_inventory_items` (int), `inventory_advanced` (bool).
- **Single RBAC Matrix:**
  - `inventory.view`: `OWNER`, `BRANCH_MANAGER`, `INVENTORY_MANAGER`, `KITCHEN` (quantities only)
  - `inventory.manage`: `OWNER`, `BRANCH_MANAGER`, `INVENTORY_MANAGER`
  - `inventory.receive`: `OWNER`, `BRANCH_MANAGER`, `INVENTORY_MANAGER`, `KITCHEN`
  - `inventory.waste`: `OWNER`, `BRANCH_MANAGER`, `INVENTORY_MANAGER`, `KITCHEN`, `CASHIER`
  - `inventory.count`: `OWNER`, `BRANCH_MANAGER`, `INVENTORY_MANAGER`, `KITCHEN`
  - `inventory.approve`: `OWNER`, `BRANCH_MANAGER`
  - `inventory.costs`: `OWNER`, `BRANCH_MANAGER` (cost/value/margin fields are **omitted** from API responses for all other roles)
  - `WAITER`: no inventory access.

### 6. Read-Time Alerts, Counts, Receiving & Reports
- **Alerts (computed on read):** low stock, negative stock, days of stock left (`14`-day average daily usage, shown only when `>= 7` days of usage data exist), expiring soon, failed deductions.
- **Receiving (`GoodsReceipt`):** optional supplier, purchase unit conversion, unit cost, optional batch/expiry, total paid in paise, duplicate `(supplier, invoice_number)` blocked unless `confirm_duplicate=true`.
- **Counts (`StockCount`):** full or category-filtered, blind count option, `DRAFT -> SUBMITTED -> APPROVED` (approval posts `COUNT_VARIANCE`). Adjustments exceeding `adjustment_approval_threshold_paise` require `inventory.approve` and a mandatory reason.
- **CSV Injection Defense:** Every CSV export and spreadsheet paste neutralizes leading `=`, `+`, `-`, `@` cells.
