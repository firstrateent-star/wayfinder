# Wayfinder Voyage Progression v0.1

**Status:** IMPLEMENTED ON BRANCH — CI / LIVE DATABASE GATES PENDING  
**Rule:** `voyage_progression_v0.1`  
**First provider:** `training.strength-session-encounter.v0.1`

## Purpose

Reconnect the original Wayfinder Life RPG progression ideas to the newer canonical-reality, semantic-admission, and Character evidence architecture without allowing XP to become false life truth.

The central split is:

```text
meaningful participation -> Voyage Experience
demonstrated development -> Character
```

Wayfinder can reward the player for genuinely doing something while requiring stronger evidence before saying the player became more capable.

## Root law

> **Logging earns nothing. Practice earns Experience. Evidence reveals Capability. Longitudinal evidence establishes Growth.**

Voyage XP and Character growth are therefore independent projections over shared canonical reality.

## v0.1 encounter grammar

The first admitted encounter provider is Training because it already has a canonical logical session identity, versioned current state, occurrence time, command idempotency, and owner-scoped reads.

```text
wf_training.sessions logical record
        |
        + current ACTIVE STRENGTH version
        + occurrence completed through as_of
        |
        v
TRAINING_STRENGTH_SESSION encounter
        |
        v
1 Voyage XP
```

### Stable identity

```text
encounter_key = training:session:<logical-session-id>
```

The session version is lineage, not encounter identity.

Therefore:

```text
session v1 -> 1 encounter
correct to session v2 -> still 1 encounter
20 sets inside session -> still 1 encounter
command retry -> still the same canonical session -> still 1 encounter
```

## Why the rule is intentionally simple

v0.1 uses:

```text
1 unique qualifying canonical encounter = 1 Voyage XP
```

This is not intended as the final reward curve. It gives the smallest trustworthy unit before adding:

- encounter scale;
- healthy challenge/stretch;
- Pillar experience;
- Skill Experience;
- novelty;
- achievements;
- quests;
- Levels / Rank.

No multiplier is admitted until its inputs are grounded enough that additional detail cannot be gamed into extra XP.

## Read boundary

Migration:

```text
supabase/migrations/20260920003000_add_wayfinder_voyage_progression_input_v0.sql
```

Authenticated public RPC:

```text
wf_training_voyage_progression_input_v0(as_of, recent_limit)
```

The RPC reads private Training canonical state and returns:

- exact count of current ACTIVE completed STRENGTH logical sessions through `as_of`;
- a bounded recent encounter lineage list;
- COMPLETE stored-record count coverage;
- UNKNOWN lived-reality epistemic coverage.

It does not read the ModuleChange outbox as history and does not persist XP.

## Projection runtime

```text
supabase/functions/_shared/intelligence/voyage-progression.ts
```

Output:

```text
VoyageProgression
├── state
├── voyage_xp
├── encounter_count
├── configured_providers[]
├── recent_encounters[]
│   ├── stable encounter key
│   ├── current exact source ref
│   ├── occurred time
│   └── XP contribution
├── count_coverage
├── epistemic_coverage
└── does_not_assert[]
```

If the exact aggregate is unavailable, XP remains `null`. Unknown is never converted to zero.

## Wayfinder State integration

`wayfinder-state` advances to contract:

```text
wayfinder-state.v0.3
```

Its composed outputs now include:

```text
Position
Requirements
Character
Voyage Progression
Bearing
Guidance
Helm
```

Training ModuleChange invalidates three independent projections:

```text
Training
  -> Requirements
  -> Character
  -> Progression
```

Nutrition does not currently invalidate Progression because logging food is observation/intake capture, not a governed Voyage encounter.

Direction and Schedule likewise do not award XP merely for authoring intention or planning time.

## Character separation

A workout can simultaneously produce:

```text
Voyage XP            yes, because the encounter occurred
Might EXPOSURE       yes, if the canonical session supports it
Might CAPABILITY     only when structured performance supports it
Might GROWTH         only under might_growth_v0.1
```

Voyage XP never mutates Character.

Requirement satisfaction also does not award XP.

## Correction semantics

Because v0.1 is reconstructable:

- correction keeps the same logical encounter identity;
- changing the session version does not duplicate XP;
- if the current canonical record becomes ineligible/retracted, derived XP may decrease;
- no historical award is silently preserved because no durable award ledger exists yet.

This behavior is deliberate. If real use proves that game-history recognition needs to survive canonical corrections, the next architecture should introduce explicit recognition/adjustment semantics rather than mutating canonical life truth.

## Known boundary: duplicate descriptions

Command retry safety is solved by the canonical command/runtime and logical session identity.

A different problem remains possible:

```text
two separately created canonical sessions
that actually describe the same real workout
```

v0.1 does not claim those are automatically the same lived encounter. Cross-record reconciliation is a later Discovery/identity problem and is explicitly disclosed by the projection.

## Tests

```text
lab/voyage-progression-v0.1.test.ts
```

Pressure cases include:

- one session = one XP;
- correction does not mint a second encounter;
- complete zero is valid zero;
- unknown aggregate remains null rather than zero;
- unsupported encounter kinds do not surface;
- participation XP remains separate from Character growth;
- no permanent award ledger is implied.

Recomputation tests also verify that Training invalidates Progression while Nutrition and Direction do not.

## Deferred next petals

After this gate is green:

1. add the next genuinely governed encounter provider rather than a universal activity table;
2. recover dynamic Skill Experience + Sharpness over canonical encounters;
3. decide whether encounter scale/challenge can be grounded without rewarding logging detail;
4. Flower Level/Rank thresholds only after the XP stream has real data;
5. admit durable progression recognition only if correction/rule-version history proves reconstructability insufficient.
