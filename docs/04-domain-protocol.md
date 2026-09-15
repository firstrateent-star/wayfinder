# Wayfinder Stateful Module Protocol

**Version:** 0.4  
**Status:** CANDIDATE-STABLE

A Wayfinder **stateful module** is a bounded owner of canonical records, rules, commands, reads, and failure behavior.

There are two initial module families:

- **core modules** — shared canonical capabilities such as Direction, Evidence, and authored Meaning/Reflection where appropriate;
- **life-domain modules** — independently understandable areas of lived reality such as Practice, Training, Finance, Relationships, Creative, Home, or Inner Life.

A life domain is therefore one module kind, not the universal operational abstraction.

The protocol exists so new modules can join Wayfinder without weakening truth boundaries or requiring scattered core edits.

## A stateful module owns

- its persistence schema
- validation rules
- canonical records
- record/version lifecycle semantics
- command handlers
- semantic duplicate prevention
- module-specific measurements/derivations where appropriate
- read models or read adapters
- reference resolution for its own records

A life-domain module does **not** automatically own cross-domain Direction, Evidence, Character, or other shared/core records merely because its facts contribute to them.

## A stateful module exposes

At minimum:

1. **identity** — stable module id, kind, and implementation version
2. **public identifiers** — stable machine ids for record types, command types, read types, and change types
3. **commands** — allowed requests for canonical mutation
4. **validation** — payload, authority, ownership, lifecycle, and precondition rules
5. **references** — stable `RecordRef` / `EntityRef` resolution surfaces
6. **version resolution** — `RecordVersionRef` resolution, including explicit redacted/deleted/unavailable/missing states
7. **reads** — bounded authorized query surfaces
8. **changes** — durable `ModuleChange` publication after canonical mutation
9. **capability readiness** — dependency-scoped readiness rather than one global healthy flag

Optional extensions:

- observations
- metrics
- signals
- evidence candidates/suggestions
- projection contributions
- Journey/Helm read contributions
- criteria/evaluation helpers
- sync/import capabilities

## Public contract stability

Internal tables and code may evolve without preserving implementation details.

But externally visible machine identifiers must not silently drift:

- module id
- record namespace/type ids
- command type ids
- read type ids
- change type ids

A display rename is not a machine-identifier migration.

Breaking public-contract changes require explicit versioning/migration rather than silent replacement.

Disabling or retiring a module feature must not silently orphan durable historical references. Historical resolver compatibility, explicit migration, or tombstone resolution remains required for records already used by lineage/evidence.

## Command execution

A module command handler must:

1. resolve owner scope;
2. validate current authorization at execution time;
3. validate payload/module rules;
4. validate version preconditions when required;
5. apply semantic duplicate protections appropriate to the module;
6. commit canonical mutation atomically;
7. durably append the corresponding `ModuleChange` in the same commit boundary or equivalent mechanism;
8. persist enough command-result identity to make retries safe;
9. return a `CommandReceipt`.

A command may affect multiple records inside one owning-module transaction.

A single command does not directly mutate multiple stateful modules.

## Shared transaction infrastructure

Command receipts/idempotency state and the durable outbox belong to shared System Kernel infrastructure.

A module may participate in those infrastructure stores inside the same database transaction as its canonical mutation. This is not considered a hidden foreign write into another life/core module's canonical facts.

The distinction is:

- **allowed shared infrastructure write:** command receipt/outbox primitives required to preserve execution guarantees;
- **forbidden foreign canonical write:** modifying another module's life/core records directly.

## Reliable change publication

Canonical state and change notification must not silently diverge.

Preferred first implementation: **transactional outbox** in the same database transaction as canonical mutation.

Logical guarantees:

- a committed canonical change eventually has a durable ModuleChange;
- delivery may be **at least once**;
- consumers must be idempotent;
- duplicate ModuleChanges must not duplicate projection/evidence effects;
- publishing failure after commit must be recoverable by the durable outbox.

### ModuleChange is not an event-sourcing ledger

A ModuleChange is a durable invalidation/change notification.

Core consumers must **not** assume replaying ModuleChanges alone reconstructs canonical truth unless a module explicitly offers a separate ordered/complete replay contract.

For current-state projections, a ModuleChange may simply trigger authorized re-resolution/recomputation from canonical module reads.

## Reads

Reads are authorized module-owned views of canonical records and module derivations.

When a result can imply absence, zero, completeness, or “nothing happened,” it must provide bounded Coverage appropriate to the claim.

Conceptually:

```ts
interface ModuleReadResult<T> {
  data: T;
  evaluatedAt: string;
  coverage?: Coverage[];
  readiness?: CapabilityReadiness[];
}
```

A read must not quietly convert missing dependencies into empty factual results.

Cross-module composition consumes public reads/reference resolvers or explicitly exported stable views. It must not couple itself to private module tables merely for convenience.

## Reference resolution

Other modules and core services do not query a module's private canonical tables directly.

A module provides authorized resolution for:

- stable current `RecordRef`
- exact historical `RecordVersionRef`

Historical resolution may return resolved content, redacted/deleted tombstone, temporary unavailable state, or unexpected missing/corrupt state according to the Object Contracts.

Anything used in durable evidence or provenance lineage must be version-addressable.

An internal schema migration must preserve these semantics or explicitly migrate/tombstone affected references.

## Capability readiness

Module readiness is not one boolean.

Conceptually:

```ts
type CapabilityStatus = "READY" | "DEGRADED" | "UNAVAILABLE";

interface CapabilityReadiness {
  capability: string;
  status: CapabilityStatus;
  dependencies?: Array<{
    id: string;
    status: CapabilityStatus;
    reason?: string;
  }>;
}
```

Examples:

- persisted Finance reads may be READY while bank sync is UNAVAILABLE;
- Practice writes may be READY while AI interpretation is UNAVAILABLE;
- Evidence writes may be DEGRADED while Practice truth remains healthy;
- reference resolution may remain READY even when an external connector is offline.

A failed optional capability must not invalidate unrelated truth.

## Cross-module relationships

Composition occurs through explicit seams:

- `RecordRef` / `RecordVersionRef` / `EntityRef`
- EvidenceLinks owned by the Evidence module
- ModuleChanges
- explicit authorized reads
- authorized commands

Never through hidden foreign canonical writes.

A life-domain module may **suggest** or request cross-module evidence/meaning; it does not silently write shared truth owned elsewhere.

## Multi-module workflows

One real-world workflow may touch several modules.

Wayfinder handles that through orchestration, not by giving one module write authority over all others.

Conceptually:

`Orchestrator → Command A → Module A`

`             → Command B → Module B`

`             → Command C → Module C`

Cross-module completion may be eventual. Do not require distributed transactions for the first architecture.

If partial completion matters, the orchestrator must expose it rather than pretending the whole workflow was atomic. Retry/compensation logic belongs to orchestration, not hidden side effects.

## Derived systems are read-only toward source truth

Projection, Character, recommendation, and intelligence consumers may read canonical facts and propose actions, but they do not silently mutate source canonical records based on their own interpretations.

If a derived system detects inconsistency, it may:

- invalidate/recompute its own projection;
- raise a diagnostic;
- propose an authorized corrective command.

It must not self-author a factual correction in the source module.

## Semantic duplicate prevention

Command retry safety and semantic duplicate prevention are different.

Examples:

- same bank transaction external id
- same imported calendar event
- same sensor sample id

The owning module defines those natural/external uniqueness rules.

## Corrections

A module must support correction/supersession without silently destroying lineage required by downstream evidence and projections.

When a version becomes superseded/retracted:

- publish a ModuleChange;
- make current resolution point to the new accepted state;
- keep historical version resolution or an explicit tombstone according to privacy policy;
- allow downstream consumers to invalidate/recompute dependent projections.

Full event sourcing is not required.

## Authorization and privacy propagation

Reads, reference resolution, commands, and derivations must respect owner/permission scope.

A derived read/projection must not silently expose information more broadly than its source lineage permits unless an explicit policy authorizes a safe aggregate/transformation.

Exact permission inheritance remains Candidate, but accidental privilege widening is prohibited.

## Registration model

The core discovers stateful modules through registration rather than hard-coded branching.

Conceptually:

```ts
type StatefulModuleKind = "core" | "life";

interface StatefulModule {
  id: string;
  kind: StatefulModuleKind;
  version: string;
  lifecycle: "experimental" | "active" | "disabled";
  publicIds: {
    records: string[];
    commands: string[];
    reads: string[];
    changes: string[];
  };
  readiness(): CapabilityReadiness[];
}
```

Concrete handler types should be added only when the first vertical slice proves the common shape.

`disabled` means active behavior is disabled. It does not license orphaning previously durable historical references.

## Fault isolation

Failure in one module must not erase or invalidate truth in another.

If Finance is unavailable, Practice history still loads. If Evidence or interpretation fails, factual Practice records remain intact.

Readiness and failure are scoped to the capability/dependency actually affected.

## Life-domain admission test

Before creating a new **life domain**, answer:

1. Does this area have distinct factual semantics?
2. Does it require its own validation or persistence rules?
3. Would forcing it into an existing life domain weaken truth or clarity?
4. Can it expose a bounded contract to the rest of Wayfinder?
5. Can it fail independently without corrupting unrelated truth?

If not, it may be a feature, projection, or shared core module rather than a new life domain.

## Pilot life domain

The first proving life-domain module remains **Practice** because it is small enough to implement early but rich enough to test:

- real events
- time
- corrections
- measurements
- Direction relationships
- Evidence
- Reflection
- projections
- Journey/Helm reads
- Navigator reasoning

Practice is not privileged in the architecture. It is the first executable pressure test of the protocol.
