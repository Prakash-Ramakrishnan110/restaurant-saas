# Automated Screen Rule Violations Report

Evaluated **185** captured flow steps (`mobile` 390x844 touch + `desktop` 1440x900) against Step 3 rules. Zero hand-typed counts; sourced directly from [walk_stats.json](raw/walk_stats.json).

## Summary Table

| Rule Check | Failing Screens | Total Element Instances | Status |
|---|---:|---:|---|
| Horizontal scroll (`scrollWidth > innerWidth`) | 0 | — | PASS |
| Tap targets under threshold (`< 56px` mobile touch / `< 48px` desktop) | 181 | 5335 | FAIL |
| Text smaller than `12px` | 174 | 3010 | FAIL |
| Axe `serious` or `critical` accessibility violations | 152 | — | FAIL |
| Text contrast under `4.5:1` | 151 | — | FAIL |
| Orange used as text, warnings, or status colors | 155 | — | FAIL |
| White text on `#FF6A00` background | 0 | — | PASS |
| Empty frames or broken images (`naturalWidth === 0`) | 2 | — | FAIL |
| Skeletons / spinners still visible after `10s` | 5 | — | FAIL |
| Zero metrics shown after failed HTTP request (`>= 400`) | 0 | — | PASS |
| Forbidden visible words (EN or TA) | 58 | — | FAIL |
| Word `table` on counter-only venue screens | 4 | — | FAIL |
| Missing Tamil strings / raw keys | 10 | — | FAIL |

## Axe Violation Breakdown (`serious` & `critical`)

| Axe Rule (Impact) | Affected Screens |
|---|---:|
| `color-contrast (serious)` | 151 |
| `select-name (critical)` | 35 |
| `label (critical)` | 21 |
| `button-name (critical)` | 18 |
| `scrollable-region-focusable (serious)` | 11 |

## Forbidden Visible Words Breakdown

| Word / Token | Screens Matched |
|---|---:|
| `tenants` | 33 |
| `tenant` | 27 |
| `sessions` | 23 |
| `session` | 14 |
| `entitlements` | 14 |
| `tax` | 8 |
| `gst` | 7 |
| `paise` | 7 |
| `preset` | 6 |
| `pms` | 2 |
| `ledger` | 2 |
| `உரிமை` | 2 |
| `gstin` | 2 |
| `presets` | 1 |

## HTTP >= 400 Responses Observed During Walkthrough

| Flow | Step | Viewport | Role | Status | Method & Endpoint |
|---|---|---|---|---:|---|
| F-02 | `02-tracker` | mobile | GUEST | 429 | `POST /api/v1/public/qr/KysoK5g3qqfgDR9dUzCU8rBNbFhnjlBA/orders/` |
| F-05 | `01-invalid-token` | mobile | GUEST | 404 | `GET /api/v1/public/qr/invalid-nonexistent-token-999/menu/` |
| F-05 | `01-invalid-token` | mobile | GUEST | 404 | `GET /api/v1/public/qr/invalid-nonexistent-token-999/menu/` |
| F-05 | `03-rotated-old-token` | mobile | GUEST | 404 | `GET /api/v1/public/qr/Ys7Yp6oYO-GAMMxqLUiVgcv_p9ZMcDJC/menu/` |
| F-05 | `03-rotated-old-token` | mobile | GUEST | 404 | `GET /api/v1/public/qr/Ys7Yp6oYO-GAMMxqLUiVgcv_p9ZMcDJC/menu/` |
| F-06 | `02-reorder-cart` | mobile | GUEST | 429 | `POST /api/v1/public/qr/6qEs8CBUy1cXAufmN035t_iRZcOgJNWv/orders/` |
| F-07 | `01-guest-requests` | mobile | GUEST | 400 | `POST /api/v1/public/qr/demo-spice-t4/service-requests/` |
| F-07 | `01-guest-requests` | mobile | GUEST | 400 | `POST /api/v1/public/qr/demo-spice-t4/service-requests/` |
| F-07 | `01-guest-requests` | mobile | GUEST | 400 | `POST /api/v1/public/qr/demo-spice-t4/service-requests/` |
| F-05 | `01-invalid-token` | desktop | GUEST | 404 | `GET /api/v1/public/qr/invalid-nonexistent-token-999/menu/` |
| F-05 | `01-invalid-token` | desktop | GUEST | 404 | `GET /api/v1/public/qr/invalid-nonexistent-token-999/menu/` |
| F-05 | `03-rotated-old-token` | desktop | GUEST | 404 | `GET /api/v1/public/qr/Ys7Yp6oYO-GAMMxqLUiVgcv_p9ZMcDJC/menu/` |
| F-07 | `01-guest-requests` | desktop | GUEST | 400 | `POST /api/v1/public/qr/aMMgnG_AGOnIGmrIJEO1_srnG6REC8ud/service-requests/` |
| F-12 | `03-sold-out-switches` | desktop | KITCHEN | 403 | `GET /api/v1/branches/` |
