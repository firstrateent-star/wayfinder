# Admission Planner v0.1

**Status:** IMPLEMENTED / DETERMINISTIC GATE PASSED / NAVIGATOR INTEGRATED
**Date:** 2026-09-19

## Purpose

Wayfinder can now understand multi-claim input and selectively retrieve canonical context, but understanding alone must not become persistence.

Admission Planner v0.1 adds the governance seam between the Semantic Compiler and domain admission.

> **The model proposes meaning. Capacity declares what Wayfinder can own. The planner coordinates. The domain still decides.**

## Separation of authority

```text
MODEL
  understands semantic meaning
  does NOT choose canonical owner
  does NOT authorize a write
  does NOT produce commands
        |
        v
SEMANTIC COMPILER
  preserves Candidate Life Graph
        |
        v
CAPACITY REGISTRY
  deterministically declares concept -> owner -> claim type
        |
        v
ADMISSION PLANNER
  applies domain routing policy
  creates 0..N transient proposals
  preserves unsupported meaning
  checks authorization state
  executes NOTHING
        |
        v
DOMAIN ADMISSION
  validates domain semantics
  normalizes domain payload
        |
        v
AUTHORIZED DOMAIN COMMAND
        |
        v
CANONICAL REALITY
```

## Deterministic claim routing

The live semantic reasoner is intentionally told not to invent canonical claim types or owners. A correct semantic node may therefore contain `concept = STRENGTH_TRAINING` with no model-supplied `claimType`.

Capacity now exposes declared persistence routes. For current Training this is `STRENGTH_TRAINING -> training -> TRAINING_STRENGTH_SESSION`.

The semantic graph remains untouched. The compiler routing decision carries the deterministic owner and claim type. A conflicting model claim type fails closed as `UNDECLARED_CLAIM_TYPE` and remains session-only.

## Planner dispositions

```text
READY_FOR_DOMAIN_ADMISSION
NEEDS_AUTHORIZATION
NEEDS_CLARIFICATION
SESSION_ONLY
DROP
REJECT
```

Every proposal is transient and contains its source/candidate IDs, capacity-selected owner and claim type, semantic concept, subject, reality mode, source spans, context refs, authorization state, and planning-policy version.

## Training planning policy

Training v0.1 only considers a proposal eligible when the semantic node is a SELF EVENT with `realityMode = OCCURRED`.

Therefore negated workouts and third-party workout reports may still be understood, but they cannot become player Training admission proposals.

## Authorization is not acceptance

Ordinary conversation can produce `NEEDS_AUTHORIZATION`. Explicit RECORD authorization can advance that only to `READY_FOR_DOMAIN_ADMISSION`.

The Admission Planner still does not execute a command and does not claim the owning domain will accept the candidate.

## Mixed utterance behavior

For a statement such as `I worked out and spent about $40 on gas`, current Wayfinder can produce a governed Training proposal while the Expense claim remains understood but `SESSION_ONLY` because Finance persistence capacity is not live.

No unsupported claim is redirected into a miscellaneous facts table.

## Navigator v0.3

Navigator now returns an `admission_plan` in its response contract.

Primary persistence affordances are planner-backed. A secondary `Clarify & log workout` affordance may still enter the existing Training clarification flow for broad workout language that has not yet earned a persistence proposal.

## Invariants

```text
model meaning != canonical claim type
canonical claim type != domain acceptance
domain acceptance != authorization
authorization != command execution

planner executesCommands = false
planner persistsCandidates = false
planner modelChoosesOwner = false
```

## Gate

`lab/admission-planner-v0.1.test.ts` proves deterministic claim routing, conflicting-claim failure, authorization separation, no command creation, negation safety, third-party safety, blocking ambiguity, mixed-claim behavior, multiple-owner ambiguity, missing policy failure, and duplicate-policy failure.

## Next frontier — Admission Fulfillment v0

```text
AdmissionProposal
  -> owning-domain lowering adapter
  -> existing AdmissionContract
  -> NEEDS_CLARIFICATION / NEEDS_AUTHORIZATION / ACCEPT / ACCEPT_PARTIAL / REJECT
  -> explicit confirmation
  -> typed domain command
  -> canonical write
  -> recomputation
```

Training should be the first fulfillment adapter. Navigator should not make the player restate information Wayfinder already understood; the adapter must carry grounded semantic detail and provenance forward while failing closed on domain detail it cannot safely normalize.