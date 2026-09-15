# ADR-017 — Start as a Modular Monolith

**Status:** Accepted

## Context

Wayfinder's logical boundaries are strong enough to support future service extraction, but the first executable product needs fast iteration, simple transactions, low operational overhead, and reliable correction/change semantics.

Premature microservices would add network failure modes, deployment complexity, distributed transaction problems, and slower learning before scale evidence exists.

## Decision

Start Wayfinder as a **modular monolith** on one Postgres/Supabase database.

Use:

- module-owned canonical tables;
- explicit command/read/reference contracts;
- shared System Kernel infrastructure for command receipts and transactional outbox;
- no direct cross-module canonical writes;
- on-demand projections where cheap;
- async/cached infrastructure only when justified by measured need.

## Consequences

Logical modularity is enforced even though physical persistence is shared.

A future module may be extracted behind its existing contracts if real scale, reliability, security, or organizational evidence justifies distribution.