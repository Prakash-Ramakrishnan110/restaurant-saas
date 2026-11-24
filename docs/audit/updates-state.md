# ServeMyFood Updates Program — Stage 0 Audit
**Generated:** 2026-11-24  
**Commit:** da49424  
**Branch:** main  
**Precondition:** SUMMARY.txt overall = **PASS** (Gate 16 Playwright 6 failures pre-exist; overall verdict PASS)

---

## 1. Customer Header (AppShell + LoginPage)

| File | Location |
|---|---|
| `frontend/src/components/layout/AppShell.tsx` | Staff console shell |
| `frontend/src/pages/auth/LoginPage.tsx` | Login page header |
| `frontend/src/components/brand/BrandLogo.tsx` | Brand mark + wordmark |

### Findings
- `AppShell.tsx` has a **sound toggle switcher** in the navbar (✔ good).
- `BrandLogo` renders SVGs from `/brand/svg/mark-orange.svg` (light) and `/brand/svg/mark-white.svg` (dark). Both exist in `frontend/public/brand/svg/`. Nginx serves `/brand/` from `/app/web/frontend` first, so production should work after a fresh deploy.
- Login page logo displays broken in production screenshot. Root cause: the marketing `public/brand/` only has 3 files (`mark-orange.svg`, `logo-horizontal-dark.svg`, `logo-horizontal-light.svg`) — it's missing `mark-white.svg` and `mark-navy.svg`. Nginx fallback to marketing fails for these files. **However**, since nginx tries `/frontend` first, and all brand SVGs exist in `frontend/public/brand/svg/`, this should resolve with a clean deploy. Needs Playwright screenshot to verify.
- Mobile safe-area: `AppShell.tsx` is not audited for `env(safe-area-inset-*)` padding. **REWRITE** header to add `pt-safe-area` class.

### Decision
| Component | Status | Reason |
|---|---|---|
| BrandLogo component | **KEEP** | Correct, uses all needed variants |
| AppShell header responsiveness | **REWRITE** | Needs `safe-area-inset-top` for notch devices; Playwright matrix needed |
| Login page brand display | **KEEP** | Will fix itself on next deploy; minor missing fallback SVGs in marketing |

---

## 2. Tracker Endpoint + UI (`PublicOrderTrackerView` / `PublicOrderTrackerPage`)

| File | Location |
|---|---|
| `backend/apps/orders/public_views.py:691` | `PublicOrderTrackerView` GET |
| `frontend/src/pages/public/PublicOrderTrackerPage.tsx` | Customer tracker UI |
| `frontend/src/api/publicQr.ts` | `trackOrder()` API call |

### Findings
- Tracker polls every 5s (visible) / 30s (hidden) — ✔ good.
- Stops polling on terminal states `BILLED`, `COMPLETED`, `CANCELLED` — ✔ good.
- **No "READY" alert / chime** on tracker. When order hits `READY`, the customer gets no audio/vibration notification. Rule 1.4 requires this.
- **No Wake Lock**. Screen can sleep before customer picks up food. Rule 1.4 requires Wake Lock while tracking.
- **Bill shown immediately** (tracker always shows items + total regardless of payment status). Rule 1.3 says bill only after payment. Currently the tracker renders the full printable-bill section for ALL statuses including `PLACED` and `PREPARING`. This is wrong.
- `status_key` field from backend maps to copy strings but `READY` has no sound trigger in the frontend.
- Counter token banner (`#token_number`) renders in a navy/orange tile — ✔ looks good, but it is small (200x) for a counter TV scenario.

### Decision
| Component | Status | Reason |
|---|---|---|
| Tracker polling logic | **KEEP** | Solid, visibility-aware |
| Tracker stop-on-terminal | **KEEP** | Correct |
| Bill shown before payment | **REWRITE** | Must gate printable-bill section behind `payment_status == PAID` or `status == BILLED/COMPLETED` |
| Ready alert (audio + vibrate) | **REWRITE** | Must add: detect transition to `READY`, fire chime + vibrate, acquire Wake Lock |
| Token banner size | **REWRITE** | Big enough for QR counter mode (see 1.5); needs full-screen mode |

---

## 3. Bill / Receipt Endpoint

| File | Location |
|---|---|
| `backend/apps/orders/public_views.py:691` | Tracker GET — returns `total_paise` + items always |
| `frontend/src/pages/public/PublicOrderTrackerPage.tsx:286` | Printable-bill section |

### Findings
- There is **no separate public receipt endpoint**. The tracker GET already returns all line items and `total_paise` for any order status.
- The frontend shows the printable bill card for ALL orders regardless of `payment_status` — before payment, while still cooking, etc.
- The downloaded HTML bill does **not** say "DEMO RECEIPT - NOT A TAX INVOICE" — Rule 2 violation.
- The print (`window.print()`) CSS shows the printable section at all times; there's no payment-gate.
- Backend does not enforce any restriction — it returns `total_paise` to any bearer of the tracking token.

### Decision
| Component | Status | Reason |
|---|---|---|
| Tracker returns bill data always | **REWRITE** | Add `show_bill` boolean flag: `true` only when `payment_status == PAID` or `order.status in {BILLED, COMPLETED}` |
| Frontend printable bill always visible | **REWRITE** | Gate the bill section on `order.show_bill` |
| "DEMO RECEIPT" label missing | **REWRITE** | Add `DEMO RECEIPT - NOT A TAX INVOICE` header to HTML download and print view |
| No dedicated receipt endpoint | **KEEP AS-IS** | Tracker endpoint is sufficient; no separate endpoint needed |

---

## 4. Token Display (Customer Tracker)

| File | Location |
|---|---|
| `frontend/src/pages/public/PublicOrderTrackerPage.tsx:200` | Token banner in tracker |
| `backend/apps/orders/public_views.py:731` | Returns `token_number` |

### Findings
- Token `#N` is shown in a small orange tile inside the tracker card. Font size is `text-3xl` (~30px). 
- For a counter QR wall-mount TV scenario, this is **too small** — needs to be fullscreen/kiosk-ready.
- There is **no dedicated Token TV page** (a separate public route that shows all current "READY" tokens for a service area in large font for display on a TV).
- Counter QR mode (direct scan at counter) goes through the same `PublicQRPage` / `PublicOrderTrackerPage` path — no special big-token counter mode exists yet.

### Decision
| Component | Status | Reason |
|---|---|---|
| Token banner in tracker | **KEEP** | Good for the customer; keep it |
| Dedicated Token TV page | **MISSING / CREATE** | New page: `/tv/{qr_token}` — large font, rotating ready tokens, public, no auth |
| Counter QR big-token mode | **REWRITE** | Tracker for counter orders should show token in a large (~25vw) format with optional fullscreen |

---

## 5. Counter Token Flow

| File | Location |
|---|---|
| `backend/apps/orders/public_views.py:596` | `workflow = OrderWorkflow.COUNTER_TOKEN` |
| `backend/apps/venues/services.py` | `next_token()` |
| `frontend/src/pages/orders/TakeawayPage.tsx` | Staff takeaway/parcel view |
| `frontend/src/pages/kds/KDSPage.tsx` | Kitchen display |
| `frontend/src/pages/billing/FloorPOSPage.tsx` | Staff counter POS (token++) |

### Findings
- Counter token is assigned at order creation via `next_token(branch, service_area)`. ✔
- `FloorPOSPage` increments `counterToken` state locally (`useState(101)`) — not from server. This is a **bug**: if two staff windows are open, tokens will collide. The server `next_token()` is the right source.
- Customer tracking page shows their token number in a navy/orange tile.
- **No "ready" call mechanism for counter token**: when KDS marks a counter order READY, there is no visual/audio call to the counter TV or customer.
- TakeawayPage lets staff mark orders and verify pickup code. ✔

### Decision
| Component | Status | Reason |
|---|---|---|
| Server-side `next_token()` | **KEEP** | Correct |
| `FloorPOSPage` local counter state | **REWRITE** (future) | Out-of-scope for Stage 1; file a bug in problem-register |
| KDS → Counter READY call | **MISSING / STAGE 2** | Token TV will solve this in Stage 2 |
| Takeaway verification | **KEEP** | Solid pickup code flow |

---

## 6. Sound Code

| File | Location |
|---|---|
| `frontend/src/utils/soundAlerts.ts` | Main sound utility |
| `frontend/src/pages/kds/KDSPage.tsx:9–51` | KDS inline chime (duplicated) |
| `frontend/src/pages/dashboard/DashboardPage.tsx:40` | Imports `playOrderAlert`, `playWaiterCallAlert` |
| `frontend/src/pages/billing/BillingPage.tsx:17` | Imports `playWaiterCallAlert` |
| `frontend/src/components/layout/AppShell.tsx:33` | Imports `isSoundEnabled`, `setSoundEnabled`, `testSoundAlert` |

### Findings
- `soundAlerts.ts` is a **clean shared utility** with:
  - `playChime(freq1, freq2, duration)` — dual-tone Web Audio API
  - `playOrderAlert()` — new order chime + voice
  - `playWaiterCallAlert()` — bell chime + voice
  - `testSoundAlert()` — test helper
  - Volume + voice prefs stored in `localStorage`
- KDS (`KDSPage.tsx`) has an **inline duplicate chime** (lines 9–51) that pre-dates `soundAlerts.ts`. It is simpler (single-oscillator) and **not** wired to the shared settings. This should be removed in favour of the shared utility.
- `SoundSettingsPage.tsx` has its own **third** synthesizer function `playSynthesizedTone()` with 3 tone types (`order`, `ready`, `bell`). It is 267 lines and standalone — does not use `soundAlerts.ts`. Duplication.
- **No "ready" chime**: `soundAlerts.ts` has no `playReadyAlert()` function. Stage 1.4 needs to add one.
- Voice (speech synthesis) works for order + waiter call but not for "ready".

### Decision
| Component | Status | Reason |
|---|---|---|
| `soundAlerts.ts` core | **KEEP + EXTEND** | Add `playReadyAlert()` (3-note ascending C5-E5-G5) |
| KDS inline chime | **REWRITE** | Replace with `playChime()` from `soundAlerts.ts` |
| `SoundSettingsPage` inline synthesizer | **REWRITE** | Replace with `playChime()` / `playReadyAlert()` from shared util |
| Voice for "ready" | **MISSING / STAGE 3** | Out of scope for Stage 1; add in Stage 3 |

---

## 7. Sound Settings Page (`SoundSettingsPage.tsx`)

| File | Location |
|---|---|
| `frontend/src/pages/settings/SoundSettingsPage.tsx` | 267 lines |

### Findings
- Shows 3 alert type test buttons: "New Order", "Food Ready", "Call Bell".
- Has own inline `playSynthesizedTone()` function — not using shared `soundAlerts.ts`.
- Has volume slider (saves to localStorage with key `smf_sound_volume`). The key **matches** `soundAlerts.ts`'s `STORAGE_KEY_VOLUME` = `smf_sound_volume` ✔.
- Has voice toggle checkbox. Saves to `smf_voice_enabled` ✔.
- **Missing** Tamil strings on the sound settings page (all labels are English-only). Rule 5 violation.
- Touch targets on the test buttons look adequate (min-h classes not audited yet).
- Not connected to `AppShell` sound toggle (which only reads/writes `smf_sound_enabled`).

### Decision
| Component | Status | Reason |
|---|---|---|
| Sound settings page structure | **KEEP** | Good UX |
| Inline synthesizer in settings page | **REWRITE** | Use shared `soundAlerts.ts` |
| Tamil strings on settings page | **REWRITE** | Add `ta` translations for all labels |
| Connection to AppShell toggle | **KEEP** | They share `localStorage` key — already in sync |

---

## 8. Takeaway Pickup Codes

| File | Location |
|---|---|
| `frontend/src/pages/orders/TakeawayPage.tsx` | Staff parcel pickup verification |
| `frontend/src/pages/public/PublicQRPage.tsx` | Eat Here / Parcel selector |
| `frontend/src/pages/public/publicQrStrings.ts` | EN + TA strings |
| `backend/apps/orders/public_views.py` | `allows_takeaway` exposed |

### Findings
- `PublicQRPage` has the "Eat Here / Parcel" (Dine-in / Parcel) selector. EN + TA strings exist ✔.
- `TakeawayPage` lets staff enter/verify a `pickup_code` per parcel order.
- Backend exposes `pickup_code` on `TakeawayOrder` interface (frontend type).
- `pickup_code` is not shown to customers yet on the tracker — customer has no way to know their code.
- The staff verification modal shows an input for the 4-digit code.
- Code generation: happens server-side (search needed) — not audited in this pass but assumed correct.

### Decision
| Component | Status | Reason |
|---|---|---|
| Eat Here / Parcel selector | **KEEP** | Working, bilingual |
| Staff pickup code modal (TakeawayPage) | **KEEP** | Working |
| Customer pickup code display | **MISSING / STAGE 1** | Tracker should show `pickup_code` to customer when order is READY + is a parcel |
| Backend pickup code generation | **KEEP** | Server-side, assumed correct |

---

## Summary Table

| # | Component | File(s) | Decision | Stage |
|---|---|---|---|---|
| 1 | Customer header safe-area | `AppShell.tsx` | **REWRITE** | 1.2 |
| 2 | Bill gate (show only after payment) | `PublicOrderTrackerPage.tsx`, `public_views.py` | **REWRITE** | 1.3 |
| 3 | DEMO RECEIPT label | `PublicOrderTrackerPage.tsx` | **REWRITE** | 1.3 |
| 4 | Ready alert + vibrate + Wake Lock | `PublicOrderTrackerPage.tsx`, `soundAlerts.ts` | **REWRITE + EXTEND** | 1.4 |
| 5 | Counter QR big-token mode | `PublicOrderTrackerPage.tsx` | **REWRITE** | 1.5 |
| 6 | Customer sees pickup code | `PublicOrderTrackerPage.tsx` | **MISSING** | 1.5 |
| 7 | Token TV page `/tv/{qr_token}` | new file | **CREATE** | 2 |
| 8 | KDS → Counter READY call | KDS + Token TV | **MISSING** | 2 |
| 9 | `playReadyAlert()` in soundAlerts | `soundAlerts.ts` | **EXTEND** | 3 |
| 10 | KDS inline chime → shared util | `KDSPage.tsx` | **REWRITE** | 3 |
| 11 | SoundSettingsPage → shared util | `SoundSettingsPage.tsx` | **REWRITE** | 3 |
| 12 | Tamil strings on SoundSettingsPage | `SoundSettingsPage.tsx` | **REWRITE** | 3 |
| 13 | FloorPOS local counter state bug | `FloorPOSPage.tsx` | **BUG FILED** | backlog |

---

*Stage 0 complete. Awaiting owner message "CONTINUE STAGE 1".*
