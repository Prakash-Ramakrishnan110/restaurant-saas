# ServeMyFood Staff Android App — Capacitor Plugins Inventory

All plugins are selected for minimal footprint, active maintenance, permissive licensing, and strict compliance with the allowed Android permission set (`INTERNET`, `POST_NOTIFICATIONS`, `VIBRATE`, `WAKE_LOCK`).

| Plugin | Version | License | Purpose | Extra Android Permissions |
|---|---|---|---|---|
| `@capacitor/core` | `^7.0.0` | MIT | Core Capacitor runtime & JS-to-Native bridge | None (`INTERNET` in app manifest) |
| `@capacitor/android` | `^7.0.0` | MIT | Android native container & Gradle project | None |
| `@aparajita/capacitor-secure-storage` | `^7.0.0` | MIT | Store refresh token in Android Keystore (`EncryptedSharedPreferences`) | None |
| `@capacitor/app` | `^7.0.0` | MIT | App lifecycle (`appStateChange` resume), hardware back button, app version info | None |
| `@capacitor/network` | `^7.0.0` | MIT | Reliable online/offline detection for the native Offline banner | `ACCESS_NETWORK_STATE`? *(Note: stripped/avoided if manifest scan restricts to exact 4 permissions — we use browser `navigator.onLine` + `online`/`offline` events + API health check if needed to keep manifest permissions strictly `{INTERNET, POST_NOTIFICATIONS, VIBRATE, WAKE_LOCK}`!)* |
| `@capacitor/status-bar` | `^7.0.0` | MIT | Navy status bar styling & safe-area overlay control | None |
| `@capacitor/splash-screen` | `^7.0.0` | MIT | Branded navy splash screen hide on app boot | None |
| `@capacitor-community/keep-awake` | `^7.0.0` | MIT | Keep screen awake while active in POS/KDS mode | Uses `FLAG_KEEP_SCREEN_ON` (no extra permission needed) |
| `@capacitor/push-notifications` *(Stage 2)* | `^7.0.0` | MIT | FCM registration, Android 13+ notification permission prompt, channel creation, tap routing | `POST_NOTIFICATIONS` (Android 13+) |

> **Note on Strict Permission Whitelist (Common Rule 5):**  
> Only `INTERNET`, `POST_NOTIFICATIONS`, `VIBRATE`, and `WAKE_LOCK` are permitted in the merged `AndroidManifest.xml`. Any plugin that injects `ACCESS_NETWORK_STATE` or other unapproved permissions is either omitted in favor of WebView `online`/`offline` events or stripped via `tools:node="remove"` in `AndroidManifest.xml` and verified by our automated manifest scan test.
