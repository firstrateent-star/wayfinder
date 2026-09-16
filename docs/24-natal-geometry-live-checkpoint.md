# Wayfinder Natal Geometry Live Checkpoint

**Status:** LIVE

This checkpoint records the state immediately after deterministic natal geometry was promoted and deployed.

## Proven path

```text
Person birth facts
  -> birth-context Knowledge resolution
      -> birthplace
      -> IANA timezone
      -> historical UTC birth instant
  -> astro.natal_geometry
      -> Sun through Pluto
      -> Ascendant / MC / Descendant / IC
      -> Equal + Whole Sign houses
      -> exact angular relationships
```

Live Edge Functions:

```text
birth-context   v1   verify_jwt=true
natal-geometry  v1   verify_jwt=true
```

Runtime calculator:

```text
Astronomy Engine 2.1.19
MIT
provider id: astro.astronomy_engine
capability: astro.natal_geometry
```

Independent CI validation compares a neutral fixture against Swiss Ephemeris reference outputs while keeping Swiss Ephemeris out of the deployed runtime.

## Architectural boundaries preserved

- birth facts remain Person truth;
- resolved place/time are Knowledge/derivation;
- natal geometry is reconstructable deterministic output;
- no symbolic personality or guidance claims are produced yet;
- no natal geometry columns/tables were added to Person;
- no default house system is persisted;
- missing/ambiguous birth context blocks timed geometry instead of being guessed.

## Known deliberate limits

- historical wall-clock -> UTC still uses runtime Intl timezone rules and needs a pinned tzdb before perfect replay from wall-clock inputs;
- v0.1 house geometry supports Equal and Whole Sign only;
- aspect geometry exposes exact separation + nearest major angle but does not apply interpretive orb thresholds;
- longitude speed is a labeled twelve-hour central-difference approximation.

## Natural next architectural step

The deterministic astrology substrate is now strong enough that the next work should not add symbolic astrology immediately merely because it is available.

The mature roadmap can now return to the broader Life RPG foundation. High-value candidates are:

```text
Character Creation player UI
Schedule
Requirement/Standard contract
General Discovery / Navigator information-need loop
```

Symbolic astrology should later consume natal geometry through versioned astrology Knowledge and remain subordinate to grounded guidance/relevance rules.
