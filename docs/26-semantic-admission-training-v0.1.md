# Semantic Admission + Training v0.1

**Status:** LIVE / CI PASSED / DATABASE LIVE TEST PASSED

This slice proves the first end-to-end version of the rule:

> **Wayfinder listens broadly, understands selectively, stores narrowly, and reasons recursively.**

It exists because natural input must not become a generic note or memory record simply because the player said it.

## Core flow

```text
PLAYER TEXT / VOICE
        ↓
   SourceEnvelope
        ↓
Semantic recognition
        ↓
  CandidateGraph
        ↓
Domain Admission Contract
        ↓
┌───────────────┬──────────────────────┬──────────────┐
│ ACCEPT        │ NEEDS_CLARIFICATION  │ REJECT/DROP  │
└───────┬───────┴──────────┬───────────┴──────────────┘
        │                  │
        ↓                  ↓
explicit authority   Information Need
        ↓                  ↓
 typed domain command   Navigator later
        ↓
 canonical reality
        ↓
 domain read recomputed
```

Raw input is not the canonical model.

## Runtime contracts

```text
supabase/functions/_shared/intelligence/semantic-admission.ts
```

Introduces:

```text
SourceEnvelope
SemanticCandidate
CandidateGraph
AdmissionContract
AdmissionDecision
AdmissionRegistry
runSemanticAdmission(...)
```

Admission dispositions:

```text
ACCEPT
ACCEPT_PARTIAL
NEEDS_CLARIFICATION
NEEDS_AUTHORIZATION
SESSION_ONLY
REFLECTION
REJECT
```

Important properties:

- candidates are in-memory/runtime artifacts in v0;
- a candidate must have exactly one canonical owner;
- multiple owners are an architecture error, not a tiebreaking problem;
- no matching owner does not create a miscellaneous persistence destination;
- acceptance and authorization are different checks;
- extraction confidence does not create authority.

## Training v0.1 canonical domain

Private schema:

```text
wf_training
├── sessions
├── session_versions
└── exercise_sets
```

Training owns factual strength-training occurrence and structured set observations.

It does not own:

```text
Strength stat
Might
Skill mastery
XP
Recovery
Body growth
```

Those remain downstream projections/analyses.

### Current factual scope

Session kind:

```text
STRENGTH
```

Occurrence precision:

```text
INSTANT
DAY
APPROXIMATE
```

Exercise-set fields:

```text
exercise reference key
resolved display label
reps optional
load optional, LB or KG
RPE optional
```

`DAY` occurrence uses the existing DST-aware Temporal Kernel:

```text
wf_system.local_day_bounds(local_date, zone_id)
```

### Public authenticated boundary

```text
wf_training_capture_strength_session(...)
wf_training_recent_v0(from,to,limit)
```

Private `wf_training` tables remain inaccessible directly to the authenticated browser role.

`wf_training_recent_v0` distinguishes:

```text
result_coverage
```

from:

```text
epistemic_coverage = UNKNOWN
```

because complete retrieval of stored records does not prove complete lived training coverage.

## Training semantic proving recognizer

```text
supabase/functions/_shared/intelligence/training-semantic.ts
```

v0 deliberately uses a bounded deterministic grammar rather than a general LLM. This isolates and proves Semantic Admission before a probabilistic recognition provider is allowed to propose broader candidates.

Current reference resolution supports:

```text
barbell_bench_press
aliases:
bench
bench press
barbell bench press
benched
```

This tiny reference set is not intended as the final exercise Knowledge system.

### Exact example

Input:

```text
I benched 185 lbs for 8 reps for 3 sets today
```

With explicit RECORD intent + write authorization:

```text
recognize
 -> TRAINING_STRENGTH_SESSION candidate
 -> resolve bench -> barbell_bench_press
 -> Training Admission
 -> ACCEPT
 -> training.capture_strength_session command
 -> 3 structured canonical sets
```

### Ambiguous example

Input:

```text
I benched 185 for 8 three times today
```

v0 deliberately does not assume `three times == three sets`.

```text
SET_STRUCTURE_AMBIGUOUS
 -> NEEDS_CLARIFICATION
 -> Information Need: training.exercise_set.structure
 -> no canonical command
```

### Valid partial reality

Input:

```text
I crushed legs today
```

Wayfinder may know that a lower-body strength session occurred without knowing exercises, reps or load.

```text
ACCEPT_PARTIAL
 -> generic lower-body strength session
 -> zero exercise sets
```

No squat/set/load details are invented.

### Authorization boundary

A clear statement in ordinary conversation is still not automatically a write:

```text
CONVERSATION
+ authorizesCanonicalWrite=false
 -> NEEDS_AUTHORIZATION
```

v0 requires:

```text
interactionIntent = RECORD
and
explicit write authorization
```

before executing the Training command.

Future standing domain-specific capture permissions may relax the interaction burden without giving the recognition model authority.

### No-owner example

Input:

```text
I saw a cool red Corvette across the street
```

Current bounded Training recognition produces no candidate.

```text
NO_DOMAIN_CLAIM
 -> dropped by this semantic path
 -> no misc note
 -> no player-state persistence
```

## Live Edge Function

JWT-protected:

```text
semantic-admission
version: 1
status: ACTIVE
verify_jwt: true
```

Request shape:

```text
text
sourceId? 
sourceType? PLAYER_TEXT | PLAYER_VOICE
interactionIntent? RECORD | CONVERSATION | ASK | REFLECT | UNKNOWN
authorizeWrite? boolean
zoneId?
occurredAt?
```

The function currently registers only the Training admission contract.

After an accepted Training write it immediately calls:

```text
wf_training_recent_v0
```

and returns the changed Training understanding. This proves local recomputation after persistence. Broader Position/Requirement/Information-Need invalidation is intentionally a later slice.

The response explicitly reports:

```text
raw_input_persisted_by_semantic_admission = false
```

## Validation

Automated test:

```text
lab/semantic-admission-training-v0.1.test.ts
```

Proves:

1. explicit 185 × 8 × 3 bench input becomes exactly three structured sets;
2. ambiguous “three times” requires clarification;
3. generic leg training is accepted only as partial reality and invents no exercise detail;
4. conversational disclosure does not silently write without authorization;
5. irrelevant input is not forced into a junk domain.

Wayfinder Intelligence CI passed with the semantic-admission Edge Function type-check and Training semantic tests.

### Live database rollback proof

A production-database transaction created a synthetic Training session through the authenticated public RPC, read it back through `wf_training_recent_v0`, verified three `185 LB × 8` Barbell Bench Press sets, then rolled the transaction back.

A follow-up query confirmed zero rows with the test provenance id remained.

Direct authenticated access to `wf_training.sessions` was also tested and denied.

## Performance hardening

The first advisor pass found four unindexed composite foreign keys in the new Training schema. They were covered by:

```text
20260916043500_index_wayfinder_training_foreign_keys.sql
```

A second advisor pass no longer reported `unindexed_foreign_keys` for Training.

New indexes can appear in `unused_index` INFO findings until real traffic exercises them.

## Current limitations

This slice is deliberately small:

- no general LLM semantic recognizer yet;
- no persistent candidate queue;
- no Training correction command yet;
- no broad exercise catalog/reference provider;
- no workout-duration/exercise-order/rest semantics beyond the minimum proving fields;
- no Training UI/dashboard;
- no standing authorization preferences;
- no Skill/XP/Might derivation;
- no weekly strength Requirement feed yet;
- no automatic Position recomposition after Training changes beyond the Edge Function's local Training reread;
- no multi-domain decomposition of one utterance yet.

These are future pressure points, not reasons to weaken the v0 boundaries.

## Next proving slice

Nutrition is the strongest independent second domain because it stresses different semantics while reusing the same admission spine:

```text
"I had three eggs and toast"
 -> meal/intake candidates
 -> food reference resolution
 -> exact vs estimated vs unknown quantities/nutrients
 -> Nutrition admission
 -> canonical intake
 -> protein aggregation + coverage
 -> temporal Requirement evaluation
```

If Training and Nutrition can both use Semantic Admission without changing the central contract, the architecture has strong evidence that it can scale to Finance, Inventory, World, Direction, Social and other real-life domains.
