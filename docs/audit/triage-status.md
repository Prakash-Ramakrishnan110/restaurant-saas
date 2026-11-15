# Feature Triage Status

Verified against `docs/audit/hidden-modules.md`, `frontend/src/`, `frontend/e2e/`, and `backend/apps/`:

| # | Triage Item | Status | Evidence |
| :--- | :--- | :--- | :--- |
| 1 | Payment is full only (no split payment) | PASS | `frontend/src/pages/billing/BillingPage.tsx` settles full bill only; renamed `frontend/e2e/orders-operations-flows.spec.ts` ("Option 4: Cashier Billing, Full Settlement & 80mm Receipt") and `frontend/src/tests/orders-pos.test.tsx` ("calculates full bill settlement balance accurately in integer paise"). |
| 2 | Inventory hidden in sidebar and dashboard | PASS | Removed from `frontend/src/app/navigation.ts` and `frontend/src/pages/dashboard/DashboardPage.tsx`; verified by `frontend/src/tests/navigation-sync.test.ts` and `frontend/src/tests/sidebar-navigation.test.tsx`. |
| 3 | Historical sales graph and download hidden on dashboard | PASS | Removed 7-Day Revenue Trend & Sales Report Quick Export CSV cards and `getRangeReport` calls from `frontend/src/pages/dashboard/DashboardPage.tsx`. |
| 4 | WhatsApp share removed from dashboard | PASS | Removed `handleShareWhatsApp` and `Share WhatsApp` button from `frontend/src/pages/dashboard/DashboardPage.tsx`. |
| 5 | Discount management disabled/hidden in billing | PASS | `frontend/src/pages/billing/BillingPage.tsx` locks `discountPaise` to `0` (`useState<number>(0)` with no input UI). |
| 6 | Tax mode / GST calculation removed from billing | PASS | Enforced by Gate 17 `tax-scan.txt` in `scripts/verify_all.ps1` and `backend/apps/orders/migrations/0002_remove_billinvoice_cgst_paise_and_more.py`; receipts show `DEMO RECEIPT - NOT A TAX INVOICE`. |
| 7 | Jain dietary tag hidden from active QR menu & POS | PASS | Active menu/QR UI only exposes `VEG` / `NON_VEG` / `EGG`; `JAIN` only appears in hidden P2 `CustomersPage.tsx` (`docs/audit/hidden-modules.md`). |
| 8 | Dhaba and QSR business types | FAIL (Open in Admin) | Hidden/unsupported for standard restaurant onboarding (`CAFE`, `TEA_SHOP`, `HOTEL_RESTAURANT`), but `DHABA` / `QSR` presets still exist in `frontend/src/pages/admin/NewCustomerWizardPage.tsx` and `PlatformPlansPage.tsx` (tracked for platform admin cleanup). |
| 9 | Staff PIN login removed | PASS | Zero staff PIN UI or endpoints in active `frontend/src/` or `backend/apps/accounts/` (email/password + JWT only). |
| 10 | Recipe links removed from active UI | PASS | Renamed `Menu Recipes` -> `Menu Management` in `frontend/src/pages/team/RolesGuidePage.tsx`; `/inventory/recipes` is unlinked from sidebar and dashboard (`docs/audit/hidden-modules.md`). |
