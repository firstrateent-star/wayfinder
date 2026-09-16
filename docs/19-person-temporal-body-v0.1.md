# Wayfinder Person + Temporal Kernel + Body v0.1

**Status:** DEPLOYED / LIVE DATABASE GATE PASSED  
**Supabase project:** `ngakauhlcmvwnmimtsca`

## Purpose

This is the first executable expansion after the mature Life RPG architecture v0.2.

It proves three important seams without broadening the player UI:

1. **Owner is not Person.** Authentication/ownership remains System infrastructure while the modeled human has a separate canonical identity.
2. **Time remains cross-cutting.** A shared local-day helper establishes real timezone/DST semantics before Schedule and recurring Requirements are added.
3. **Body state is not Person identity.** Height and weight are temporal Body measurements, not permanent columns on the Person profile.

## Deployed private schemas

New:

```text
wf_person
wf_body
```

Existing private Wayfinder schemas remain:

```text
wf_system
wf_direction
wf_practice
wf_evidence
```

All private schemas continue to deny ordinary `anon` / `authenticated` direct access. Browser/application access remains through typed public RPCs.

---

# Person v0.1

## Canonical persistence

```text
wf_person.persons
wf_person.person_versions
```

### `persons`

Stable logical Person identity:

```text
id
owner_id
current_version_id
created_at
```

v0.1 admits one modeled player-person per owner.

The owner is the authorization/account scope. The Person is the modeled human subject. They are deliberately different concepts even while v0.1 is one-to-one.

### `person_versions`

Versioned/correctable profile payload:

```text
display_name
birth_date?
birth_time_local?
birth_time_accuracy?  EXACT | APPROXIMATE
birth_place_label?
```

Plus version/lifecycle/provenance metadata.

Birth facts are stable in reality but a recorded birth fact may be wrong. Correction therefore creates a new historical version instead of overwriting the old payload.

Person intentionally does **not** contain:

- height or weight;
- Role / Class;
- Skills or Mastery;
- XP / Level;
- current location;
- finances;
- Direction / goals;
- astrology interpretation.

## Commands

```text
wf_person_create(...)
wf_person_update_profile(...)
```

Both use the existing Wayfinder command envelope:

- authenticated owner resolution;
- command-id idempotency;
- canonical request hashing;
- APPLIED / REJECTED / NOOP terminal receipts;
- exact affected refs;
- transactional ModuleChange publication.

Correction requires `expected_version_id` and rejects stale noncommutative updates.

## Read

```text
wf_person_current_v0()
```

Returns the current active Person representation plus separate result and epistemic coverage.

No Person record means **no Person record is currently known**, not that the modeled person or any attribute is absent.

---

# Temporal Kernel v0.1

Private helper:

```text
wf_system.local_day_bounds(local_date, zone_id)
```

It resolves one local calendar day to the real half-open UTC interval:

```text
[start, end)
```

This exists specifically so future recurring Requirements and Schedule logic do not treat a day as a naive rolling 24-hour period.

Live DST evidence for `America/New_York`:

```text
2026-03-08 -> 23 hours
2026-09-15 -> 24 hours
2026-11-01 -> 25 hours
```

This is now the temporal foundation for concepts such as:

```text
protein >= target / local day
training >= N sessions / local week
review this evening
calendar allocation in the player's timezone
```

The helper is internal; it is not a normal browser RPC.

---

# Body v0.1

## Why Body is a distinct domain

Person answers **who is being modeled**.

Body owns **physical observations of that person through time**.

Therefore:

```text
birth date  -> Person
height      -> Body measurement
weight      -> Body measurement
```

Even height is modeled as a measurement rather than an eternal Person attribute. That preserves measurement time, source, correction, and later life-stage changes without corrupting Person identity.

## Canonical persistence

```text
wf_body.measurements
wf_body.measurement_versions
```

### Stable measurement

```text
id
owner_id
metric       height | weight
current_version_id
created_at
```

Metric kind is stable for the logical record.

### Versioned payload

```text
value
unit
observed_at
observed_zone_id?
lifecycle
provenance
recorded_at
```

Supported v0.1 canonical units:

```text
height: cm | m | in
weight: kg | lb
```

The reported quantity is canonical source reality. Unit normalization is deliberately a deterministic derivation, not a rewrite of the reported quantity.

Example:

```text
reported:   69 in
normalized: 175.26 cm   [DETERMINISTIC]
```

## Commands

```text
wf_body_record_measurement(...)
wf_body_correct_measurement(...)
```

Aliases such as `lbs`, `pounds`, `inches`, and `kilograms` normalize to canonical unit tokens before persistence.

A correction versions the same logical measurement and requires the expected current version.

Body v0.1 does not perform health judgments and does not infer BMI, fitness, body composition, recovery, stamina, or RPG attributes.

## Current Body read

```text
wf_body_current_v0()
```

This selects the latest active recorded observation for each admitted metric and returns both:

- reported quantity;
- deterministic normalized quantity.

"Current" here means **latest recorded Body observation**, not metaphysical proof of the body's exact state at the evaluation instant.

The read explicitly does not assert:

```text
health status
fitness level
BMI / body composition
stamina / recovery
that an unrecorded measurement does not exist
```

---

# Integrity and security

Both new modules preserve the existing Wayfinder architecture:

```text
Authenticated client
      |
      v
public SECURITY DEFINER RPC
      |
      v
private canonical wf_* schema
```

Person and Body use:

- stable logical row + immutable version row;
- one active version invariant;
- exact supersession lineage;
- deferred head-integrity constraint triggers;
- SECURITY DEFINER for deferred integrity triggers because they may execute after the outer public RPC definer context has returned;
- owner-scoped commands/reads;
- transactional command receipt + outbox behavior.

Authenticated direct-table access was explicitly tested and denied for both new private schemas.

## RLS advisory note

Supabase's generic table advisor reports that the new `wf_person` and `wf_body` tables have RLS disabled.

This is intentionally not auto-remediated because Wayfinder's current isolation model is **private schema privilege denial + narrow SECURITY DEFINER RPCs**, not direct client table access. Live tests confirmed the `authenticated` role cannot access these tables directly.

If the boundary changes in the future, RLS can be added as defense in depth. Enabling RLS blindly without matching policies would alter the current access model and is therefore a deliberate architecture decision rather than an automatic fix.

---

# What this unlocks

The backend can now support a future Character Creation experience that appears as one simple player interaction while routing truth correctly:

```text
Name / Birth
    -> Person

Height / Weight
    -> Body

Timezone
    -> System / temporal context

Natal geometry
    -> deterministic projection later
```

No Character Creation UI is added by this slice. The player shell remains intentionally quiet until the next seams are ready.

## Next candidate

The next mature slice is **Character Creation orchestration + deterministic natal-chart input contract**, while preserving the rule that one UI experience may span multiple canonical owners without collapsing their semantics.

Before a player-facing flow is exposed, the orchestration/atomicity question must be Flowered: if the player experiences initial creation as one indivisible save, Person + Body writes must not leave a misleading partial character when one required sub-write fails.
