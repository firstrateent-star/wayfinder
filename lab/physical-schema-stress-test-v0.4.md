# Physical Schema Stress Test — v0.4

**Target:** `docs/10-physical-schema.md` v0.4  
**Result:** architecture holds; no new table/module/ontology primitive required; four small physical clarifications remain

## Flower center

Can the current ten-table Slice 1A schema be created in Supabase without semantic ambiguity, silent corruption paths, or premature infrastructure?

## 1. Empty half-open range

Current constraint permits `occurred_to = occurred_from`.

Under `[start, end)` semantics that is an empty interval, not a meaningful bounded occurrence window.

**Change:** when `occurred_to` is present require `occurred_to > occurred_from`. Point-like occurrence uses `occurred_to = NULL` with instant precision.

No ontology/contract change is required.

## 2. Internal command claim state

`command_receipts.status` is NOT NULL but the transaction shape claims a command before it terminalizes.

**Change:** physical status check may include internal `PROCESSING` in addition to public terminal states `APPLIED | REJECTED | NOOP`. Because claim and terminalization occur in one database transaction, an aborted transaction does not leave a durable stuck PROCESSING row.

Public `CommandReceipt` remains terminal-only; this is physical transaction machinery.

## 3. Practice lifecycle mutation

Practice is intentionally unversioned display metadata, but its lifecycle still needs monotonic behavior.

**Change:** enforce `ACTIVE → RETRACTED` only for Practice lifecycle. A retracted Practice does not silently reactivate. If future product semantics require restoration, that gets an explicit command/architecture decision rather than a maintenance UPDATE.

## 4. Owner bootstrap concurrency

Two first-login requests may call ensure-owner concurrently.

**Change:** bootstrap is implemented as an idempotent insert/upsert keyed by unique `auth_user_id`, then returns the one owner row. It does not use the ordinary command receipt contract because the owner needed by that contract does not yet exist.

This is a bootstrap exception, not a second mutation architecture.

## 5. Outbox command reference

If `module_change_outbox.command_id` is populated, it should correspond to a real command receipt.

**Change:** add nullable FK to `wf_system.command_receipts(command_id)` where practical. The field remains nullable for future trusted/system-internal canonical changes that may not originate from an external Command.

This is integrity tightening only.

## 6. Same-record current/supersession triggers

Re-tested correction ordering:

1. insert v2 ACTIVE;
2. mark v1 SUPERSEDED pointing to v2;
3. advance stable head/current pointer to v2;
4. deferred invariant checks at transaction end.

**Pass.** Deferrable checking avoids temporary mid-transaction invalidity while preserving final integrity.

## 7. Retracted latest version

Stable pointer to latest RETRACTED version remains coherent: resolver reports the logical record as having no active accepted representation while preserving exact latest history.

**Pass.** No need to rename the physical pointer before implementation; resolver semantics must distinguish `latest/head` from `active` in code even if the column remains `current_version_id`.

## 8. Evidence currentness race

Evidence may validate a current session/action version and then become stale because another module commits a correction before/after Evidence commit.

**Pass.** Exact version references preserve truth of what was linked; current projections re-resolve and ignore stale links. Cross-module distributed locks would be disproportionate.

## 9. Direction edge stability across node edits

DirectionEdge points to stable node ids, not exact node versions.

**Pass for structural intent.** The graph relation belongs to logical Direction nodes. If an edit materially changes identity/kind, the node is replaced rather than silently reinterpreted. Evidence about fulfillment remains exact-version-addressed.

## 10. Owner deletion / auth deletion

`auth.users` deletion is restricted while a Wayfinder owner exists.

**Pass by design.** This forces account deletion through a future explicit privacy purge rather than accidental cascade. The product must eventually provide that flow before production deletion UX is exposed.

## 11. Minimum-table challenge again

No table can be removed without losing an already-accepted first-slice behavior:

- owners: authority scope;
- command receipts: idempotency/conflict identity;
- outbox: atomic durable change capture;
- Direction nodes/versions/edges: graph + correction lineage;
- Practice practices/sessions/session_versions: life-domain identity + correctable occurrence;
- Evidence links: cross-layer epistemic bearing.

**Pass.** Ten-table topology remains justified.

## 12. Scale and performance sanity

Current-version reads require stable→version joins and owner/time indexes. Evidence uses source/target tuple indexes. No recursive universal graph traversal is required for Slice 1A.

**Pass.** Nothing in the first slice requires a projection warehouse or background derivation pipeline.

## Result

No structural architecture change is required.

Apply four physical clarifications:

1. non-empty known occurrence intervals;
2. internal PROCESSING receipt state;
3. monotonic Practice lifecycle + concurrent owner bootstrap rule;
4. nullable outbox→command receipt FK.

Then run one **confirmation pass**. If it surfaces no material change, mark the Physical Schema Gate passed and allow creation of the empty Wayfinder Supabase project. Migration application remains a separate next step after project creation.
