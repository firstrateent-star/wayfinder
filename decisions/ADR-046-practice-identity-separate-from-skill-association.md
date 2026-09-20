# ADR-046 — Canonical Practice identity and Skill association are separate

**Status:** ACCEPTED FOR SKILL ASSOCIATION / PRACTICE v0.1

## Context

Wayfinder already preserves player-created Practice identities exactly and deliberately refuses fuzzy/AI merges. Real production history contains multiple active Practice rows whose names normalize to `music production`.

The Skill system needs a different question:

> Which governed Skill concept did this canonical encounter exercise?

Treating Practice identity and Skill identity as the same thing would either fragment Skill Experience across duplicate/synonymous Practice labels or grant semantic similarity authority to rewrite canonical player reality.

## Decision

1. **Practice identity remains canonical and player-owned.**
   - Skill projection never merges, deletes, renames, or rewrites Practice records.
   - Existing Practice correction/version semantics remain unchanged.

2. **Skill association is a reconstructable game/knowledge interpretation.**
   - Multiple canonical Practice identities may associate to one stable Skill concept.
   - Lineage preserves the exact PracticeSession and Practice record behind each Experience contribution.

3. **v0.1 accepts only governed normalized Practice-name aliases.**
   - Normalization is lower-case + trim + collapsed whitespace.
   - `Music Production` / `Music production` -> `creative.music_production`.
   - `Drawing` -> `creative.drawing`.
   - Unregistered names remain unresolved.

4. **Alias collisions fail closed.**
   - One normalized Practice alias cannot silently map to two Skill concepts.

5. **Semantic model proposals are non-authoritative.**
   - The model may propose that an encounter relates to a known or novel Skill.
   - A semantic proposal contributes zero Skill Experience until a governed association rule accepts it.

6. **Skill Experience identity remains encounter + stable Skill.**
   - `skill_experience_key = encounter_key + skill_key`.
   - Correcting a PracticeSession version does not mint another Experience contribution.
   - Distinct real PracticeSessions remain distinct Experience encounters even when their Practice records differ.

7. **Practice-derived Skills do not automatically award Voyage XP or Character growth.**
   - Practice -> Skills in this slice.
   - Generic Practice remains separate from Voyage Progression and Character unless a future governed provider explicitly establishes those consequences.

8. **Natural-language Practice capture reuses canonical Practice commands.**
   - Navigator may recognize only the initially governed creative concepts: Music Production and Drawing.
   - Only SELF + OCCURRED events may reach Practice admission.
   - The semantic layer stages a proposal; explicit confirmation is required.
   - The existing idempotent `wf_practice_capture_session` remains the canonical write path.

9. **Temporal uncertainty fails closed.**
   - v0.1 semantic Practice fulfillment requires an explicit exact or approximate start/end interval.
   - If timing is only “today,” a daypart, or otherwise insufficient, Navigator asks instead of inventing occurrence time.

## Consequences

The complete loop becomes:

```text
player language
 -> semantic recognition
 -> transient Practice proposal
 -> explicit confirmation
 -> canonical PracticeSession
 -> ModuleChange(practice)
 -> Skills invalidation
 -> governed Practice alias
 -> Skill Experience + Sharpness
```

The model never awards Skill Experience directly.

## Non-goals

v0.1 does not add:

- fuzzy Practice merges;
- universal Skill taxonomy;
- arbitrary model-created Skills;
- Skill Level;
- Skill Capability/Mastery inference;
- Voyage XP from generic Practice;
- permanent Skill/association tables;
- autonomous canonical writes.
