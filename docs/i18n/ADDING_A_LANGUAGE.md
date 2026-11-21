# Adding a New Guest Language to ServeMyFood

ServeMyFood maintains a central language registry in `backend/apps/menu/translation_service.py` with two levels of readiness:

1. **Menu-content preparation (`chrome_ready: false`)**:
   - Languages such as Hindi (`hi`), Telugu (`te`), Malayalam (`ml`), Kannada (`kn`), Arabic (`ar`, RTL), French (`fr`), and Spanish (`es`) are pre-registered so restaurant owners can prepare and review menu translations in **Menu > Translations**.
   - Until `chrome_ready` is `true`, guests cannot select that language in the public QR menu switcher.

2. **Enabling guest interface support (`chrome_ready: true`)**:
   1. Add a complete, native-reviewed UI string dictionary in `frontend/src/pages/public/publicQrStrings.ts` (and `frontend/src/i18n/index.ts` if staff UI support is also desired).
   2. Verify `direction` (`"ltr"` or `"rtl"`) in `LANGUAGE_REGISTRY` (`backend/apps/menu/translation_service.py`) and ensure all customer-facing components use logical CSS properties (`ms-*`, `me-*`, `ps-*`, `pe-*`, `text-start`, `text-end`).
   3. Set `chrome_ready: True` for the language code in `LANGUAGE_REGISTRY`.
   4. Run `npm run test` (including `i18n-jargon.test.ts` and RTL layout tests) and Playwright guest QR tests before release.
