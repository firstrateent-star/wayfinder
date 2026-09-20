# ADR-048 — Practice Output is canonical completion evidence; creative Capability stays bounded

**Status:** ACCEPTED FOR PRACTICE OUTPUT + CREATIVE CAPABILITY v0.1

## Context

Wayfinder can already recognize Practice Experience and Sharpness for governed Practice concepts such as Music Production and Drawing.

That does not establish creative Capability.

Counting practice sessions would repeat the same mistake the architecture has deliberately avoided elsewhere:

```text
practice frequency != demonstrated ability
```

Creative domains also do not naturally produce a scalar equivalent to loaded repetitions. The first honest Capability question is narrower:

> Has the player completed a concrete output associated with governed Practice?

## Decision

1. **Practice owns concrete completed outputs.**
   - A Practice Output is canonical player reality.
   - Skills remain reconstructable projections over that reality.
   - No canonical Skill row or Skill Level is created.

2. **The first output kind is deliberately narrow.**

   ```text
   COMPLETED_ARTIFACT
   ```

   v0.1 stores:
   - logical Output identity;
   - exact source PracticeSession identity;
   - exact source version captured at recording time;
   - owning Practice identity;
   - title;
   - optional HTTP/HTTPS evidence URL;
   - version/lifecycle/provenance.

3. **Practice Output is versioned.**
   - Corrections create a new immutable Output version.
   - The logical Output id remains stable.
   - Stale writes are rejected.
   - Command retries are idempotent.

4. **A source-session correction does not automatically move creative Capability between Practices.**
   - The Output remains associated with the Practice recorded on its current Output version.
   - The capability read additionally checks the current logical source session.
   - If that session is reclassified to a different Practice, the Output stops contributing.
   - An explicit Output correction/rebase is required before it can contribute under the new Practice.

   This avoids both accidental evidence loss from harmless session corrections and silent semantic movement across Skill identities.

5. **The captured source-session version is provenance, not permanent validity.**
   - A timing/focus correction to the same logical session and Practice does not erase a completed output.
   - A retracted/non-active source session invalidates current contribution.
   - A Practice identity mismatch invalidates current contribution until explicitly rebased.

6. **Completed-output Capability is bounded completion evidence.**
   - A current canonical completed Output may establish that the player has demonstrated the ability to complete a work in that Practice.
   - It does not establish:
     - creative quality;
     - originality;
     - artistic merit;
     - commercial success;
     - professional readiness;
     - Mastery;
     - a numeric Skill Level.

7. **An external URL is optional.**
   - The player may have completed work that is private/offline.
   - A URL is an evidence pointer, not an independent quality score.
   - Only HTTP/HTTPS URLs are accepted in v0.1.

8. **Practice Experience cannot substitute for completed-output evidence.**
   - Ten or one hundred sessions do not automatically establish this Capability model.
   - Complete zero Output evidence may produce `INSUFFICIENT_EVIDENCE`, never “zero ability.”

9. **The semantic model is non-authoritative over Practice Output.**
   - A model may eventually propose that a statement describes a completed output.
   - Persistence still requires an explicit typed Practice Output command and player authorization.
   - v0.1 ships the explicit player capture surface first.

10. **No generic artifact database is introduced.**
    - This schema exists because Practice has a concrete domain-owned result.
    - Future domains should earn their own evidence semantics rather than dumping arbitrary files/facts into one universal table.

## Projection

The first creative Capability provider is:

```text
practice.completed-output-skill-capability-provider.v0.1
```

It maps current canonical Practice Outputs through the existing governed Practice-name → Skill association.

Current supported Skill concepts:

```text
Music Production -> creative.music_production
Drawing          -> creative.drawing
```

The provider model is:

```text
COMPLETED_PRACTICE_OUTPUT
```

with evidence basis:

```text
PLAYER_CONFIRMED_COMPLETED_OUTPUT
```

## Consequence

A creative Skill can now coherently be:

```text
Experience   OBSERVED
Sharpness    UNESTABLISHED
Capability   EVIDENCED
Mastery      NOT_EVALUATED
```

or:

```text
Experience   OBSERVED
Capability   INSUFFICIENT_EVIDENCE
```

without contradiction.

## Non-goals

v0.1 does not add:

- creative quality scoring;
- model-generated portfolio critique as canonical truth;
- automatic Capability from practice count;
- Skill Level;
- Mastery;
- Role/Class;
- awards for publishing;
- external-service ingestion;
- a universal artifact/file store.
