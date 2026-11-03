# ADR 0005: Venue Profiles and Typed Capability Flags

## Status
Accepted

## Context
A multi-tenant restaurant SaaS must accommodate widely divergent food and beverage hospitality models:
- Counter-service tea shops, bakeries, and food trucks (no tables, pay-first, token numbers, high volume)
- Cafes and quick-service diners (simple open seating, hybrid pay-first or pay-later)
- Casual and fine-dining restaurants (AC/non-AC sections, joinable tables, waitstaff section assignments, pay-later)
- Luxury hotel dining (multiple service outlets, room charging, multi-course sequencing)
- Food courts (shared seating, multi-counter token systems, unified or separate billing)

### Considered Alternatives
1. **Model Inheritance (e.g. `CafeTable`, `HotelRoomTable`, `FoodCourtCounter`)**:
   - *Rejected*: Inflexible, requires multiple database tables, polymorphic query complexity, and forces brittle database migrations when an operator changes formats.
2. **Generic Untyped JSON Blobs**:
   - *Rejected*: Lacks schema enforcement, cannot be typed in Python/TypeScript, prone to runtime key drift, cannot be easily indexed or queried at database level.
3. **Branch-Level Typed Capability Flags with Onboarding Presets (Chosen)**:
   - Stores 11 explicit, strongly-typed capability flags on a dedicated `BranchCapabilities` model per branch.
   - Populated from predefined venue presets (`QUICK_SERVICE`, `CAFE`, `CASUAL_DINING`, `FINE_DINING`, `HOTEL_RESTAURANT`, `FOOD_COURT`, `BAR_BREWERY`).
   - Allows individual flag overrides by the tenant owner.

## Decision
We implement a unified venue hierarchy (`Tenant` -> `Branch` -> `ServiceArea` -> `Section` -> `DiningTable` / `TableGroup`) combined with a typed `BranchCapabilities` model:
- `payment_timing`: `PAY_FIRST` vs `PAY_LATER`
- `qr_ordering_mode`: `DISABLED`, `BROWSE_ONLY`, `OPEN_TAB`, `PAY_AT_TABLE`
- `qr_session_policy`: `STRICT_WAIT_APPROVAL`, `AUTO_OPEN`
- `order_workflow`: `COUNTER_TOKEN`, `TABLE_SEAT`, `ROOM_SERVICE`, `DELIVERY_PICKUP`
- `has_table_management`: Boolean
- `has_sections`: Boolean
- `has_seat_ordering`: Boolean
- `supports_courses`: Boolean
- `allows_table_transfer`: Boolean
- `uses_token_numbers`: Boolean
- `allows_room_charge`: Boolean

When a branch is created with a `venue_profile`, `apply_preset()` automatically instantiates `BranchCapabilities` with default parameters tailored to that venue type.

## Consequences
### Positive
- A single unified data model and codebase powers all venue types without conditional codebase branching (`if venue == "hotel"`).
- Features adapt dynamically: if `uses_token_numbers` is true, sequential daily tokens are issued; if `has_table_management` is false, table assignments are bypassed.
- Strongly typed fields are validated via Django model choices and DRF serializers.
- Clean plan entitlement binding (e.g. Starter tier cannot enable `floor_editor` or multi-course sequencing).

### Negative / Trade-offs
- Downstream services (orders, billing, POS) must inspect branch capabilities rather than assuming table presence.

