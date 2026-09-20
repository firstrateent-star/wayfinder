# Wayfinder Practice Output + Creative Capability v0.1

**Status:** IMPLEMENTED ON BRANCH — MERGE / PRODUCTION GATES PENDING  
**State contract:** `wayfinder-state.v0.7`  
**Skills projection:** `skills_v0.4`  
**Capability provider:** `practice.completed-output-skill-capability-provider.v0.1`

## Purpose

Give Wayfinder its first honest creative Capability evidence without converting Practice frequency into ability.

The slice introduces one new canonical fact:

> A concrete output was completed from a governed PracticeSession.

That fact belongs to Practice. Skills interpret it.

## Canonical model

```text
wf_practice.outputs
  logical output identity
  current_version_id

wf_practice.output_versions
  practice_id
  source_session_id
  source_session_version_id
  output_kind
  title
  external_url?
  lifecycle/provenance
```

v0.1 output kind:

```text
COMPLETED_ARTIFACT
```

The output title is required. An HTTP/HTTPS evidence URL is optional.

## Commands

### Capture

```text
wf_practice_capture_output(
  command_id,
  source_session_id,
  source_session_version_id,
  title,
  output_kind = COMPLETED_ARTIFACT,
  external_url?
)
```

Capture requires the exact current ACTIVE PracticeSession version.

### Correct / rebase

```text
wf_practice_correct_output(
  command_id,
  output_id,
  expected_version_id,
  source_session_version_id,
  title,
  external_url?
)
```

Correction:

- rejects stale Output heads;
- preserves logical Output identity;
- creates a new immutable version;
- may rebase the output onto the current version of the same logical source session;
- derives the current Practice from that source session.

## Source-session correction law

The output read validates the current logical source session.

```text
same logical session
+ same Practice
+ timing/focus correction
    -> Output remains usable

same logical session
+ Practice changed
    -> Output stops contributing
    -> explicit Output rebase required
```

This prevents capability from silently moving between Skill concepts.

## Capability read

Authenticated RPC:

```text
wf_practice_output_skill_capability_input_v0(
  normalized_practice_names[],
  as_of,
  recent_limit
)
```

It returns:

- exact current completed-output count;
- distinct source-session count;
- first/last demonstrated occurrence;
- bounded recent exact Output lineage;
- `COMPLETE` stored-result coverage;
- `UNKNOWN` total-human-capability coverage;
- model `COMPLETED_PRACTICE_OUTPUT`;
- basis `PLAYER_CONFIRMED_COMPLETED_OUTPUT`.

The read requires:

```text
current ACTIVE Output version
COMPLETED_ARTIFACT
current ACTIVE source logical session
current source session Practice == Output Practice
active Practice
normalized Practice alias match
source session completed by as_of
```

## Skill projection

Creative Capability now shares the high-level state machine with Strength but keeps a different proof payload.

```text
Strength Training
  evidence class = LOADED_REPETITION_DEMONSTRATION
  model          = LOAD_REPS_PARETO_FRONTIER
  proof          = exercise-specific frontier

Music Production / Drawing
  evidence class = COMPLETED_PRACTICE_OUTPUT
  model          = COMPLETED_PRACTICE_OUTPUT
  basis          = PLAYER_CONFIRMED_COMPLETED_OUTPUT
  proof          = completed output lineage
```

### EVIDENCED

Requires:

```text
demonstration_count > 0
AND
model = COMPLETED_PRACTICE_OUTPUT
AND
basis = PLAYER_CONFIRMED_COMPLETED_OUTPUT
AND
at least one valid exact Output lineage item
```

### INSUFFICIENT_EVIDENCE

Requires:

```text
result coverage = COMPLETE
AND
demonstration_count = 0
```

This means Wayfinder has no qualifying recorded completed output for this model.

It does **not** mean zero creative ability.

### UNKNOWN

Positive aggregate evidence with malformed/missing proof, or unknown result coverage, fails closed to `UNKNOWN`.

## Player surface

The merged Character architecture is extended with an explicit capture control on governed Practice-derived Skills.

A player can select a recent exact PracticeSession and record:

- completed output title;
- optional evidence URL.

After command success the Character state is recomputed.

When creative Capability is evidenced, Character can show:

```text
Completed outputs
  Fool on Folly rough master
  Sep 19, 2026
  evidence link (optional)
```

The UI explicitly says this does not rate quality, originality, mastery, or commercial success.

## Rollback-backed production-schema proof

Before merge, the exact migration was installed in a transaction and exercised against production schema semantics.

The proof:

1. created synthetic Music Production and Drawing Practices;
2. created one Music Production session;
3. captured a completed output;
4. retried the exact command and verified no duplicate Output;
5. read Music Production Capability and verified one demonstration;
6. corrected the Output while preserving logical identity;
7. attempted a stale correction and verified `STALE_VERSION`;
8. reclassified the source logical session from Music Production to Drawing;
9. verified the Output contributed to neither Skill rather than silently moving;
10. explicitly rebased the same logical Output to the corrected session version;
11. verified Drawing gained the demonstration and Music Production stayed at zero;
12. rolled back the entire transaction;
13. confirmed schema/functions/synthetic data were absent afterward.

Result:

```text
PASS
```

## Projection pressure tests

```text
lab/practice-output-capability-v0.1.test.ts
```

Cases include:

- valid completed Output -> EVIDENCED;
- output proof keeps title/URL/Practice/session lineage;
- completed output proves completion, not quality/ranking;
- complete zero -> INSUFFICIENT_EVIDENCE, not zero ability;
- high Practice Experience cannot substitute for Output evidence;
- malformed output proof fails closed;
- private/offline completed output can omit URL;
- duplicate output lineage dedupes;
- unknown coverage stays UNKNOWN.

## Security / authority

- private Practice Output tables are not directly exposed;
- capture/correction/read RPCs are owner-scoped through `require_authenticated_owner()`;
- anon/public execution is denied;
- model inference cannot directly create an Output;
- ModuleChange uses the existing `practice` domain so Skills recomputation invalidates naturally.

## Deferred

This slice intentionally does not add:

- semantic auto-capture of outputs;
- creative quality evaluation;
- portfolio scoring;
- external content ingestion;
- Skill Level;
- Mastery;
- Role/Class;
- output-count XP;
- a universal artifact database.

## Next earned frontier

After production:

1. use the capture flow on a real Music Production or Drawing session;
2. verify the Character language feels truthful when Capability becomes EVIDENCED;
3. decide whether a future creative provider should add stronger evidence classes such as reviewed deliverables, publication, client acceptance, or repeatable objective constraints;
4. keep all stronger claims layered rather than replacing the bounded completion proof.
