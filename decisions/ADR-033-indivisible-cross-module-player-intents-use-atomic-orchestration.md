# ADR-033 — Indivisible Cross-Module Player Intents Use Atomic Orchestration

**Status:** ACCEPTED  
**Date:** 2026-09-15

## Context

The Stateful Module Protocol correctly prevents one domain from silently owning or directly mutating another domain's canonical facts.

Character Creation introduces a different problem: the player may experience one action such as:

```text
Create my character
  name / birth facts
  height
  weight
```

while those facts correctly belong to different modules:

```text
Person <- name / birth
Body   <- height / weight
```

Committing those child writes independently from the client can leave a misleading partial result if one succeeds and another fails.

Wayfinder already has a root law that when the person experiences a save as one indivisible act, required canonical writes should share one authoritative transaction when partial commit would violate the intent.

Because the current architecture is a modular monolith on one Postgres database, this can be achieved without distributed transactions and without giving Person ownership of Body or vice versa.

## Decision

For an **indivisible user intent that spans multiple canonical modules on the same transactional database**, Wayfinder may use a System/application orchestration command that:

1. claims one outer user-intent command receipt;
2. validates cross-module request shape;
3. invokes each owning module through its command boundary;
4. executes the required child commands inside one outer database transaction / subtransaction boundary;
5. rolls back every child canonical mutation if any required child command fails;
6. preserves one clean outer terminal result for the player intent;
7. correlates child `ModuleChange` rows back to the outer command id;
8. does **not** create a new canonical aggregate merely to make the transaction easier.

This does not permit one life domain to write another domain's tables directly.

Conceptually:

```text
PLAYER INTENT
     |
     v
SYSTEM ORCHESTRATOR
  /       |        \
 v        v         v
Person   Body    other future owner
command  command      command
  \       |         /
   +------+--------+
          |
     one transaction
          |
       COMMIT
          or
       ROLLBACK
```

## Character initialization v0.1

The first implementation is:

```text
public.wf_character_initialize_v0(...)
```

Character itself remains a projection and no canonical Character table is created.

The orchestration currently supports:

```text
required:
  display name

optional:
  birth date
  birth local time + accuracy
  birth-place label
  initial height
  initial weight
```

Routing:

```text
Person facts -> wf_person command
Body facts   -> wf_body commands
```

If any provided required child write rejects, the child subtransaction rolls back completely and the outer command returns `REJECTED`.

A successful initialization may be replayed safely using the same outer command id. A different initialization command after Person already exists is rejected as `CHARACTER_ALREADY_INITIALIZED` so the first-run endpoint cannot silently append duplicate initial Body observations.

## Consequences

Positive:

- player-facing Character Creation can truthfully behave like one save;
- domain ownership remains intact;
- no partial Person-without-required-Body residue survives child failure;
- retries remain safe;
- module changes retain their native owners while sharing a correlation id;
- no canonical Character aggregate is introduced.

Tradeoffs:

- orchestration adds nested command receipts;
- child commands must remain safe to invoke under an outer transaction;
- multi-database or external side effects cannot use this mechanism directly and will require explicit resumable/saga semantics later;
- optional fields must remain genuinely optional; the atomic boundary only protects writes included in the declared player intent.

## Boundary

This ADR does **not** say every cross-module workflow must be atomic.

Use atomic orchestration only when:

- the player experiences the operation as one indivisible save;
- partial commit would misrepresent their intent;
- all required canonical mutations can participate in the same authoritative transaction.

Otherwise use an explicitly resumable/eventual workflow and surface partial completion honestly.

## Rejected alternatives

### Let the frontend call Person and Body independently

Rejected for Character Creation because a network failure between calls can produce a half-created result while the UI implies one save.

### Let Person directly write Body tables

Rejected because it destroys module ownership.

### Create a canonical Character table that owns all creation fields

Rejected because Character is a composed projection and would duplicate Person/Body truth.

### Use distributed saga infrastructure immediately

Rejected because Person and Body currently share one Postgres transaction. A saga would add failure modes and infrastructure without solving a present need.
