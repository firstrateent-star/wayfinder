# ADR-030 — RPG mechanics derive from canonical reality and discovery routes through owning modules

**Status:** ACCEPTED FOR NEXT BUILD PHASE

## Context

Wayfinder is evolving toward a Life RPG that may eventually represent stats, skills, XP, levels, roles, stamina, quests, inventory, gear, income, transportation, home/base, exploration, achievements, rewards, health, macros, workouts, social relationships, and symbolic astrology guidance.

A naive implementation would create one canonical table/module per visible mechanic or allow AI to write directly into a universal life store. That would duplicate truth, entangle domains, and make future interpretation changes expensive.

## Decision

1. **Player-facing RPG mechanics are derived by default.**
   - Stats, skill levels, mastery, Role/Class, XP, Level, stamina, buffs/debuffs, character path, reputation, gear score, and similar mechanics are projections unless a later evidence gate proves a durable canonical record is necessary.

2. **Canonical modules own factual reality, not UI concepts.**
   - Person, Direction, Evidence, Body, Training, Nutrition, Finance, Inventory, World, Social, and future modules are admitted only when they have distinct factual semantics and ownership requirements.

3. **Discovery is not authoritative truth.**
   - AI/source discovery produces structured candidates or hypotheses with provenance. Canonical factual writes occur only through the owning module's validated command boundary.

4. **Equipment modifies effective capability, not permanent base mastery.**
   - Effective state composes base character capability + equipment + context + temporary conditions. Ownership/equipment alone does not permanently increase learned skill.

5. **Navigator may ask information-need questions.**
   - Navigator asks only when missing information materially improves understanding, a decision, or future usefulness; it does not fill blanks for their own sake.

6. **Astrology remains a symbolic lens.**
   - Birth facts are canonical Person data; astronomical chart calculation is deterministic derivation; astrological meaning is symbolic interpretation and must not masquerade as empirical fact.

7. **No universal life table.**
   - Complexity expands horizontally through bounded modules and reconstructable projections inside the modular monolith.

## Consequences

- The backend can remain small while the player experience becomes rich.
- Changing XP rules, stat formulas, Role clustering, or AI models does not rewrite historical reality.
- Inventory/gear can meaningfully affect gameplay without corrupting skill history.
- New life areas can be added through the Stateful Module Protocol instead of editing a universal schema.
- Navigator can learn progressively without requiring a long onboarding questionnaire.
- Astrology can be deeply integrated into guidance while retaining epistemic separation.

## Non-goals

This ADR does not yet authorize physical schemas for Person, Body, Discovery, Inventory, Skills, Character, XP, Astrology, or Navigator. Those require vertical-slice designs and stress tests.

## Reference

See `docs/17-life-rpg-discovery-architecture-v0.1.md`.
