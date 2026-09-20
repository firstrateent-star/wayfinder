# Wayfinder Skill Capability v0.1

**Status:** IMPLEMENTED ON BRANCH — CI / LIVE DATABASE GATES PENDING  
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
- bounded recent exact set/session lineage;
- COMPLETE result coverage over the modeled phenomenon;
- UNKNOWN epistemic coverage over total human capability.

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
at least one valid exact recent demonstration lineage item
```

This proves only a bounded demonstrated capability.

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
- Mastery;
- whole-body strength;
- physiological adaptation;
- growth from capability alone;
- complete capability coverage.

## Tests

```text
lab/skill-capability-v0.1.test.ts
```

Pressure cases include:

- valid loaded repetition -> EVIDENCED;
- complete zero -> INSUFFICIENT_EVIDENCE, not zero ability;
- unknown read -> UNKNOWN;
- positive bounded evidence with UNKNOWN lived coverage;
- DORMANT Sharpness while Capability stays EVIDENCED;
- large Experience without demonstration does not become Capability;
- Practice-derived Skills stay Capability UNKNOWN;
- duplicate Capability providers fail closed;
- orphan Capability provider fails closed.

## Next earned frontier

After production:

1. decide whether Strength Training Capability needs exercise-specific subskill projections rather than one broad Skill;
2. define a first evidence-backed Capability provider for a creative Skill only when objective/authorized output evidence exists;
3. Flower Mastery from repeated capability across time, contexts, and difficulty only after capability breadth exists;
4. defer Skill Level until Experience + Capability + Mastery semantics have enough real data.
