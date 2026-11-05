# ADR 0015: Menu Structure, Modifiers, and Multi-Format Import

## Status
Accepted

## Context
Restaurant menus vary from simple 10-item tea stall chalkboards to multi-category casual dining menus with extensive modifier groups (size variations, spice levels, crust choices, add-ons). Onboarding a venue requires rapid initial menu creation, including bulk import from spreadsheets or standard POS exports.

## Decision

### 1. Hierarchical Menu Schema
The menu domain is organized hierarchically:
- **Category**: Top-level menu groupings (`Hot Beverages`, `Tandoori Starters`, `Main Curries`, `Biryani`, `Breads`, `Desserts`). Supports display order sorting and availability windows (e.g., Breakfast only).
- **MenuItem**: Distinct dishes with base price in paise, tax category code, preparation station, preparation time estimate, and dietary classification (`VEG`, `NON_VEG`, `EGG`, `VEGAN`).
- **ModifierGroup**: Bundles of customization options (`Select Spice Level`, `Add Extra Cheese`, `Choose Rice`). Configured with `min_selections` (e.g. 1 for required radio choice) and `max_selections` (e.g. 3 for checkboxes).
- **ModifierOption**: Specific modifier choice with price offset in paise (`+30.00 INR` or `0.00 INR`).

### 2. Multi-Format Bulk Import Engine
To eliminate manual item entry during onboarding (Prompt 3B), the system provides a robust CSV and Excel (.xlsx) importer:
- **Columns**: `Category`, `Item Name`, `Tamil Name`, `Description`, `Price INR`, `Tax %`, `Dietary`, `Station`, `Available`
- **Validation Pipeline**:
  1. Header normalization and alias mapping (e.g., accepts `Price`, `Rate`, `Amount`).
  2. Data type casting and sanitization (converting decimal INR to integer paise).
  3. Pre-flight preview table displaying valid items and highlighting rows with validation warnings.
  4. Atomic ingestion inside a database transaction: if severe syntax errors occur, no partial menu is committed.

### 3. Server-Side Price Resolution
- Menu items and modifiers are priced authoritatively on the server.
- Line item total calculation:
  $$\text{Item Total} = \left(\text{Base Price} + \sum \text{Modifier Prices}\right) \times \text{Quantity}$$
- Frontends never compute or submit monetary subtotals.

## Consequences
- Fast onboarding for restaurants with existing spreadsheets.
- Prevents price tampering through authoritative server-side calculation.
