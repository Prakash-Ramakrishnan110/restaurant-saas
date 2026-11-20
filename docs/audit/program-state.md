# ServeMyFood Program Audit — Current State (`v1.1.0-qr-ordering`)

**Audit Date:** 2026-11-20  
**Baseline Commit / Tag:** `56054a0` (`v1.1.0-qr-ordering`, 19/19 verification gates PASS)  
**Scope:** Read-only inspection across all 9 program areas prior to Stage A–D implementation.

---

## Summary Decision Matrix

| # | Area | Exists Today? | Works? | Follows Program Rules? | Decision | Target Stage |
|---|------|--------------|--------|------------------------|----------|--------------|
| 1 | Inventory | Yes (P3 prototype) | Partial | No (mutable ledger, no branch/location, `gstin` field, no Celery deduction, no `inventory.costs` split, hidden from sidebar) | **REWRITE (in-place in `apps/inventory`)** | Stage A |
| 2 | Menu Images | Yes (single image) | Yes | Yes (Pillow verified, EXIF stripped, size limits, nosniff) | **KEEP & EXTEND** (add `ItemImage` gallery + bulk upload) | Stage B |
| 3 | Menu Translations | Yes (`name_ta`, `description_ta`) | Yes | Partial (hardcoded 2 columns, no workflow/draft/outdated/allergen notes) | **KEEP & EXTEND** (data-preserving migration to `MenuTranslation`) | Stage B |
| 4 | Printing & Receipt Layouts | Yes (`DeviceSettingsPage`) | Partial | No (localStorage-only, false ESC/POS printer model claims, no 58/80mm clean print templates) | **REWRITE** | Stage C |
| 5 | Help & Support Pages | Support yes; Help no | Support works | Partial (SupportTicket works; no `/help` Markdown center or safe context notice) | **KEEP Support / BUILD Help** | Stage C |
| 6 | Feedback & Reviews | No | N/A | N/A | **BUILD NEW** | Stage D |
| 7 | Guest Order History & Reorder | Cart only (`sessionStorage`) | Cart works | N/A (no opt-in order history or `/reorder-preview/`) | **BUILD NEW** | Stage D |
| 8 | Service Requests | Yes (staff model & viewset) | Partial | Partial (no public QR endpoint, no 3-per-10m limit, no `allows_service_requests` switch) | **KEEP & EXTEND** | Stage D |
| 9 | QR Scan Counts | No | N/A | N/A | **BUILD NEW** | Stage D |

---

## Detailed Area-by-Area Inspection

### 1. Inventory
- **Files / Models:**
  - `backend/apps/inventory/models.py`: `Supplier`, `Ingredient`, `Recipe`, `RecipeItem`, `PurchaseOrder`, `PurchaseOrderItem`, `WastageLog`, `StockTransaction`.
  - `backend/apps/inventory/services.py`, `serializers.py`, `views.py`, `urls.py`, `constants.py`.
  - Endpoints: `/api/v1/inventory/{suppliers,ingredients,recipes,purchases,wastage,transactions}/`, `/reports/low-stock/`, `/reports/variance/`.
  - Frontend pages: `StockOverviewPage.tsx`, `SuppliersPurchasesPage.tsx`, `RecipesPage.tsx`, `WastagePage.tsx`, `InventoryReportsPage.tsx` (currently hidden from `navigation.ts` sidebar).
  - Tests: `backend/apps/inventory/tests/test_p3_inventory.py` (7 tests), `frontend/src/tests/p3-inventory.test.tsx` (5 tests).
- **Gaps vs. Stage A Rules:**
  - `StockTransaction` is mutable (not append-only at model/queryset level), lacks signed movement types (`OPENING`, `PURCHASE`, `SALE_USAGE`, `PRODUCTION_IN`, `PRODUCTION_USAGE`, `WASTE`, `ADJUSTMENT`, `COUNT_VARIANCE`, `TRANSFER_OUT`, `TRANSFER_IN`, `SUPPLIER_RETURN`, `PACKAGING_USAGE`), lacks unit cost snapshot, value in paise, actor, and per-branch sequence numbers.
  - Stock is tenant-wide on `Ingredient.current_stock` instead of `StockLevel(branch, location, item)` with `StockLocation` (`STORE`, `KITCHEN`, `BAR`, `COUNTER`).
  - `Supplier.gstin` violates Rule 2 (no tax names/fields anywhere in inventory/purchases).
  - Missing `UnitConversion`, `StockBatch`, `GoodsReceipt`, `StockCount`, `StockTransfer`, `ProductionRun`, `OrderLineStockDeduction`, `InventorySettings` (branch mode `SIMPLE`/`STANDARD`/`ADVANCED`, auto sold-out, thresholds).
  - Missing Celery post-commit idempotent deduction on `PREPARING`/paid, cancel-after-preparing `WASTE`, takeaway packaging deduction, and Stock Health retry screen.
  - Missing `inventory.costs` field omission for `KITCHEN` and plan entitlements (`inventory`, `max_inventory_items`, `inventory_advanced`).
- **Decision:** **REWRITE in-place inside `apps/inventory`** (avoid creating a duplicate app; preserve clean URL namespace and migrate/evolve existing tables, views, and frontend pages to meet every Stage A requirement).

### 2. Menu Images
- **Files / Models:** `backend/apps/menu/models.py` (`MenuItem.image_original`, `image_card`, `image_thumb`, `image_bytes`, `image_focus_x`, `image_focus_y`), `backend/apps/menu/services.py`, `frontend/src/components/menu/ItemEditorSheet.tsx`.
- **Tests:** `backend/apps/tenants/tests/test_prompt3b_branding_logo.py` (7 safety tests), `backend/apps/menu/tests/`.
- **Status:** Works and follows security Rule 6 (Pillow validation, EXIF strip, size limits).
- **Decision:** **KEEP & EXTEND** in Stage B with `ItemImage` gallery (up to 5 images/item), bulk upload (up to 50 files), filename matching review, and Unassigned tray.

### 3. Menu Translations
- **Files / Models:** `name_ta` / `description_ta` on `MenuCategory`, `MenuItem`, `ItemVariant`, `OptionGroup`, `OptionValue`; UI i18n in `frontend/src/i18n/{en,ta}.json` and `frontend/src/pages/public/publicQrStrings.ts`.
- **Status:** Works for English and Tamil.
- **Decision:** **KEEP & EXTEND** in Stage B with language registry (`en`/`ta` `chrome_ready=true`, 7 additional languages registered), `MenuTranslation` table with data-preserving migration, ingredients/allergen notes + disclaimer, and pluggable `TranslationProvider`.

### 4. Printing & Receipt Layouts
- **Files:** `frontend/src/pages/settings/DeviceSettingsPage.tsx`, receipt print modals in `BillingPage.tsx` and `InvoicesHistoryPage.tsx`.
- **Gaps:** `DeviceSettingsPage.tsx` stores settings only in `localStorage` and makes unverified claims about Ethernet/Wi-Fi ESC/POS models (`Epson, TVS, NGX, Star, Hoin`). No per-branch backend printer settings, no clean 58mm/80mm print pages, no setup wizard, no `docs/help/printers-tested.md`.
- **Decision:** **REWRITE** in Stage C to truthful browser-based printing with per-branch settings, 58mm/80mm bill & KOT print pages (`DEMO RECEIPT - NOT A TAX INVOICE`, `DUPLICATE` on reprint), setup wizard, and Playwright PDF verification.

### 5. Help & Support Pages
- **Files / Models:** `backend/apps/tenants/models.py` (`SupportTicket`), `backend/apps/tenants/views.py` (`SupportTicketViewSet`), `frontend/src/components/layout/AppShell.tsx` (Support dialog), `frontend/src/pages/admin/PlatformSupportPage.tsx`.
- **Gaps:** No `/help` Help Center page, no `docs/help/{en,ta}` Markdown guides, no `{{nav:...}}` token resolver or `scripts/help/capture.mjs`. Support dialog needs strict non-PII auto-attached context notice and throttle.
- **Decision:** **KEEP & EXTEND Support** (`SupportTicket`, `PlatformSupportPage`), **BUILD NEW Help Center (`/help`)** in Stage C.

### 6. Feedback & Reviews
- **Status:** Does not exist in backend or frontend.
- **Decision:** **BUILD NEW** in Stage D (owner-only verified-order feedback via tracking link, retention purge, reports + CSV export, dashboard card).

### 7. Guest Order History & Reorder
- **Status:** Only `sessionStorage` cart persistence exists in `PublicQRPage.tsx`. No opt-in phone order history, no `/api/v1/public/qr/<token>/reorder-preview/`.
- **Decision:** **BUILD NEW** in Stage D.

### 8. Service Requests
- **Files / Models:** `backend/apps/orders/models.py` (`ServiceRequest`, `ServiceRequestType`, `ServiceRequestStatus`), `backend/apps/orders/views.py` (`ServiceRequestViewSet` at `/api/v1/orders/service-requests/`).
- **Gaps:** No public QR endpoint, no 1-open-per-type / 3-per-10-min cap, no `allows_service_requests` branch capability toggle, no guest UI or staff Tables badge/3-min escalation highlight.
- **Decision:** **KEEP & EXTEND** in Stage D.

### 9. QR Scan Counts
- **Files / Models:** `backend/apps/venues/models.py` (`QRCode`). No scan counter model or analytics endpoint exists.
- **Decision:** **BUILD NEW** in Stage D (privacy-safe daily counts per QR code, zero IP/cookie storage, analytics tab + CSV export).
