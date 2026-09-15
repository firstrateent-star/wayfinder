# Wayfinder Physical Schema — First Slice

**Version:** 0.5  
**Status:** CANDIDATE-STABLE — CONFIRMATION PASS PENDING, NOT YET DEPLOYED

## Goal

Map the stable ontology/contracts into the **smallest physical Postgres/Supabase schema** needed for Slice 1A without creating a universal life table, projection warehouse, future-domain scaffolding, or premature distributed infrastructure.

This version incorporates four rounds of recursive schema pressure: current-version integrity, monotonic lifecycle, same-record supersession, owner FK discipline, half-open time ranges, precision-aware duration validation, canonical command request hashing, non-empty bounded intervals, bootstrap concurrency, and durable command/outbox integrity.

## Physical topology

Start with one Supabase/Postgres project and one database.

Private canonical schemas:

- `wf_system`
- `wf_direction`
- `wf_practice`
- `wf_evidence`

Application commands/reads are exposed through narrow RPC/server boundaries. Canonical tables are not a normal frontend write surface.

No microservices.

## Physical principles

### Logical id vs historical version id

For versioned canonical records:

- stable `RecordRef.id` → logical `record_id uuid`
- exact `RecordVersionRef.version` → `version_id uuid`

All Wayfinder-created canonical ids use UUID in the first implementation even though the logical contract remains transport-agnostic.

### No universal canonical record table

There is no universal `facts`, `entities`, or generic payload table.

Each stateful module owns its canonical payload persistence. Generic cross-module references carry namespace/type/logical-id/version-id and resolve through module contracts.

### Version only what the first slice needs

Versioned in Slice 1A:

- DirectionNode
- PracticeSession

Immutable semantic payload after creation, with only controlled lifecycle change:

- DirectionEdge
- EvidenceLink

Unversioned display Entity in Slice 1A:

- Practice

Practice name/description must not be used as durable evidence lineage until a future contract/versioning migration explicitly permits it.

### Stable row + version row

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

### Immutable payload protection and lifecycle

Version tables protect historical semantic payload against UPDATE after insertion.

Allowed lifecycle mutations are narrowly limited to lifecycle fields such as:

- `lifecycle_status`
- `superseded_by_version_id`
- explicit retraction metadata

First-slice lifecycle transitions are monotonic:

- `ACTIVE → SUPERSEDED`
- `ACTIVE → RETRACTED`
- `SUPERSEDED` and `RETRACTED` do not silently return to `ACTIVE`

DirectionEdge, EvidenceLink, and the unversioned Practice lifecycle permit only `ACTIVE → RETRACTED` after creation.

A database trigger/invariant function should enforce immutable payload and lifecycle transitions. Application roles receive no general UPDATE privilege on canonical tables.

## Owner-aware referential integrity

All owner-scoped system/canonical rows FK to `wf_system.owners(id)` using restrictive/guarded semantics. Owner purge is an explicit future privacy operation; auth deletion must not accidentally cascade through Wayfinder history.

Inside one module, database constraints enforce owner consistency wherever practical.

Pattern for versioned records:

- stable table: `unique (id, owner_id)`;
- version table FK `(record_id, owner_id)` → stable `(id, owner_id)`;
- version table: `unique (id, record_id, owner_id)`;
- stable current pointer protected by composite relation `(current_version_id, id, owner_id)` → version `(id, record_id, owner_id)` or equivalent DEFERRABLE invariant;
- `superseded_by_version_id` protected by same-record/owner composite relation `(superseded_by_version_id, record_id, owner_id)` → `(id, record_id, owner_id)`.

At transaction end, a current-version invariant must also prove:

1. `current_version_id` resolves to the same logical record/owner;
2. it does not point to a `SUPERSEDED` version;
3. when an accepted current representation exists it is `ACTIVE`;
4. `RETRACTED` may remain the latest pointed version when the logical record intentionally has no active representation.

Creation may insert stable row with NULL current pointer, insert v1, then advance pointer in the same transaction. Current-pointer constraints/invariant triggers should be DEFERRABLE where practical so create/correct/restore/migration ordering remains tractable.

Same-owner constraints are mandatory for Direction edge endpoints and PracticeSession → Practice.

## System Kernel

### `wf_system.owners`

Root Wayfinder owner identity and auth mapping.

Minimum columns:

- `id uuid primary key`
- `auth_user_id uuid unique not null` → `auth.users(id)`
- `timezone text not null default 'UTC'`
- `created_at timestamptz not null default now()`

The auth FK must not silently cascade-delete Wayfinder data. Prefer `ON DELETE RESTRICT`/equivalent guarded behavior until an explicit privacy workflow exists.

Owner EntityRef conceptually resolves as `identity / owner / owners.id`.

### Owner bootstrap

Do not require an `auth.users` trigger for Slice 1A.

After authentication, an idempotent bootstrap/ensure-owner RPC creates the Wayfinder owner mapping if missing. It is concurrency-safe by relying on unique `auth_user_id` plus insert/upsert/re-read semantics, so two simultaneous first-login calls converge on one owner.

This bootstrap does not use the ordinary command receipt contract because that contract requires the owner identity it is creating. This is a narrow bootstrap exception, not a second canonical mutation architecture.

Normal canonical commands fail clearly when no owner mapping exists.

### `wf_system.command_receipts`

Durable retry/idempotency identity, conflicting replay detection, and terminal command result.

Minimum columns:

- `command_id uuid primary key`
- `owner_id uuid not null` FK → `wf_system.owners(id)`
- `module_id text not null`
- `command_type text not null`
- `request_hash text not null`
- `requested_at timestamptz not null`
- `status text not null`
- `affected_refs jsonb null`
- `error_code text null`
- `processed_at timestamptz null`
- `created_at timestamptz not null default now()`

Physical allowed states:

- `PROCESSING` — internal in-transaction claim state
- `APPLIED`
- `REJECTED`
- `NOOP`

The public `CommandReceipt` contract remains terminal-only (`APPLIED | REJECTED | NOOP`). Because claim and terminalization occur in one DB transaction, a transaction abort rolls back the PROCESSING claim rather than leaving a durable stuck receipt.

Same command id + same canonical request hash returns the existing terminal result. Same command id + different canonical request hash is rejected as conflicting reuse.

**Hashing rule:** material command content is deterministically normalized/canonically serialized before hashing. Raw client JSON text, object-key order, whitespace, or client-specific serializer behavior must not change retry semantics.

`affected_refs` is sufficient for Slice 1A retry responses; callers may re-resolve records for display payload.

Authenticated semantic rejection may persist a terminal `REJECTED` receipt without canonical mutation. It emits no ModuleChange. Unauthorized cross-owner requests need not persist a receipt that could reveal resource existence.

Command idempotency identity is durable in Slice 1A. Do not prune it merely because the canonical write is old.

### `wf_system.module_change_outbox`

Transactionally durable ModuleChange publication record.

Minimum columns:

- `id uuid primary key`
- `owner_id uuid not null` FK → `wf_system.owners(id)`
- `module_id text not null`
- `change_type text not null`
- `command_id uuid null` FK → `wf_system.command_receipts(command_id)` when populated
- `affected jsonb not null`
- `correlation_id uuid null`
- `committed_at timestamptz not null default now()`
- `published_at timestamptz null`
- `attempt_count integer not null default 0`
- `next_attempt_at timestamptz null`

Create outbox rows only for committed canonical changes. `REJECTED` commands do not create them; a true `NOOP` normally does not either.

`published_at` means successful handoff to configured dispatcher/transport, not that every consumer processed the change. If Slice 1A has no async dispatcher, unpublished rows may accumulate; do not falsely mark them published.

`command_id` remains nullable for future trusted/system-internal canonical changes that may legitimately not originate from an external Command.

Published outbox rows may later be pruned under an explicit transport-retention policy because ModuleChange is not canonical history.

## Direction core module

### `wf_direction.nodes`

Stable DirectionNode identity.

Columns:

- `id uuid primary key`
- `owner_id uuid not null` FK → `wf_system.owners(id)`
- `kind text not null`
- `current_version_id uuid null`
- `created_at timestamptz not null default now()`
- `unique (id, owner_id)`

`kind` is stable across versions. A material kind change creates/supersedes a different logical node.

Ontology kinds may include value/direction/outcome/commitment/quest/plan/action; Slice 1A UI exercises direction/outcome/action.

### `wf_direction.node_versions`

Columns:

- `id uuid primary key` — exact version id
- `node_id uuid not null`
- `owner_id uuid not null` FK → `wf_system.owners(id)`
- `version_no bigint not null check (version_no > 0)`
- `schema_version smallint not null default 1 check (schema_version > 0)`
- `title text not null`
- `description text null`
- `intent_state text not null`
- `lifecycle_status text not null`
- `superseded_by_version_id uuid null`
- `provenance_source_type text not null`
- `provenance_source_id text null`
- `actor_owner_id uuid null` FK → `wf_system.owners(id)`
- `recorded_at timestamptz not null default now()`

Constraints/invariants:

- unique `(node_id, version_no)`
- unique `(id, node_id, owner_id)`
- FK `(node_id, owner_id)` → nodes `(id, owner_id)`
- same-record/owner composite supersession pointer
- intent state ∈ `ACTIVE | PAUSED | WITHDRAWN`
- lifecycle ∈ `ACTIVE | SUPERSEDED | RETRACTED`
- immutable semantic payload after insertion
- monotonic lifecycle transitions

`nodes.current_version_id` is DEFERRABLY validated against same node/owner and acceptable lifecycle state.

`schema_version` describes stored payload contract version. Resolver code must understand it or explicitly fail/degrade; never silently reinterpret incompatible historical payload.

### `wf_direction.edges`

Immutable semantic payload in Slice 1A; relation change means retract/create.

Columns:

- `id uuid primary key`
- `version_id uuid unique not null`
- `schema_version smallint not null default 1 check (schema_version > 0)`
- `owner_id uuid not null` FK → `wf_system.owners(id)`
- `from_node_id uuid not null`
- `to_node_id uuid not null`
- `relation text not null`
- `lifecycle_status text not null default 'ACTIVE'`
- `retracted_at timestamptz null`
- `provenance_source_type text not null`
- `provenance_source_id text null`
- `actor_owner_id uuid null` FK → `wf_system.owners(id)`
- `recorded_at timestamptz not null default now()`
- `unique (id, owner_id)`

Same-owner composite FKs bind both endpoint ids to Direction nodes of the same owner.

Slice 1A command surface permits only `SUPPORTS`. Lifecycle allows only `ACTIVE → RETRACTED`; semantic payload is immutable.

## Practice life-domain module

### `wf_practice.practices`

Stable Practice Entity, deliberately unversioned in Slice 1A.

Columns:

- `id uuid primary key`
- `owner_id uuid not null` FK → `wf_system.owners(id)`
- `name text not null`
- `description text null`
- `lifecycle_status text not null default 'ACTIVE'`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`
- `unique (id, owner_id)`

Lifecycle initially: `ACTIVE | RETRACTED`, with monotonic `ACTIVE → RETRACTED` only.

Practice metadata is display metadata and cannot be a durable Evidence source/target in Slice 1A. If exact historical naming becomes meaningful, Practice metadata must be promoted to versioned payload through a deliberate migration.

### `wf_practice.sessions`

Stable PracticeSession identity.

Columns:

- `id uuid primary key`
- `owner_id uuid not null` FK → `wf_system.owners(id)`
- `current_version_id uuid null`
- `created_at timestamptz not null default now()`
- `unique (id, owner_id)`

### `wf_practice.session_versions`

Columns:

- `id uuid primary key` — exact version id
- `session_id uuid not null`
- `owner_id uuid not null` FK → `wf_system.owners(id)`
- `version_no bigint not null check (version_no > 0)`
- `schema_version smallint not null default 1 check (schema_version > 0)`
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
- `actor_owner_id uuid null` FK → `wf_system.owners(id)`
- `recorded_at timestamptz not null default now()`

Constraints/invariants:

- unique `(session_id, version_no)`
- unique `(id, session_id, owner_id)`
- FK `(session_id, owner_id)` → sessions `(id, owner_id)`
- same-owner FK `(practice_id, owner_id)` → practices `(id, owner_id)`
- same-record/owner composite supersession pointer
- `occurred_to is null OR occurred_to > occurred_from`
- `duration_seconds is null OR duration_seconds > 0`
- lifecycle ∈ `ACTIVE | SUPERSEDED | RETRACTED`
- immutable semantic payload after insertion
- monotonic lifecycle transitions

`sessions.current_version_id` is DEFERRABLY validated against same session/owner and acceptable lifecycle state.

### Time representation

Known occurrence ranges use **half-open interval semantics `[occurred_from, occurred_to)`**. Start is inclusive; end is exclusive. Adjacent normalized day/month/year ranges therefore do not overlap at the shared boundary.

If `occurred_to` is present, it must be strictly later than `occurred_from`; an instant/point-like occurrence uses a single known start with no artificial zero-width end.

For coarse local input such as “Saturday,” normalization uses that local date's real time-zone/DST bounds to persist a bounded UTC range plus declared precision and `occurred_zone_id`. Coarse input is never later displayed as if an exact instant were known.

Duration validation is precision-aware:

- if boundaries represent the actual exact event interval, explicit duration must be consistent with the interval;
- if boundaries represent an uncertainty window such as “sometime Saturday,” a known 30-minute duration may be shorter than the range and is valid.

Slice 1A requires at least a known occurrence start/bound. Fully unknown occurrence time is deferred.

## Evidence core module

### `wf_evidence.links`

EvidenceLink semantic payload is immutable in Slice 1A. Correction means retract/create.

Columns:

- `id uuid primary key`
- `version_id uuid unique not null`
- `schema_version smallint not null default 1 check (schema_version > 0)`
- `owner_id uuid not null` FK → `wf_system.owners(id)`
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
- `actor_owner_id uuid null` FK → `wf_system.owners(id)`
- `recorded_at timestamptz not null default now()`
- `unique (id, owner_id)`

Allowed evidence relations:

- `SUPPORTS`
- `WEAKENS`
- `CONTRADICTS`
- `QUALIFIES`

Generic source/target refs intentionally do not use polymorphic database FKs. Evidence command resolver-validates exact refs and owner scope before insert.

Direct self-evidence is rejected.

Slice 1A narrows initial product capability to:

- source = exact current PracticeSession version;
- target = exact current Direction Action version;
- target aspect = `fulfillment`.

Historical links remain resolvable after either side changes, but current Fulfillment/Bearing re-resolves source/target currentness and treats old links as stale rather than carrying them forward.

Evidence currentness need not be globally locked across modules. A link may become stale immediately after validation due to a concurrent correction; because it stores exact versions, this remains safe and current reads simply do not count the stale version.

Lifecycle allows only `ACTIVE → RETRACTED`; semantic payload is immutable.

## Resolver surfaces required before Evidence writes

### Direction

- resolve current node by `(owner, node_id)`
- resolve exact node version by `(owner, node_id, version_id)`
- report exact version lifecycle/currentness

### Practice

- resolve Practice Entity by `(owner, practice_id)`
- resolve current session by `(owner, session_id)`
- resolve exact session version by `(owner, session_id, version_id)`
- report exact version lifecycle/currentness

### Evidence

- resolve link by stable id/version

Resolvers distinguish current, superseded, retracted, missing, and unsupported schema-version states where relevant.

## Generic Evidence integrity audit

Because generic Evidence refs intentionally lack polymorphic DB FKs, an executable integrity audit/test must identify Evidence rows whose source/target resolvers unexpectedly return `MISSING`.

Expected `SUPERSEDED` or `RETRACTED` refs are historical/stale, not corruption. `MISSING` is a diagnostic integrity failure and never negative evidence.

Do not add a universal record registry solely to obtain polymorphic FKs before real evidence demands it.

## Authentication, RLS, and application boundary

Canonical tables are not directly writable by `anon` or normal `authenticated` application roles.

Preferred Slice 1A pattern:

- private module schemas;
- exposed command/read RPC wrappers or server endpoints;
- RPCs derive owner from `auth.uid()` or trusted server context; client-supplied owner id is never authority;
- `SECURITY DEFINER` functions use fixed/hardened `search_path` and fully qualified private objects;
- revoke direct canonical table DML/SELECT from exposed client roles unless a specific safe read view is intentionally exported;
- grant only intended RPC execution/read privileges;
- owner-aware constraints and RLS/policies remain defense in depth where useful.

Service-role execution must supply/derive trusted actor/owner context through a server-only path; null `auth.uid()` must never broaden access.

## Command transaction shape

```text
BEGIN
  1. resolve authenticated/trusted owner
  2. canonicalize material Command request and compute deterministic request_hash
  3. claim command_id as PROCESSING in wf_system.command_receipts
  4. if same id/same hash already terminal: return stored receipt/result refs
  5. if same id/different hash: reject conflict
  6. validate authorization, owner, refs, payload, schema versions, preconditions
  7. mutate only owning module canonical tables
  8. terminalize receipt as APPLIED/NOOP (or persist REJECTED without mutation)
  9. if canonical state changed, insert ModuleChange into outbox
COMMIT
```

For authenticated semantic rejection that should be retry-stable, persist a terminal `REJECTED` receipt and commit without canonical mutation/outbox. Do not raise a transaction-aborting exception after writing that receipt.

Concurrent attempts with the same command id serialize on the unique command key. Same hash resolves to the same logical terminal result; different hash conflicts.

## Correction transaction shape

PracticeSession correction:

```text
BEGIN
  resolve owner
  claim Command id
  lock wf_practice.sessions stable row
  verify current_version_id == expected_version_id
  validate correction
  insert v2 ACTIVE
  mark v1 SUPERSEDED + superseded_by=v2
  update sessions.current_version_id=v2
  verify deferred current/supersession/lifecycle invariants
  write APPLIED receipt
  write ModuleChange affected=[v1 SUPERSEDED, v2 CREATED]
COMMIT
```

Historical semantic payload on v1 remains unchanged. A stale correction returns deterministic rejection and leaves source truth unchanged.

## Reads in Slice 1A

No persistent Journey/Bearing/Fulfillment tables.

Module reads/resolvers provide:

- current Direction graph
- recent recorded PracticeSessions
- Evidence links for source/target
- current/exact record resolution

Application-level on-demand composition provides:

- Journey v0
- Action Fulfillment v0
- Bearing v0
- Helm v0

Operational SQL completeness is not epistemic lived-reality Coverage.

## Indexes required early

At minimum:

- owner indexes on canonical tables
- unique/version lookup indexes implied by constraints
- active Practice session-version `(owner_id, occurred_from desc)` index for recent reads
- Direction edge `(owner_id, from_node_id, to_node_id, relation)` lookup index
- Evidence source tuple lookup index
- Evidence target tuple lookup index
- outbox unpublished/due index over `published_at` / `next_attempt_at`

Do not add speculative indexes for future domains.

## Migration, restore, and historical compatibility

`schema_version` is meaningful.

When module storage evolves:

- resolvers retain adapters for supported historical schema versions; or
- a true semantic transformation creates new canonical record versions while preserving prior exact versions; or
- unsupported historical versions resolve explicitly as unavailable/unsupported rather than silently reinterpreted.

Do not bulk rewrite immutable historical semantic payload merely to make old rows resemble current code.

Migration/backup/restore tests must prove DEFERRABLE current-pointer/supersession constraints and lifecycle invariants restore consistently.

## Retention and deletion boundaries

- canonical lineage-bearing versions are retained for ordinary correction/history;
- command idempotency identity is retained durably in Slice 1A;
- published outbox rows may have a shorter transport-retention policy;
- full owner/account deletion is a future explicit privacy workflow, not an auth cascade side effect;
- partial privacy deletion/redaction of individual canonical records is not implemented in Slice 1A and must receive its own architecture/schema pass before exposure;
- ordinary UI correction/removal uses supersession/retraction, not hard delete.

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
- universal tombstone registry
- Evidence invalidation table

## Confirmation gate

Run one more adversarial pass after v0.5. The gate passes only if that pass finds no material schema/topology change and no unresolved first-slice semantic contradiction.

When it passes, authorization is granted to:

1. create the empty Wayfinder Supabase project;
2. record its project/region metadata in Canon;
3. design the first migration against this schema.

Project creation does **not** itself authorize applying the migration. Migration SQL receives its own executable review before database mutation.
