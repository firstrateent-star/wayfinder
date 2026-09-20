# ADR-049 — Canonical Practice Outputs remain visible independently of Skill eligibility

**Status:** ACCEPTED FOR PRACTICE OUTPUT LIFECYCLE + JOURNEY v0.1

## Context

Practice Output v0.1 deliberately separates canonical creative results from Skill Capability.

That creates an important recovery case:

```text
Output recorded under Music Production
        |
source PracticeSession later corrected
        |
session now belongs to Drawing
```

The Output must not silently move from Music Production Capability to Drawing Capability. ADR-048 requires an explicit Output rebase.

However, if Skill projections are the only way to see Outputs, the exact record that needs repair disappears from both Skills at the moment it becomes semantically misaligned.

A canonical fact must not become unfindable merely because a projection stops admitting it.

## Decision

1. **Practice Output visibility is independent of Skill eligibility.**
   - Wayfinder exposes an owner-scoped canonical Output catalog read.
   - The read includes every current logical Output head within the result limit, including Outputs that currently contribute to no Skill.
   - Skill Capability continues to consume only eligible Output evidence.

2. **Source-version drift and semantic mismatch are different states.**
   - If the same logical source session receives a new version but remains under the same Practice, the Output remains Capability-eligible.
   - The catalog reports `SOURCE_VERSION_ADVANCED`.
   - This is provenance drift, not semantic invalidation.

3. **Practice mismatch fails closed.**
   - If the source session's current Practice differs from the Output's recorded Practice, the catalog reports `PRACTICE_MISMATCH`.
   - Capability eligibility becomes false.
   - The Output remains visible and recoverable.
   - Moving it to the source session's new Practice requires an explicit Output correction/rebase.

4. **Lifecycle visibility is descriptive, not destructive.**
   - The Output catalog distinguishes current, source-version-advanced, Practice-mismatched, source-inactive/unresolved, future-as-of, recorded-Practice-inactive, and retracted states.
   - An ineligible Output is not deleted and is not asserted never to have happened.

5. **Repair uses the existing typed correction command.**
   - The catalog supplies the current logical source-session version and current Practice.
   - The player may explicitly correct title/URL and/or rebase the Output.
   - Stale Output-head protection remains authoritative.

6. **Journey includes Output history without becoming an Event store.**
   - `PRACTICE_OUTPUT_RECORDED` is a derived Journey item.
   - `PRACTICE_OUTPUT_CORRECTED` is a separate correction item.
   - Output correction never creates another completed-work item.

7. **Practice Output uses record time in Journey v0.2.**
   - v0.1 Output does not store a defensible independent completion timestamp.
   - Journey therefore uses:
     ```text
     PRACTICE_OUTPUT_RECORDED  -> time_basis = RECORDED
     PRACTICE_OUTPUT_CORRECTED -> time_basis = RECORDED
     ```
   - The source PracticeSession's occurrence time remains present in lineage.
   - Wayfinder does not silently equate session occurrence with exact Output completion.

8. **Result and activity remain distinct Journey layers.**
   - PracticeSession is `REALITY / Did`.
   - PracticeOutput is `RESULT / Made`.
   - A correction is `CORRECTION / Updated`.

## Output alignment states

v0.1 catalog states:

```text
CURRENT
SOURCE_VERSION_ADVANCED
PRACTICE_MISMATCH
SOURCE_SESSION_UNRESOLVED
SOURCE_SESSION_NOT_ACTIVE
SOURCE_PRACTICE_NOT_ACTIVE
RECORDED_PRACTICE_NOT_ACTIVE
SOURCE_OCCURRENCE_AFTER_AS_OF
OUTPUT_RETRACTED
```

Only a subset are repairable through the current command surface.

## Consequences

The architecture can now represent:

```text
canonical Output exists
Skill Capability temporarily excludes it
player can still inspect the Output
player explicitly repairs/rebases it
Skill Capability recomputes
Journey preserves every record transition
```

without a second truth store.

## Non-goals

This decision does not add:

- automatic repair;
- semantic auto-rebase;
- deletion of historical Outputs;
- exact output-completion time;
- output quality scoring;
- Mastery;
- Skill Level;
- a universal event log.
