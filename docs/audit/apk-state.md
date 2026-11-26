# ServeMyFood Staff Android APK — Current Codebase State Audit (Stage 0)

**Date:** 2026-11-26  
**Baseline Commit:** `ed9fe66d7586aa43957a3a0a1e708007b027cd6f` (`verify_all.ps1` 19/19 PASS)

---

## 1. Current Authentication Flow
- **Web Sign-In & Refresh (`backend/apps/accounts/views.py`, `frontend/src/api/client.ts`):**
  - Access token (JWT, 15 min lifetime via `SIMPLE_JWT`) is held in memory only (`inMemoryAccessToken` in `frontend/src/api/client.ts`).
  - Refresh token (JWT, 7 days lifetime, `ROTATE_REFRESH_TOKENS=True`, `BLACKLIST_AFTER_ROTATION=True`) is stored in an `httpOnly` cookie (`refresh_token`, `COOKIE_SECURE` env-controlled).
  - Cookie-authenticated endpoints (`/api/v1/auth/refresh/`, `/api/v1/auth/logout/`) enforce `validate_cookie_origin(request)` against `CORS_ALLOWED_ORIGINS` + `CSRF_TRUSTED_ORIGINS`.
  - **Single-flight refresh:** `frontend/src/api/client.ts` uses a shared `refreshPromise` mutex (`withCredentials: true`) so concurrent `401` responses trigger only one `/api/v1/auth/refresh/` call and retry with the new `Authorization: Bearer <token>`.
- **Implication for Capacitor APK:**
  - Bundled Capacitor apps run on `capacitor://localhost` / `https://localhost`, a different origin from the API server, so browser `httpOnly` cookies are not reliably sent cross-origin in Android WebView.
  - Native sign-in therefore requires dedicated `/api/v1/auth/native/*` endpoints returning `access` + `refresh` in JSON (no cookies), storing `refresh` in Android Keystore-backed secure storage and `access` in memory only.

## 2. Service Worker & PWA Install Prompts
- **Service Worker (`frontend/src/main.tsx`):**
  - `navigator.serviceWorker.register("/sw.js")` is registered unconditionally on startup.
- **PWA Manifest & Install Prompt (`frontend/index.html`, `frontend/src/components/layout/AppShell.tsx`):**
  - `frontend/index.html` links `<link rel="manifest" href="/manifest.webmanifest" />`.
  - `AppShell.tsx` listens for `window.addEventListener("beforeinstallprompt", onBeforeInstall)` to offer browser PWA installation.
- **Implication for Capacitor APK:**
  - In `VITE_NATIVE=1` mode, service worker registration and `beforeinstallprompt` install prompts must be disabled because assets are already bundled inside the APK.

## 3. Sound Engine & Wake Lock
- **Sound Engine (`frontend/src/sound/engine.ts`):**
  - Singleton `soundEngine` manages audio unlock, device preferences (`smf_sound_prefs_v3` in `localStorage`), deduplication (`seenSet` capped at `MAX_SEEN_IDS = 500` by `event_id`), queue capped at `MAX_QUEUE_SIZE = 5`, burst coalescing (`BURST_WINDOW_MS = 5000`), and repeat intervals per event.
  - Plays Web Audio / HTMLAudio chimes and optional `window.speechSynthesis` announcements.
- **Wake Lock (`frontend/src/sound/engine.ts`):**
  - Uses `navigator.wakeLock.request("screen")` when `keepScreenAwake` is enabled.
  - **Limitation on mobile:** Web Wake Lock releases as soon as the screen is locked or the app moves to the background; native keep-awake (`@capacitor-community/keep-awake`) works in foreground, while **locked-screen alerts require FCM notification channels** (Stage 2).

## 4. API Base URL, CORS & Cookie Settings
- **Frontend (`frontend/src/api/client.ts`):**
  - `apiClient` currently hardcodes `baseURL: "/api/v1"` and `withCredentials: true`, relying on Vite proxy in dev or same-origin hosting in prod.
  - In `VITE_NATIVE=1`, `baseURL` must resolve to `${VITE_API_BASE_URL}/api/v1` and `withCredentials` must be `false`.
- **Backend (`backend/config/settings/base.py`):**
  - `CORS_ALLOW_CREDENTIALS = True`, `CORS_ALLOWED_ORIGINS` defaults to `["http://localhost:5173", "http://127.0.0.1:5173"]`.
  - `CORS_ALLOW_HEADERS` includes `idempotency-key` and `x-tenant-id` (needs `x-client` added for native header `X-Client: android-staff` and Capacitor origin handling for native requests).
  - DRF throttling rates: `login_ip = 10/minute`, `login_email = 5/minute`, `anon = 100/minute`, `user = 1000/minute`.

## 5. How Events Reach the Staff App Today
- **Global Event Poller (`frontend/src/components/layout/AppShell.tsx`):**
  - Polls `/api/v1/events/feed/` (when `canPollEvents` is true) and calls `soundEngine.enqueueBatch(data.events, { isReconnect: wasReconnecting })`.
- **Ready To Serve (`frontend/src/pages/orders/ReadyToServePage.tsx`):**
  - Polls every `10000` ms (`setInterval(fetchReadyOrders, 10000)`).
- **Kitchen Display System (`frontend/src/pages/kds/KDSPage.tsx`):**
  - Polls every `3000` ms (`setInterval(fetchTickets, 3000)`).

## 6. Existing Sound & Alerts Settings
- **`frontend/src/pages/settings/SoundSettingsPage.tsx`:**
  - Configures device-local chime/voice preferences, voice language (`EN` / `TA` / `EN_TA`), speech rate, Wake Lock toggle, voice test panel, and per-event chime/voice/repeat rules synced with branch defaults (`/api/v1/events/sound-defaults/`).
  - Ready to host a **This phone** section in `VITE_NATIVE=1` mode for native notification status, alert toggle, and test alert button.
