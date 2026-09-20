# Wayfinder Practice Output Lifecycle + Journey v0.1

**Status:** IMPLEMENTED ON BRANCH — MERGE / PRODUCTION GATES PENDING  
**Canonical read:** `wf_practice_outputs_v0`  
**Journey read:** `wf_journey_v1`  
**Journey rule:** `journey_v0.2`

## Purpose

Close the recovery seam introduced by Practice Output + creative Capability.

An Output may remain canonical while temporarily becoming ineligible for a Skill projection. Wayfinder must still let the player find it, understand why it is ineligible, and repair it explicitly.

## Canonical Output catalog

Authenticated read:

```text
wf_practice_outputs_v0(as_of, limit)
```

Each current logical Output exposes:

- logical id + current version;
- title / optional URL / lifecycle;
- recorded Practice;
- logical source session;
- captured source-session version;
- current source-session version;
- current source Practice + occurrence/focus;
- alignment state;
- whether the captured source version remains current;
- current Capability eligibility;
- whether the Output needs attention;
- whether correction/rebase is currently possible.

The read is not a Skill projection. It remains useful even when no Skill currently admits the Output.

## Alignment semantics

### CURRENT

```text
Output ACTIVE
source session ACTIVE
recorded Practice ACTIVE
current source Practice == recorded Output Practice
source occurrence <= as_of
captured source version == current source version
```

Capability may use the Output.

### SOURCE_VERSION_ADVANCED

The logical source session has a newer current version but remains under the same Practice.

```text
provenance version changed
semantic owner did not
```

Capability remains eligible.

### PRACTICE_MISMATCH

The logical source session now belongs to another Practice.

```text
Output Practice != current source-session Practice
```

Capability becomes ineligible. The catalog remains visible and marks the Output for review.

No automatic move occurs.

### Other ineligible states

The catalog also preserves explicit states for:

- unresolved source session;
- non-active source session;
- non-active source Practice;
- non-active recorded Practice;
- occurrence after the chosen as-of horizon;
- retracted Output.

None means the Output never existed.

## Repair surface

Character now loads the canonical Output catalog independently of Skills.

For each Output it can show:

```text
Current
Current · session updated
Needs review
Not currently usable
Retracted
```

When a Practice mismatch is safely repairable, the player sees an explicit action such as:

```text
Save & move to Drawing
```

That action calls the existing `wf_practice_correct_output` command with:

- current Output head;
- current logical source-session version;
- retained/edited title;
- retained/edited evidence URL.

This is an explicit semantic rebase, not an inference.

## Journey v0.2

New read:

```text
wf_journey_v1(from,to,limit)
```

It composes the existing Journey v0.1 projection with Practice Output history.

New item kinds:

```text
PRACTICE_OUTPUT_RECORDED
PRACTICE_OUTPUT_CORRECTED
```

### Output recorded

```text
layer       RESULT
surface     Made
time_basis  RECORDED
timeline    output version 1 recorded_at
```

The source session's occurred time remains in lineage.

Wayfinder does not assert that the Output was completed at exactly the session start/end because v0.1 does not record an independent completion instant.

### Output corrected

```text
layer       CORRECTION
surface     Updated
time_basis  RECORDED
timeline    newer Output version recorded_at
```

The correction includes:

- previous + new exact Output refs;
- changed fields;
- title/URL before and after;
- Practice before and after;
- source-session version before and after.

A correction is not a second completed Output.

## Composition strategy

`wf_journey_v1` reuses `wf_journey_v0` as the legacy substrate and adds Output items.

The legacy call asks for its maximum 200 items. Since the new public limit is also capped at 200, every legacy item that could enter the final top-N is present in the composition set.

The final matching count is:

```text
legacy matching count
+
Output creation count
+
Output correction count
```

Journey remains reconstructable and does not persist timeline rows.

## Rollback-backed production-schema proof

The exact migration was installed inside a production-schema transaction.

The proof established:

1. newly captured Output -> `CURRENT`, eligible;
2. same-Practice source-session correction -> `SOURCE_VERSION_ADVANCED`, still eligible;
3. explicit Output correction -> lineage refreshed to `CURRENT`;
4. source-session Practice reclassification -> `PRACTICE_MISMATCH`, ineligible, Needs review, can rebase;
5. Journey emitted exactly one `PRACTICE_OUTPUT_RECORDED`;
6. that item used `layer=RESULT` and `time_basis=RECORDED`;
7. source-session occurrence remained present in payload lineage;
8. first Output correction emitted exactly one `PRACTICE_OUTPUT_CORRECTED`;
9. explicit Output rebase restored `CURRENT` under Drawing;
10. Journey then contained two Output correction records, not duplicate completed works;
11. migration functions and all synthetic records rolled back cleanly.

Result:

```text
PASS
```

## Security

Both new reads:

- derive owner from `auth.uid()`;
- use `SECURITY DEFINER` with fixed search path;
- are granted only to `authenticated`;
- do not expose private tables directly.

## Deferred

No:

- automatic stale-output repair;
- automatic cross-Skill movement;
- deletion UI;
- new retraction command;
- output quality scoring;
- independent output completion timestamp;
- persisted Journey event table;
- Mastery or Skill Level.

## Next earned frontier

After production, the immediate value test is to use the actual Character Output flow once Vercel can promote:

1. record a real creative Output;
2. see bounded Capability become evidenced;
3. inspect it independently in Output management;
4. observe it in Journey;
5. correct/rebase it and verify the historical transition remains legible.

Only after that should Wayfinder decide whether stronger creative evidence classes are worth adding.
