# Venue Presets and Capability Matrix

Fusion Engine Restaurant SaaS provides out-of-the-box configuration profiles for 7 distinct Indian and global food service operational models. Each preset automatically pre-configures 11 strongly typed capability flags on `BranchCapabilities`.

---

## 1. Presets Overview

| Venue Profile | Representative Indian Venues | Payment Timing | QR Ordering Mode | QR Session Policy | Order Workflow | Table Mgmt | Sections | Seat Orders | Courses | Daily Tokens |
|---|---|---|---|---|---|:---:|:---:|:---:|:---:|:---:|
| **QUICK_SERVICE** | Chai shops, Darshinis, Bakeries, Food trucks, Sweets counters | PAY_FIRST | BROWSE_ONLY | AUTO_OPEN | COUNTER_TOKEN | ❌ | ❌ | ❌ | ❌ | ✅ |
| **CAFE** | Coffee shops, Bistro bakeries, Dessert parlours, Tea rooms | PAY_LATER | OPEN_TAB | AUTO_OPEN | TABLE_SEAT | ✅ | ❌ | ❌ | ❌ | ❌ |
| **CASUAL_DINING** | Family restaurants, Biryani houses, Udupi vegetarian, Pizzerias | PAY_LATER | OPEN_TAB | STRICT_WAIT_APPROVAL | TABLE_SEAT | ✅ | ✅ | ❌ | ❌ | ❌ |
| **FINE_DINING** | Heritage luxury dining, Speakeasy cocktail lounges, Chef tables | PAY_LATER | BROWSE_ONLY | STRICT_WAIT_APPROVAL | TABLE_SEAT | ✅ | ✅ | ✅ | ✅ | ❌ |
| **HOTEL_RESTAURANT** | Resort multi-outlets, 24/7 all-day diners, Room service operations | PAY_LATER | OPEN_TAB | STRICT_WAIT_APPROVAL | TABLE_SEAT | ✅ | ✅ | ✅ | ✅ | ❌ |
| **FOOD_COURT** | Mall food court stalls, IT park tech cafeterias, Drive-ins | PAY_FIRST | PAY_AT_TABLE | AUTO_OPEN | COUNTER_TOKEN | ❌ | ❌ | ❌ | ❌ | ✅ |
| **BAR_BREWERY** | Microbreweries, Pubs, Taprooms, Sports lounges | PAY_LATER | OPEN_TAB | AUTO_OPEN | TABLE_SEAT | ✅ | ✅ | ❌ | ❌ | ❌ |

---

## 2. Capability Details

1. **`payment_timing` (`PAY_FIRST` / `PAY_LATER`)**:
   - `PAY_FIRST`: Order requires counter settlement before kitchen tickets (KOT) fire. Standard for fast food, food courts, and tea stalls.
   - `PAY_LATER`: Tab accumulates across multiple rounds, settled at the end of the dining session.
2. **`qr_ordering_mode` (`DISABLED` / `BROWSE_ONLY` / `OPEN_TAB` / `PAY_AT_TABLE`)**:
   - `BROWSE_ONLY`: Customer scans table QR to view digital live menu and allergens only. Staff takes physical order.
   - `OPEN_TAB`: Customer places orders directly from their smartphone onto the active table session.
   - `PAY_AT_TABLE`: Customer selects items, pays immediately via UPI / gateway, then KOT fires with token.
3. **`qr_session_policy` (`STRICT_WAIT_APPROVAL` / `AUTO_OPEN`)**:
   - `STRICT_WAIT_APPROVAL`: QR scan shows table is unoccupied; customer must be seated and waiter must open table from staff POS before orders can be placed. Prevents accidental or rogue orders.
   - `AUTO_OPEN`: Customer scan instantly starts an active table session.
4. **`order_workflow` (`COUNTER_TOKEN` / `TABLE_SEAT` / `ROOM_SERVICE` / `DELIVERY_PICKUP`)**:
   - Determines kitchen dispatching, display screen grouping (KDS), and customer pickup announcements.
5. **`uses_token_numbers` (Boolean)**:
   - Issues daily auto-resetting sequential tokens (e.g. Token #1, Token #2) per service area / counter using atomic row-level database locking.
6. **`allows_room_charge` (Boolean)**:
   - Enables hotel room number verification and post-to-room billing workflows.
7. **`supports_courses` (Boolean)**:
   - Unlocks appetizer, starter, main, and dessert pacing controls for fine dining.

---

## 3. Override Capability
While presets apply intelligent defaults during branch creation, tenant owners can override individual flags at `PATCH /api/v1/branches/{id}/capabilities/`, subject to the tenant's active plan entitlements (e.g. `floor_editor`, `table_merge`, `courses`).

