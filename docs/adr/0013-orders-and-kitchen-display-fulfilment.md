# ADR 0013: Orders and Kitchen Display Fulfilment (KDS) Architecture

## Status
Accepted

## Context
Commercial kitchen operations require instantaneous ticket routing, clear visual priority cues, station-based decomposition of complex dining orders, and race-free state transitions under heavy rush conditions. In Pilot 1, kitchen tickets must support staff-entered table orders and counter takeaway without relying on complex external hardware.

## Decision

### 1. Order State Machine
Orders transition through a strict, unidirectional state machine:
- `DRAFT` -> `PLACED` -> `PREPARING` -> `READY` -> `SERVED` -> `COMPLETED`
- `CANCELLED` is allowed only from `DRAFT` or `PLACED`. Once kitchen preparation has begun (`PREPARING`), cancellations require manager authorization with a mandatory audit reason.

### 2. Station-Based Decomposition
- Every menu item specifies a default preparation station (`MAIN_KITCHEN`, `GRILL`, `TANDOOR`, `BAR_BEVERAGE`, `DESSERT`, `COLD_PREP`).
- When an order containing multiple items is placed, the backend creates station-specific KDS ticket views.
- Kitchen bump actions can mark entire tickets as ready or individual line items independently.

### 3. Course Pacing
Orders support course categorization (`STARTER`, `MAIN`, `DESSERT`, `BEVERAGE`):
- Starters are routed immediately with `FIRE` status.
- Mains default to `HOLD` until the floor waiter or captain explicitly triggers `FIRE MAINS` from the floor terminal.

### 4. SLA Timers & Visual Alerting
- KDS cards calculate elapsed duration since placement:
  - **0 - 10 mins**: Normal Green accent
  - **10 - 20 mins**: Caution Amber accent (`#D97706`)
  - **> 20 mins**: Urgent Red pulsing border (`#DC2626`)
- Audio chime (Web Audio API synthesized bell tone) rings when new tickets land on the active station.

### 5. Polling & Syncing Model
- In Pilot 1, KDS screens utilize 3-second short polling with TanStack Query.
- In Phase 2, this will be upgraded to Redis pub/sub WebSocket streaming.

## Consequences
- Clean separation between overall order state and individual kitchen preparation progress.
- Prevents items from different preparation stations from blocking each other's status progression.

