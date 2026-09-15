# Wayfinder System Architecture

**Version:** 0.4  
**Status:** CANDIDATE-STABLE

Wayfinder is logically modular, evidence-grounded, and deliberately simple in its first physical deployment.

The architecture separates canonical truth capture, intention, evidence, derivation, reasoning, and product experience without prematurely splitting the system into distributed services.

## Physical starting topology

Wayfinder begins as a **modular monolith** backed by one Postgres/Supabase database.

This means:

- one deployable application/backend boundary initially;
- one primary database initially;
- module-owned tables and contracts;
- transactional guarantees inside one owning stateful module;
- shared System Kernel transaction primitives for command receipts and outbox;
- transactional outbox for durable change notification;
- no direct cross-module canonical table mutation;
- no microservices until real scale/organizational evidence justifies extraction.

Logical boundaries are designed strongly enough that a module can later be extracted without redesigning the ontology.

## Architectural layers

### 1. Identity / System Kernel

Owns shared operational identity and authority concerns:

- Wayfinder owner/person/workspace identity
- authentication linkage
- permissions/grants
- source registry
- stable machine identifiers
- command identity/receipts
- shared outbox infrastructure
- time/version conventions

This layer does not own every life fact.

### 2. Shared Contract Kernel

Defines semantics used across modules:

- `RecordRef` / `RecordVersionRef` / `EntityRef`
- provenance and lineage
- epistemic state
- temporal contracts
- coverage
- record lifecycle
- command envelope
- `ModuleChange` envelope

The Contract Kernel is primarily semantic/code-level infrastructure, not a giant universal persistence schema.

### 3. Stateful Modules

Canonical records live in bounded owning modules.

There are two initial families.

#### Core stateful modules

Cross-life capabilities whose records are shared across many life domains, such as:

- Direction
- Evidence
- authored Reflection / Meaning storage where appropriate
- future shared scheduling/commitment capabilities if earned

#### Life-domain modules

Areas with distinct factual semantics, such as:

- Practice
- Training / Body
- Finance
- Relationships
- Creative
- Home
- Inner Life

Both families obey the same laws around ownership, commands, versions, provenance, references, corrections, and change publication.

One module does not directly mutate another module's private canonical persistence.

### 4. Application / Orchestration Layer

Coordinates user-level workflows across modules.

Responsibilities may include:

- command routing
- multi-module workflow sequencing
- partial-completion handling
- retry/compensation orchestration
- read composition

It does **not** become a hidden universal module with its own copy of canonical life facts.

Cross-module workflows may be eventually consistent. The orchestrator must surface partial completion when it matters rather than pretending a distributed atomic transaction occurred.

### 5. Change / Derivation Plane

Canonical module mutations produce durable `ModuleChange` notifications through a transactional outbox or equivalent mechanism.

ModuleChange is an invalidation/change-notification stream, not automatically an event-sourcing history log.

Consumers may:

- invalidate caches;
- recompute projections;
- request/create shared Evidence through authorized module commands;
- update search/read indexes;
- trigger diagnostics.

Derived consumers are read-only toward source canonical facts. They may propose corrective commands but do not silently rewrite evidence they depend on.

### 6. Read / Projection Layer

Provides simple product-facing reads without coupling the UI to private module tables.

Examples:

- current life state
- recent Practice activity
- Journey timeline
- Direction view
- Bearing
- Character
- module readiness

A projection may be:

- **on-demand** — computed from current authorized reads;
- **cached** — stored for speed but reconstructable;
- **asynchronous** — refreshed from ModuleChanges.

Start with on-demand deterministic projections when cheap. Add persistent projection infrastructure only when latency/scale earns it.

### 7. Intelligence Layer

AI/Flower reasoning consumes authorized reads and projections.

Responsibilities:

- context assembly
- recursive Flower reasoning
- explanation
- hypothesis generation
- proposal generation
- planning assistance

Intelligence is optional for basic truth capture. If the model provider is unavailable, Wayfinder must still be able to record facts, maintain Direction, read history, and compute deterministic views.

AI follows:

`read → reason → propose → authorization → command`

not:

`reason → direct table write`

### 8. Experience Layer

Product surfaces sit above the architecture:

- Helm
- Journey
- Direction
- Character
- Navigator
- Atlas
- future voice/watch/API/agent surfaces

The interface should remain simpler than the backend model.

Beneath every layer is lived life. Wayfinder models it; Wayfinder does not replace it.

## Canonical mutation path

```text
Interface
  ↓
Application/Orchestrator
  ↓
Command
  ↓
Owning Stateful Module
  ↓
Authorization + Validation + Preconditions
  ↓
Single-module Transaction
  ├─ Canonical record version(s)
  ├─ Command receipt/idempotency result (System Kernel infrastructure)
  └─ Durable outbox ModuleChange (System Kernel infrastructure)
  ↓
Response
  ↓
Async/on-demand derived work
```

Canonical application writes do not bypass this path.

## Frontend boundary

The frontend must not directly mutate canonical module tables.

Writes go through command handlers exposed via server/API/RPC boundaries that enforce the Stateful Module Protocol.

Reads may use stable authorized APIs, RPCs, or explicitly exported views. A same-database deployment is not permission for the UI or other modules to depend on private tables.

A Supabase/Postgres RPC is a valid command boundary if it enforces the same authorization, validation, version, receipt, and outbox laws.

## Consistency model

Wayfinder intentionally uses different consistency strengths for different concerns.

### Canonical module write/read

Within the owning module, a successful command commits its canonical records, command receipt, and outbox atomically.

The user should be able to confirm that canonical write immediately.

### Cross-module state

Cross-module effects may be eventually consistent.

Example: PracticeSession is already canonical while an EvidenceLink or shared projection is still being created/recomputed.

The product may expose pending/partial state rather than fabricating atomicity.

### Projections

- cheap on-demand projections may reflect current source reads immediately;
- cached/async projections may lag and should expose freshness/readiness where material;
- stale projections must not silently masquerade as current after source correction/invalidation.

## Cross-module composition

Modules interact through explicit seams:

- `RecordRef`
- `RecordVersionRef`
- `EntityRef`
- ModuleChanges
- factual Relation records where owned
- EvidenceLinks through the Evidence module
- stable authorized read contracts
- authorized commands

Shared references do not imply shared persistence ownership.

## Direction and Evidence ownership

Direction is canonical intentional state, not a property sprinkled into every life-domain table.

Evidence is canonical epistemic linkage, not a field each module writes independently.

Life-domain modules may provide facts, candidates, or context, but shared Direction/Evidence records have explicit owning core modules.

This makes cross-domain reasoning possible without allowing one life domain to become authoritative over another.

## Root owner bootstrap

Every canonical record has an explicit owner scope separate from its subject.

For the initial Wayfinder person/workspace entity, the stable owner id is generated first and the root owner entity may self-own. Authentication identity links to that owner entity.

This avoids a permanent ownerless-record exception.

## Correction and versioning

Wayfinder preserves correction/supersession lineage without requiring full event sourcing.

The owning module decides its physical history strategy, but must preserve enough version-addressable history/tombstones for accepted lineage contracts and must publish invalidation through ModuleChange.

## Ownership and multi-user safety

Physical persistence must enforce owner isolation (for example through database row-level security and backend authorization) rather than trusting frontend filtering.

References may be globally collision-resistant while resolution remains authorization-scoped.

## Failure philosophy

A failure should be contained as close as possible to the capability that failed.

Examples:

- AI unavailable → canonical app still works;
- Finance connector unavailable → persisted Finance history may still work;
- projection worker unavailable → source facts remain intact;
- Evidence unavailable → Practice facts remain intact;
- one life-domain module unavailable → unrelated modules remain usable.

## Expansion rule

A new life-domain or core stateful module should be addable through registration/contracts without scattered edits across unrelated modules.

If repeated core edits are required, treat that as architectural evidence that a boundary is wrong.

## Recursive validation rule

Architecture is never considered permanently settled.

Material changes re-enter:

`DESIGN → FLOWER → STRESS TEST → REVISE → REPEAT`

Executable vertical slices and real use provide the next class of evidence.