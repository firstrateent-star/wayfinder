# Wayfinder Deterministic Natal Geometry v0.1

**Status:** IMPLEMENTED / CI GATE PASSED — deployment pending final promotion from build branch

## Purpose

Natal geometry is the deterministic astronomical layer between resolved birth context and later symbolic astrology guidance.

Wayfinder must preserve:

```text
Person birth facts
  -> Knowledge resolves place/time context
  -> deterministic natal geometry
  -> symbolic interpretation later
```

Natal geometry is not canonical Person truth and it is not itself symbolic guidance.

## Runtime capability

```text
astro.natal_geometry
```

Current provider:

```text
astro.astronomy_engine
Astronomy Engine 2.1.19
MIT license
```

The implementation is pinned by version. Provider identity is separate from capability identity so a future calculator can be substituted without changing the contract.

## Input contract

The calculator requires already-resolved birth context:

```text
UTC birth instant
latitude
longitude
optional resolved-place lineage
```

It does not accept a birthplace label and silently geocode it. Geographic/time resolution remains the responsibility of the birth-context Knowledge slice.

## Coordinate frame

v0.1 declares its frame explicitly:

```text
zodiac: tropical
planet observer: geocentric
ecliptic: true ecliptic of date
aberration correction: enabled
```

Planetary positions are calculated for:

```text
Sun
Moon
Mercury
Venus
Mars
Jupiter
Saturn
Uranus
Neptune
Pluto
```

Each body exposes:

```text
ecliptic longitude
ecliptic latitude
distance AU
zodiac sign + degree within sign
approximate signed longitude speed
DIRECT / RETROGRADE / STATIONARY motion state
```

The motion speed is explicitly marked as a central-difference approximation across twelve hours rather than a native ephemeris velocity.

## Terrestrial angles

Using Greenwich apparent sidereal time, resolved geographic longitude, true obliquity, and latitude, v0.1 calculates:

```text
Ascendant
Midheaven
Descendant
Imum Coeli
```

At the exact geographic poles, Ascendant/house geometry is intentionally omitted rather than fabricated. Planetary geometry remains available.

## Houses

v0.1 exposes two deterministic house geometries without selecting one as universal player truth:

```text
EQUAL
WHOLE_SIGN
```

No default interpretive house system is persisted.

Placidus/Koch are intentionally deferred until Wayfinder admits a separately validated, license-compatible house provider. The architecture must not force a complex house algorithm into the core merely to match one astrology convention.

## Angular relationships / aspects

v0.1 calculates pairwise separations among:

```text
10 planetary bodies
Ascendant
Midheaven
```

For each pair it reports:

```text
exact separation in [0,180]
nearest major aspect angle
orb = distance from that exact geometric angle
```

Major reference angles:

```text
0   conjunction
60  sextile
90  square
120 trine
180 opposition
```

Crucially, geometry does **not** decide whether the aspect is active. Orb thresholds and interpretive significance belong to later versioned astrology reference/guidance knowledge.

## Full runtime composition

```text
Person
  -> birth-context runtime
      -> geo.resolve_place
      -> geo.resolve_timezone
      -> time.resolve_local_instant
  -> astro.natal_geometry
  -> NatalGeometry projection
```

If birth context is not `READY`, the natal runtime returns `BLOCKED_BY_BIRTH_CONTEXT` and carries the existing Information Needs / Question Opportunities forward. It never invents missing time or place information.

## Reproducibility

Natal geometry itself is version-pinned to Astronomy Engine 2.1.19.

The upstream birth-context slice still has one known reproducibility limitation: its historical local-wall-time conversion currently relies on the runtime `Intl` timezone database, whose exact tzdb release is not surfaced as a durable identifier. The resulting UTC instant is included in natal-geometry lineage, but Wayfinder should pin/version timezone rules before treating future persisted chart snapshots as perfectly replayable from only the original wall-clock input.

## Independent validation

`lab/natal-geometry-v0.1.test.ts` compares a neutral test fixture against independently generated Swiss Ephemeris reference values.

The runtime does **not** depend on Swiss Ephemeris. The reference test checks bounded agreement for the ten planetary longitudes plus Ascendant/Midheaven.

The test suite also proves:

- retrograde/direct direction survives the approximation;
- Equal and Whole Sign cusp construction;
- all pairwise separations remain bounded;
- aspect geometry does not create an `active` symbolic assertion;
- polar charts omit undefined terrestrial angles instead of guessing;
- invalid deterministic inputs become conflict, not invented geometry;
- the full Person -> birth-context -> Knowledge -> natal-geometry runtime composes end-to-end.

## Architectural law

> **Natal geometry is reconstructable deterministic knowledge derived from birth facts and resolved context. It is not canonical Person truth and it is not symbolic astrology interpretation.**

This allows later astrology guidance to evolve without rewriting either the person's history or the astronomical calculation layer.
