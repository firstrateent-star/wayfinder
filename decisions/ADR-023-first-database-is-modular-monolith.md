# ADR-023 — First Wayfinder database is a modular monolith

**Status:** ACCEPTED  
**Decision:** Wayfinder begins on one Postgres/Supabase database with isolated module schemas rather than microservices or separate databases.

## Context

The first executable slice needs strong ownership boundaries without operational complexity. Direction, Evidence, Practice, and the System Kernel have distinct canonical responsibilities but do not yet justify distributed infrastructure.

## Decision

Use one physical Postgres/Supabase database with top-level schemas:

- `wf_system`
- `wf_direction`
- `wf_practice`
- `wf_evidence`

Each stateful module owns its canonical tables. Cross-module composition occurs through commands, resolvers, versioned references, evidence, and durable ModuleChange notifications—not hidden foreign writes.

## Consequences

- transactional guarantees remain simple inside each module;
- infrastructure cost and operational surface stay low;
- logical boundaries are preserved strongly enough for later extraction if real pressure appears;
- a shared physical database does not imply shared canonical ownership;
- microservices are deferred until evidence justifies them.