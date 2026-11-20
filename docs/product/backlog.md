# ServeMyFood Product Backlog (Explicitly Deferred)

The following items are **not** included in the Stage 0–D program (`v1.2.0` through `v1.5.0`) and must not be built until their listed prerequisites are resolved:

| Item | Reason Deferred |
|------|-----------------|
| Online payments, UPI links, payment sound boxes, and refunds | Requires the owner's payment gateway merchant account and settlement configuration. |
| Delivery management & rider dispatch | Out of scope for dine-in / counter QR ordering program. |
| QR takeaway ordering & scheduled pickup | Requires phone/OTP verification to prevent uncollected unpaid orders. |
| SMS and WhatsApp notifications | Requires DLT/template registration and recurring messaging cost approval. |
| Coupons, offers, loyalty points, and referrals | Requires accountant review for discount/accounting treatment. |
| Customer accounts with OTP and server-side order history | Requires privacy/legal advice (DPDPA data controller obligations). |
| Digital tax receipts / GST invoices | Tax format is pending accountant sign-off (ADR 0021). |
| Personalised menu recommendations | Deferred until sufficient multi-month anonymized order history exists. |
| Time-based and seasonal menus | Deferred beyond core menu tools. |
| Direct ESC/POS printing via local print bridge | Browser printing ships first; native print bridge remains Coming Soon. |
| Guest interface chrome beyond English and Tamil | Additional languages (`hi`, `te`, `ml`, `kn`, `ar`, `fr`, `es`) are registered with `chrome_ready=false` until reviewed UI translations exist. |
| Inventory Stage B (supplier PO workflow, price history & jump alerts, FIFO batch consumption, inter-outlet transfers, production runs, expected vs. actual variance, suggested order list, barcode scanning, closing checklist) | Scheduled for Inventory Stage B after Stage A Inventory Core stabilizes. |
