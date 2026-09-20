# ADR-045 — Skill Experience, Sharpness, Capability, and Mastery are separate axes

**Status:** ACCEPTED FOR SKILLS v0.1

## Context

Wayfinder now has governed Voyage Experience and evidence-backed Character growth, but the older Life RPG design also needs to represent learned/practiced skills.

A naive Skill XP system would collapse several different claims:

- how often the player practiced;
- how recently the player practiced;
- what the player can actually do;
- how deep and reliable that capability is.

Those claims have different evidence requirements and different temporal behavior.

## Decision

1. **Skill Experience recognizes governed practice exposure.**
   - One qualifying governed encounter may contribute at most once to a particular stable Skill identity.
   - The v0.1 identity is:
     `skill_experience_key = encounter_key + skill_key`.

2. **Experience does not decay.**
   - Experience is reconstructed from qualifying canonical encounter history.
   - Time passing alone never removes Experience.

3. **Sharpness is a temporal projection, not stored decay state.**
   - Sharpness is recomputed from the current time and governed encounter cadence.
   - No cron job subtracts points.

4. **Personal cadence must be earned before cadence-aware Sharpness is asserted.**
   - v0.1 requires at least four encounters and at least three positive temporal intervals.
   - The personal cadence baseline is the median positive interval between current qualifying canonical encounters.
   - Before that threshold, Wayfinder exposes recency but reports Sharpness as `UNESTABLISHED`.

5. **Cadence-aware qualitative states use a versioned deterministic rule.**
   - `SHARP`: current gap <= 1.25x typical interval
   - `WARM`: <= 2x
   - `COOL`: <= 4x
   - `DORMANT`: > 4x

   These thresholds are game/projection semantics, not biological truth.

6. **Experience and Sharpness do not prove Capability.**
   - Capability requires its own governed evidence provider.
   - Sharpness decline does not imply learned capability disappeared.

7. **Encounter count does not establish Mastery.**
   - Mastery remains unevaluated until a future rule can represent depth, reliability, breadth, transfer, and sustained performance.

8. **Skill concepts are not canonical Person facts.**
   - A Skill identity is a game/knowledge concept used to organize evidence.
   - v0.1 does not create a universal persisted Skill taxonomy.

9. **AI may propose future skill associations but may not mint Skill Experience directly.**
   - Semantic discovery may propose that an encounter practiced a Skill.
   - A governed provider/resolver must accept the association before it contributes to progression.

## First provider

The first deterministic Skill provider is deliberately narrow:

```text
current canonical Training STRENGTH session
 -> physical.strength_training
 -> one Skill Experience encounter
```

This reuses the same logical session identity that already underpins Voyage Progression.

## Consequences

A single workout may now have independent consequences:

```text
Training session
  -> Requirement evidence
  -> Character Might evidence
  -> Voyage XP
  -> Strength Training Skill Experience
  -> Strength Training Sharpness
```

None of those consequences owns or automatically mutates another.

## Non-goals

v0.1 does not add:

- Skill Level;
- Skill XP point weights;
- Challenge/difficulty multipliers;
- persisted Sharpness;
- a universal Skill table;
- semantic cross-domain skill discovery;
- Mastery scoring;
- capability scoring;
- Role/Class derivation.

Those require later evidence gates.
