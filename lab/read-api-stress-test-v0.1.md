# Slice 1A Read API Stress Test — v0.1

**Target:** initial authenticated Direction / Practice / Evidence reads  
**Result:** architecture holds; read semantics clarified before SQL

## Center

Can Wayfinder expose useful current state without leaking private canonical tables, converting storage completeness into claims about lived reality, or hiding stale evidence?

## 1. Direction graph currentness

`wf_direction_current` should not merely read every non-deleted row.

**Rule:** current graph includes only Direction nodes whose stable `current_version_id` resolves to an `ACTIVE` version. Active edges are included only when both endpoint logical nodes currently resolve to ACTIVE versions.

A withdrawn intention may still be ACTIVE canonical history with `intent_state = WITHDRAWN`; it remains representable and can be returned. `lifecycle_status` and `intent_state` are different axes.

## 2. Practice recent-range semantics

The query scope is a known half-open storage interval `[from,to)`.

Current PracticeSession records qualify when:

- point-like occurrence: `occurred_from >= from AND occurred_from < to`;
- bounded occurrence/uncertainty window: `occurred_from < to AND occurred_to > from`.

This is overlap semantics, not a claim that the actual lived event definitely occurred at every instant inside a coarse uncertainty window.

The API requires `to > from` and a bounded result limit.

## 3. Storage coverage is not lived-reality coverage

A complete SQL read can truthfully say the returned result covers all **current Wayfinder-stored PracticeSession records** matching the declared owner/time scope.

It cannot say “you did not practice.”

**Response rule:** return explicit storage coverage metadata whose wording identifies Wayfinder records as the phenomenon being covered.

Empty result language downstream should be “No practice sessions are logged in this Wayfinder scope,” not “No practice happened.”

## 4. Retracted Practice identity with retained historical sessions

A Practice Entity may later be retracted while historical PracticeSessions remain valid lived records.

**Rule:** `wf_practice_recent` does not hide a valid current session merely because its referenced Practice display Entity is currently RETRACTED. It returns current Practice metadata/lifecycle for context.

This preserves history without pretending the Practice itself is still active.

## 5. Evidence read must expose staleness

An EvidenceLink may remain ACTIVE after its exact source or target version becomes superseded. ACTIVE link lifecycle means “this link itself has not been retracted,” not “its source and target are still current.”

**Rule:** `wf_evidence_for_target` returns:

- link payload;
- `source_current`;
- `target_current`;
- `currently_usable` for the Slice 1A fulfillment projection (`link ACTIVE && source current && target current`).

Historical/stale evidence remains visible and explainable.

## 6. Historical exact target authorization

A caller may ask for Evidence against an older exact Direction Action version they own.

**Rule:** target authorization validates exact owner-scoped node/version existence, not only currentness. The response then separately reports whether that target version is current.

Another owner's exact historical version must resolve as NOT_FOUND/INVALID_REF, not leak existence.

## 7. Result bounds

Read RPCs can otherwise become accidental unbounded export endpoints.

**Rule:** Practice recent read uses a default limit and hard maximum. Direction current is naturally bounded by one owner's active graph but still returns a deliberately compact payload. Evidence-by-exact-target uses a hard maximum as well.

Pagination can be added when real usage requires it; do not invent generic pagination infrastructure yet.

## 8. Read authority and side effects

Read RPCs are `SECURITY DEFINER` because canonical tables remain private, but they:

- derive owner from `auth.uid()`;
- have fixed `search_path = pg_catalog`;
- accept no owner-id authority;
- create no CommandReceipt;
- create no ModuleChange;
- mutate no canonical state.

## 9. Determinism

Array aggregation must use deterministic ordering so UI/state snapshots do not churn from arbitrary SQL row order.

## 10. Minimum read set

The smallest useful set remains:

- `wf_direction_current()`
- `wf_practice_recent(from,to,limit)`
- `wf_evidence_for_target(target_action_id,target_version_id,limit)`

A composed Helm/Bearing read should depend on these semantics only after they survive live testing.

## Result

No new ontology primitive, table, cache, or service is required.

Authorized next:

1. implement these three typed authenticated read RPCs;
2. live-test owner isolation, storage coverage wording, temporal overlap, historical target lookup, and stale Evidence flags;
3. only then implement Action Fulfillment / Bearing / Helm composition.
