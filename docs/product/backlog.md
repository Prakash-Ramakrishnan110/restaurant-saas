# ServeMyFood Product Backlog (Deferred Items)

The following items are intentionally excluded from the current release and Updates Program, and tracked here with reasons:

1. **Web push notifications**: Browser tab chimes, voice callouts, and Screen Wake Lock are active in-session; background service-worker Web Push requires VAPID key management and per-device notification opt-in flows.
2. **SMS and WhatsApp notifications**: Requires DLT template registration, sender ID approval, and per-message telecom billing setup.
3. **Online payments, UPI deep links & payment sound boxes**: Requires the restaurant owner's merchant payment gateway account, webhook secrets, and settlement KYC.
4. **Delivery & external aggregator dispatch**: Requires customer address/phone OTP verification and rider tracking workflows.
5. **Customer accounts & cross-visit order history**: Deferred pending privacy notice review and OTP login verification.
6. **Tax invoices (GST / CGST / SGST)**: All receipts remain labelled `DEMO RECEIPT - NOT A TAX INVOICE` until the owner records an accountant-verified tax configuration.
7. **Named competitor comparison on marketing pages**: Public pages compare ServeMyFood only against paper slips and manual WhatsApp messages, never naming third-party competitors or claiming unverified superiority.
8. **Per-dish recorded human voice studio packs**: Dynamic dish names use Web Speech synthesis (with English fallback when Tamil system voices are absent), while recorded clip packs cover numbers `0..999` and fixed callout phrases.
9. **Direct USB/LAN ESC/POS hardware bridge**: Browser CSS thermal printing (58mm/80mm) is active; native local bridge remains deferred until physical printer models are tested and recorded in `docs/help/printers-tested.md`.
10. **Guest UI languages beyond English and Tamil**: Menu translation preparation supports additional languages, while guest UI switcher awaits native-reviewed UI copy.
11. **Android Staff APK Deferred Scope (from Waiter APK Program)**:
    - iPhone / iOS app (out of scope; Android staff only).
    - Google Play Store listing (pilot uses direct signed APK distribution).
    - Certificate pinning & root detection.
    - Biometric unlock.
    - Offline order queue in the Android wrapper.
    - Direct Bluetooth printing from the phone.
    - In-app APK auto-install.
    - Third-party analytics and crash reporting SDKs.
