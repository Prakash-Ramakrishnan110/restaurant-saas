# ADR 0010: Order Routing, Workflow Overrides, and Anchor Models

## Status
Accepted

## Context
In restaurant and hospitality operations, ordering flows vary significantly across service areas within the same venue. A fine dining restaurant may offer a traditional table service dining room alongside a casual bar counter. Similarly, a food court stall or fast-casual venue operates entirely on counter-based token dispatch without table occupancy tracking.

To prepare for Prompts 5 (Orders & POS) and 6 (Kitchen & KDS) without retroactive database refactoring, we formalize the order routing architecture, workflow overrides, and anchor models.

## Architectural Decisions

### 1. Service Area Workflow Overrides
- **Branch Defaults**: Each branch defines baseline capabilities via `BranchCapabilities` (`uses_tables`, `uses_token_numbers`, `uses_kds`, `allows_takeaway`, `allows_room_service`, `allows_room_charge`, `uses_courses`).
- **Area-Level Overrides**: Each `ServiceArea` specifies its dedicated `OrderWorkflow` (`TABLE_SERVICE`, `COUNTER_TOKEN`, `BAR_TAB`, `ROOM_SERVICE`).
- **Routing Precedence**: When an order is placed, the order routing engine inspects the target `ServiceArea` first:
  1. If `service_area.order_workflow` is set, it overrides the venue-wide default.
  2. If unset, it inherits from the branch profile preset.

### 2. Counter Token Orders Without Table Sessions
- In counter-service workflows (`COUNTER_TOKEN`), diners do not occupy a persistent physical table session before placing an order.
- Orders in counter areas anchor directly to a `TokenCounter` sequence per branch/service-date/service-area.
- `Order` model will support nullable `table_session_id` when `workflow == COUNTER_TOKEN`.
- Kitchen dispatch (KDS) tracks orders by `(service_date, token_number)` instead of table labels.

### 3. Pay-First QR Order & Awaiting-Payment Flow
- For service areas configured with `payment_timing == PaymentTiming.PAY_FIRST` and customer self-ordering:
  1. Diner scans table QR or counter QR.
  2. Diner adds items to draft cart and submits order.
  3. The system transitions the order into status `AWAITING_PAYMENT`.
  4. Order is NOT routed to the Kitchen Display System (KDS) or printed at kitchen stations while in `AWAITING_PAYMENT`.
  5. Upon successful payment verification (webhook / gateway confirmation / cashier mark-paid), the order transitions to `CONFIRMED` and is instantly routed to KDS stations.
- For `PAY_LATER` workflows:
  1. Order is directly placed into the active table session.
  2. Order is immediately routed to KDS in `CONFIRMED` status.
  3. Payment occurs at table close or checkout.

## Consequences
- Orders maintain clear lifecycle separation between session-anchored dine-in and token-anchored counter workflows.
- Kitchen display logic avoids phantom unpaid tickets in pay-first operations.
- Floor and POS interfaces can seamlessly handle hybrid venues (e.g. restaurant dining + bar tab + takeaway counters) under a single branch.
