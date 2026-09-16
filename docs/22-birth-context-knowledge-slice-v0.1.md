# Wayfinder Birth Context Knowledge Slice v0.1

**Status:** LIVE / PROVING SLICE PASSED

## Purpose

This slice is the first real vertical use of the Knowledge + Inquiry acquisition spine. It turns Person birth facts into a deterministic, lineage-aware natal-readiness projection without copying geography or astrology reference data into canonical Person state.

## Live flow

```text
Person birth facts
  -> Knowledge / geo.resolve_place
  -> RESOLVED | AMBIGUOUS | UNAVAILABLE
  -> Information Need when player clarification is appropriate
  -> Question Planner
  -> Knowledge / geo.resolve_timezone
  -> deterministic time.resolve_local_instant
  -> natal readiness
```

## Canonical vs Knowledge ownership

Person remains canonical owner of the player's authored/stable origin facts:

```text
birth_date
birth_time_local?
birth_time_accuracy?
birth_place_label?
```

Knowledge owns no player truth. It resolves the recorded birthplace label into external/reference context:

```text
resolved place identity
WGS84 latitude / longitude
IANA timezone
provider lineage
```

The read-only birth-context operation does not rewrite Person.

If ambiguity is resolved by a player selecting one candidate, v0.1 can use that selection for the current request. Persisting a clarified birthplace still requires an explicitly authorized Person correction/update.

## Providers in v0.1

### `geo.resolve_place`

Provider: `geo.open_meteo`

Open-Meteo's geocoding API is used as a provisional reference-data provider. The capability seam is stable; the provider is replaceable.

Returned reference data includes, where available:

- provider place id;
- normalized display label;
- WGS84 latitude / longitude;
- country / administrative region;
- IANA timezone;
- feature type / population metadata.

Ambiguous common place names are not silently collapsed to the first result.

### `geo.resolve_timezone`

Provider: `geo.resolved_place_timezone`

The selected place's provider-supplied IANA timezone is validated by the runtime before use.

### `time.resolve_local_instant`

Provider: `time.intl_local_instant`

This deterministic resolver converts:

```text
local birth date
+ local birth time
+ IANA timezone
-> UTC instant + offset
```

It explicitly detects:

- daylight-saving clock gaps where a local wall time never occurred;
- clock folds where one local wall time maps to two UTC instants.

It does not arbitrarily choose one side of a fold.

## Reproducibility limitation

v0.1 uses the Edge runtime's `Intl` timezone rules. The exact underlying tzdb version is not exposed as a durable Wayfinder contract.

Therefore:

> The current resolver is sufficient to prove the acquisition seam and produce read-time natal readiness, but persisted natal geometry should not be treated as perfectly reproducible until Wayfinder pins or otherwise versions the timezone-rule dataset used by calculation.

This limitation is surfaced in lineage rather than hidden.

## Natal-readiness states

```text
NO_PERSON
MISSING_BIRTH_DATE
MISSING_BIRTH_PLACE
AMBIGUOUS_BIRTH_PLACE
PLACE_RESOLUTION_UNAVAILABLE
TIMEZONE_RESOLUTION_UNAVAILABLE
READY_FOR_TIME_INDEPENDENT_CHART_ONLY
AMBIGUOUS_BIRTH_INSTANT
BIRTH_INSTANT_UNRESOLVABLE
READY
```

`READY_FOR_TIME_INDEPENDENT_CHART_ONLY` never means Wayfinder may invent noon or another default birth time. It means future astrology calculation may support only components that can be honestly represented without a precise local birth time.

## Question behavior

Question specs exist for:

```text
person.birth_date
person.birth_place
person.birth_place_disambiguation
person.birth_time
```

Examples:

- A birthplace ambiguity required for a full natal request becomes P0/P1 and can be asked immediately.
- Missing birth time during ordinary background readiness is P2 high-leverage and does not interrupt task-driven mode.
- The same missing birth time may be asked during an opt-in Discovery Session.

Question wording remains separate from the structured information target.

## Live Edge Function

Supabase Edge Function:

```text
birth-context
```

Security:

```text
verify_jwt = true
```

The function:

1. reads the authenticated owner's current Person through the existing public owner-scoped RPC;
2. runs the Knowledge + Inquiry birth-context runtime;
3. returns a read-only readiness projection;
4. performs no canonical writes.

Optional request fields:

```text
purpose: NATAL_READINESS | FULL_NATAL_CHART
questionMode: TASK_DRIVEN | AMBIENT | DISCOVERY_SESSION
selectedPlaceId?: string
includeOptionalQuestions?: boolean
locale?: string
```

## Validation

Automated test:

```text
lab/birth-context-vertical-slice-v0.1.test.ts
```

CI:

```text
.github/workflows/intelligence-ci.yml
```

The passing test suite proves:

- a qualified birthplace resolves through reference knowledge;
- `1988-10-22 17:32 America/New_York` resolves to `1988-10-22T21:32:00Z`;
- ambiguous `Springfield` remains ambiguous and creates a high-priority player question;
- missing birth time does not nag during ordinary task-driven natal-readiness evaluation;
- Discovery Session may ask the high-leverage birth-time question;
- DST clock-fold ambiguity is preserved rather than guessed;
- provider outage returns unavailable and does not invent a place.

The Edge Function deployed successfully and is ACTIVE as version 1.

## What this proves for the wider project

This slice proves the same architecture that later Training, Nutrition, Inventory, Finance, World and other domains can reuse:

```text
canonical player fact
+ reference knowledge
+ deterministic derivation
+ uncertainty
+ prioritized player inquiry
-> useful read/projection
```

No `wf_knowledge` or `wf_questions` persistence was required.

## Next build

The next astrology step is a deterministic ephemeris/natal-geometry provider over the resolved birth context.

Before symbolic interpretation, prove:

```text
resolved UTC birth instant
+ WGS84 coordinates
+ versioned ephemeris implementation/data
-> planetary positions
-> Ascendant / houses when timed inputs support them
-> aspects
```

The output remains deterministic derivation, not Person truth and not symbolic interpretation.
