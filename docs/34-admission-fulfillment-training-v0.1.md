# Admission Fulfillment v0.1 — Training vertical

**Status:** IMPLEMENTED ON WORK BRANCH / GATED BEFORE MERGE  
**Date:** 2026-09-19

## Closed loop

```text
natural player language
 -> Semantic Episode
 -> bounded canonical context
 -> Capacity
 -> Admission Planner
 -> Training Fulfillment adapter
 -> existing Training AdmissionContract (non-authorizing)
 -> expiring server-side admission envelope
 -> explicit player confirmation by opaque proposal id
 -> existing Training AdmissionContract (authorizing)
 -> fixed idempotent Training command id
 -> wf_training_capture_strength_session
 -> module_change_outbox
 -> client projection refresh
```

The browser never returns a trusted domain payload. It receives only an opaque proposal id.

The staged envelope is noncanonical runtime state in `wf_system.admission_envelopes`, service-role-only, owner-scoped, and expires after 15 minutes by default. Raw conversation text is not stored in the envelope.

## Training lowering

Semantic exercise lists, skips, reps/load/set-count detail and temporal meaning are lowered into the existing Training semantic candidate. The existing Training AdmissionContract remains authoritative over normalization and acceptance.

Unknown exercise identity, missing occurrence time, ambiguous global numbers across multiple exercises, and missing load units fail closed into clarification.

## Exercise reference expansion

Training now has a shared deterministic reference catalog for common compound, lower-body, push, pull, and accessory movements. Both the proving recognizer and semantic Fulfillment adapter use the same reference resolver.

## Confirmation

Confirmation re-runs Training Admission with `interactionIntent=RECORD` and `authorizesCanonicalWrite=true`. The server-staged command id replaces any generated id before execution, making repeated confirmation idempotent through the existing command runtime.

## Downstream recomputation

Training already emits `training.session_captured` into `wf_system.module_change_outbox`. Navigator responses mark successful writes with `projection_refresh=true`; Helm already refreshes Initial Position after `confirmed=true`.

No derived projection is stored as a second source of truth.
