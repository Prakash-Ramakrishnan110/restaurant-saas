# Stage 1 Evidence — Android App Shell, Native Sign-In & Devices

- **Branch:** `main`
- **Base Commit:** `ed9fe66d7586aa43957a3a0a1e708007b027cd6f`
- **APK Evidence:**
  - `docs/evidence/mobile/debug-apk-info.txt` (4.96 MB, `app-debug.apk`, SHA-256 `EF53F266D7AA9EC74A8B2DBE1C148F06FB3909D07618F9FAB45C5AC360F00CEA`)
  - `docs/evidence/mobile/release-apk-info.txt` (1.85 MB, `app-release-unsigned.apk`, SHA-256 `5F58CB1FC859FF6F778E4309AD938EA0474A400B2F04A99CED951754F83E2EB2`)
  - `docs/evidence/mobile/emulator-smoke.txt` (`SKIPPED: No running Android emulator or USB-connected device found.`)
- **Screenshots:** No Android emulator or physical phone was connected during Stage 1; native shell flows were verified via Playwright (`e2e/native-shell-stage1.spec.ts`) against the real backend using `window.__SMF_NATIVE_SHIM__`.
- **Real-Device Verification:** Pending owner testing in `docs/mobile/device-tests.md`.
