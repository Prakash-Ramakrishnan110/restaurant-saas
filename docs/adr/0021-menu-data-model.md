# ADR 0021: Menu Domain Data Model and Monetary Representation

## Status
Accepted

## Context
A flexible restaurant management platform must support diverse food business models (from single-counter tea shops to multi-course fine dining establishments and multi-brand food courts). A robust menu domain data model requires structured portion sizes (variants), customer customizations (option groups), multi-outlet availability overrides, and strict monetary integrity.

In many naive implementations, prices are stored as floating-point numbers or combined with embedded tax assumptions (e.g. "includes 5% GST"). In India and internationally, tax percentages vary by air conditioning status, liquor licensing, composite GST schemes, and future statutory changes.

## Decision

1. **Integer Paise Representation (No Floating Point)**:
   - All monetary fields in `MenuItem`, `ItemVariant`, and `Option` are stored strictly as positive integers representing paise (`base_price_paise`, `price_paise`, `price_delta_paise`). 1 INR = 100 paise.
   - Floating point calculations are strictly forbidden in business logic and serializers.
   - Frontend inputs parse user rupees to integer paise without IEEE 754 precision issues.

2. **Decoupled Tax Architecture (Zero Tax Fields in Menu Models)**:
   - Menu models contain zero tax fields or rate assumptions.
   - Tax calculation is the sole responsibility of the ordering, billing, and invoicing engine based on tenant tax profile, business settings, and order destination (dine-in, takeaway, delivery).

3. **Portion Sizes & Variants with Partial Unique Constraint**:
   - `ItemVariant` represents portion sizes (e.g. Half, Full, Small, Large).
   - Only one variant per item can be default: enforced via PostgreSQL partial unique index `unique_default_variant_per_item` (`WHERE is_default = TRUE`).
   - Invariant: When variants exist, `MenuItem.base_price_paise` is automatically synchronized by the service layer to match the default variant price.

4. **Hierarchical Customization via Option Groups**:
   - `OptionGroup` (e.g. "Milk Choice", "Spice Level") contains `min_select` and `max_select` constraints.
   - Associated with `MenuItem` via `ItemOptionGroup` join table.

5. **Branch Availability Overrides**:
   - `BranchItemAvailability` tracks sold-out state per branch. Absence of a row implies available by default (`is_available = True`).

6. **Constant Query-Count Active Menu Endpoint**:
   - `/api/v1/menu/full/?branch=<branch_id>` serves the complete active catalog for digital QR ordering and staff POS using `select_related` and `prefetch_related`, guaranteeing $O(1)$ database round-trips.

## Consequences
- **Positive**: Absolute mathematical precision for all currency calculations. Complete independence from tax rate volatility. High-performance menu rendering for live ordering.
- **Negative**: Client applications must format paise into localized currency strings using `Intl.NumberFormat` with Indian grouping (`₹1,25,000`).

