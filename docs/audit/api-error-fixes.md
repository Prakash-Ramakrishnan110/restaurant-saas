# Unexpected API Error Fixes (`>= 400` in Playwright)

## Playwright Guard
- `frontend/e2e/fixtures.ts` (`attachApiErrorGuard`) records every `/api/` response with HTTP status `>= 400` and fails any test whose title does not explicitly mark a negative case.

## Fixed Call Sites

| Status Seen | Endpoint | Root Cause & File | Fix Applied |
| :--- | :--- | :--- | :--- |
| `401` | `GET /api/v1/support-tickets/` | `frontend/src/components/layout/AppShell.tsx` called `fetchTenantTickets()` on mount when `!user?.is_platform_admin`, which evaluated `true` before `user` finished signing in (`user === null`) and fired on every page load even when the support dialog was closed. | Guarded `fetchTenantTickets` with `if (!user || user.is_platform_admin) return;` and removed the unconditional mount `useEffect` so `/support-tickets/` is only fetched when `supportOpen && user && !user.is_platform_admin`. |
| `401` | `GET /api/v1/announcements/` | `frontend/src/components/layout/AppShell.tsx` evaluated `if (user?.is_platform_admin) return;` so it fired while `user` was `null`/unauthenticated. | Guarded with `if (!user || user.is_platform_admin) return;` so `/announcements/` waits until sign-in is complete. |
| `404` | `GET /api/v1/inventory/alerts/` | `frontend/src/pages/dashboard/DashboardPage.tsx` called `/inventory/alerts/` (an endpoint that does not exist in backend `apps/inventory/urls.py`) for the hidden P3 inventory widget. | Removed the `/inventory/alerts/` request and the hidden `Inventory & Stock Health` dashboard widget. |
| `401` | `GET /api/v1/inventory/ingredients/` | `frontend/src/pages/dashboard/DashboardPage.tsx` called `/inventory/ingredients/` for the hidden P3 inventory widget (and before `user` was guaranteed). | Removed the `/inventory/ingredients/` request from `DashboardPage.tsx`, added `if (!user || !activeTenant?.tenant_id) return;`, and removed `Inventory & Stock` from `navigation.ts`. |
| `401` | `GET /api/v1/reports/range/` | `frontend/src/pages/dashboard/DashboardPage.tsx` called `ordersApi.getRangeReport(...)` for the hidden 7-day historical revenue chart and CSV export. | Removed `ordersApi.getRangeReport(...)` and the hidden 7-day trend & CSV export cards from `DashboardPage.tsx`. |
| `401` | `GET /api/v1/orders/` | `frontend/src/components/layout/AppShell.tsx` polled `ordersApi.getOrders()` when `user?.is_platform_admin` was falsy (including `user === null`). | Guarded with `if (!user || user.is_platform_admin) return;` and added catch-all `/api/v1/**` mocks to route-mocked E2E specs so unmocked shell calls do not leak to the live backend with fake JWTs. |
| `403` | `GET /api/v1/business/` | `frontend/src/components/layout/AppShell.tsx` called `/business/` for all tenant roles including `WAITER` (who lacks `business.view` permission). | Guarded `/business/` with `OWNER` / `MANAGER` role check (`activeTenant` already supplies `business_type`, `venue_profile`, and `uses_tables`). |
| `403` | `GET /api/v1/menu/availability/` | `frontend/src/pages/orders/FloorPOSPage.tsx` called `/menu/availability/` on `/pos` load even for `WAITER` (who lacks `menu.availability` permission). | Guarded `/menu/availability/` with `OWNER` / `MANAGER` / `KITCHEN` role check. |
