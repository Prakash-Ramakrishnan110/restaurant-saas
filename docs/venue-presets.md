# Venue Presets and Capability Matrix

Fusion Engine Restaurant SaaS provides out-of-the-box configuration profiles for 7 distinct Indian and global food service operational models. Each preset automatically pre-configures 15 strongly typed capability flags on `BranchCapabilities`.

---

## 1. Complete Capability Matrix (As Implemented)

| Venue Profile | Representative Venues | Tables | Tokens | KDS | Courses | Takeaway | Room Svc | Room Chg | Sections | Seats | Transfer | QR Ord | Payment Timing | QR Ordering Mode | QR Session Policy | Order Workflow |
|---|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|---|---|---|---|
| **QUICK_SERVICE** | Chai shops, Darshinis, Bakeries, Food trucks, Sweet counters | ❌ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | `PAY_FIRST` | `BROWSE_ONLY` | `CUSTOMER_CAN_OPEN` | `COUNTER_TOKEN` |
| **CAFE** | Coffee shops, Bistro bakeries, Dessert parlours, Tea rooms | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ | `EITHER` | `ORDER_DIRECT` | `CUSTOMER_CAN_OPEN` | `TABLE_SERVICE` |
| **CASUAL_DINING** | Family dining, Biryani houses, Udupi vegetarian, Pizzerias | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | `PAY_LATER` | `ORDER_WITH_APPROVAL` | `CUSTOMER_CAN_OPEN` | `TABLE_SERVICE` |
| **FINE_DINING** | Heritage luxury dining, Speakeasy bars, Chef tasting rooms | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | `PAY_LATER` | `BROWSE_ONLY` | `STAFF_ONLY` | `TABLE_SERVICE` |
| **HOTEL_RESTAURANT** | Resort outlets, 24/7 diners, Room service operations | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | `PAY_LATER` | `ORDER_WITH_APPROVAL` | `STAFF_ONLY` | `TABLE_SERVICE` |
| **FOOD_COURT** | Mall food court stalls, Tech park cafeterias, Drive-ins | ❌ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | `PAY_FIRST` | `ORDER_DIRECT` | `CUSTOMER_CAN_OPEN` | `COUNTER_TOKEN` |
| **BAR_BREWERY** | Microbreweries, Pubs, Taprooms, Sports lounges | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | `PAY_LATER` | `ORDER_WITH_APPROVAL` | `CUSTOMER_CAN_OPEN` | `BAR_TAB` |

> [!NOTE]
> **Cafe Preset Justification**:
> Cafés feature seated table service (`uses_tables=True`, `order_workflow=TABLE_SERVICE`) where customers can pay either upfront at counter or at table end (`payment_timing=EITHER`), and orders can be placed directly from the table QR menu (`qr_ordering_mode=ORDER_DIRECT`).
>
> **Which profiles use `ORDER_WITH_APPROVAL`?**
> Both **`CASUAL_DINING`**, **`HOTEL_RESTAURANT`**, and **`BAR_BREWERY`** use `ORDER_WITH_APPROVAL`. In these venues, customers can compose orders via table QR on their phones, but orders require waiter/staff confirmation before firing to the kitchen (KOT) or posting to the hotel folio.

---

## 2. Invariant Capability Validation Rules

The service layer (`validate_capabilities`) and serializers enforce 6 invariant consistency rules with error code `INVALID_CAPABILITY_COMBINATION`:
1. `COUNTER_TOKEN` workflow requires `uses_token_numbers=True`
2. `TABLE_SERVICE` workflow requires `uses_tables=True`
3. `ROOM_SERVICE` workflow requires `allows_room_service=True`
4. `uses_courses=True` requires `uses_tables=True`
5. `allows_room_charge=True` requires `payment_timing != PAY_FIRST` (`PAY_LATER` or `EITHER`)
6. `qr_ordering_mode in ['ORDER_WITH_APPROVAL', 'ORDER_DIRECT']` requires `allows_qr_ordering=True`

---

## 3. Enum Definitions

### `payment_timing` (`PaymentTiming`)
- **`PAY_FIRST`**: Upfront settlement prior to kitchen ticket routing (QSR, food court).
- **`PAY_LATER`**: Post-meal settlement upon requesting final bill (Casual, fine dining, bar, hotel).
- **`EITHER`**: Counter or table payment depending on guest workflow (Café).

### `qr_ordering_mode` (`QROrderingMode`)
Defines the permitted ordering behavior when a customer scans a table QR code:
- **`DISABLED`**: QR ordering is completely turned off. Scans are rejected.
- **`BROWSE_ONLY`**: View-only digital menu with real-time item availability and allergens. Orders must be placed with physical waitstaff.
- **`ORDER_WITH_APPROVAL`**: Customer submits order from smartphone; designated waiter or cashier receives real-time notification to review and approve before KOT is dispatched.
- **`ORDER_DIRECT`**: Customer order dispatches directly to kitchen/bar upon submission.

### `qr_session_policy` (`QRSessionPolicy`)
Controls session initiation security and table occupancy rights:
- **`CUSTOMER_CAN_OPEN`**: First customer scan automatically opens a new `TableSession` if table is available.
- **`STAFF_ONLY`**: Customer scan cannot open a session on an unoccupied table. Waitstaff or host must seat guests and open the session from staff POS before customer QR ordering becomes active.

### `order_workflow` (`OrderWorkflow`)
- **`COUNTER_TOKEN`**: Dispatches with atomic sequential token number for collection display board.
- **`TABLE_SERVICE`**: Routed to specific table and section with waiter assignment.
- **`BAR_TAB`**: Routed to bar dispense station under running guest tab.
- **`ROOM_SERVICE`**: Routed to room service pantry with tray delivery dispatch.
- **`FAST_FOOD_DISPLAY`**: Routed to order preparation queue with front-of-house pickup display.
- **`DRIVE_THRU`**: Routed to drive-thru window workflow.

---

## 4. Business Type to Venue Profile Recommendation

When onboarding a new restaurant tenant, `suggest_venue_profile(business_type)` provides intelligent defaults:

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
