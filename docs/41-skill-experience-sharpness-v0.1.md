# Wayfinder Skill Experience + Sharpness v0.1

**Status:** IMPLEMENTED ON BRANCH — CI / LIVE DATABASE GATES PENDING  
**Projection:** `skills_v0.1`  
**First Skill:** `physical.strength_training`  
**Provider:** `training.strength-skill-provider.v0.1`

## Purpose

Recover the strongest part of the older Wayfinder skill system without collapsing practice, current readiness, demonstrated capability, and mastery into one number.

The v0.1 model is:

```text
EXPERIENCE
how much governed practice exists

SHARPNESS
how current that practice is relative to personal cadence

CAPABILITY
what can actually be demonstrated

MASTERY
depth / reliability / transferability
```

Only the first two are implemented here. Capability remains UNKNOWN and Mastery remains NOT_EVALUATED.

## Root laws

```text
Experience may accumulate.
Experience does not decay.

Sharpness may change with time.
Sharpness does not erase Experience.

Experience != Capability.
Sharpness != Capability.
Encounter count != Mastery.
```

## Skill identity

v0.1 intentionally uses one deterministic Skill concept:

```text
physical.strength_training
label: Strength Training
```

It is not stored as a Person fact or canonical Skill row.

Training owns the factual session. The Skill provider deterministically interprets a current canonical `STRENGTH` session as one Strength Training practice encounter.

## Experience identity

```text
encounter_key
= training:session:<logical-session-id>

skill_experience_key
= <encounter_key>:skill:physical.strength_training
```

Therefore:

```text
12 sets in one workout      -> 1 Skill Experience encounter
command retry               -> still 1
session v1 corrected to v2  -> still 1
two separate workouts       -> 2
```

Richer logging detail cannot manufacture more Experience.

## Training read boundary

Migration:

```text
supabase/migrations/20260920010000_add_strength_skill_experience_input_v0.sql
```

Authenticated RPC:

```text
wf_training_strength_skill_input_v0(as_of, recent_limit)
```

The read derives from current ACTIVE completed Strength Training logical sessions and returns:

- exact encounter count;
- first evidenced occurrence;
- last evidenced occurrence;
- count of positive inter-session cadence samples;
- median positive interval;
- bounded recent exact-version lineage;
- COMPLETE stored-record aggregate/cadence coverage;
- UNKNOWN lived-reality coverage.

No Skill XP or Sharpness state is persisted.

## Sharpness rule

Cadence-aware Sharpness is permitted only when:

```text
encounter_count >= 4
AND
positive cadence samples >= 3
AND
cadence aggregate coverage = COMPLETE
AND
median interval > 0
```

The typical interval is:

```text
median(
  each positive interval
  between chronological qualifying encounters
)
```

Using the median makes the baseline less sensitive to an unusually long break or one unusually short interval.

Current cadence ratio:

```text
(now - last_evidenced_at)
/
typical_interval
```

v0.1 states:

```text
<= 1.25x  SHARP
<= 2.00x  WARM
<= 4.00x  COOL
>  4.00x  DORMANT
```

These are versioned RPG semantics, not physiological claims.

### Insufficient history

With recorded Experience but insufficient cadence history:

```text
mode  = RECENCY_ONLY
state = UNESTABLISHED
```

Wayfinder still exposes the last evidenced occurrence and current time gap, but does not invent a personal cadence.

With no qualifying recorded encounter:

```text
skill state      = UNOBSERVED
experience count = 0
sharpness        = UNOBSERVED
capability       = UNKNOWN
```

Complete zero stored Experience is not a claim of zero human ability.

## Projection

Runtime:

```text
supabase/functions/_shared/intelligence/skill-projection.ts
```

Shape:

```text
SkillsProjection
└── Strength Training
    ├── association
    │   └── DETERMINISTIC
    ├── experience
    │   ├── encounter count
    │   ├── first evidenced
    │   ├── last evidenced
    │   └── recent exact lineage
    ├── sharpness
    │   ├── mode
    │   ├── state
    │   ├── current gap
    │   ├── typical interval
    │   ├── cadence sample count
    │   └── cadence ratio
    ├── capability = UNKNOWN
    └── mastery = NOT_EVALUATED
```

## Wayfinder State

This slice advances the composed contract to:

```text
wayfinder-state.v0.4
```

State now contains:

```text
Position
Requirements
Character
Voyage Progression
Skills
Bearing
Guidance
Helm
```

Training invalidation becomes:

```text
Training
 -> Requirements
 -> Character
 -> Progression
 -> Skills
```

These remain separate projections over shared canonical reality.

## Temporal behavior

A critical invariant is that no data mutation is needed for Sharpness to cool.

Example:

```text
same canonical encounter history
same Experience count

Sep 19 -> WARM
Sep 29 -> COOL
Oct 19 -> DORMANT
```

The only changed input is current time.

## Tests

```text
lab/skill-experience-sharpness-v0.1.test.ts
```

Pressure cases cover:

- one deterministic Skill identity;
- exact encounter counting;
- Experience/Capability separation;
- Experience/Mastery separation;
- insufficient cadence history;
- cadence-aware SHARP;
- time-only WARM -> COOL -> DORMANT transition;
- Experience never decays;
- session correction does not duplicate Experience;
- exact zero remains UNOBSERVED rather than zero ability;
- unknown count remains unknown;
- incomplete cadence basis fails closed;
- non-Strength rows cannot contribute.

## Deferred next petals

After v0.1 survives production:

1. add a Skill Association contract that can accept deterministic and governed semantic associations;
2. pressure-test one non-Training skill from Practice before creating any universal taxonomy;
3. reconcile aliases/synonyms to stable Skill identities;
4. add Skill Capability only where a domain can define demonstrated performance;
5. add Mastery only after depth/reliability/transfer evidence exists;
6. keep Skill Level deferred until real Experience + Capability histories exist;
7. only then explore Role/Class clustering across multiple Skills.
