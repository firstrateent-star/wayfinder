# Wayfinder Skill Capability v0.1

**Status:** MERGED / PRODUCTION STATE DEPLOYED  
**Skills projection:** `skills_v0.3`  
**First Capability provider:** `training.strength-skill-capability-provider.v0.1`

## Purpose

Add the first evidence-backed Skill Capability without collapsing it into Experience, Sharpness, Character growth, or Mastery.

## Core model

```text
Skill
├── Experience
│   governed practice history
├── Sharpness
│   recency relative to personal cadence
├── Capability
│   demonstrated ability evidence
└── Mastery
    future depth / reliability / transferability
```

v0.1 activates Capability only for Strength Training.

## All-history read boundary

Migration:

```text
supabase/migrations/20260920020000_add_strength_skill_capability_input_v0.sql
```

Authenticated RPC:

```text
wf_training_strength_skill_capability_input_v0(as_of, recent_limit)
```

The read scans current canonical Strength Training history through `as_of` and admits only structured loaded-repetition demonstrations:

```text
exercise key present
exercise label present
reps > 0
load > 0
load unit = LB | KG
current ACTIVE session/version
```

It returns:

- exact loaded-demonstration count;
- distinct demonstrated session count;
- distinct demonstrated exercise count;
- first/last demonstrated occurrence;
- exercise-specific load × reps Pareto frontiers;
- bounded recent exact set/session lineage;
- COMPLETE result coverage over the modeled phenomenon;
- UNKNOWN epistemic coverage over total human capability.

### Performance frontier

Loads are normalized with the same governed constants used by `might_growth_v0.1`:

```text
canonical load unit = KG
LB -> KG            = 0.45359237
comparison quantum  = 0.5 kg
```

For one stable exercise identity, point A dominates point B only when:

```text
A.load >= B.load
AND
A.reps >= B.reps
AND
at least one is strictly greater
```

The capability representation is the set of non-dominated observations.

Example:

```text
Barbell Bench Press

185 lb × 8   frontier
205 lb × 5   frontier
185 lb × 5   dominated -> excluded
```

The first two remain simultaneously because neither dominates the other. A squat observation is represented on a separate squat frontier; Wayfinder does not compare it directly with bench press.

## Why all current history

Character's Might growth analysis intentionally uses a bounded recent window.

Skill Capability answers a different question. A previously demonstrated ability should not disappear merely because an old session ages out of a 90-day read.

Therefore:

```text
Sharpness can decay with time.
Capability evidence does not decay with time.
```

Canonical correction/retraction may still change the reconstructed projection.

## State semantics

### EVIDENCED

Requires:

```text
demonstration_count > 0
AND
performance_model = LOAD_REPS_PARETO_FRONTIER
AND
valid governed load normalization
AND
frontier_point_count > 0
AND
frontier exercise count agrees with the aggregate
```

The TypeScript projection independently removes dominated points even if a malformed provider response contains them.

This proves only bounded, exercise-specific demonstrated capability.

### INSUFFICIENT_EVIDENCE

Requires:

```text
result coverage = COMPLETE
AND
demonstration_count = 0
```

This means the modeled records do not establish Capability.

It does **not** mean zero human ability.

### UNKNOWN

Used when the governed read cannot establish either a positive demonstration or complete zero.

## Current production expectation

At implementation time, current production Training data contains:

```text
loaded demonstration count  0
demonstrated exercise count 0
demonstrated session count  0
```

Therefore after deployment the honest expected Strength Training Capability state is:

```text
INSUFFICIENT_EVIDENCE
```

even if Strength Training Experience exists.

Music Production and Drawing remain:

```text
Capability = UNKNOWN
provider   = none
```

because no governed performance provider exists for them yet.

## Projection architecture

`buildSkillsProjection` now accepts two independent provider families:

```text
Experience providers
Capability providers
```

One Skill may have one authoritative provider per axis.

Duplicate Capability providers fail closed.

A Capability provider cannot silently create a Skill identity without a configured Experience/association provider in v0.1.

## What Capability does not assert

The first provider explicitly does not claim:

- numeric Skill Level;
- one overall Strength Training capability score;
- Mastery;
- direct comparability between unlike exercises;
- measured or estimated one-repetition maximum;
- whole-body strength;
- physiological adaptation;
- growth from capability alone;
- complete capability coverage.

## Tests

```text
lab/skill-capability-v0.1.test.ts
```

Pressure cases include:

- valid loaded repetition frontier -> EVIDENCED;
- non-dominated load/reps tradeoffs both survive;
- dominated points are removed at the projection boundary;
- positive counts with missing/incoherent frontier -> UNKNOWN;
- aggregate/frontier exercise-count disagreement -> UNKNOWN;
- complete zero -> INSUFFICIENT_EVIDENCE, not zero ability;
- unknown read -> UNKNOWN;
- positive bounded evidence with UNKNOWN lived coverage;
- DORMANT Sharpness while Capability stays EVIDENCED;
- large Experience without demonstration does not become Capability;
- Practice-derived Skills stay Capability UNKNOWN;
- duplicate Capability providers fail closed;
- orphan Capability provider fails closed.

## Live-schema rollback proof

Before merge, the exact migration was installed inside a production-schema transaction with synthetic canonical Training history:

```text
Bench 185 lb × 8
Bench 205 lb × 5
Bench 185 lb × 5
Squat 225 lb × 5
```

The authenticated RPC returned:

```text
Bench frontier = 185×8 + 205×5
185×5          = excluded as dominated
Squat           = independent frontier
```

The transaction then rolled back. The test function and all synthetic rows were verified absent afterward.

This also caught and fixed a PostgreSQL special-syntax issue (`pg_catalog.coalesce` -> `coalesce`) before production migration.

## Production proof

PR #19 merged at `5afdb0539d0067c6a35ab35787dbc37b5014515f`.

```text
Wayfinder Intelligence CI     PASS
Skill Capability suite        PASS
Wayfinder Web CI              PASS
wayfinder-state               ACTIVE v8
state contract                wayfinder-state.v0.6
skills projection             skills_v0.3
```

Production migration `add_strength_skill_capability_input_v0` is applied. Authenticated callers may execute the RPC; anon/public may not.

The live canonical read currently reports:

```text
demonstrated observations  0
demonstrated sessions      0
demonstrated exercises     0
exercise frontiers         []
result coverage            COMPLETE
epistemic coverage         UNKNOWN
```

Therefore the honest initial Strength Training Capability projection is `INSUFFICIENT_EVIDENCE`, not zero ability.

The deployed state entrypoint, Skill projection, and projection-provider registry match merge `5afdb053` byte-for-byte.

## Next earned frontier

With Capability live:

1. observe whether exercise frontiers should later surface as subskills while keeping the broad Strength Training Skill as the parent experience concept;
2. define a first evidence-backed Capability provider for a creative Skill only when objective/authorized output evidence exists;
3. Flower Mastery from repeated capability across time, contexts, and difficulty only after capability breadth exists;
4. defer Skill Level until Experience + Capability + Mastery semantics have enough real data.
