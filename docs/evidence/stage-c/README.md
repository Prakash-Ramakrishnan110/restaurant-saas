# Stage C Evidence — Offline & Resilience (`v1.4.0-resilience-c`)

## Summary of Capabilities & Visual Proof

1. **Offline-First Floor POS & Idempotent Replay (`C1`)**:
   - `frontend/src/utils/offlineQueue.ts` persists floor read cache (`tables`, `categories`, `menuItems`, `activeSessions`) and the FIFO offline order mutation queue (`IndexedDB` + `localStorage` fallback).
   - Every order submission attaches a client-generated UUID in the `Idempotency-Key` header (`POST /api/v1/orders/`).
   - Top-bar connection status pill (`Offline — N queued` / `Syncing...` / `Conflict (N)` / `Online`) opens the **Offline Order Queue & Sync Status** drawer (`offline-queue-drawer.png`).
2. **Real-Time WebSocket Push (`C2`)**:
   - `BranchStreamConsumer` (`ws/v1/branch/<branch_id>/stream/?token=<jwt>`) authenticates JWT & tenant membership (`4401` / `4403`), responds to 25-second `ping`/`pong` heartbeats, and broadcasts `order.created`, `order.status_changed`, `table.updated`, `menu.availability_changed`, and `stock.alert`.
   - `BranchLiveStreamClient` (`frontend/src/utils/liveStream.ts`) automatically falls back to HTTP polling after 2 failed WebSocket connections.
3. **Automated Encrypted Backups, Restore Drill & Owner Data Export (`C3`)**:
   - `scripts/backup_db.ps1` / `scripts/backup_db.sh` and `scripts/restore_drill.ps1` / `scripts/restore_drill.sh` perform a live `pg_dump` -> SHA-256 verification -> scratch database restore -> row-count parity verification (`restore-drill.txt`).
   - `GET /api/v1/settings/export-my-data/` exports a tenant-isolated ZIP archive (`branches.csv`, `menu_items.csv`, `orders.csv`, `invoices.csv`, `refunds.csv`, `inventory_items.csv`, `stock_movements.csv`, `customers.csv`, `manifest.json`) accessible from `/settings/account` (`data-export-account.png`).
