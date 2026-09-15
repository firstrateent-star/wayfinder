# System Architecture Stress Test — v0.2

**Target:** `docs/02-system-architecture.md` v0.2  
**Context:** Ontology and Object Contracts/Domain Protocol have passed first stability gates.  
**Result:** architecture is sound but needs clearer execution topology and consistency boundaries before database design.

## 1. Canonical write is not always a lived Event

Creating a Direction node, correcting an Observation, or adding an EvidenceLink are canonical writes but not necessarily lived-life Events.

**Failure:** current command flow ends in `Fact/Event → Derivations`, which is too narrow.

**Change:** use `Canonical record(s) → durable DomainChange → derived reads/projections`.

## 2. Direction and Evidence are stateful but are not life domains

Direction and Evidence have their own canonical records, commands, validation, versions, and ownership.

**Finding:** they should follow the same write/reference/version laws as domains without pretending they are life domains.

**Change:** define them as **core stateful modules**. Life Domains and core stateful modules both obey shared command/record/change protocols.

## 3. Frontend writes directly to Supabase

If Helm inserts `practice_sessions` directly, it can bypass command validation, idempotency, outbox, version preconditions, and authorization semantics.

**Rule:** canonical mutation is command-only. UI may use stable read APIs/views, but direct table mutation is not an accepted application path.

## 4. One database or many services?

The boundaries could be implemented as microservices, but doing so now would add network failure, distributed transactions, deployment complexity, and slower iteration without improving the first product.

**Decision candidate:** start as a **modular monolith on one Postgres/Supabase database** with explicit module ownership and transactional outbox. Contracts are designed so a module can be extracted later if real evidence justifies it.

## 5. User logs practice and immediately opens Helm

Canonical Practice write is committed, but a cached projection worker has not updated yet.

**Need:** distinguish consistency classes.

- canonical writes/read-after-write inside owning module: strong enough for immediate confirmation;
- cross-module/shared evidence: may be eventually consistent;
- cached projections: may be eventually consistent and expose freshness;
- cheap read projections: may be computed on demand to avoid premature worker complexity.

## 6. Projection worker is down

Practice logging must still work.

**Pass if:** derivation failure never rolls back or invalidates source truth. Helm can degrade gracefully or compute simple reads on demand.

## 7. AI is down

The app must still log sessions, read Journey, maintain Direction, and explain deterministic projections.

**Rule:** intelligence is an optional consumer/orchestrator above canonical systems, not a dependency for basic truth capture.

## 8. One workflow touches Practice and Direction

Logging a PracticeSession may relate to an Action/Outcome.

**Boundary:** Practice owns the session; Direction owns intent; Evidence owns epistemic linkage. Do not hide a cross-module transaction inside Practice.

The first slice may use a small orchestrator that issues separate commands and surfaces partial completion/retry.

## 9. Read model bypasses domain boundaries for speed

A giant SQL query directly joins every private domain table.

**Risk:** backend becomes one tightly coupled schema despite nominal modules.

**Rule:** composition uses stable exported reads/views/resolvers. Same-database deployment is not permission to erase module boundaries.

## 10. Versioned lineage and database size

History, corrections, command receipts, outbox, and projections can all grow.

**Boundary:** keep canonical history/provenance; caches and projections are disposable. Retention for command transport/outbox may differ from retention for canonical evidence-bearing versions. Do not retain everything forever merely because it exists.

## 11. First slice is too broad

Current roadmap can be read as building identity, Direction, Evidence, Reflection, projections, Helm, and Navigator before Wayfinder is usable.

**Change:** define one narrow vertical slice that reaches the screen quickly and deliberately exercises correction, retry, and lineage—not just the happy path.

## Proposed first execution topology

```text
UI / Helm
   |
   | commands + reads
   v
Application / Orchestration Layer
   |
   +--> Identity/System Kernel
   +--> Direction Core Module
   +--> Evidence Core Module
   +--> Practice Life Domain
   |
   v
Single Postgres/Supabase database
   - module-owned tables
   - command receipts
   - transactional outbox
   - stable exported reads/views/RPCs

Derived Read Layer
   - on-demand simple projections first
   - cached/async projections only when earned

Intelligence
   - reads context
   - proposes commands
   - never required for basic canonical operation
```

## Reflection

The layered model survives. The key architectural improvement is to separate **logical modularity** from **physical distribution**. We want strong boundaries without premature microservices.

Revise architecture around a modular monolith, explicit consistency classes, core stateful modules, and command-only mutation; then re-run.