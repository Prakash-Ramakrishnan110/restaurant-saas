# QR Ordering Deliverables Checklist

| # | Deliverable / Requirement | Status | Evidence (Test / File) |
| :--- | :--- | :--- | :--- |
| 1 | `docs/audit/customer-order-state.md` and `docs/adr/0023-public-ordering.md` exist | PASS | `docs/audit/customer-order-state.md`, `docs/adr/0023-public-ordering.md` |
| 2 | Server price wins over tampered payload | PASS | `backend/apps/orders/tests/test_public_qr_ordering.py::test_server_pricing_wins_and_rejects_tampered_or_foreign` |
| 3 | Sold-out, hidden, and inactive items rejected | PASS | `backend/apps/orders/tests/test_public_qr_ordering.py::test_server_pricing_wins_and_rejects_tampered_or_foreign`, `test_public_menu_etag_and_no_hidden_items` |
| 4 | All four ordering modes behave as designed (`DISABLED`, `BROWSE_ONLY`, `ORDER_WITH_APPROVAL`, `ORDER_DIRECT`) | PASS | `backend/apps/orders/tests/test_public_qr_ordering.py::test_modes_staff_policy_approval_reject_and_pay_first`, `frontend/src/tests/public-qr-ordering.test.tsx`, `frontend/e2e/public-qr-ordering.spec.ts` |
| 5 | Pay-first branch: order waits (`AWAITING_PAYMENT`) until cashier pays | PASS | `backend/apps/orders/tests/test_public_qr_ordering.py::test_modes_staff_policy_approval_reject_and_pay_first`, `frontend/e2e/public-qr-ordering.spec.ts` |
| 6 | Approve and reject (reason required) | PASS | `backend/apps/orders/tests/test_public_qr_ordering.py::test_modes_staff_policy_approval_reject_and_pay_first` |
| 7 | Idempotency: repeated `Idempotency-Key` returns the same order | PASS | `backend/apps/orders/tests/test_public_qr_ordering.py::test_modes_staff_policy_approval_reject_and_pay_first` |
| 8 | Limits: 30 lines, qty 1–10, note lengths, 3 unfinished orders/session, 5 orders/10 min, throttles | PASS | `backend/apps/orders/tests/test_public_qr_ordering.py::test_abuse_limits_and_12h_tracking_expiry`, `test_public_qr_edge_cases_room_counter_session_and_plain_notes` |
| 9 | Tracking link cannot show another order or any staff data | PASS | `backend/apps/orders/tests/test_public_qr_ordering.py::test_modes_staff_policy_approval_reject_and_pay_first`, `test_public_qr_edge_cases_room_counter_session_and_plain_notes` |
| 10 | Role matrix and isolation tests for every new endpoint | PASS | `backend/apps/rbac/tests/test_role_endpoint_matrix.py`, `backend/apps/orders/tests/test_public_qr_ordering.py` |
| 11 | 30 concurrent orders on one table keep unique order numbers | PASS | `backend/apps/orders/tests/test_public_qr_ordering.py::test_concurrent_orders_unique_order_numbers` |
| 12 | Menu endpoint query count with 200 items | PASS | `backend/apps/orders/tests/test_public_qr_ordering.py::test_public_menu_query_count_200_items` |
| 13 | Notes stored as plain text and shown escaped | PASS | `backend/apps/orders/tests/test_public_qr_ordering.py::test_public_qr_edge_cases_room_counter_session_and_plain_notes` (plain text stored; React JSX text escaping in `PublicOrderTrackerPage.tsx`, `LiveOrdersPage.tsx`) |
| 14 | No token in `localStorage` on public pages | PASS | `frontend/src/tests/public-qr-ordering.test.tsx`, `frontend/e2e/public-qr-ordering.spec.ts` |
| 15 | Axe: zero serious violations on every customer page | PASS | `frontend/src/tests/public-qr-ordering.test.tsx` |
| 16 | Playwright flows: Kitchen KDS `QR` badge, Live Orders `Needs approval`, approval mode, pay-first token, browse-only, disabled & invalid token generic page, Tamil & dark screenshots, 360 px no horizontal scroll, foreign tracking token blocked | PASS | `frontend/e2e/public-qr-ordering.spec.ts` |
