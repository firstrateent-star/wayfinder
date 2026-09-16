# ADR-037 — Natal Geometry Is Derived Deterministic Knowledge

**Status:** ACCEPTED

## Context

Wayfinder now has canonical Person birth/origin facts and a Knowledge-driven birth-context resolver. The next astrology layer requires planetary positions, angles, house geometry, and pairwise angular relationships.

A naive implementation could persist these values directly on Person, treat them as symbolic meaning, or bind the architecture to one astrology library/house system.

All three would weaken the system:

- chart coordinates are reconstructable derivations, not Person-authored facts;
- astronomical geometry and symbolic astrology have different authority classes;
- calculator/provider implementations may change over time;
- house systems are conventions and should not be silently universalized.

## Decision

Wayfinder treats natal geometry as **DETERMINISTIC Knowledge / Projection output**.

```text
canonical Person birth facts
  + resolved birth context
  -> versioned deterministic calculator
  -> natal geometry
  -> symbolic astrology knowledge later
```

The stable capability is:

```text
astro.natal_geometry
```

The first provider is version-pinned Astronomy Engine 2.1.19.

Natal output must declare its coordinate frame, engine/version, input lineage, and limitations.

The v0.1 calculator returns:

- tropical geocentric true-ecliptic-of-date positions for Sun through Pluto;
- Ascendant, Midheaven, Descendant, and Imum Coeli when geographically defined;
- Equal and Whole Sign house geometry;
- exact pairwise angular separations and nearest major aspect angles.

The geometry layer does **not**:

- store chart values as canonical Person fields;
- infer personality/meaning;
- decide whether an aspect is active using an orb convention;
- choose Equal vs Whole Sign as the player's universal truth;
- fabricate Ascendant/houses from missing or invalid birth context;
- implement complex house systems merely by importing a restrictive runtime dependency.

## Why not Swiss Ephemeris as the runtime dependency?

Swiss Ephemeris is useful as an independent validation oracle, but commonly available JS/WASM wrappers inherit GPL/AGPL or Swiss dual-license constraints. Wayfinder v0.1 therefore uses a permissively licensed deterministic runtime implementation and keeps the provider seam replaceable.

A future Swiss Ephemeris provider may be admitted if licensing is explicitly compatible with the deployment model.

## Consequences

Positive:

- Player truth remains clean.
- Symbolic astrology can evolve independently.
- Calculator providers are replaceable.
- Geometry can be recomputed instead of migrated as canonical history.
- House-system choices remain explicit.
- The same Knowledge contract used by geography/time now owns the astronomical calculation seam.

Tradeoffs:

- v0.1 does not yet provide Placidus/Koch.
- motion speed is an explicitly labeled finite-difference approximation.
- upstream historical timezone resolution still needs a pinned/version-identifiable tzdb for perfect replay from wall-clock inputs.

## Validation requirement

Before promotion, natal geometry must pass deterministic CI and compare bounded outputs against an independent ephemeris reference fixture.
