# ADR-044 — Voyage experience and Character growth are separate progression axes

**Status:** ACCEPTED FOR VOYAGE PROGRESSION v0.1

## Context

Wayfinder's earlier Life RPG design correctly wanted experience, levels, skills, attributes, quests, momentum, and achievements to emerge from lived reality. Before the Character evidence architecture existed, however, XP and growth could be read as the same thing.

The current architecture can now distinguish:

- a meaningful encounter happened;
- the encounter exposed a facet or skill;
- capability was demonstrated;
- comparable longitudinal evidence established growth.

Collapsing these into one score would either make the game unrewarding or make Character claims too easy to manufacture.

## Decision

1. **Voyage XP recognizes governed participation, not permanent capability.**
   - A qualifying canonical encounter may contribute Voyage XP even when no Character growth is established.
   - XP is a game interpretation over canonical reality.

2. **Character growth remains independently evidence-governed.**
   - Exposure, capability, and growth continue through Character providers.
   - Voyage XP never mutates Might, Craft, Vigor, Fortune, Insight, Bond, Flow, or Lore.

3. **Encounter identity is logical-record stable.**
   - For Training v0.1 the encounter key is the logical session identity: `training:session:<session_id>`.
   - Correcting the current version changes lineage but does not create a second encounter.
   - Command retry idempotency therefore cannot mint duplicate XP from the same logical session.

4. **Voyage Progression remains reconstructable in v0.1.**
   - There is no permanent XP-award ledger.
   - The exact all-time count is derived from current canonical qualifying encounters.
   - If canonical reality is corrected or retracted, the projection may change accordingly.
   - Durable recognition / adjustment-event semantics are deferred until real correction-history pressure requires them.

5. **The first provider is deliberately narrow.**
   - One completed current canonical `STRENGTH` Training session through the projection's `as_of` time = one Voyage XP.
   - Sets, reps, load detail, Requirement satisfaction, Nutrition logging, Schedule allocation, and Direction authorship do not multiply or award XP in v0.1.

6. **Stored-record completeness is not lived-reality completeness.**
   - The canonical Training aggregate can be complete for recorded eligible sessions while epistemic coverage of all meaningful lived experience remains unknown.

## Why one XP per encounter in v0.1

The purpose of v0.1 is to prove identity, replay safety, correction behavior, lineage, provider boundaries, and Character separation.

Encounter scale, challenge, stretch, difficulty, novelty, quest bonuses, Pillar XP, Skill Experience, Level thresholds, and Rank are deliberately deferred. Adding multipliers before the encounter primitive is trustworthy would make the scoring system look richer while making its semantics weaker.

## Consequences

Wayfinder can now reward practice frequently without pretending every practice session proves growth.

A single workout may therefore produce independent downstream consequences:

```text
canonical Training session
        |
        +--> Requirement evidence
        |
        +--> Character exposure/capability/growth evaluation
        |
        +--> Voyage encounter -> Voyage XP
```

Those consequences are related by the same source reality but are not interchangeable.

This also preserves the older Life RPG principle:

> Logging earns nothing. Practice earns experience. Reality decides results.

## Future pressure tests

Before a permanent XP ledger is admitted, prove whether Wayfinder needs to preserve historical recognition when:

- a canonical encounter is corrected out of eligibility;
- progression rules change;
- new historical providers are added retroactively;
- two canonical records are discovered to describe the same lived encounter;
- an achievement/title was unlocked under an older rule version.

If those cases require durable game-history semantics, add explicit recognition/adjustment records rather than silently turning the derived projection into canonical life truth.
