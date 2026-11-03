# ADR 0006: Table Sessions as the Primary Order Anchor

## Status
Accepted

## Context
In hospitality software, naive architectures attach line items and customer orders directly to a physical `Table` foreign key. In real-world dining, physical tables present severe operational limitations:
1. **Table Transfers**: A guest moves from table T3 to outdoor booth B12. If orders link to `Table`, all active order records, kitchen tickets, and billing drafts must be updated across multiple tables.
2. **Table Merges and Splits**: A party of 8 joins tables T4 and T5. Orders are placed across both physical tables. Splitting them later creates orphaned or double-counted items.
3. **Turnover & Concurrency**: If orders link directly to tables, historical orders must be filtered out by timestamps, inviting race conditions when Table 1 is re-seated while the prior party's bill is still finalizing at the counter.

## Decision
All orders, kitchen tickets, and billing instances attach strictly to a **`TableSession`** entity rather than directly to a `DiningTable`.
- A `TableSession` represents a discrete, bounded dining party lifecycle: `OPEN` -> `CLOSED` (or `EXPIRED`).
- A `TableSession` links to either a single `DiningTable` or a joined `TableGroup`.
- If a guest changes tables, only the `TableSession.table` reference is updated; all orders, kitchen tickets, and billing tickets remain anchored to the session without disruption.
- When tables are merged, a single active `TableSession` attaches to the `TableGroup`.
- The session lifecycle governs physical table status: opening a session marks the table `OCCUPIED`; closing the session transitions the table to `DIRTY` (or `AVAILABLE` if auto-turnover is enabled).
- Inactivity expiration: A Celery periodic beat task automatically closes abandoned sessions after 3 hours of inactivity (`last_activity_at`).

## Consequences
### Positive
- Zero data mutation on order or kitchen rows when guests change tables or join seating.
- Clean audit trail: Each dining party has an immutable session boundary with timestamps, guest count, and opened-via provenance (`STAFF_POS`, `QR_CUSTOMER`, `RESERVATION`).
- Public QR order tokens tie securely to a specific `TableSession`, preventing new parties from seeing or adding to a prior guest's tab.

### Negative / Trade-offs
- An active session must exist before an order can be accepted for dine-in workflows.

