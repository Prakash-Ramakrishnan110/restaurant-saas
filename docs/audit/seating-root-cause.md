# Root Cause Analysis: `waiter-seating-live` Timeout on `/pos`

Date: 2026-11-15

## Summary

The `waiter-seating-live.spec.ts` Playwright test timed out waiting for `button:hasText("Free")` (`timeout: 10000`) due to two compounding causes — **not** a regression of `BUG-001`:

1. **Test Isolation Leak (State Exhaustion)**: `waiter-seating-live.spec.ts` opened live dining sessions on `The Grand Kaveri Cafe` (12 seeded tables `T1`–`T12`) across both `chromium` and `mobile` projects without closing sessions or resetting tables in `afterEach`. After repeated runs, all 12 tables remained `OCCUPIED` or `CLEANING`, leaving zero `Free` buttons on `/pos`.
2. **UI Load Blocking in `FloorPOSPage.tsx`**: Even when tables were `AVAILABLE`, `FloorPOSPage.tsx` awaited `Promise.all` across 7 endpoints (`/tables/`, `/menu/categories/`, `/menu/items/`, `/sessions/`, `/orders/service-requests/`, `/menu/availability/`, `/orders/`) before calling `setTables(tblData)`. Under E2E load against single-process `manage.py runserver`, that combined wait could exceed 10s, leaving the `Floor Tables` section empty when the 10s assertion expired.

---

## Diagnostic Answers (Evidence)

### (a) Does seating guests work by hand on `/pos` at a 390 px phone viewport against the real backend?

**Yes.**
- Direct API verification against `fusion_backend` (`http://localhost:8000/api/v1/`) as `waiter@kavericafe.com`:
  - `POST /api/v1/auth/login/` -> `200 OK` (`2525.1 ms`)
  - `GET /api/v1/tables/` -> `200 OK` (`2171.8 ms`, 12 tables returned)
  - `POST /api/v1/table-sessions/open/` -> `201 Created` (`2152.9 ms`)
- Playwright verification at `390x844` (`frontend/e2e/waiter-seating-live.spec.ts`, `"Waiter seats guests on /pos at 390px phone viewport against real backend"`): **PASS** (`3.1s` Desktop project, `2.6s` Mobile project).

### (b) Does the audit bug `BUG-001` still exist?

**No.**
- `docs/audit/DELTA.md` records `BUG-001` as fixed.
- `backend/apps/venues/views.py` (`TableSessionViewSet`) exposes `@action(detail=False, methods=["post"], url_path="open")` without the old broken `create()` calling `self.open()`.
- `frontend/src/pages/orders/FloorPOSPage.tsx` posts to `/table-sessions/open/` and opens the dining session cleanly (`201 Created`).

### (c) Which earlier tests leave tables `OCCUPIED` or sessions `OPEN`?

- `frontend/e2e/waiter-seating-live.spec.ts` (both `chromium` and `mobile` runs) was the **only** unstubbed E2E spec mutating `The Grand Kaveri Cafe` tables (`waiter@kavericafe.com`), and it had no `afterEach` cleanup.
  - Evidence from failed run `task-29838` (`error-context.md`): all 12 buttons on `/pos` rendered as `T1 Cleaning` through `T12 Cleaning`.
- `frontend/e2e/demo-journey.spec.ts` and `frontend/e2e/screenshots.spec.ts` stub `/api/v1/tables` and `/api/v1/table-sessions` via `page.route(...)`.
- `frontend/e2e/public-qr-ordering.spec.ts` targets `Spice Garden` (`owner@spicegarden.com`) and cleans up its own sessions in `beforeEach`.

### (d) Is the table list request slow or failing (status codes, timings)?

- `GET /api/v1/tables/` returns **`200 OK`** (`0.42s`–`1.30s` in `fusion_backend` logs; `2171.8 ms` standalone).
- It is **not failing**, but `FloorPOSPage.tsx` previously delayed `setTables(tblData)` until all 7 `Promise.all` requests completed (`/menu/items/` up to `1.61s`, `/orders/` up to `1.02s`, plus `AppShell` requests `/business/`, `/announcements/`, `/support-tickets/`, `/menu/availability/`).
- Evidence from failed run `task-30017` (`waiter-seating-live-...-mobile/error-context.md`): `Floor Tables` heading rendered with 0 table buttons and `All Items` only (data still in flight at 10s).

---

## Fixes Applied

1. **`frontend/src/pages/orders/FloorPOSPage.tsx`**: Updated `fetchData()` so `setTables(data)` executes immediately when `GET /tables/` resolves, rather than waiting for all 7 endpoints in `Promise.all`.
2. **`backend/apps/core/management/commands/reset_e2e_state.py`**: Added a `DEBUG`/`TEST`-guarded management command that closes `OPEN` `TableSession`s and resets non-`AVAILABLE` `DiningTable`s to `AVAILABLE`.
3. **`frontend/e2e/global-setup.ts` & `frontend/playwright.config.ts`**: Wired `globalSetup` to invoke `reset_e2e_state` automatically before every Playwright run (zero manual commands required).
4. **`frontend/e2e/waiter-seating-live.spec.ts`**: Added `afterEach` API cleanup (`POST /sessions/<id>/close/` + `POST /tables/<id>/status/` -> `AVAILABLE`) and added an explicit `390x844` phone viewport seating test.
