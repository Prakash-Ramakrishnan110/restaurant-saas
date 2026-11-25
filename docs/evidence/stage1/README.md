# Stage 1 Evidence â€” Customer App Updates (`v1.6.0-customer-app`)

Generated from real live-stack runs (PostgreSQL + Django Daphne + React SPA, zero response stubs).

- **Commit:** 7e5b99be1237e81ce7961576509e55d7f78bb850
- **Playwright Spec:** `frontend/e2e/customer-app-stage1.spec.ts`

## Screenshots

| File | Description |
|---|---|
| `header-320.png` | Customer QR header at 320x568 viewport â€” safe-area padding, zero horizontal overflow |
| `header-393.png` | Customer QR header at 393x852 (iPhone 14 Pro) viewport |
| `counter-token-ready.png` | Counter QR tracker after KDS marks READY â€” large `#token` banner, Ready alert banner, 4-digit pickup code |
| `counter-token-ready-ta.png` | Counter QR READY tracker in Tamil at 360px viewport |
| `paid-receipt.png` | Official printable receipt unlocked only after cashier settlement, stamped `DEMO RECEIPT - NOT A TAX INVOICE` |
| `paid-receipt-dark.png` | Dark mode view of paid customer receipt |
