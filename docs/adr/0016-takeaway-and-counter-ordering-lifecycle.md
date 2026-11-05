# ADR 0016: Takeaway and Counter Ordering Lifecycle

## Status
Accepted

## Context
Quick-service restaurants, tea stalls, and fast-casual takeaway counters do not operate table sessions. Instead, orders are taken at the counter, paid immediately or on pickup, and identified by a race-free sequential token (`COUNTER_TOKEN`). The order lifecycle must minimize touch interaction while maintaining full auditability.

## Decision

### 1. Counter Token Generation
- For takeaway and counter orders (`order_type = TAKEAWAY`), the order is anchored to a daily sequential token rather than a `TableSession`.
- Tokens reset to 1 every midnight in the branch's local timezone.
- Tokens are acquired using atomic PostgreSQL sequence incrementation (`nextval`) to guarantee race-free uniqueness under high concurrency without table lock contention.

### 2. High-Velocity Takeaway POS Interface
- Designed for speed: a 2-tap ordering flow on touchscreen terminals.
- Cashier selects items -> taps "Cash Settle" -> instant thermal print of Kitchen Order Ticket (KOT) and customer token receipt.
- Time from customer greeting to receipt print: < 10 seconds.

### 3. Customer Pickup Notification
- **Public Screen View**: Responsive HDMI display mode showing:
  - **Now Preparing**: List of active token numbers currently in production.
  - **Ready for Collection**: Highlighting ready tokens with an audible tone.
- **SMS/WhatsApp Hook (Optional)**: If the customer provides a phone number, an automated notification fires when the ticket is marked `READY`.

### 4. Tax Treatment Distinction
- Certain jurisdictions (and GST provisions) distinguish between Dine-In (AC restaurant tax rate) and Takeaway / Counter sales.
- The order type (`DINE_IN` vs `TAKEAWAY`) is captured on the order header and propagated to the billing engine to apply appropriate tax slabs.

## Consequences
- Single unified order architecture supports both seated table dining and rapid counter takeaway.
- Eliminates queue bottlenecks at quick-service and takeaway counters.

