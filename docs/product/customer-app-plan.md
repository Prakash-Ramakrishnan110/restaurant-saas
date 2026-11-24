# Customer App Plan — Stage 1
**Author:** Agent  
**Date:** 2026-11-24  
**Tag target:** `v1.6.0-customer-app`

---

## Goal

Fix and improve the customer-facing QR ordering experience. The customer app spans:
- `/q/{token}` — `PublicQRPage` (menu, cart, place order)
- `/q/{token}/o/{trackingToken}` — `PublicOrderTrackerPage` (live tracker, bill)

Five deliverables in this stage.

---

## 1.1 — This Document

Defines the plan. All other sub-steps follow it.

---

## 1.2 — Header Fix (responsive + safe-area)

### Problem
`AppShell.tsx` (staff console header) and the customer tracker header (`PublicOrderTrackerPage`) both use fixed `px-4 py-3` padding with no provision for iOS notch / Android status bar. On devices with `env(safe-area-inset-top) > 0`, content slides under the status bar.

### Solution
- Add `pt-safe` / `pb-safe` using the Tailwind `safe-area` plugin (already in project if using `tailwindcss-safe-area`, else add via `@supports` CSS).
- Specifically fix the `<header>` in `PublicOrderTrackerPage` (the navy top bar) to use `padding-top: max(0.75rem, env(safe-area-inset-top))`.
- Also fix `AppShell.tsx` top nav bar similarly.
- Playwright device matrix: test at iPhone SE (375×667), iPhone 14 Pro (393×852 safe-area ~59px), Pixel 7 (412×915), Galaxy S21 (360×800), iPad (768×1024), desktop 1280×800.

### Rules checked
- Touch targets ≥ 56 px ✔ (height of nav bar stays ≥ 56 px)
- No horizontal scroll at 320 px ✔
- Dark mode works ✔
- axe zero serious violations ✔

---

## 1.3 — Bill Only After Payment

### Problem
`PublicOrderTrackerPage` renders the full printable-bill section (items + total + Print + Download) for ALL order statuses — even `PLACED` and `PREPARING`. A customer can download a bill before they have paid.

The downloaded HTML also says nothing about demo/tax status — Rule 2 violation.

### Solution

**Backend** (`public_views.py` — `PublicOrderTrackerView` & `PublicOrderReceiptView`):
- Add `show_bill: bool` to `PublicOrderTrackerView` — `True` only when `payment_status == "PAID"`.
- Add dedicated server-enforced endpoint `GET /api/v1/public/orders/<tracking_token>/receipt/`:
  - Returns generic `404` for invalid, oversized, expired (>12h), or suspended-tenant tokens.
  - Returns `403 BILL_NOT_PAID` if `payment_status != "PAID"`.
  - Returns `200` with `demo_notice: "DEMO RECEIPT - NOT A TAX INVOICE"`, server-computed whole-paise totals, zero tax lines, and zero staff/customer PII or notes.

**Frontend** (`PublicOrderTrackerPage.tsx`):
- Before payment: show order summary only (`Items in your order` + pending receipt notice); hide `customer-printable-bill`, print, and HTML download.
- After payment (`order.show_bill === true`): fetch `/receipt/` and render `<div data-testid="customer-printable-bill">` stamped with `DEMO RECEIPT - NOT A TAX INVOICE` (plus Tamil subtitle), `Save PDF / Print`, and `Download HTML`.

**OpenAPI** — update schema to document `show_bill` field.  
**Frontend types** (`publicQr.ts`) — add `show_bill: boolean` to `PublicOrderTrackerResponse`.

---

## 1.4 — Ready Alert on Tracker

### Problem
When a customer's order moves to `READY` (kitchen marks it done), the tracker page just updates the progress bar silently. The customer's screen may also be asleep.

### Solution

**`soundAlerts.ts`** — add `playReadyAlert()`:
- 3-note ascending chime: C5 (523 Hz) → E5 (659 Hz) → G5 (784 Hz), triangle wave, 120 ms per note
- Respects `isSoundEnabled()` and `getSoundVolume()`

**`PublicOrderTrackerPage.tsx`**:
1. Track previous `order.status` with a `useRef`.
2. On transition → `"READY"`: call `playReadyAlert()` + `navigator.vibrate([200, 100, 200])`.
3. Wake Lock: on page mount, call `navigator.wakeLock.request("screen")` and store handle. Release on unmount. Re-acquire on `visibilitychange` (browser releases it on tab hide). Do not crash if Wake Lock API is not supported.
4. All logic wrapped in try/catch — customer device may block audio or vibration.

**Rules checked**
- Server computes status; client only reacts ✔
- No customer data stored ✔
- Wake Lock released on unmount ✔

---

## 1.5 — Counter QR Mode (Big Token + Pickup Code)

### Problem
For counter / quick-service QR scans:
- The token number `#N` shows in a small `text-3xl` tile in the tracker — hard to read across a counter.
- The customer is never shown their pickup code (even though the backend stores it).

### Solution

**`PublicOrderTrackerPage.tsx`**:
1. **Big-token display**: if `order.token_number !== null`, show a large (`text-[22vw] sm:text-[12rem]`) full-width orange banner. Keep the existing small tile as a fallback for smaller layouts; replace with the vw-based one.
2. **Fullscreen button**: add a `⤢` button that calls `document.documentElement.requestFullscreen()`. Only show if `document.fullscreenEnabled`. Label: "Full Screen" / "முழு திரை".
3. **Pickup code display**: if `order.pickup_code` is returned and order status is `"READY"`, show a 4-digit code in a prominent card: "Your pickup code: **XXXX**" / "உங்கள் பிக்அப் குறியீடு: **XXXX**".

**Backend** (`PublicOrderTrackerView`):
- Add `pickup_code` to the response (only when `order.status == "READY"` and `order.workflow == COUNTER_TOKEN`; otherwise `null`). This prevents premature disclosure.

**Frontend types** (`publicQr.ts`):
- Add `pickup_code: string | null` to `PublicOrderTrackerResponse`.

---

## Delivery Checklist

| # | Item | Evidence |
|---|---|---|
| 1.1 | This plan doc | `docs/product/customer-app-plan.md` |
| 1.2 | Header safe-area fix | Playwright screenshots at 6 viewports |
| 1.3 | Bill gate + DEMO label | Backend test: `show_bill=False` pre-payment; screenshot of receipt |
| 1.4 | Ready alert | Unit test for `playReadyAlert()`; Playwright: status→READY triggers chime ref |
| 1.5 | Big token + pickup code | Playwright screenshot of counter QR tracker at 320 px |
| ALL | `scripts/verify_all.ps1` | All gates PASS |
| ALL | `docs/evidence/SUMMARY.txt` | All gates PASS |
| tag | `v1.6.0-customer-app` | Only if every gate passes |

---

## Files Changed in Stage 1

| File | Change |
|---|---|
| `frontend/src/utils/soundAlerts.ts` | Add `playReadyAlert()` |
| `frontend/src/pages/public/PublicOrderTrackerPage.tsx` | Bill gate, ready alert, Wake Lock, big token, pickup code |
| `frontend/src/pages/public/publicQrStrings.ts` | New EN+TA strings: DEMO RECEIPT notice, fullscreen, pickup code |
| `frontend/src/api/publicQr.ts` | Add `show_bill`, `pickup_code` to `PublicOrderTrackerResponse` |
| `backend/apps/orders/public_views.py` | Add `show_bill`, `pickup_code` to tracker response |
| `frontend/src/components/layout/AppShell.tsx` | Safe-area padding on top nav |
| `docs/evidence/stage1/README.md` | Screenshot README |
| `docs/product/requirements-index.md` | New entries |
| `docs/product/problem-register.md` | FloorPOS local counter bug + bill-before-payment bug |
| `docs/product/sidebar-map.md` + `navigation.ts` | No new nav items in Stage 1 |
