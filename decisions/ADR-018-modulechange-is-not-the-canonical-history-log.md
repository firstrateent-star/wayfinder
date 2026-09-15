# ADR-018 — ModuleChange Is Not the Canonical History Log

**Status:** Accepted

## Context

Wayfinder needs reliable change notification for projection invalidation, read-index updates, and other downstream work. It does not need every stateful module to become an event-sourced system.

Treating the change stream as authoritative replay would introduce ordering/completeness constraints that are unnecessary for the first product and would conflict with the decision not to mandate event sourcing.

## Decision

`ModuleChange` is a durable **change/invalidation notification**, not automatically a complete ordered event-sourcing ledger.

Canonical truth remains in the owning stateful module.

Consumers that need current truth re-resolve canonical records/reads after receiving a change unless that module explicitly offers a stronger replay contract.

Change publication is transactionally coupled through an outbox or equivalent and may be delivered at least once; consumers are idempotent.

## Consequences

Out-of-order or duplicate notification does not redefine truth.

Modules may later add ordered replay contracts where justified without forcing that complexity onto every module.