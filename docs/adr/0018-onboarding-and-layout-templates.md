# ADR 0018: Restaurant Onboarding Wizard and Atomic Layout Templates

## Status
Accepted

## Date
2026-11-05

## Context
When restaurant owners and managers first configure their venue on ServeMyFood, they need a frictionless, step-by-step onboarding process to set up business details, branch operating parameters, operational workflows (venue profile presets), dining or counter capacity, cryptographic QR codes, and initial staff credentials.

Different venue profiles have fundamentally different dining models:
1. **Cafés and Restaurants**: Need dining tables, service areas (AC, Outdoor, Family Hall), and table standees.
2. **Quick Service / Tea Shops**: Do not have dining tables; they operate takeaway counters, pickup points, and token dispatch queues.
3. **Hotels & Fine Dining**: Require captain-assisted dining or room-level QR anchors.

Furthermore, multi-tenant subscription tiers enforce strict entitlement limits on `max_branches`, `max_service_areas`, and `max_tables`. Applying an onboarding layout template must never leave the database in an inconsistent state or permit a tenant to bypass subscription limits.

## Decisions

### 1. 7-Step Deterministic Onboarding Wizard
The onboarding flow is structured into exactly 7 sequential steps:
1. **Business Details**: Name, venue profile preset (Café by default), primary email/phone, timezone, document language.
2. **First Branch**: Name, street address, phone, weekly operating hours with one-click "Copy to all days".
3. **Service Style**: Preset operational rules (ordering mode, session policy, table merging, courses) with plan entitlement alerts.
4. **Layout & Capacity**: Template selection with pre-validation and capacity previews.
5. **QR Standees**: Review and generate cryptographic QR standees.
6. **Staff & Team**: Optional invitation for manager, waiter, cashier, or kitchen staff with a single-view temporary password.
7. **Ready to Serve**: Completion checklist and immediate action links to dashboard and print sheets.

The wizard progress is tracked on the backend via `/api/v1/onboarding/status/`, which deterministically calculates `is_complete`, `completion_percentage`, and `next_step`. If an owner leaves or refreshes the page, the frontend automatically resumes at the first incomplete step.

### 2. Atomic Layout Templates and Pre-Validation
Layout templates (`cafe_small`, `restaurant_3_sections`, `fine_dining`, `hotel`, `counters`, `empty`) are applied via `POST /api/v1/branches/{id}/layout-templates/{key}/apply/`:
- **Atomic Transaction**: All service areas, tables, counters, and initial QR tokens are created inside a database transaction (`transaction.atomic()`). If any failure occurs, the entire operation rolls back.
- **Entitlement Pre-Check**: Before inserting any records, the backend verifies current counts plus template requirements against `SubscriptionPlan` limits (`max_service_areas`, `max_tables`). If limits are exceeded, the operation aborts with HTTP 400 (`ENTITLEMENT_LIMIT_REACHED`) and creates zero rows.
- **Dry-Run Support**: Passing `?dry_run=true` calculates proposed table and area counts, comparing them against the tenant's remaining plan capacity without modifying database state.
- **Conflict Handling**: Mode `"new"` ensures clean branches are not accidentally overwritten (raises `BRANCH_NOT_EMPTY` 400), while mode `"replace"` cleanly transitions layout.

### 3. Strict Invariant: Counter & Takeaway Mode
When the venue profile is `QUICK_SERVICE` or the `counters` layout template is selected:
- Zero dining tables are created (`tables_count = 0`).
- Token counters and takeaway pickup stations are configured instead.
- The UI strictly enforces **zero occurrence of the word "table"** (case-insensitive) in English and Tamil ("மேஜை") across all descriptions and headers in this step.

## Consequences
- **Positive**: First-time venue setup takes under 10 minutes.
- **Positive**: Subscription limits are strictly enforced at the database and API boundary before any rows are written.
- **Positive**: Tea shops and quick service venues get a tailored counter workflow without confusing restaurant table terminology.
- **Positive**: Onboarding state is durable, resumable, and safe against browser refreshes.

