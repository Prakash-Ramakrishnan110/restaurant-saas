# ADR 0026: ServeMyFood Staff Android App (Capacitor + Native Auth + FCM Channels)

**Status:** Accepted  
**Date:** 2026-11-26  
**Program:** Waiter APK Program (Stages 0–3)

---

## Context
Waiters and floor staff need reliable order and guest-call alerts even when their Android phone is locked or the app is in the background. Mobile browsers suspend tabs and Web Audio/Wake Lock when locked, and PWA `httpOnly` cookie auth cannot work cleanly across `capacitor://localhost` and remote API origins.

## Decisions

### 1. Bundled Capacitor Android App (No Remote Page Loading)
- Build a Capacitor Android wrapper in `mobile/android/` with package ID `in.fusionengine.servemyfood.staff` and app name **ServeMyFood Staff**.
- Bundle the Vite React production build (`VITE_NATIVE=1`) inside the APK as local assets.
- **No `server.url`**, no remote HTML/JS loading, and WebView navigation restricted strictly to local bundled assets and the configured `API_BASE_URL` host.

### 2. Native Auth Flow & Keystore-Backed Token Storage
- Keep web `httpOnly` cookie authentication completely unchanged.
- Add dedicated native endpoints (`/api/v1/auth/native/login/`, `/api/v1/auth/native/refresh/`, `/api/v1/auth/native/logout/`) requiring `X-Client: android-staff`, refusing `PLATFORM_ADMIN` and disallowed roles, and returning `access` + rotated `refresh` in JSON with **zero cookies**.
- Store the `refresh` token **only** in Android Keystore-backed secure storage (never `localStorage`/`sessionStorage`, never logged). Hold `access` token in memory only.
- On network loss, do **not** clear Keystore or sign out; only clear Keystore and sign out on explicit `401`/`403` from `/auth/native/refresh/` or remote device revocation.

### 3. Chosen Secure-Storage & Native Plugins
- Use `@aparajita/capacitor-secure-storage` (MIT license, actively maintained for Capacitor 6/7, backed by Android Keystore + `EncryptedSharedPreferences`, requiring zero extra Android manifest permissions).
- Full plugin inventory, versions, purposes, and permissions are documented in `docs/mobile/PLUGINS.md`.

### 4. Push Notification Design (Stage 2)
- Use Firebase Cloud Messaging (FCM) notification messages routed to **versioned high-importance Android notification channels** (`staff_new_order_v1`, `staff_ready_v1`, `staff_request_v1`, `staff_attention_v1`, `staff_default_v1`) with distinct short custom sounds in `res/raw`.
- Android plays the channel sound at the OS level even when the app is killed or the phone is locked.
- Foreground pushes and the in-app `soundEngine` share deduplication by `event_id`.
- Payloads exclude all PII (no customer names, phone numbers, prices, or dish names).

### 5. Pilot Distribution & Updates
- Distribute signed release APKs directly (Play Store out of scope for pilot).
- Version checks via `GET /api/v1/app/android-config/` (`minimum_version_code`, `latest_version_code`, `download_url`, `maintenance_message`), showing a blocking **Update required** screen when `installedVersionCode < minimum_version_code`.

## Deviations
- None from the program specification.
