# ADR-036 — Birth context is derived through Knowledge resolution, not expanded Person columns

**Status:** Accepted

## Context

Deterministic natal calculation requires more than the player's authored birth facts. A birthplace label must be resolved to a geographic place, coordinates, timezone context, and ultimately a UTC instant.

Those derived/reference values are not the same kind of truth as the player's recorded birthplace statement.

A tempting implementation would add fields such as latitude, longitude, timezone, provider id, and UTC birth timestamp directly to Person. That would mix player-authored origin facts with provider-derived reference data and make Person depend on one geography provider.

## Decision

Person continues to own only the stable/correctable player-origin facts:

```text
birth_date
birth_time_local?
birth_time_accuracy?
birth_place_label?
```

Geographic and temporal context is resolved through Knowledge capabilities:

```text
geo.resolve_place
geo.resolve_timezone
time.resolve_local_instant
```

The resulting birth context is a reconstructable read/projection with source/version/lineage and explicit limitations.

The initial `birth-context` Edge Function is read-only. It may accept an explicit candidate selection for one request, but it does not silently rewrite Person.

If a player chooses to persist a clarified birthplace, that mutation must route through an authorized Person command/correction.

## Consequences

Positive:

- Person remains small and provider-neutral.
- Geography vendors can be replaced behind stable capabilities.
- Ambiguity and provider outage remain explicit instead of becoming bad canonical data.
- Natal calculations can expose exactly which geographic/time resolution supported them.
- The same Knowledge + Inquiry architecture can be reused outside astrology.

Tradeoffs:

- A read may need to resolve reference context again unless later caching is justified.
- Exact long-term reproducibility requires a version-identifiable timezone rule dataset; runtime `Intl` alone is not a final persistence-grade contract.
- A user-selected place may need a later canonical clarification workflow to avoid repeated ambiguity.

## Rejected alternatives

### Put coordinates/timezone on Person

Rejected because those values are reference/derived context, not player-authored Person truth, and would couple canonical Person state to provider behavior.

### Always choose the first geocoder result

Rejected because ambiguity is epistemically meaningful and must not be silently collapsed.

### Default unknown birth time to noon

Rejected because it fabricates a fact and can materially alter timed astrology components such as Ascendant and houses.

### Persist every Knowledge resolution immediately

Rejected because the first slice does not yet justify a universal Knowledge cache/store. Persistence can be earned later through performance, offline, audit, or reproducibility pressure.
