# Wayfinder Domain Protocol

**Version:** 0.3  
**Status:** CANDIDATE-STABLE

A Wayfinder domain is an independently understandable area of lived reality with its own facts, rules, commands, reads, and failure boundary.

The protocol exists so new domains can join Wayfinder without weakening truth boundaries or requiring scattered core edits.

## A domain owns

- its persistence schema
- validation rules
- canonical factual records
- record/version lifecycle semantics
- command handlers
- semantic duplicate prevention
- domain-specific measurements
- domain-specific derived signals where appropriate
- read models or read adapters
- reference resolution for its own records

A domain does **not** automatically own cross-domain Evidence, Direction, Character, or other shared/core records merely because its facts contribute to them.

## A domain exposes

At minimum:

1. **identity** — stable domain id and implementation version
2. **public identifiers** — stable machine ids for record types, command types, read types, and change types
3. **commands** — allowed requests for canonical mutation
4. **validation** — payload, authority, ownership, lifecycle, and precondition rules
5. **references** — stable `RecordRef` / `EntityRef` resolution surfaces
6. **version resolution** — `RecordVersionRef` resolution, including explicit redacted/deleted/unavailable/missing states
7. **reads** — bounded authorized query surfaces
8. **changes** — durable `DomainChange` publication after canonical mutation
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

- domain id
- record namespace/type ids
- command type ids
- read type ids
- change type ids

A display rename is not a machine-identifier migration.

Breaking public-contract changes require explicit versioning/migration rather than silent replacement.

Disabling or retiring a domain feature must not silently orphan durable historical references. Historical resolver compatibility, explicit migration, or tombstone resolution remains required for records already used by lineage/evidence.

## Command execution

A domain command handler must:

1. resolve owner scope;
2. validate current authorization at execution time;
3. validate payload/domain rules;
4. validate version preconditions when required;
5. apply semantic duplicate protections appropriate to the domain;
6. commit canonical mutation atomically;
7. durably append the corresponding `DomainChange` in the same commit boundary or equivalent mechanism;
8. persist enough command-result identity to make retries safe;
9. return a `CommandReceipt`.

A command may affect multiple records inside one owning domain transaction.

A single command does not directly mutate multiple domains.

## Reliable change publication

Canonical state and change notification must not be allowed to silently diverge.

Preferred first implementation: **transactional outbox** in the same database transaction as canonical mutation.

Logical guarantees:

- a committed canonical change eventually has a durable DomainChange;
- delivery may be **at least once**;
- consumers must be idempotent;
- duplicate DomainChanges must not duplicate projection/evidence effects;
- publishing failure after commit must be recoverable by the durable outbox.

### DomainChange is not an event-sourcing ledger

A DomainChange is a durable invalidation/change notification.

Core consumers must **not** assume that replaying DomainChanges alone reconstructs canonical truth unless a domain explicitly offers a separate ordered/complete replay contract.

This lets the first architecture avoid unnecessary event-sourcing constraints.

For current-state projections, a DomainChange may simply trigger authorized re-resolution/recomputation from canonical domain reads.

## Reads

Reads are authorized domain-owned views of canonical facts and domain derivations.

When a result can imply absence, zero, completeness, or “nothing happened,” it must provide bounded Coverage appropriate to the claim.

Conceptually:

```ts
interface DomainReadResult<T> {
  data: T;
  evaluatedAt: string;
  coverage?: Coverage[];
  readiness?: CapabilityReadiness[];
}
```

A read must not quietly convert missing dependencies into empty factual results.

Cross-domain composition consumes public reads/reference resolvers or explicitly exported stable views. It must not couple itself to private domain tables merely for convenience.

## Reference resolution

Other domains and core services do not query a domain's factual tables directly.

A domain provides authorized resolution for:

- stable current `RecordRef`
- exact historical `RecordVersionRef`

Historical resolution may return resolved content, redacted/deleted tombstone, temporary unavailable state, or unexpected missing/corrupt state according to the Object Contracts.

Anything used in durable evidence or provenance lineage must be version-addressable.

An internal schema migration must preserve these semantics or explicitly migrate/tombstone affected references.

## Capability readiness

Domain readiness is not one boolean.

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
- reference resolution may remain READY even when an external connector is offline.

A failed optional capability must not invalidate unrelated truth.

## Cross-domain relationships

Cross-domain composition occurs through explicit seams:

- `RecordRef` / `RecordVersionRef` / `EntityRef`
- EvidenceLinks owned by the evidence/shared capability
- DomainChanges
- explicit authorized reads
- authorized commands

Never through hidden foreign writes.

A life domain may **suggest** or request cross-domain evidence/meaning; it does not silently write shared truth owned elsewhere.

## Multi-domain workflows

One real-world workflow may touch several domains.

Wayfinder handles that through orchestration, not by giving one domain write authority over all others.

Conceptually:

`Orchestrator → Command A → Domain A`

`             → Command B → Domain B`

`             → Command C → Domain C`

Cross-domain completion may be eventual. Do not require distributed transactions for the first architecture.

If partial completion matters, the orchestrator must expose it rather than pretending the whole workflow was atomic. Retry/compensation logic belongs to orchestration, not hidden domain side effects.

## Derived systems are read-only toward source truth

Projection, Character, recommendation, and intelligence consumers may read domain facts and propose actions, but they do not silently mutate canonical life-domain facts based on their own interpretations.

If a derived system detects inconsistency, it may:

- invalidate/recompute its own projection;
- raise a diagnostic;
- propose an authorized corrective command.

It must not self-author a factual correction in the source domain.

This prevents interpretation/derivation feedback loops from rewriting the evidence they depend on.

## Semantic duplicate prevention

Command retry safety and domain semantic duplicate prevention are different.

Examples of domain semantic dedupe:

- same bank transaction external id
- same imported calendar event
- same sensor sample id

The owning domain defines those natural/external uniqueness rules.

## Corrections

A domain must support correction/supersession without silently destroying lineage required by downstream evidence and projections.

When a version becomes superseded/retracted:

- publish a DomainChange;
- make current resolution point to the new accepted state;
- keep historical version resolution or an explicit tombstone according to privacy policy;
- allow downstream consumers to invalidate/recompute dependent projections.

Full event sourcing is not required.

## Authorization and privacy propagation

Reads, reference resolution, commands, and derivations must respect owner/permission scope.

A derived read/projection must not silently expose information more broadly than its source lineage permits unless an explicit policy authorizes a safe aggregate/transformation.

Exact permission inheritance remains Candidate, but accidental privilege widening is prohibited.

## Registration model

The core discovers domains through registration rather than hard-coded branching.

Conceptually:

```ts
interface DomainModule {
  id: string;
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

Failure in one domain must not erase or invalidate truth in another.

If Finance is unavailable, Practice history still loads. If an interpretation service fails, factual domain records remain intact.

Readiness and failure are scoped to the capability/dependency actually affected.

## Domain admission test

Before creating a new domain, answer:

1. Does this area have distinct factual semantics?
2. Does it require its own validation or persistence rules?
3. Would forcing it into an existing domain weaken truth or clarity?
4. Can it expose a bounded contract to the rest of Wayfinder?
5. Can it fail independently without corrupting unrelated truth?

If not, it may be a feature, projection, or shared core capability rather than a domain.

## Pilot domain

The first proving domain remains **Practice** because it is small enough to implement early but rich enough to test:

- real events
- time
- corrections
- measurements
- direction relationships
- evidence
- reflection
- projections
- Journey/Helm reads
- Navigator reasoning

Practice is not privileged in the architecture. It is the first executable pressure test of the protocol.
