# ADR 0005: Venue Profiles and Typed Capability Flags

## Status
Accepted

## Context
A multi-tenant restaurant SaaS must accommodate widely divergent food and beverage hospitality models:
- Counter-service tea shops, bakeries, and food trucks (no tables, pay-first, token numbers, high volume)
- Cafes and quick-service diners (simple open seating, hybrid pay-first or pay-later)
- Casual and fine-dining restaurants (AC/non-AC sections, joinable tables, waitstaff section assignments, pay-later)
- Luxury hotel dining (multiple service outlets, room service, room charging, multi-course sequencing)
- Food courts (counter-style stalls with independent token queues per counter)

### Considered Alternatives
1. **Model Inheritance (e.g. `CafeTable`, `HotelRoomTable`, `FoodCourtCounter`)**:
   - *Rejected*: Inflexible, requires multiple database tables, polymorphic query complexity, and forces brittle database migrations when an operator changes formats.
2. **Generic Untyped JSON Blobs**:
   - *Rejected*: Lacks schema enforcement, cannot be typed in Python/TypeScript, prone to runtime key drift, cannot be easily indexed or queried at database level.
3. **Branch-Level Typed Capability Flags with Onboarding Presets (Chosen)**:
   - Stores 15 explicit, strongly-typed capability fields (11 booleans and 4 enums) on a dedicated `BranchCapabilities` model per branch.
   - Populated from predefined venue presets (`QUICK_SERVICE`, `CAFE`, `CASUAL_DINING`, `FINE_DINING`, `HOTEL_RESTAURANT`, `FOOD_COURT`, `BAR_BREWERY`).
   - Allows individual flag overrides by the tenant owner while enforcing domain invariants (R1–R7).

## Decision
We implement a unified venue hierarchy (`Tenant` -> `Branch` -> `ServiceArea` -> `Section` -> `DiningTable` / `TableGroup`) combined with a typed `BranchCapabilities` model containing 15 fields (no duplicate property aliases):
- `uses_tables`: Boolean
- `uses_kds`: Boolean
- `uses_token_numbers`: Boolean
- `allows_takeaway`: Boolean
- `allows_room_service`: Boolean
- `allows_room_charge`: Boolean
- `allows_qr_ordering`: Boolean
- `has_sections`: Boolean
- `has_seat_ordering`: Boolean
- `supports_courses`: Boolean
- `allows_table_transfer`: Boolean
- `payment_timing`: `PAY_FIRST`, `PAY_LATER`, `EITHER`
- `qr_ordering_mode`: `DISABLED`, `BROWSE_ONLY`, `ORDER_WITH_APPROVAL`, `ORDER_DIRECT`
- `qr_session_policy`: `CUSTOMER_CAN_OPEN`, `STAFF_ONLY`
- `order_workflow`: `COUNTER_TOKEN`, `TABLE_SERVICE`, `BAR_TAB`, `ROOM_SERVICE`, `FAST_FOOD_DISPLAY`, `DRIVE_THRU`

When a branch is created with a `venue_profile`, `apply_preset()` automatically instantiates `BranchCapabilities` with default parameters tailored to that venue type.

### Food Court Architectural Decision
- **`FOOD_COURT` Preset Scope**: Modelled as a counter-style food court stall (`uses_tables = False`, `uses_token_numbers = True`, `payment_timing = PAY_FIRST`, `qr_ordering_mode = ORDER_DIRECT`, `order_workflow = COUNTER_TOKEN`), where each counter (`ServiceArea` of type `FOOD_COURT_COUNTER`) has its own QR code (`target_type = COUNTER`) and independent daily sequential token counter (`TokenCounter` scoped by `(branch, service_date, service_area)`).
- **Deferred Scope**: Multi-vendor mall operator management with cross-vendor cart aggregation and multi-vendor revenue settlement is explicitly **DEFERRED** to a future multi-merchant marketplace milestone.

## Consequences
### Positive
- A single unified data model and codebase powers all venue types without conditional codebase branching (`if venue == "hotel"`).
- Features adapt dynamically: if `uses_token_numbers` is true, sequential daily tokens are issued per branch or per counter (`service_area`); if `uses_tables` is false, table assignments are bypassed.
- Strongly typed fields and invariant rules (R1–R7) are validated via Django model choices, service-layer validation (`validate_capabilities`), and DRF serializers.
- Clean plan entitlement binding (e.g. Starter tier cannot enable `floor_editor` or `supports_courses`).

### Negative / Trade-offs
- Downstream services (orders, billing, POS) must inspect branch capabilities rather than assuming table presence.
