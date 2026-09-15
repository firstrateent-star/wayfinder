# Wayfinder Physical Schema — First Slice

**Version:** 0.2  
**Status:** CANDIDATE — DESIGN ONLY, NOT YET DEPLOYED

## Goal

Map the stable ontology/contracts into the **smallest physical Postgres/Supabase schema** needed for Slice 1A without creating a universal life table, projection warehouse, future-domain scaffolding, or premature distributed infrastructure.

This document defines physical persistence strategy. It does not authorize deployment until the schema survives recursive stress testing.

## Physical topology

Start with one Supabase/Postgres project and one database.

Use private canonical schemas:

- `wf_system`
- `wf_direction`
- `wf_practice`
- `wf_evidence`

Expose application commands/reads through narrowly scoped RPC/server boundaries. Canonical tables are not a normal frontend write surface.

Do not create microservices.

## Mapping rules

### Logical id vs historical version id

For versioned canonical records:

- stable `RecordRef.id` → `record_id uuid`
- exact `RecordVersionRef.version` → `version_id uuid`

`version_id` is opaque to callers even though the first implementation uses UUID.

### No universal canonical record table

There is no `facts`, `entities`, or universal payload table.

Each stateful module owns its payload persistence. Generic cross-module references carry namespace/type/logical-id/version-id and are resolved through module contracts.

### Version only what Slice 1A needs versioned

Use stable-row + version-row persistence when historical payload identity already matters to correction/evidence.

Slice 1A versions:

- DirectionNode
- PracticeSession

Slice 1A keeps these immutable after creation except lifecycle/retraction metadata:

- DirectionEdge
- EvidenceLink

The Practice identity itself is **not versioned in Slice 1A**. Its name/description are display metadata and must not be used as durable evidence lineage until a future contract explicitly versions them.

### Stable row + version row

Conceptually:

```text
stable row
  id
  owner_id
  current_version_id

version row
  version_id
  record_id
  owner_id
  version_no
  schema_version
  immutable semantic payload
  lifecycle metadata
  provenance essentials
```

Correction inserts a new version and advances the stable pointer atomically. Historical semantic payload is not overwritten.

Lifecycle metadata may later mark an old version SUPERSEDED/RETRACTED. Privacy policy may explicitly override payload retention in a future deletion path; ordinary correction never does.

## Owner-aware referential integrity

Inside one module, cheap database constraints should enforce owner consistency rather than relying only on application validation.

Pattern for versioned records:

- stable table has `unique (id, owner_id)`;
- version table FK `(record_id, owner_id)` → stable `(id, owner_id)`;
- version table has `unique (id, record_id, owner_id)`;
- stable current pointer may use composite FK `(current_version_id, id, owner_id)` → version `(id, record_id, owner_id)`.

Creation can insert stable row with `current_version_id = null`, insert v1, then set the pointer in the same transaction. The composite current-pointer FK may be DEFERRABLE if implementation requires it.

Same-owner constraints are mandatory for Direction edge endpoints and PracticeSession → Practice.

## System Kernel

### `wf_system.owners`

Root Wayfinder owner identity and auth mapping.

Minimum columns:

- `id uuid primary key`
- `auth_user_id uuid unique not null` → `auth.users(id)`
- `timezone text not null default 'UTC'`
- `created_at timestamptz not null default now()`

Owner EntityRef conceptually resolves as `identity / owner / owners.id`.

The root owner may self-own conceptually; no `owner_id` column is needed on the bootstrap owner row.

### `wf_system.command_receipts`

Transport retry identity, conflicting replay detection, and durable terminal command result.

Minimum columns:

- `command_id uuid primary key`
- `owner_id uuid not null`
- `module_id text not null`
- `command_type text not null`
- `request_hash text not null`
- `requested_at timestamptz not null`
- `status text not null`
- `affected_refs jsonb null`
- `error_code text null`
- `processed_at timestamptz null`
- `created_at timestamptz not null default now()`

Public terminal states:

- `APPLIED`
- `REJECTED`
- `NOOP`

An internal transaction may temporarily use `PROCESSING` while claiming the unique command id.

`request_hash` is computed from a deterministic canonical representation of the material command request. Same command id + materially different hash is a conflict.

Raw command payload is not retained here in Slice 1A.

A semantically rejected, authenticated command may retain a terminal `REJECTED` receipt so a retry is deterministic. A rejected command emits **no ModuleChange** because canonical module state did not change.

Unauthorized cross-owner requests need not create receipts that could reveal protected resource existence.

### `wf_system.module_change_outbox`

Transactionally durable `ModuleChange` notification.

Minimum columns:

- `id uuid primary key`
- `owner_id uuid not null`
- `module_id text not null`
- `change_type text not null`
- `command_id uuid null`
- `affected jsonb not null`
- `correlation_id uuid null`
- `committed_at timestamptz not null default now()`
- `published_at timestamptz null`
- `attempt_count integer not null default 0`
- `next_attempt_at timestamptz null`

Create outbox rows for committed canonical changes. `REJECTED` commands do not create them. A true `NOOP` normally does not create one unless a future module explicitly defines a meaningful canonical change notification.

The outbox is infrastructure, not canonical life history, and may have a shorter retention policy than lineage-bearing record versions.

No consumer-state table is created until an actual async consumer exists.

## Direction core module

### `wf_direction.nodes`

Stable DirectionNode identity.

Columns:

- `id uuid primary key`
- `owner_id uuid not null`
- `kind text not null`
- `current_version_id uuid null`
- `created_at timestamptz not null default now()`
- `unique (id, owner_id)`

`kind` is stable across versions. A material kind change creates/supersedes a different logical node rather than mutating node identity.

Allowed ontology kinds may include value/direction/outcome/commitment/quest/plan/action, although Slice 1A UI exercises only direction/outcome/action.

### `wf_direction.node_versions`

Columns:

- `id uuid primary key` — exact version id
- `node_id uuid not null`
- `owner_id uuid not null`
- `version_no bigint not null`
- `schema_version smallint not null default 1`
- `title text not null`
- `description text null`
- `intent_state text not null`
- `lifecycle_status text not null`
- `superseded_by_version_id uuid null`
- `provenance_source_type text not null`
- `provenance_source_id text null`
- `actor_owner_id uuid null`
- `recorded_at timestamptz not null default now()`

Constraints:

- unique `(node_id, version_no)`
- unique `(id, node_id, owner_id)`
- FK `(node_id, owner_id)` → nodes `(id, owner_id)`
- intent state ∈ `ACTIVE | PAUSED | WITHDRAWN`
- lifecycle ∈ `ACTIVE | SUPERSEDED | RETRACTED`

`nodes.current_version_id` is protected so it can only point to a version of that same node/owner.

`schema_version` describes the stored payload contract, not the logical record version number.

### `wf_direction.edges`

Immutable semantic payload in Slice 1A; relation change means retract/create.

Columns:

- `id uuid primary key`
- `version_id uuid unique not null`
- `schema_version smallint not null default 1`
- `owner_id uuid not null`
- `from_node_id uuid not null`
- `to_node_id uuid not null`
- `relation text not null`
- `lifecycle_status text not null default 'ACTIVE'`
- `retracted_at timestamptz null`
- `provenance_source_type text not null`
- `provenance_source_id text null`
- `actor_owner_id uuid null`
- `recorded_at timestamptz not null default now()`
- `unique (id, owner_id)`

Same-owner composite FKs bind `from_node_id` and `to_node_id` to Direction nodes owned by the same owner.

Slice 1A command surface only permits `SUPPORTS` even if the ontology recognizes additional relations.

## Practice life-domain module

### `wf_practice.practices`

Stable Practice Entity. Deliberately unversioned in Slice 1A.

Columns:

- `id uuid primary key`
- `owner_id uuid not null`
- `name text not null`
- `description text null`
- `lifecycle_status text not null default 'ACTIVE'`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`
- `unique (id, owner_id)`

Allowed lifecycle initially: `ACTIVE | RETRACTED`.

Practice display metadata is not permitted as a durable Evidence source/target in Slice 1A. If future semantics require exact historical Practice metadata, Practice becomes versioned through an explicit migration/contract change.

### `wf_practice.sessions`

Stable PracticeSession identity.

Columns:

- `id uuid primary key`
- `owner_id uuid not null`
- `current_version_id uuid null`
- `created_at timestamptz not null default now()`
- `unique (id, owner_id)`

### `wf_practice.session_versions`

Columns:

- `id uuid primary key` — exact version id
- `session_id uuid not null`
- `owner_id uuid not null`
- `version_no bigint not null`
- `schema_version smallint not null default 1`
- `practice_id uuid not null`
- `occurred_from timestamptz not null`
- `occurred_to timestamptz null`
- `occurred_from_precision text not null default 'INSTANT'`
- `occurred_to_precision text null`
- `occurred_zone_id text null`
- `duration_seconds integer null`
- `focus text null`
- `lifecycle_status text not null`
- `superseded_by_version_id uuid null`
- `provenance_source_type text not null`
- `provenance_source_id text null`
- `actor_owner_id uuid null`
- `recorded_at timestamptz not null default now()`

Constraints:

- unique `(session_id, version_no)`
- unique `(id, session_id, owner_id)`
- FK `(session_id, owner_id)` → sessions `(id, owner_id)`
- same-owner FK `(practice_id, owner_id)` → practices `(id, owner_id)`
- `occurred_to is null OR occurred_to >= occurred_from`
- `duration_seconds is null OR duration_seconds > 0`
- lifecycle ∈ `ACTIVE | SUPERSEDED | RETRACTED`

`sessions.current_version_id` can only point to a version of that same session/owner.

If exact start/end and duration are all present, command validation checks consistency. Coarse/approximate occurrence is normalized to a bounded UTC instant/range while retaining declared precision and zone context; the system must not present coarse input as exact.

Slice 1A requires at least a known occurrence start. Fully unknown occurrence time remains deferred.

## Evidence core module

### `wf_evidence.links`

EvidenceLink semantic payload is immutable in Slice 1A. Correction means retract old link and create another.

Columns:

- `id uuid primary key`
- `version_id uuid unique not null`
- `schema_version smallint not null default 1`
- `owner_id uuid not null`
- `source_namespace text not null`
- `source_type text not null`
- `source_record_id uuid not null`
- `source_version_id uuid not null`
- `target_namespace text not null`
- `target_type text not null`
- `target_record_id uuid not null`
- `target_version_id uuid not null`
- `target_aspect text null`
- `relation text not null`
- `reason text null`
- `lifecycle_status text not null default 'ACTIVE'`
- `retracted_at timestamptz null`
- `provenance_source_type text not null`
- `provenance_source_id text null`
- `actor_owner_id uuid null`
- `recorded_at timestamptz not null default now()`
- `unique (id, owner_id)`

Allowed evidence relations:

- `SUPPORTS`
- `WEAKENS`
- `CONTRADICTS`
- `QUALIFIES`

Generic source/target refs intentionally do not use polymorphic database FKs. The Evidence command resolver-validates exact refs and owner scope before insert.

Direct self-evidence is rejected.

Slice 1A narrows the initial product capability to:

- source = exact current PracticeSession version;
- target = exact current Direction `action` version;
- target aspect = `fulfillment`.

The table remains generic enough for later evidence types without claiming they are already implemented.

## Resolver surfaces required before Evidence writes

The schema design assumes module-owned resolvers with authorization:

### Direction

- resolve current node by `(owner, node_id)`
- resolve exact node version by `(owner, node_id, version_id)`
- report whether exact version is current/active/superseded/retracted

### Practice

- resolve Practice entity by `(owner, practice_id)`
- resolve current session by `(owner, session_id)`
- resolve exact session version by `(owner, session_id, version_id)`
- report current lifecycle

### Evidence

- resolve link by stable id/version

Resolvers return explicit missing/retracted states rather than silently converting them to absence.

## Why Evidence refs do not have universal FKs

A generic EvidenceLink can eventually point to records owned by many modules. A central record registry or cross-module polymorphic FK web would physically couple modules and complicate future extraction.

Instead:

1. Evidence command validates exact refs through owning module resolvers;
2. Evidence stores the exact reference tuple;
3. current reads re-resolve source/target lifecycle as needed;
4. missing/corrupt resolution is surfaced explicitly.

This is a deliberate boundary trade-off, not an integrity omission.

## Authentication, RLS, and application boundary

Canonical tables are not directly writable by the normal authenticated frontend role.

Preferred Slice 1A pattern:

- private module schemas for canonical tables;
- exposed command/read RPC wrappers or server endpoints;
- mutation/read functions derive the Wayfinder owner from `auth.uid()`; client-supplied owner id is never trusted as authority;
- `SECURITY DEFINER` functions, if used, set a hardened `search_path` and fully qualify private objects;
- grant only required function execution/read privileges;
- owner-aware constraints and RLS/policies remain defense in depth where useful.

A public/exposed RPC is acceptable. A raw canonical table insert/update/delete is not.

## Command transaction shape

```text
BEGIN
  1. resolve authenticated owner
  2. deterministically hash material Command request
  3. claim command_id in wf_system.command_receipts
  4. if same id/same hash already terminal: return stored result
  5. if same id/different hash: reject conflict
  6. validate current authorization, payload, owner, refs, preconditions
  7. mutate only owning module canonical tables
  8. persist terminal APPLIED/NOOP receipt
  9. if canonical state changed, insert ModuleChange into outbox
COMMIT
```

For authenticated semantic rejection, the handler may persist a terminal `REJECTED` receipt and return it without emitting ModuleChange. Implementations must avoid raising an exception that rolls back the receipt if deterministic rejected-retry behavior is desired.

Two concurrent attempts with the same command id serialize on the unique receipt key. Different hashes conflict; same hash returns the same logical terminal result after the first attempt completes.

## Correction transaction shape

Example PracticeSession correction:

```text
BEGIN
  resolve owner
  claim Command id
  lock wf_practice.sessions stable row
  verify current_version_id == expected_version_id
  validate correction
  insert session_versions v2 ACTIVE
  mark v1 SUPERSEDED + superseded_by=v2
  update sessions.current_version_id=v2
  write APPLIED receipt
  write ModuleChange affected=[v1 SUPERSEDED, v2 CREATED]
COMMIT
```

No old semantic payload overwrite occurs.

A stale correction returns deterministic rejection and leaves source truth unchanged.

## Reads in Slice 1A

Do not create persistent Journey/Bearing/Fulfillment tables yet.

Module read functions/views provide:

- current Direction graph
- recent recorded PracticeSessions
- Evidence links for source/target
- exact/current record resolution

Application-level on-demand composition provides:

- Journey v0
- Action Fulfillment v0
- Bearing v0
- Helm v0

Operational SQL completeness is not epistemic lived-reality Coverage.

## Indexes required early

At minimum:

- owner indexes on canonical tables
- unique/version lookup indexes already implied by constraints
- Practice session-version `(owner_id, occurred_from desc)` index, preferably scoped to active/current-read needs
- Direction edge `(owner_id, from_node_id, to_node_id, relation)` index
- Evidence source tuple index
- Evidence target tuple index
- outbox unpublished/due index using `published_at` / `next_attempt_at`

Do not add speculative indexes for future domains.

## Retention and deletion boundaries

- canonical lineage-bearing versions are retained for ordinary correction/history;
- outbox rows and command receipts may use shorter operational retention after replay/idempotency requirements are satisfied;
- full owner/account deletion may explicitly cascade/purge that owner's isolated data under a future deletion policy;
- partial privacy deletion/redaction of individual canonical records is not implemented in Slice 1A and must receive its own schema/policy design before exposure;
- ordinary UI “remove/correct” uses retraction/supersession, not hard delete.

Do not add a universal tombstone registry merely for a future deletion feature.

## Explicit non-tables in Slice 1A

Do **not** create yet:

- universal `facts`
- universal `entities`
- universal relationship graph
- universal observations table
- Practice version-history table
- projection cache tables
- Character/XP tables
- Skills tables
- Calendar tables
- connector registry tables
- lineage manifest table
- workflow/saga tables
- AI conversation tables
- agent tables

The contracts leave seams for these when actual use earns them.

## Schema exit gate

Before deployment, recursively test this design against:

- duplicate/concurrent commands
- correction races and current-pointer integrity
- cross-owner access
- security-definer/RLS bypass risk
- Evidence currentness/dangling refs
- Direction edits after evidence
- partial orchestration failure
- outbox failure/retry/retention
- rejected-command retry behavior
- account deletion and future partial-redaction boundary
- time-zone/DST/coarse-time behavior
- schema migration of immutable historical versions
- backup/restore consistency
- current-version read performance
- whether any table/column exists only for speculation rather than Slice 1A.

No Supabase project/database migration should be created until these tests are reviewed.