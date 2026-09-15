# Wayfinder Projection Reads v0

**Status:** CANDIDATE-STABLE — LIVE GATE PASSED  
**Scope:** Action Fulfillment v0, Bearing v0, Helm v0

These are on-demand derived reads over canonical Direction, Practice, and Evidence records. They are not canonical facts and are not persisted in Slice 1A.

## Action Fulfillment v0

RPC:

`wf_action_fulfillment_v0(action_id)`

Purpose: describe the current recorded evidence state bearing on fulfillment of the owner's current exact Action version.

States:

- `CURRENT_EVIDENCE_PRESENT`
- `STALE_RECORDED_EVIDENCE_ONLY`
- `NO_RECORDED_EVIDENCE`

The projection returns:

- current Action id/version/title/intent state;
- current qualifying evidence count;
- stale recorded evidence count;
- exact qualifying EvidenceLink + PracticeSession version lineage;
- epistemic coverage UNKNOWN for complete lived-reality fulfillment evidence;
- explicit non-claims so evidence is not presented as proof of action occurrence or outcome achievement.

## Bearing v0

RPC:

`wf_bearing_v0()`

Purpose: summarize recorded evidence of movement across current ACTIVE Action intentions without manufacturing a progress score.

States:

- `NO_ACTIVE_ACTIONS`
- `RECORDED_EVIDENCE_OF_MOVEMENT`
- `NO_RECORDED_EVIDENCE_OF_MOVEMENT`

Bearing returns:

- active Action count;
- evidenced active Action count;
- stale-evidence-only Action count;
- each active Action's evidence state and exact qualifying lineage;
- current ACTIVE Direction SUPPORTS targets.

An Action may have no graph ancestor/target and is still valid. Bearing does not penalize it.

Bearing intentionally does **not** return a percentage of life progress, goal completion, or personal worth.

## Helm v0

RPC:

`wf_helm_v0(from,to,session_limit)`

Purpose: provide the first composed “where am I?” read while keeping source semantics visible.

For the explicit half-open `[from,to)` scope, Helm composes:

- `wf_direction_current()`;
- `wf_bearing_v0()`;
- `wf_practice_recent(from,to,session_limit)`.

Helm preserves nested lineage and coverage rather than flattening them into one universal status.

## Read epistemics

Result completeness and epistemic coverage are different axes.

Example:

- there may be 50 matching stored PracticeSession rows and a limit of 10, making `result_coverage=PARTIAL`;
- the same response may have `epistemic_coverage=UNKNOWN` because stored records do not prove complete capture of lived practice.

An empty stored result therefore means “no matching Wayfinder records,” not automatically “the lived event did not happen.”

## Security boundary

These public RPCs are intentionally `SECURITY DEFINER` because canonical `wf_*` schemas remain inaccessible to ordinary authenticated clients.

Each RPC:

- derives owner identity from `auth.uid()`;
- uses hardened `search_path=pg_catalog`;
- fully qualifies private objects;
- scopes reads by owner;
- is denied to anon;
- has passed live cross-owner isolation tests.

Supabase's security advisor warns on authenticated SECURITY DEFINER RPCs by design. The warning is accepted for this architecture and remains a review checkpoint for every new public RPC.

## Persistence rule

Do not create tables for Fulfillment, Bearing, or Helm merely because these projections exist.

Persist a projection only if future evidence shows a real need for caching, asynchronous derivation, durable snapshotting, or use as version-addressable lineage. Until then they remain deterministic/reconstructable reads.

## Executable evidence

- `lab/read-api-live-test-v0.1.md`
- `lab/read-api-live-test-v0.2-confirmation.md`
- `lab/projection-read-stress-test-v0.1.md`
- `lab/projection-read-stress-test-v0.2.md`
- `lab/projection-read-live-test-v0.1.md`

The current gate is passed for Slice 1A.
