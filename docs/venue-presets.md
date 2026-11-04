# ServeMyFood Venue Capability Presets Matrix

This document defines the 15 capability fields configured across the 7 operational venue presets in ServeMyFood.

## 15-Field Venue Capability Matrix

| Field | Description | QUICK_SERVICE | CAFE | CASUAL_DINING | FINE_DINING | HOTEL_RESTAURANT | FOOD_COURT | BAR_BREWERY |
|---|---|---|---|---|---|---|---|---|
| `uses_tables` | Whether dine-in tables are assigned/used | `false` | `true` | `true` | `true` | `true` | `false` | `true` |
| `uses_token_numbers` | Daily sequential counter tokens | `true` | `false` | `false` | `false` | `false` | `true` | `false` |
| `uses_kds` | Kitchen display system enabled | `false` | `false` | `true` | `true` | `true` | `true` | `true` |
| `supports_courses` | Multi-course ordering (Starter, Main, Dessert) | `false` | `false` | `false` | `true` | `true` | `false` | `false` |
| `allows_takeaway` | Takeaway / counter pickup supported | `true` | `true` | `true` | `false` | `true` | `true` | `false` |
| `allows_room_service` | Delivery to hotel guest rooms | `false` | `false` | `false` | `false` | `true` | `false` | `false` |
| `allows_room_charge` | Post bill to guest room folio | `false` | `false` | `false` | `false` | `true` | `false` | `false` |
| `has_sections` | Section grouping within service areas | `false` | `false` | `true` | `true` | `true` | `false` | `true` |
| `has_seat_ordering` | Seat-level ordering breakdown | `false` | `false` | `false` | `true` | `true` | `false` | `false` |
| `allows_table_transfer` | Transfer/merge tables across floor | `false` | `true` | `true` | `true` | `true` | `false` | `true` |
| `allows_qr_ordering` | QR code ordering enabled | `true` | `true` | `true` | `true` | `true` | `true` | `true` |
| `payment_timing` | When payment occurs | `PAY_FIRST` | `EITHER` | `PAY_LATER` | `PAY_LATER` | `PAY_LATER` | `PAY_FIRST` | `PAY_LATER` |
| `qr_ordering_mode` | Mode of QR ordering | `BROWSE_ONLY` | `ORDER_DIRECT` | `ORDER_WITH_APPROVAL` | `BROWSE_ONLY` | `ORDER_WITH_APPROVAL` | `ORDER_DIRECT` | `ORDER_WITH_APPROVAL` |
| `qr_session_policy` | Who can start a QR dining session | `CUSTOMER_CAN_OPEN` | `CUSTOMER_CAN_OPEN` | `CUSTOMER_CAN_OPEN` | `STAFF_ONLY` | `STAFF_ONLY` | `CUSTOMER_CAN_OPEN` | `CUSTOMER_CAN_OPEN` |
| `order_workflow` | Primary order routing workflow | `COUNTER_TOKEN` | `TABLE_SERVICE` | `TABLE_SERVICE` | `TABLE_SERVICE` | `TABLE_SERVICE` | `COUNTER_TOKEN` | `BAR_TAB` |

## Validation Invariants (Rules R1 - R7)

1. **R1**: `order_workflow == COUNTER_TOKEN` requires `uses_token_numbers == True`.
2. **R2**: `order_workflow == TABLE_SERVICE` requires `uses_tables == True`.
3. **R3**: `order_workflow == ROOM_SERVICE` requires `allows_room_service == True`.
4. **R4**: `order_workflow == BAR_TAB` forbids `supports_courses == True` and requires `uses_tables == True`.
5. **R5**: `uses_tables == False` forbids `has_sections == True` and forbids `has_seat_ordering == True`.
6. **R6**: `allows_room_charge == True` requires `payment_timing == PAY_LATER`.
7. **R7**: `allows_qr_ordering == False` forbids `qr_ordering_mode` from being `ORDER_WITH_APPROVAL` or `ORDER_DIRECT`.
