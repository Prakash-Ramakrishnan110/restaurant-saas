# Venue Presets and Capability Matrix

Fusion Engine Restaurant SaaS provides out-of-the-box configuration profiles for 7 distinct Indian and global food service operational models. Each preset automatically pre-configures 11 strongly typed capability flags on `BranchCapabilities`.

---

## 1. Complete Capability Matrix (As Implemented)

| Venue Profile | Representative Venues | Tables | Tokens | KDS | Courses | Takeaway | Room Svc | QR Ordering | Payment Timing | QR Ordering Mode | QR Session Policy | Order Workflow |
|---|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|---|---|---|---|
| **QUICK_SERVICE** | Chai shops, Darshinis, Bakeries, Food trucks, Sweet counters | ❌ | ✅ | ❌ | ❌ | ✅ | ❌ | ✅ | `PAY_FIRST` | `BROWSE_ONLY` | `CUSTOMER_CAN_OPEN` | `COUNTER_TOKEN` |
| **CAFE** | Coffee shops, Bistro bakeries, Dessert parlours, Tea rooms | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ | ✅ | `EITHER` | `ORDER_PAY_FIRST` | `CUSTOMER_CAN_OPEN` | `COUNTER_TOKEN` |
| **CASUAL_DINING** | Family dining, Biryani houses, Udupi vegetarian, Pizzerias | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ | ✅ | `PAY_LATER` | **`ORDER_WITH_APPROVAL`** | `CUSTOMER_CAN_OPEN` | `TABLE_SERVICE` |
| **FINE_DINING** | Heritage luxury dining, Speakeasy bars, Chef tasting rooms | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ✅ | `PAY_LATER` | `BROWSE_ONLY` | `STAFF_ONLY` | `TABLE_SERVICE` |
| **HOTEL_RESTAURANT** | Resort outlets, 24/7 diners, Room service operations | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | `ROOM_CHARGE` | **`ORDER_WITH_APPROVAL`** | `STAFF_ONLY` | `TABLE_SERVICE` |
| **FOOD_COURT** | Mall food court stalls, Tech park cafeterias, Drive-ins | ❌ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | `PAY_FIRST` | `ORDER_DIRECT` | `CUSTOMER_CAN_OPEN` | `COUNTER_TOKEN` |
| **BAR_BREWERY** | Microbreweries, Pubs, Taprooms, Sports lounges | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ | `TAB` | `ORDER_PAY_LATER` | `CUSTOMER_CAN_OPEN` | `BAR_TAB` |

> [!NOTE]
> **Which profiles use `ORDER_WITH_APPROVAL`?**
> Both **`CASUAL_DINING`** and **`HOTEL_RESTAURANT`** use `ORDER_WITH_APPROVAL`. In these venues, customers can compose orders via table QR on their phones, but orders require waiter/staff confirmation before firing to the kitchen (KOT) or posting to the hotel folio.

---

## 2. Enum Definitions

### `qr_ordering_mode` (`QROrderingMode`)
Defines the permitted ordering behavior when a customer scans a table QR code:
- **`DISABLED`**: QR ordering is completely turned off. Scans are rejected.
- **`BROWSE_ONLY`**: View-only digital menu with real-time item availability and allergens. Orders must be placed with physical waitstaff.
- **`ORDER_PAY_LATER`**: Customer places orders directly to table tab; payment collected at end of dining session.
- **`ORDER_PAY_FIRST`**: Customer must pay immediately via UPI/card gateway before order is accepted and fired to kitchen.
- **`ORDER_WITH_APPROVAL`**: Customer submits order from smartphone; designated waiter or cashier receives real-time notification to review and approve before KOT is dispatched.
- **`ORDER_DIRECT`**: Customer order bypasses approval and dispatches immediately with a pickup token.
- **`DIRECT_TO_KITCHEN`**: Direct KOT generation for specialized unattended stations.

### `qr_session_policy` (`QRSessionPolicy`)
Controls session initiation security and table occupancy rights:
- **`CUSTOMER_CAN_OPEN`**: First customer scan automatically opens a new `TableSession` if table is available.
- **`STAFF_ONLY`**: Customer scan cannot open a session on an unoccupied table. Waitstaff or host must seat guests and open the session from the staff POS before customer QR ordering becomes active. Prevents rogue scans or accidental orders on empty tables.

### `payment_timing` (`PaymentTiming`)
- **`PAY_FIRST`**: Upfront settlement prior to kitchen ticket routing.
- **`PAY_LATER`**: Post-meal settlement upon requesting final bill.
- **`EITHER`**: Counter or table payment depending on customer preference.
- **`ROOM_CHARGE`**: Posted directly to registered hotel room guest folio.
- **`TAB`**: Open bar tab running against pre-authorized card or identity.

### `order_workflow` (`OrderWorkflow`)
- **`COUNTER_TOKEN`**: Dispatches with atomic sequential token number for collection display board.
- **`TABLE_SERVICE`**: Routed to specific table and section with waiter assignment.
- **`BAR_TAB`**: Routed to bar dispense station under running guest tab.
- **`ROOM_SERVICE`**: Routed to room service pantry with tray delivery dispatch.

---

## 3. Business Type to Venue Profile Recommendation

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
