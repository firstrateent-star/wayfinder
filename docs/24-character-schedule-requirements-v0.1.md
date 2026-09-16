# Wayfinder Character Creation → Schedule → Requirements v0.1

**Status:** IMPLEMENTED — Character Creation player flow live in source; Schedule v0.1 deployed; Requirement contract CI passed

This slice returns Wayfinder to the player/life side after proving the Knowledge/Question and deterministic natal foundations.

The sequence is deliberate:

```text
Character Creation
  -> establishes the modeled Person + initial Body observations
  -> Schedule
      -> owns planned allocation of time, never occurrence
      -> Requirement contract
          -> evaluates domain-owned recurring standards against bounded time
          -> Navigator later uses both to orient the player
```

## Laws preserved

- Character remains a projection; no canonical Character table.
- Character Creation is one player intent routed atomically to Person + Body.
- Planned time is not lived occurrence.
- Schedule may reference another module's object but does not own that object.
- Requirements are a shared contract, not a universal facts table.
- A domain owns the meaning of its requirement metric.
- Requirement evaluation is coverage-aware; missing observations are never silently treated as zero.
- Home/Helm remains relevance-driven rather than becoming a dashboard.

## Character Creation player flow

Authenticated players now pass through a Person-existence gate:

```text
authenticated + owner scope
       ↓
wf_person_current_v0
       ↓
Person exists?
├── no  -> /create-character
└── yes -> /helm
```

`/create-character` intentionally feels like an RPG creation moment rather than a settings/profile form.

Current fields:

```text
Name                  required
Birth date            required in v0.1 UI
Birthplace            optional
Birth time            optional
Birth time accuracy   EXACT | APPROXIMATE when known
Starting height       optional Body observation
Starting weight       optional Body observation
```

The page calls the already-proven atomic command:

```text
wf_character_initialize_v0
```

One submit therefore remains all-or-nothing across Person + optional Body observations. Skills, Role, XP, Level, Attributes and Path are deliberately absent; Wayfinder must earn those projections from later evidence.

Unknown birth time remains unknown. The UI does not substitute noon.

## Schedule v0.1 — LIVE

Private canonical schema:

```text
wf_schedule
├── allocations
└── allocation_versions
```

Public authenticated RPC boundary:

```text
wf_schedule_create_allocation
wf_schedule_revise_allocation
wf_schedule_current_v0
```

Supported planning semantics:

```text
HARD      fixed interval that should not move freely
SOFT      fixed preferred interval that may be rescheduled
WINDOWED  must fit somewhere inside a bounded window
FLOATING  needs temporal attention but has no selected interval yet
```

State v0.1:

```text
PLANNED
CANCELLED
```

An allocation may carry:

```text
fixed [start,end)
OR window [window_start,window_end)
due time
expected duration
IANA timezone
optional RecordRef/RecordVersionRef-like target
```

The target reference lets Schedule say “time is reserved for this Direction Action/Quest/etc.” without taking ownership of that object.

Schedule versions preserve immutable semantic payload, supersession lineage and stale-write protection. `ModuleChange` remains operational infrastructure rather than lived history.

The Schedule read separates database-result coverage from lived-world coverage and explicitly does not assert:

```text
that a scheduled activity occurred
that unscheduled time is definitely free
that missing schedule records do not exist
```

A live rollback test proved create → revise → current read and confirmed `authenticated` has no direct `wf_schedule` schema usage. See `lab/schedule-live-test-v0.1.md`.

## Requirement contract v0.1 — CI PASSED

There is intentionally no `wf_requirements` canonical table.

Shared runtime:

```text
supabase/functions/_shared/intelligence/requirements.ts
```

The contract accepts a requirement supplied by its owning domain:

```text
requirement key
domain
metric
unit
rule
resolved temporal scope
aggregation semantics
optional Direction lineage
```

Current rules:

```text
AT_LEAST
AT_MOST
BETWEEN
EXACT
```

Current observation coverage:

```text
COMPLETE
PARTIAL
UNKNOWN
```

Current evaluation states:

```text
SATISFIED
IN_PROGRESS
CLOSED_BELOW_TARGET
BREACHED
UNKNOWN
```

The evaluator supports a crucial logical distinction for monotonic accumulation.

Example — protein minimum `150 g / local day`:

```text
110g recorded, day open, partial coverage
-> IN_PROGRESS

155g recorded, day open, partial coverage
-> SATISFIED
   because additional intake cannot make an already reached minimum become unreached

110g recorded, day closed, partial coverage
-> UNKNOWN
   because unrecorded intake is not zero

110g recorded, day closed, complete coverage
-> CLOSED_BELOW_TARGET
```

Likewise an accumulating `AT_MOST` requirement can be proven breached before the period closes once the observed value has already exceeded its maximum.

The Requirement evaluator does not decide whether a target itself is appropriate. Nutrition, Training, Finance, or another owning domain must establish the metric and requirement semantics.

Automated tests:

```text
lab/requirements-v0.1.test.ts
```

The Intelligence CI workflow type-checks the evaluator and runs those tests.

## Performance / security follow-up

Schedule deployment surfaced missing covering foreign-key indexes across the newer Person, Body and Schedule modules. They were added in:

```text
20260916030500_index_wayfinder_person_body_schedule_foreign_keys.sql
```

The subsequent Supabase performance advisor no longer reports `unindexed_foreign_keys` for these modules.

Security remains intentionally:

```text
authenticated browser
  -> narrow public SECURITY DEFINER RPC
  -> private wf_* schema
```

The Supabase advisor therefore warns that authenticated users may execute these `SECURITY DEFINER` RPCs; this is expected and remains a deliberate review point. Direct private-schema access is denied. Leaked-password protection remains a separate production-hardening item.

## What this slice does not yet do

It does not yet:

- show Calendar/Schedule as a player dashboard;
- infer that a past Schedule allocation happened;
- create recurring Schedule rows automatically;
- create global Requirement records;
- know real protein intake or training exposure;
- surface requirement cards permanently on Helm;
- allow Navigator to schedule or change canonical plans autonomously.

## Next proving slice

Schedule + the shared Requirement grammar are now ready, but the Requirement evaluator still needs real domain-owned observations.

The strongest next vertical slice is a deliberately small **Training + Nutrition reality foundation** sufficient to prove two concrete standards:

```text
strength training sessions >= N / local week
protein >= target grams / local day
```

That should include the minimum reference Knowledge needed to interpret exercises/foods while preserving measured vs estimated input and coverage.

Only after those domain signals are grounded should Position/Navigator begin surfacing guidance such as:

```text
“One strength session remains this week.”

“Recorded protein is below today's target, but today's intake coverage is incomplete.”
```

That gives Navigator useful temporal intelligence without turning Helm into a tracker dashboard.
