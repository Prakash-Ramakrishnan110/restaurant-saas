# Venue Presets and Capability Matrix

Fusion Engine Restaurant SaaS provides out-of-the-box configuration profiles for 7 distinct Indian and global food service operational models. Each preset automatically pre-configures 15 strongly typed capability fields (11 booleans and 4 enums) on `BranchCapabilities` with zero duplicate property aliases.

---

## 1. Complete Capability Matrix (Every Venue Profile vs. Every Capability Field & Enum)

| Venue Profile | `uses_tables` | `uses_kds` | `uses_token_numbers` | `allows_takeaway` | `allows_room_service` | `allows_room_charge` | `allows_qr_ordering` | `has_sections` | `has_seat_ordering` | `supports_courses` | `allows_table_transfer` | `payment_timing` | `qr_ordering_mode` | `qr_session_policy` | `order_workflow` |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|---|---|---|---|
| **QUICK_SERVICE** | `False` | `False` | `True` | `True` | `False` | `False` | `True` | `False` | `False` | `False` | `False` | `PAY_FIRST` | `BROWSE_ONLY` | `CUSTOMER_CAN_OPEN` | `COUNTER_TOKEN` |
| **CAFE** | `True` | `True` | `False` | `True` | `False` | `False` | `True` | `True` | `False` | `False` | `True` | `EITHER` | `ORDER_DIRECT` | `CUSTOMER_CAN_OPEN` | `TABLE_SERVICE` |
| **CASUAL_DINING** | `True` | `True` | `False` | `True` | `False` | `False` | `True` | `True` | `True` | `False` | `True` | `PAY_LATER` | `ORDER_WITH_APPROVAL` | `CUSTOMER_CAN_OPEN` | `TABLE_SERVICE` |
| **FINE_DINING** | `True` | `True` | `False` | `False` | `False` | `False` | `True` | `True` | `True` | `True` | `True` | `PAY_LATER` | `BROWSE_ONLY` | `STAFF_ONLY` | `TABLE_SERVICE` |
| **HOTEL_RESTAURANT** | `True` | `True` | `False` | `True` | `True` | `True` | `True` | `True` | `True` | `True` | `True` | `PAY_LATER` | `ORDER_WITH_APPROVAL` | `STAFF_ONLY` | `TABLE_SERVICE` |
| **FOOD_COURT** | `False` | `True` | `True` | `True` | `False` | `False` | `True` | `False` | `False` | `False` | `False` | `PAY_FIRST` | `ORDER_DIRECT` | `CUSTOMER_CAN_OPEN` | `COUNTER_TOKEN` |
| **BAR_BREWERY** | `True` | `True` | `False` | `False` | `False` | `False` | `True` | `True` | `True` | `False` | `True` | `PAY_LATER` | `ORDER_WITH_APPROVAL` | `CUSTOMER_CAN_OPEN` | `BAR_TAB` |

---

## 2. Invariant Capability Validation Rules (R1–R7)

The service layer (`validate_capabilities`) and `BranchCapabilitiesSerializer` enforce 7 invariant consistency rules with error code `INVALID_CAPABILITY_COMBINATION`, reporting the offending field names in `error.details`:

- **R1**: `order_workflow == COUNTER_TOKEN` requires `uses_token_numbers = true` (offending fields: `order_workflow`, `uses_token_numbers`)
- **R2**: `order_workflow == TABLE_SERVICE` requires `uses_tables = true` (offending fields: `order_workflow`, `uses_tables`)
- **R3**: `order_workflow == ROOM_SERVICE` requires `allows_room_service = true` (offending fields: `order_workflow`, `allows_room_service`)
- **R4**: `supports_courses = true` requires `uses_tables = true` (offending fields: `supports_courses`, `uses_tables`)
- **R5**: `has_sections = true` and `has_seat_ordering = true` each require `uses_tables = true` (offending fields: `has_sections` / `has_seat_ordering`, `uses_tables`)
- **R6**: `allows_room_charge = true` requires `payment_timing != PAY_FIRST` (offending fields: `allows_room_charge`, `payment_timing`)
- **R7**: `qr_ordering_mode` in (`ORDER_WITH_APPROVAL`, `ORDER_DIRECT`) requires `allows_qr_ordering = true` (offending fields: `qr_ordering_mode`, `allows_qr_ordering`)

---

## 3. Enum Values and Plain-Language Meanings

### `payment_timing` (`PaymentTiming`)
- **`PAY_FIRST`**: Guests pay upfront before the order is sent to the kitchen or counter queue (used in `QUICK_SERVICE` and `FOOD_COURT`).
- **`PAY_LATER`**: Guests settle their bill at the end of the meal after dining (used in `CASUAL_DINING`, `FINE_DINING`, `HOTEL_RESTAURANT`, and `BAR_BREWERY`).
- **`EITHER`**: Branch accepts both upfront counter payment and end-of-meal table settlement (used in `CAFE`).

### `qr_ordering_mode` (`QROrderingMode`)
- **`DISABLED`**: Public QR scanning and digital menus are completely disabled for the branch.
- **`BROWSE_ONLY`**: Guests can scan the QR code to view the digital menu and prices, but cannot submit orders from their phone (used in `QUICK_SERVICE` and `FINE_DINING`).
- **`ORDER_WITH_APPROVAL`**: Guests submit orders via QR on their phone, and staff must review and approve the order before it fires to the kitchen (used in `CASUAL_DINING`, `HOTEL_RESTAURANT`, and `BAR_BREWERY`).
- **`ORDER_DIRECT`**: Guests submit orders via QR (after payment in `PAY_FIRST` venues or onto an open tab) and tickets route directly to the kitchen/KDS without manual waiter approval (used in `CAFE` and `FOOD_COURT`).

### `qr_session_policy` (`QRSessionPolicy`)
- **`CUSTOMER_CAN_OPEN`**: Scanning an available table's QR code allows a customer to automatically start a new `TableSession` (used in `QUICK_SERVICE`, `CAFE`, `CASUAL_DINING`, `FOOD_COURT`, and `BAR_BREWERY`).
- **`STAFF_ONLY`**: Only authenticated staff can open a `TableSession` on an unoccupied table; customers scanning an unopened table receive `STAFF_ACTION_REQUIRED` until seated by a host (used in `FINE_DINING` and `HOTEL_RESTAURANT`).

### `order_workflow` (`OrderWorkflow`)
- **`COUNTER_TOKEN`**: Orders issue an atomic daily token number (`TokenCounter`) for counter pickup without table seating (used in `QUICK_SERVICE` and `FOOD_COURT` presets).
- **`TABLE_SERVICE`**: Orders are bound to a `DiningTable` or `TableGroup` session and served by waitstaff at the table (used in `CAFE`, `CASUAL_DINING`, `FINE_DINING`, and `HOTEL_RESTAURANT` presets).
- **`BAR_TAB`**: Orders accumulate on a running bar tab under a guest session with drink-first dispatch (used in `BAR_BREWERY` preset).
- **`ROOM_SERVICE`**: Orders are routed to hotel in-room dining pantries for guest room delivery (custom branch override for hotel room-service-only outlets when `allows_room_service=True`).
- **`FAST_FOOD_DISPLAY`**: Orders route to a KDS preparation queue and front-of-house customer collection number screen (custom branch override for high-volume QSR outlets with digital pickup boards).
- **`DRIVE_THRU`**: Orders route through a vehicle lane order-bay and pickup-window queue (custom branch override for drive-thru lanes in QSR chains).

---

## 4. Business Type to Venue Profile Recommendation

When onboarding a new restaurant tenant, `suggest_venue_profile(business_type)` provides default branch profile mappings:

| Tenant `business_type` | Recommended Branch `venue_profile` |
|---|---|
| `TEA_SHOP` | `QUICK_SERVICE` |
| `BAKERY` | `QUICK_SERVICE` |
| `CAFE` | `CAFE` |
| `RESTAURANT` | `CASUAL_DINING` |
| `FINE_DINING` | `FINE_DINING` |
| `HOTEL` | `HOTEL_RESTAURANT` |
| `FOOD_COURT` | `FOOD_COURT` |
| `CHAIN` | `CASUAL_DINING` |
