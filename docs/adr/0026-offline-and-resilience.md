# ADR 0026: Stage C Offline & Resilience — IndexedDB Offline Queue, WebSocket Live Stream & Backup/Restore Health

- **Status:** Accepted
- **Date:** 2026-11-21
- **Stage:** Stage C (`v1.4.0-resilience-c`)

## 1. Context & Problem Statement

Restaurants and tea shops in India frequently experience brief broadband or Wi-Fi dropouts during peak service hours, as well as multi-device state updates across waiter phones, kitchen display screens (KDS), and cashier counters:

1. **Offline Floor & Counter Order Continuity:** When Wi-Fi drops for 30–180 seconds, waiters and counter staff must still view the active menu and tables and punch orders without losing tickets or double-firing them when connectivity returns.
2. **Real-Time Multi-Device Push with Graceful Fallback:** Kitchen KDS, Live Orders, and Floor POS need low-latency push updates (`order.created`, `order.status_changed`, `table.updated`, `menu.availability_changed`, `stock.alert`) via WebSockets, while automatically falling back to HTTP polling if a proxy or mobile network blocks WebSockets.
3. **Backup, Restore Drill & Owner Data Portability:** Production operations require automated custom-format PostgreSQL backups (`pg_dump -Fc` + SHA-256 checksum), automated restore drills verifying ledger invariants in an ephemeral database (`servemyfood_restore_drill`), and an Owner self-service ZIP data export (`GET /api/v1/settings/export-my-data/`).

## 2. Decisions

### C1. IndexedDB Read Cache & Idempotent Offline Order Queue

- **Read Cache (`servemyfood_offline_v1`):**
  - Caches active menu items, categories, tables, and open sessions per tenant in IndexedDB (with `localStorage` fallback).
  - When offline, `FloorPOSPage` hydrates from the local cache so waiters can continue browsing dishes and punching orders.
- **Offline Order Queue & Server Idempotency:**
  - Every queued order generates a client-side UUIDv4 `client_order_id` transmitted via the `Idempotency-Key` HTTP header (and `idempotency_key` payload field) to `POST /api/v1/orders/`.
  - `OrderViewSet.create` checks `Order.objects.filter(tenant=tenant, branch=branch, idempotency_key=idem_key).first()` before creating a new order. If found, it returns the existing `Order` (`200 OK`), guaranteeing **exact-once order creation** across retries.
  - If a queued order fails upon reconnect with `400 ITEM_UNAVAILABLE` (dish marked sold out while the waiter's device was offline), the queue entry transitions to `CONFLICT` with the unavailable `item_ids` and opens the **Offline Queue & Conflict Drawer** in `AppShell` so staff can remove sold-out items and retry or discard the ticket.
- **Honest Offline Boundaries:**
  - Offline mode only queues `CASH` / `PAY_LATER` waiter and counter orders. Digital payment verification, shift cash closeout, invoice refunds, and stock count approvals require live server connectivity.

### C2. Tenant-Scoped WebSocket Live Push + Polling Fallback

- **Endpoint:** `ws/v1/branch/<uuid:branch_id>/stream/?token=<jwt>`
- **Authentication & Isolation:**
  - `BranchStreamConsumer` validates the SimpleJWT access token and verifies that the user has an active `Membership` in `branch.tenant` (and branch access when branch-scoped).
  - Unauthenticated connections close with `4401`; cross-tenant or unauthorized branch connections close with `4403` before joining any group.
- **Channel Group & Events:**
  - Group name: `branch_<tenant_id>_<branch_id>`.
  - Canonical events: `order.created`, `order.status_changed`, `table.updated`, `menu.availability_changed`, `stock.alert`.
  - Heartbeat: Client sends `{"type": "ping"}` every 25s; server responds `{"type": "pong"}`.
  - Fallback: After 2 consecutive WebSocket connection failures, `BranchLiveStreamClient` switches to HTTP polling automatically.

### C3. Backup, Restore Drill & Owner Data Export

- **Scripts:**
  - `scripts/backup_db.ps1` & `scripts/backup_db.sh`: runs `pg_dump -Fc` and writes a `.sha256` manifest.
  - `scripts/restore_drill.ps1` & `scripts/restore_drill.sh`: restores the latest dump into ephemeral database `servemyfood_restore_drill`, verifies row counts and the stock ledger invariant (`StockLevel.quantity == SUM(StockMovement.quantity)`), and drops the drill database.
- **Owner Self-Service Data Export (`GET /api/v1/settings/export-my-data/`):**
  - Restricted to `OWNER` (`Permission.BUSINESS_MANAGE`).
  - Returns an `application/zip` attachment containing tenant-scoped CSVs (`branches.csv`, `menu_items.csv`, `orders.csv`, `invoices.csv`, `refunds.csv`, `inventory_items.csv`, `stock_movements.csv`, `customers.csv`) and `manifest.json`, with zero password hashes or secret tokens.
