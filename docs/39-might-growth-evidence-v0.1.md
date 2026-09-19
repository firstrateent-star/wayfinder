# Might growth evidence v0.1

**Status:** MERGED / PRODUCTION STATE DEPLOYED  
**Date:** 2026-09-19

## Purpose

Character v0.1 could distinguish:

```text
strength practice
 -> EXPOSURE

structured loaded repetitions
 -> CAPABILITY

GROWTH
 -> INSUFFICIENT_EVIDENCE
```

This slice defines the smallest rule that can honestly move Might GROWTH from `INSUFFICIENT_EVIDENCE` to `EVIDENCED`.

It does **not** create XP, a numeric Might score, a permanent Character ledger, or a generic fitness score.

## Explicit assumptions

The rule begins with its assumptions instead of hiding them inside a score.

1. **Growth is bounded to a canonical exercise.** Barbell Bench Press evidence is compared only with Barbell Bench Press evidence sharing the same `exercise_key`.
2. **The measured capability is a load/repetition performance frontier.** v0.1 does not estimate one-repetition maximum.
3. **Comparable observations require positive external load, integer repetitions, a canonical exercise key, and a supported load unit (`LB` or `KG`).**
4. **Load units are normalized before comparison.** Normalized load is rounded to a 0.5 kg comparison quantum so trivial LB/KG conversion noise cannot manufacture growth.
5. **A performance is better only by Pareto dominance.** It must use at least as much normalized load and at least as many repetitions as the comparison point, with one dimension strictly greater.
6. **One personal record is not durable growth evidence.** A proof requires at least two earlier baseline sessions and two distinct later sessions that each expand the same frozen historical frontier.
7. **“Later” means strictly later occurrence time.** Session IDs or storage order do not establish chronology.
8. **The claim is demonstrated capability growth, not physiology.** No minimum biological adaptation interval is inferred in v0.1.

These assumptions are versioned as `might_growth_v0.1`.

## Evidence shape

Training remains the canonical owner.

The evaluator reconstructs comparable observations from current Training session versions:

```text
session ref
+ occurred_at
+ exercise_key
+ exercise_label
+ set ref
+ reps
+ load_value
+ load_unit
+ normalized_load_kg
+ optional RPE context
```

RPE is carried as context but is not used as a hidden multiplier or gate in v0.1.

Missing or unsupported loaded-set data is excluded rather than converted to zero.

The bounded Training read must report `result_coverage.completeness = COMPLETE` before a growth proof can be emitted. A partial or unknown result set can hide a stronger historical frontier and therefore fails closed. Lived-reality epistemic coverage may remain `UNKNOWN`; the signal is explicitly about recorded capability evidence, not a claim that every workout was captured.

## Frozen-frontier proof

For one exercise:

```text
at least 2 earlier sessions
        ↓
historical Pareto frontier
        ↓
later candidate session expands frontier
        ↓
second strictly-later session also expands
the same frozen pre-candidate frontier
        ↓
Might GROWTH = EVIDENCED
```

The confirmation does not need to beat the candidate. It must independently demonstrate capability beyond the same historical anchor.

Example:

```text
baseline A   180 lb × 8
baseline B   185 lb × 8
candidate    190 lb × 8
confirm      185 lb × 9

=> bounded Barbell Bench Press growth evidence
```

Counterexample:

```text
baseline     185 lb × 8
later        195 lb × 6

=> tradeoff, not Pareto dominance
=> no growth claim
```

This deliberately refuses to smuggle an estimated 1RM formula into Character.

## Provenance

An evidenced growth signal preserves canonical lineage for:

- every baseline session required to establish the two-session baseline;
- the frontier anchor;
- the candidate expansion session;
- the later confirmation session.

The proof is reconstructable from canonical Training evidence. It is not persisted as a second source of truth.

## Character composition

Character advances to `character_v0.2`.

A qualifying proof yields:

```text
Might
  EXPOSURE   = EVIDENCED
  CAPABILITY = EVIDENCED
  GROWTH     = EVIDENCED
```

The summary names the bounded exercise evidence.

One exercise-specific proof is enough to evidence the **growth evidence class for Might**, but it does not assert:

- whole-body strength growth;
- physiological adaptation;
- causation by the training program;
- comparability with another exercise;
- a measured or estimated 1RM;
- a numeric Might level;
- XP;
- weakness or decline when the proof is absent.

## State invariant

`wayfinder-state.v0.2` keeps its response contract.

`characterGrowthAsserted` is no longer a hardcoded `false`. It is derived:

```text
true
only if at least one Character facet contains
an EVIDENCED governed growth signal
```

The state projection stays recomputable and noncanonical.

## Pressure-test gates

The implementation must prove:

1. one later personal record is insufficient;
2. one baseline session is insufficient;
3. two baseline sessions + candidate + later confirmation can establish growth;
4. cross-exercise observations never combine into growth;
5. higher-load/fewer-reps tradeoffs do not count;
6. LB/KG normalization works without conversion-noise growth;
7. incomplete/unsupported observations remain excluded rather than zero;
8. same-time sessions cannot fake “later” confirmation;
9. partial or unknown bounded Training result coverage blocks growth even when visible rows would otherwise qualify;
10. prior Character boundaries remain intact: Requirements do not mutate Character, and one loaded session remains CAPABILITY without GROWTH.

## Deferred

This slice intentionally does not decide:

- whether verified growth earns XP;
- how XP should decay, accumulate, or level a Character;
- whether a future rule should use velocity, RPE, body mass, estimated 1RM, volume, or exercise families;
- how detraining or decline should be represented;
- how long a physiological confirmation interval should be;
- growth providers for Craft, Vigor, Fortune, Insight, Bond, Flow, or Lore.

Those require their own evidence contracts rather than being inferred from this one.


## Production proof

Closed on 2026-09-19.

```text
PR #14 merge             591c1bff
Wayfinder Intelligence   PASS
Might growth tests       PASS
Wayfinder Web CI         PASS
wayfinder-state          ACTIVE v4
```

The deployed `wayfinder-state/index.ts`, `character-projection.ts`, and `might-growth.ts` were verified byte-for-byte against merge `591c1bff`.

No database migration was required. No XP, numeric Character score, or durable growth ledger was created.

The frontend source contract for `character_v0.2` is merged and Web CI is green. Vercel production promotion remains externally blocked by the free-tier daily deployment quota; this is not treated as a Character/growth architecture failure.
