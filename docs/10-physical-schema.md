# Wayfinder Physical Schema — First Slice

**Version:** 0.1  
**Status:** CANDIDATE — DESIGN ONLY, NOT YET DEPLOYED

## Goal

Map the stable-enough ontology/contracts into the **smallest physical Postgres/Supabase schema** needed for Slice 1A without creating a universal life table, a projection warehouse, or future-domain scaffolding.

This document defines physical persistence strategy. It does not authorize deployment until the schema survives recursive stress testing.

## Physical topology

Start with one Supabase/Postgres project and one database.

Use private module schemas:

- `wf_system`
- `wf_direction`
- `wf_practice`
- `wf_evidence`

Expose application commands/reads through narrowly scoped RPC/server boundaries rather than direct canonical table DML.

Do not create microservices.

## Key mapping decisions

### Stable record id vs version id

For versioned canonical records:

- stable logical `RecordRef.id` → `record_id UUID`
- exact `RecordVersionRef.version` → `version_id UUID`

`version_id` is opaque to callers even though the first implementation uses UUID.

### No universal record table

There is no `facts`, `entities`, or universal canonical-record payload table.

Each stateful module owns its payload tables.

Cross-module generic references store namespace/type/logical-id/version-id components and are validated through module resolver contracts.

### Stable row + version rows

Canonical records whose payload may be corrected use two physical levels:

```text
stable identity row
  id
  owner_id
  current_version_id

version row
  version_id
  record_id
  immutable payload
  lifecycle metadata
  provenance essentials
```

Corrections insert a new version and move the stable pointer atomically. Old payload is never overwritten.

Lifecycle metadata may mark an old version SUPERSEDED/RETRACTED while the historical payload stays immutable.

### Immutable record types

Records whose semantic payload is immutable after creation and whose only normal later change is retraction may use a single table containing:

- stable logical id
- one immutable `version_id`
- payload
- lifecycle/retraction metadata

Slice 1A uses this for DirectionEdge and EvidenceLink.

## System Kernel tables

### `wf_system.owners`

Purpose: root Wayfinder owner identity and auth mapping.

Minimum columns:

- `id uuid primary key`
- `auth_user_id uuid unique not null` → `auth.users(id)`
- `timezone text not null default 'UTC'`
- `created_at timestamptz not null default now()`

The owner EntityRef is conceptually:

`identity / owner / owners.id`

The root owner may self-own conceptually; no separate owner_ref column is necessary on the owner bootstrap row.

### `wf_system.command_receipts`

Purpose: transport retry identity, conflicting replay detection, and durable terminal command result.

Minimum columns:

- `command_id uuid primary key`
- `owner_id uuid not null`
- `module_id text not null`
- `command_type text not null`
- `request_hash text not null`
- `status text not null`
- `affected_refs jsonb null`
- `error_code text null`
- `processed_at timestamptz null`
- `created_at timestamptz not null default now()`

Internal transaction implementation may temporarily use `PROCESSING`; public terminal receipt maps to:

- `APPLIED`
- `REJECTED`
- `NOOP`

Same command id + different request hash is a conflict.

Raw command payload need not be retained here.

### `wf_system.module_change_outbox`

Purpose: transactionally durable ModuleChange notification.

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

The outbox is not canonical life history and may have a different retention policy from lineage-bearing canonical record versions.

No consumer-tracking table is created until a real async consumer exists.

## Direction core module

### `wf_direction.nodes`

Stable logical identity for DirectionNode.

Columns:

- `id uuid primary key`
- `owner_id uuid not null`
- `kind text not null`
- `current_version_id uuid null`
- `created_at timestamptz not null default now()`

`kind` is stable across versions. A material kind change creates/supersedes a different logical node rather than rewriting identity.

Allowed ontology kinds may include:

- `value`
- `direction`
- `outcome`
- `commitment`
- `quest`
- `plan`
- `action`

Slice 1A UI exercises only direction/outcome/action.

### `wf_direction.node_versions`

Columns:

- `id uuid primary key` — exact version id
- `node_id uuid not null`
- `owner_id uuid not null`
- `version_no bigint not null`
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
- one stable owner for all versions of a node
- `intent_state ∈ ACTIVE | PAUSED | WITHDRAWN`
- `lifecycle_status ∈ ACTIVE | SUPERSEDED | RETRACTED`

`nodes.current_version_id` points to the currently accepted/latest version. It may point to a RETRACTED latest version when the logical node has no active representation.

### `wf_direction.edges`

Slice 1A treats edge payload as immutable.

Columns:

- `id uuid primary key` — stable logical edge id
- `version_id uuid unique not null`
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

Slice 1A command surface only needs `SUPPORTS`.

Same-owner endpoint validation is required.

## Practice life-domain module

### `wf_practice.practices`

Stable identity for a Practice.

Columns:

- `id uuid primary key`
- `owner_id uuid not null`
- `current_version_id uuid null`
- `created_at timestamptz not null default now()`

### `wf_practice.practice_versions`

Columns:

- `id uuid primary key`
- `practice_id uuid not null`
- `owner_id uuid not null`
- `version_no bigint not null`
- `name text not null`
- `description text null`
- `lifecycle_status text not null`
- `superseded_by_version_id uuid null`
- `provenance_source_type text not null`
- `provenance_source_id text null`
- `actor_owner_id uuid null`
- `recorded_at timestamptz not null default now()`

This allows later rename/correction without silently changing historical labels.

### `wf_practice.sessions`

Stable logical PracticeSession identity.

Columns:

- `id uuid primary key`
- `owner_id uuid not null`
- `current_version_id uuid null`
- `created_at timestamptz not null default now()`

### `wf_practice.session_versions`

Columns:

- `id uuid primary key` — exact version id
- `session_id uuid not null`
- `owner_id uuid not null`
- `version_no bigint not null`
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

- `occurred_to is null OR occurred_to >= occurred_from`
- `duration_seconds is null OR duration_seconds > 0`
- unique `(session_id, version_no)`
- session/practice owner must match

If exact start/end and duration are both present, command validation checks consistency. Approximate occurrence is represented by bounded from/to values plus declared precision rather than fake exactness.

Slice 1A requires at least a known `occurred_from`; fully unknown occurrence time is deferred.

## Evidence core module

### `wf_evidence.links`

EvidenceLink payload is immutable in Slice 1A. Correction means retract old link and create another.

Columns:

- `id uuid primary key` — stable link id
- `version_id uuid unique not null`
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

Allowed evidence relations:

- `SUPPORTS`
- `WEAKENS`
- `CONTRADICTS`
- `QUALIFIES`

Cross-module source/target validity is checked through module resolver functions/contracts, not cross-module payload-table foreign keys.

Slice 1A primary target aspect is `fulfillment` for an Action.

## Why there is no universal foreign key for Evidence refs

A generic EvidenceLink can eventually point to records owned by many modules. A central payload registry or cross-module FK web would physically couple modules and complicate future extraction.

Instead:

1. Evidence command validates exact refs through owning module resolvers;
2. Evidence stores the exact reference tuple;
3. current reads re-resolve source/target lifecycle as needed;
4. missing/corrupt resolution is surfaced explicitly.

This deliberately trades database-level polymorphic FK enforcement for module boundary integrity.

## Common owner constraints

Every canonical table contains `owner_id`.

Where normal FKs exist inside/between tables of one module, prefer composite owner-aware constraints or command validation so a record cannot accidentally point to another owner's row.

Cross-module generic refs are always authorization/resolver validated.

## RLS and application write boundary

Canonical tables are not directly writable by the normal authenticated frontend role.

Preferred Slice 1A pattern:

- private module schemas for canonical tables;
- command/read RPC functions or server endpoints as the application boundary;
- mutation functions validate `auth.uid()` → owner mapping explicitly;
- owner identity is derived/validated server-side rather than trusting a client-supplied owner id;
- security-definer functions use a hardened search path and fully qualified object names;
- only required execute/read privileges are granted;
- RLS/owner checks remain defense in depth.

A direct raw table insert/update/delete is not a valid Wayfinder application write.

## Command transaction shape

Every mutation RPC/handler follows:

```text
BEGIN
  1. resolve authenticated owner
  2. claim Command id in command_receipts using request_hash
  3. if existing same command: return stored result
  4. if existing different hash: reject conflict
  5. validate authorization/payload/preconditions
  6. mutate only owning module canonical tables
  7. write terminal command receipt
  8. insert ModuleChange into outbox
COMMIT
```

For a rejected domain-semantic command after owner authorization, the implementation should return a structured rejection and may persist the terminal rejected receipt so retries remain deterministic.

Unauthorized cross-owner requests need not persist a receipt that could leak information.

## Correction transaction shape

Example PracticeSession correction:

```text
BEGIN
  lock stable session row
  verify current_version_id == expected_version_id
  insert session_versions v2 ACTIVE
  mark v1 SUPERSEDED + superseded_by=v2
  update sessions.current_version_id=v2
  write command receipt
  write ModuleChange affected=[v1 SUPERSEDED, v2 CREATED]
COMMIT
```

No old payload overwrite occurs.

## Reads in Slice 1A

Do not create persistent Journey/Bearing/Fulfillment tables yet.

Module read functions/views provide:

- current Direction graph
- recent recorded PracticeSessions
- Evidence links for source/target
- exact/current record resolution

Application-level on-demand read composition provides:

- Journey v0
- Action Fulfillment v0
- Bearing v0
- Helm v0

Operational query success is not treated as epistemic lived-reality Coverage.

## Indexes required early

At minimum:

- owner indexes on all canonical tables
- `current_version_id` indexes/uniqueness where relevant
- `(record_id, version_no)` unique indexes
- Practice session current-version occurrence-time index for recent reads
- Direction edge `(owner_id, from_node_id, to_node_id, relation)` lookup index
- Evidence source tuple lookup index
- Evidence target tuple lookup index
- outbox unpublished index on `published_at/next_attempt_at`

Do not add speculative indexes for future domains.

## Explicit non-tables in Slice 1A

Do **not** create yet:

- universal `facts`
- universal `entities`
- universal relationship graph
- universal observations table
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

- duplicate concurrent commands
- correction races
- cross-owner access
- evidence dangling refs
- Direction edits after evidence
- partial orchestration failure
- outbox failure/retry
- retention/privacy deletion
- time-zone/DST behavior
- schema migration of versioned records
- performance of current-version reads
- whether any table is only speculative rather than needed by Slice 1A.

No Supabase project/database migration should be created until these tests are reviewed.