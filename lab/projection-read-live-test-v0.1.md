# Projection Read Runtime — Live Database Test v0.1

**Result:** PASS AFTER RECURSIVE HARDENING — PROJECTION READ GATE PASSED

The first live projection test passed Action Fulfillment, Bearing, Helm composition, stale evidence, and owner isolation. A second Flower pass then found two explainability/current-intention refinements, which were deployed and retested.

## Action Fulfillment v0

Live states verified:

- `NO_RECORDED_EVIDENCE`
- `CURRENT_EVIDENCE_PRESENT`
- `STALE_RECORDED_EVIDENCE_ONLY`

The projection exposes exact qualifying EvidenceLink and PracticeSession version lineage when evidence is current.

Correcting the source PracticeSession removes it from current qualifying lineage without deleting historical Evidence.

## Bearing v0

Live states verified:

- `NO_ACTIVE_ACTIONS`
- `NO_RECORDED_EVIDENCE_OF_MOVEMENT`
- `RECORDED_EVIDENCE_OF_MOVEMENT`

The second pass verified that:

- exact qualifying lineage is exposed per evidenced Action;
- paused Direction targets are excluded from `supports_targets` even though the raw Direction graph can still preserve their structural edge;
- stale-only evidence does not count as current recorded movement;
- no progress percentage is manufactured.

## Helm v0

Helm successfully composes, in one authenticated read:

- current Direction graph;
- Bearing v0;
- scoped recent PracticeSessions;
- nested result/epistemic coverage and lineage.

It does not persist new truth or flatten coverage into one certainty flag.

## Owner isolation

A second owner received:

- `NO_ACTIVE_ACTIONS` from Bearing;
- empty Direction/Practice state in Helm;
- `ACTION_NOT_FOUND` when attempting Action Fulfillment using another owner's Action id.

An additional transaction executed Helm through the actual `authenticated` database role and succeeded through the intended RPC boundary.

## Security advisor note

Supabase's security advisor flags the public authenticated Wayfinder RPCs because they are intentionally `SECURITY DEFINER` functions. This is expected for the chosen private-schema architecture: authenticated clients have no direct access to canonical `wf_*` tables, while RPCs derive owner scope from `auth.uid()`, use fixed `search_path=pg_catalog`, fully qualify private objects, and have passed cross-owner tests.

The warning is therefore an intentional privileged-boundary warning, not evidence of an accidental grant. It should remain under review as the API grows.

## Gate

**PROJECTION READ GATE: PASSED**

No persistent Fulfillment, Bearing, or Helm tables are justified for Slice 1A.
