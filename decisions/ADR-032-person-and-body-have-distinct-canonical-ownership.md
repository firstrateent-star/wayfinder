# ADR-032 — Person and Body Have Distinct Canonical Ownership

**Status:** ACCEPTED  
**Date:** 2026-09-15

## Context

Character Creation wants to present a simple RPG-like experience containing information such as name, birth information, height, and weight.

The player experience could make these fields appear to be one Character profile, but they do not have the same truth semantics:

- preferred name and birth/origin facts describe the modeled Person;
- height and weight are physical observations through time;
- owner/auth identity is an authorization scope rather than the modeled human;
- Character itself is a composed projection, not a canonical profile row.

Putting all of these values on one `character` or `person` table would make changing observations look permanent, blur recorded-at versus observed-at time, and make later Body/Training/Nutrition reasoning depend on an identity record that owns facts it does not understand.

## Decision

Wayfinder keeps these concepts separate:

```text
Owner    -> System/auth scope
Person   -> modeled human identity + stable/correctable origin facts
Body     -> temporal physical measurements/state facts
Character -> derived composition over Person + Body + other domains
```

Person v0.1 may canonically own:

```text
display/preferred name
birth date
birth time when known
birth-time accuracy
birth-place label
```

Body v0.1 canonically owns temporal measurements such as:

```text
height
weight
```

A player-facing Character Creation experience may collect values for multiple modules in one flow, but the backend must route each factual mutation to its canonical owner.

Stable facts remain correctable by versioning because the record can be wrong even when reality itself did not change.

Body measurements preserve `observed_at` separately from `recorded_at`.

Reported measurement units remain canonical source payload. Cross-unit normalization is deterministic derivation.

## Consequences

Positive:

- Character Creation can remain simple without flattening backend truth;
- weight changes naturally become time series rather than profile overwrites;
- later Body/Training/Nutrition/Growth systems have a correct factual owner;
- birth facts can drive deterministic astrology calculations without giving astrology ownership of Person truth;
- Character remains reconstructable instead of becoming a second truth store.

Tradeoffs:

- one Character Creation action may span more than one owning module;
- the orchestration/atomicity contract must be explicitly designed before the multi-module player save is exposed;
- reads that render a Character card must compose multiple module reads.

## Rejected alternatives

### Store all Character Creation fields on Person

Rejected because mutable Body observations would become identity fields and lose their temporal semantics.

### Create a canonical Character table

Rejected because Character is intended to contain many derived concepts such as skills, role, stats, effective gear modifiers, archetypes, and path. Persisting it as source truth would create drift and duplicate ownership.

### Store height as Person but weight as Body

Rejected for v0.1. Height is relatively stable but is still a measurement with source/time/correction semantics and can change across a lifetime.

## Follow-up

Before player-facing Character Creation is implemented, define whether the initial Person + Body capture is:

1. one indivisible user intent requiring one authoritative orchestration transaction; or
2. a deliberately resumable workflow whose partial state is visible and truthful.

Do not silently split an experience the player perceives as one atomic save into unrelated commits without deciding this boundary.
