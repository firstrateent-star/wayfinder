# ADR-028 — Practice same-name reuse is exact, scoped, and non-destructive

**Status:** ACCEPTED  
**Date:** 2026-09-15

## Context

The pre-atomic Practice capture UI created multiple active Practice rows before later Session writes failed. Real use therefore produced several records named variants of `Music Production` / `Music production`.

Wayfinder needs to prevent future accidental exact-name duplication without claiming that similarly worded real practices are necessarily the same thing.

A fuzzy or AI-driven merge would cross an authority boundary: semantic similarity is not sufficient evidence that two user concepts share identity.

## Decision

For future Practice resolution/creation only, active Practice records are considered equivalent for exact-name reuse when all of the following are true:

```text
same owner
AND lifecycle_status = ACTIVE
AND lower(trim(existing.name)) = lower(trim(requested.name))
```

This is a lexical capture rule, not a universal ontology identity rule.

`Run`, `Running`, `Cardio`, and `Marathon training` are not merged automatically even if a model considers them semantically related.

Existing duplicate Practice records are preserved. The system chooses one deterministic `capture_preferred` record for future exact-name capture but does not silently delete, rename, retract, or rewrite the others.

## Deterministic preference

Within an exact normalized-name duplicate group, capture preference is:

1. a Practice referenced by at least one current ACTIVE PracticeSession version;
2. then earlier `created_at`;
3. then id as deterministic tie-breaker.

This preference is operational. It does not claim the other records were metaphysically invalid or never existed.

## Concurrency

Resolve-or-create for an owner + normalized exact name is serialized with a transaction-scoped advisory lock so concurrent requests do not independently conclude that no matching Practice exists.

## Read behavior

`wf_practice_catalog_v0()` returns all active stored Practice records and exposes:

- `same_name_active_count`
- `capture_preferred`
- active-session count

The client may present one preferred record in a normal capture selector while still acknowledging the preserved duplicate group.

## Consequences

### Positive

- Future case/whitespace duplicate creation is prevented.
- Existing test history remains truthful.
- The system does not grant AI or string similarity authority to merge user concepts.
- Concurrency behavior is deterministic.

### Costs

- Historical duplicates remain until an explicit lifecycle/merge operation is designed.
- Users may eventually need a deliberate “these are the same Practice” workflow.
- Exact lexical normalization intentionally misses semantically equivalent names.

## Rejected alternatives

### Unique index on `lower(trim(name))`

Not adopted at this stage because historical duplicates already exist and because the equivalence rule is currently a capture-resolution policy rather than a declaration that Practice name is globally unique canonical identity forever.

### Fuzzy/AI semantic deduplication

Rejected because semantic similarity is interpretation, not sufficient authority to merge canonical identity.

### Silent cleanup of the live-test duplicates

Rejected because it would rewrite evidence of what the system actually recorded during the failed workflow.

## Evidence

See:

- `lab/live-slice-flower-v0.1.md`
- `supabase/migrations/20260915074000_harden_live_capture_workflows.sql`
- `wf_practice_catalog_v0()`
