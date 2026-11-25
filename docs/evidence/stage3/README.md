# Stage 3 Evidence — Sound & Notifications (`v1.8.0-sound`)

Generated from real live-stack runs (PostgreSQL + Django Daphne + React SPA, zero response stubs).

- **Playwright Spec:** `frontend/e2e/sound-stage3.spec.ts`
- **Backend Suite:** `backend/apps/orders/tests/test_stage3_sound_events.py`
- **Frontend Unit Suite:** `frontend/src/tests/sound-engine-stage3.test.tsx`

## Screenshots

| File | Description |
|---|---|
| `kds-sound-live-alert.png` | KDS receiving live `/api/v1/events/?since=<seq>` order event, speaking zero-PII `"New order. T2. 2 artisan cappuccino"`, and showing the visual alert bar + `Live` indicator |
| `sound-off-warning-bar.png` | Red `"Sound is off. Orders will not be heard."` bar shown after 60 seconds without sound unlock |
| `sound-settings-desktop.png` | `Settings > Sound & Alerts` showing all 9 events, voice test detection, privacy notice, and saved device + branch defaults |
| `sound-settings-tamil.png` | `Settings > Sound & Alerts` rendered in Tamil (`தமிழ்`) with `min-h-[56px]` touch controls |
