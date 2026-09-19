# Requirements + Character recomputation v0.1

**Status:** IMPLEMENTED ON WORK BRANCH / PRODUCTION STANDARD MIGRATION APPLIED / GATED BEFORE MERGE  
**Date:** 2026-09-19

## Purpose

Close the next part of the Wayfinder living loop:

```text
canonical reality
 -> ModuleChange
 -> domain-owned Standards + observations
 -> Requirement evaluation
 -> evidence-backed Character signals
 -> Bearing / Guidance
 -> Helm
```

Requirements and Character remain projections. Neither becomes a second source of truth.

## Domain-owned Standards

Wayfinder does not own one global Requirement table and does not install default targets.

Training owns:

```text
strength_sessions_weekly
metric = strength_session_count
rule = AT_LEAST
recurrence = LOCAL_WEEK
```

Nutrition owns:

```text
protein_daily
metric = protein_g
rule = AT_LEAST
recurrence = LOCAL_DAY
```

A Standard exists only after a player-authored canonical command.

Typed commands:

```text
wf_training_set_strength_standard_v0
wf_nutrition_set_protein_standard_v0
```

Both use immutable version history, command idempotency, NOOP for an identical current value, and ModuleChange only for a material change.

## Requirement Inputs

Each owning domain supplies a bounded Requirement input:

```text
Standard ref
+ RequirementSpec
+ RequirementObservation
+ canonical lineage
+ epistemic caveats
```

RPCs:

```text
wf_training_strength_requirement_input_v0
wf_nutrition_protein_requirement_input_v0
```

Training observes recorded strength-session count in the current local week.

Nutrition sums only explicitly recorded protein grams in the current local day.

Both currently report lived-reality coverage as `UNKNOWN`. Missing observations never become zero.

## Requirement Projection

The shared evaluator keeps the existing coverage-aware laws:

```text
recorded 110 / target 150, open day -> IN_PROGRESS
recorded 155 / target 150          -> SATISFIED
missing explicit protein           -> UNKNOWN, not 0
closed incomplete scope            -> UNKNOWN
```

Guidance is a relevance candidate, not a dashboard fact. It uses wording such as **recorded gap** and explicitly states when lived coverage is incomplete.

No Standard means:

```text
no Requirement evaluation
no invented target
no deficit guidance
```

## Character v0.1

Character remains reconstructable and qualitative.

Evidence classes:

```text
EXPOSURE
  player practiced something associated with a facet

CAPABILITY
  player demonstrated a bounded comparable capability

GROWTH
  capability changed under a versioned longitudinal rule
```

Current provider:

```text
Training strength sessions
 -> Might EXPOSURE

structured loaded repetitions
 -> Might CAPABILITY

Might GROWTH
 -> INSUFFICIENT_EVIDENCE
```

The remaining facets are `UNOBSERVED`, never zero.

Character v0.1 does not assert:

- numeric attributes;
- XP;
- permanent growth from activity alone;
- weakness from missing evidence;
- Character penalties from Requirement state;
- Character growth from Requirement satisfaction.

## Projection Provider Registry

Projection dependencies are explicit rather than encoded in a growing central switch:

```text
training.strength-requirement-provider
  training -> REQUIREMENTS

nutrition.protein-requirement-provider
  nutrition -> REQUIREMENTS

training.might-character-provider
  training -> CHARACTER
```

Consequently Nutrition invalidates Requirements but not permanent Character v0.1. Training invalidates both.

Unknown modules still conservatively invalidate all projections.

## Governed Standard conversation path

New semantic classes:

```text
STRENGTH_SESSION_STANDARD
PROTEIN_STANDARD
```

They use the existing nervous system:

```text
natural language
 -> Semantic Episode
 -> deterministic Capacity owner/claim
 -> Admission Planner
 -> owning Standard Fulfillment
 -> expiring server-staged proposal
 -> explicit confirmation
 -> owning AdmissionContract
 -> typed Standard command
 -> ModuleChange
 -> Requirement recomputation
```

Important boundaries:

```text
"I lifted three times last week"
 != weekly Training Standard

"I ate 150g protein today"
 != daily Protein Standard

"How much protein should I eat?"
 != player-authored Standard

"I want at least 3 strength sessions per week"
 = candidate Training Standard

"My daily protein target is 150g"
 = candidate Nutrition Standard
```

## Live database proof

A rollback-backed production test proved:

- Training Standard target 3 created one version and one ModuleChange.
- Same command id replayed idempotently.
- Same target with a new command returned NOOP and emitted no new Standard change.
- Nutrition Standard target 150 created one version and one ModuleChange.
- One synthetic strength session produced observation value 1 with UNKNOWN coverage.
- One synthetic 60g protein intake produced observation value 60 with UNKNOWN coverage.
- Both Requirement Inputs preserved exact canonical lineage.
- Transaction rollback left no synthetic Standard or evidence.
- A separate target-change pressure test proved Training 3→4 and Nutrition 150→160 produce an immutable version 1 SUPERSEDED → version 2 ACTIVE chain without violating the one-active-version invariant.
- The supersession ordering fix is recorded in `20260919235500_harden_domain_standard_supersession_v0_1.sql` and applied in production.
- Cross-owner Requirement reads return no Standard/spec/observation for another authenticated owner.

The migration itself creates no player Standard defaults.

## Next frontier

Character growth requires a stronger proving slice:

```text
comparable capability observations
 -> exercise / skill-specific comparison policy
 -> versioned growth rule
 -> GROWTH signal
 -> only then consider durable RPG progression / XP
```

Other Character facets should be added only when an owning evidence provider exists.
