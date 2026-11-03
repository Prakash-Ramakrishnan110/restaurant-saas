# ADR 0001: Modular Monolith Architecture

## Status
Accepted

## Context
Fusion Engine Technology is building a multi-tenant Restaurant Management SaaS. The system will encompass branches, staff, menus, tables, orders, kitchen display, printing, billing, POS, and inventory. While high modularity and domain separation are essential, microservices introduce premature distributed systems complexity (network latency, distributed transactions, orchestration overhead) at this foundational stage.

## Decision
Adopt a Modular Monolith architecture pattern within Django.
- Monorepo containing `/backend` (Django), `/frontend` (React), `/print-bridge` (IoT print daemon), and `/docs`.
- Backend is organized into distinct, domain-bounded Django apps (`core`, `tenants`, `accounts`, `rbac`, `audit`, `subscriptions`).
- Strict layer separation: Views handle HTTP concerns and serialization; domain business logic resides strictly in `services.py`.
- Inter-app communication is facilitated via service function calls or domain events rather than direct cross-boundary model manipulation.

## Consequences
### Positive
- Single database transaction boundary guarantees strong consistency across tenant operations.
- Simplified local development, testing, and unified CI/CD deployment pipelines.
- Clean domain boundaries enable extracting hot modules (e.g., printing or real-time ordering) into dedicated microservices later if scaling demands dictate.

### Negative / Trade-offs
- Requires discipline and code reviews to prevent leaky abstractions between apps.

## Alternatives Considered
- Microservices from Day 1: Rejected due to unnecessary operational complexity, networking latency, and complex saga transactions.
- Traditional single-app Django structure: Rejected because sprawling models and views quickly degrade maintainability.

