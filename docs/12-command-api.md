# Wayfinder Slice 1A Command / Read API

**Version:** 0.1  
**Status:** CANDIDATE

## Purpose

Turn the now-executable private `wf_*` persistence layer into the smallest safe application boundary needed for the first real Wayfinder loop.

The frontend still never writes canonical tables directly.

```text
Authenticated client
      ↓
public RPC
      ↓
owner resolution
      ↓
Command claim / retry identity
      ↓
module validation
      ↓
canonical mutation
      ↓
terminal receipt + ModuleChange
      ↓
response
```

## Authentication boundary

All application RPCs except owner bootstrap require an existing `wf_system.owners` mapping for `auth.uid()`.

The client never supplies `owner_id` as authority.

### `wf_ensure_owner`

Bootstrap exception used after authenticated signup/login.

- reads `auth.uid()`;
- validates the requested IANA time-zone id;
- inserts one owner row idempotently using unique `auth_user_id`;
- returns the existing owner if already initialized;
- does not use CommandReceipt because owner authority does not exist before bootstrap.

It does not silently change an existing owner's time zone. A future owner-settings command will own that mutation.

## Command retry contract

Each canonical mutation accepts a client-generated `command_id UUID`.

The server constructs canonical typed JSON from normalized function parameters and hashes that JSON inside Postgres using a versioned hashing convention.

Rules:

- same Command id + same canonical content → return the existing terminal receipt, no duplicate effect;
- same Command id + different material content → conflict;
- semantic validation failure after authentication may persist `REJECTED` with an error code;
- successful mutation atomically writes canonical state, `APPLIED` receipt, and ModuleChange;
- `PROCESSING` is physical transaction state only and is not returned as a normal terminal receipt.

## Operational reference amendment

Per ADR-025, CommandReceipt and ModuleChange may reference an unversioned `RecordRef` for intentionally unversioned records such as Practice.

Versioned records always include their exact version in affected refs.

This does not weaken Evidence or derivation lineage, which remains exact-version-addressed.

## Slice 1A mutation RPCs

### `wf_direction_create_node`

Creates a DirectionNode stable identity + v1 in one transaction.

Initial UI kinds exercised:

- direction
- outcome
- action

The storage contract supports the full accepted Direction kinds.

### `wf_direction_create_edge`

Creates a structural Direction edge.

Slice 1A exposes `SUPPORTS` only. Duplicate active identical edges are prevented at the database boundary.

### `wf_practice_create`

Creates an unversioned Practice Entity used as the subject/category of PracticeSessions.

Practice display metadata is not durable evidence lineage in Slice 1A.

### `wf_practice_log_session`

Creates PracticeSession stable identity + v1.

Supports exact or bounded occurrence representation using:

- occurred_from
- optional occurred_to
- occurrence precision
- optional IANA zone id
- optional known duration
- optional focus

Known bounds use `[start,end)`.

### `wf_practice_correct_session`

Requires `expected_version_id` and locks the stable session row.

Executable replacement ordering:

```text
lock stable session
verify expected current version
pre-generate replacement version id
mark old ACTIVE version SUPERSEDED → replacement id
insert replacement ACTIVE version
advance stable current_version_id
receipt + ModuleChange
commit / deferred invariant checks
```

A stale precondition returns deterministic `REJECTED / STALE_VERSION` rather than overwriting newer state.

Existing Evidence does not silently migrate to the replacement version.

### `wf_evidence_create_fulfillment_link`

Slice 1A intentionally narrows generic Evidence capability:

- source = exact current PracticeSession version owned by caller;
- target = exact current Direction `action` version owned by caller;
- aspect = `fulfillment`;
- relation = `SUPPORTS`.

Duplicate active identical evidence links are prevented so the same exact source-target relation cannot manufacture extra evidence mass.

A concurrent correction may make a just-created link stale immediately after validation; exact version addressing keeps this safe. Current projections re-resolve currentness rather than assuming global atomicity.

## Initial read RPCs

### `wf_direction_current`

Returns current accepted Direction nodes and active Direction edges for the authenticated owner.

### `wf_practice_recent`

Returns current accepted PracticeSessions overlapping/occurring within a requested storage time scope.

Response wording/metadata must describe **stored record coverage**, not claim complete knowledge of lived reality.

### `wf_evidence_for_target`

Returns active EvidenceLinks for an exact target version owned by the caller.

## Response shape

Mutation RPCs return a small command receipt representation:

```json
{
  "command_id": "...",
  "status": "APPLIED | REJECTED | NOOP",
  "affected_refs": [],
  "error_code": null,
  "replayed": false
}
```

A retry of a terminal command sets `replayed = true` and returns the stored logical result.

## Deliberately absent

This API does not yet expose:

- AI writes;
- service-role/general machine mutation;
- Character or XP;
- Calendar/scheduling;
- arbitrary generic Evidence creation;
- Practice metadata update;
- hard deletion/privacy purge;
- cross-owner collaboration;
- bulk imports;
- connector ingestion.

Those require their own contracts rather than bypassing the command boundary.

## Gate before deployment

Before applying RPC migrations, pressure-test:

1. first-login owner bootstrap race;
2. same-command retry and conflicting-command replay;
3. semantic rejection persistence;
4. stale PracticeSession correction;
5. duplicate Direction edge race;
6. duplicate Evidence link race;
7. auth.uid() null / anonymous access;
8. cross-owner id probing;
9. SECURITY DEFINER search_path and grants;
10. command rollback behavior if deferred canonical invariants fail.
