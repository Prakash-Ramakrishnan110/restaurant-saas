# Project Architecture & Specification Deviations Log

This document records deliberate, accepted design decisions and differences between initial prompt specifications and final production implementation.

## Deviations Matrix

| ID | Topic | Initial Spec / Early Prompt | Production Implementation | Rationale |
|---|---|---|---|---|
| DEV-001 | Database Port | `5432` host port | `127.0.0.1:5435 -> 5432` | Host development environment had existing PostgreSQL versions running on 5432, 5433, and 5434. Binding to loopback `127.0.0.1:5435` prevents port conflicts while securing the database from external network interfaces. |
| DEV-002 | Celery Idle Session Task | `apps.core.tasks.expire_idle_sessions_task` | `apps.venues.services.expire_idle_sessions_task` | Session management logic and models (`TableSession`) live directly within the `venues` domain app, preserving clean architectural domain boundaries. |
| DEV-003 | Error Code HTTP Statuses | Mixed 400s for conflict states | 409 Conflict for `LAST_OWNER`, `SESSION_ALREADY_OPEN`, `TABLE_NOT_AVAILABLE`, `DUPLICATE_LABEL` | Standard REST semantics: resource state conflicts (concurrency, existing sessions, duplicate unique identifiers, last owner removal) return HTTP 409 Conflict instead of HTTP 400 Bad Request. |
| DEV-004 | Invariant Rules on PATCH | Full replacement check only | Invariant rules R1-R7 validated against merged state on partial `PATCH` | Ensures partial updates to single capability fields cannot put the venue configuration into an illegal state (e.g., toggling `uses_tables=False` while `has_sections=True`). |
| DEV-005 | QR Ordering Capabilities | Multi-field legacy flags (`ORDER_PAY_FIRST`, `ROOM_CHARGE` timing) | Unified 15-field matrix with explicit `allows_room_charge` boolean and simplified `payment_timing` (`PAY_FIRST`, `PAY_LATER`, `EITHER`) | Eliminates ambiguity, prevents contradictory state combinations, and aligns with database migration `0005`. |
| DEV-006 | Brand Color Accessibility | White text on Orange `#FF6A00` | Deep Navy `#0B1F3B` on Orange `#FF6A00` (5.7:1 contrast ratio) | WCAG AA compliance requires at least 4.5:1 contrast for normal text and 3:1 for large UI components. White on `#FF6A00` only achieved 2.87:1, failing accessibility standards. |
