# ADR-047 — Skill Capability is demonstrated evidence, not Experience or Sharpness

**Status:** ACCEPTED FOR SKILL CAPABILITY v0.1

## Context

Wayfinder now reconstructs Skill Experience and Sharpness from governed encounter history. Those projections answer how much a Skill has been practiced and how current that practice is.

They do not answer:

> What can the player demonstrably do?

Strength Training is the first Skill with structured performance evidence strong enough to support a bounded Capability claim.

## Decision

1. **Skill Capability is an independent projection axis.**
   - Experience does not prove Capability.
   - Sharpness does not prove Capability.
   - Capability does not prove Mastery.
   - Capability does not prove Growth.

2. **The first provider is deliberately narrow.**
   - `physical.strength_training` may become Capability `EVIDENCED` from a current canonical structured exercise set containing:
     - stable exercise identity;
     - positive repetitions;
     - positive load;
     - governed LB/KG unit;
     - exact session/set lineage.

3. **No numerical capability score is introduced.**
   - v0.1 reports bounded evidence presence and breadth:
     - demonstration count;
     - demonstrated session count;
     - demonstrated exercise count;
     - first/last demonstrated occurrence;
     - bounded recent exact demonstrations.
   - It does not transform those observations into a Skill Level, rating, percentile, estimated strength class, or Mastery score.

4. **Capability uses all current canonical history, not the 90-day Character window.**
   - A demonstrated capability must not disappear merely because its evidence becomes older than a recent-analysis window.
   - Time alone may cool Sharpness but does not erase Capability evidence.

5. **Complete zero evidence means `INSUFFICIENT_EVIDENCE`, not zero ability.**
   - If the governed all-history read is complete and contains zero qualifying demonstrations, Wayfinder may say it lacks evidence for this capability.
   - It may not say the player has no capability.

6. **Positive direct evidence may establish bounded Capability while epistemic coverage remains UNKNOWN.**
   - One valid demonstration can prove that the demonstrated act occurred.
   - It cannot establish complete coverage of the person's human capability.

7. **Current canonical corrections remain authoritative.**
   - Capability remains reconstructable.
   - If underlying canonical Training evidence is corrected or retracted, the projection may change.
   - No permanent Capability award ledger is introduced.

8. **Practice-derived Skills remain UNKNOWN until they earn their own provider.**
   - Music Production Experience does not prove Music Production Capability.
   - Drawing Experience does not prove Drawing Capability.

## First provider

```text
current canonical Training session
 + current canonical exercise set
 + reps > 0
 + load > 0
 + unit LB | KG
        |
        v
Strength Training Capability
state = EVIDENCED
```

## Temporal separation

```text
Experience = accumulated governed practice
Sharpness  = time-sensitive practice recency
Capability = demonstrated ability evidence
Mastery    = future depth/reliability/transferability
Growth     = future/parallel longitudinal change claim
```

A Skill can therefore be:

```text
Experience  HIGH
Sharpness   DORMANT
Capability  EVIDENCED
Mastery     NOT_EVALUATED
```

without contradiction.

## Non-goals

v0.1 does not add:

- Skill Level;
- capability score;
- estimated one-repetition maximum;
- whole-body strength score;
- Mastery;
- Role/Class;
- causal training-adaptation claims;
- capability inference for Music Production or Drawing.
