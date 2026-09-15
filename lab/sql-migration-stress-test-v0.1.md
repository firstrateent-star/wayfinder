# Executable SQL Migration Stress Test — v0.1

**Target:** `supabase/migrations/20260915053000_create_wayfinder_slice1_core.sql`  
**Result:** architecture holds; two implementation-order/runtime issues surfaced before deployment

## Center

Can the first actual Postgres migration enforce the accepted Wayfinder invariants without introducing a new ontology primitive, module, table family, or hidden write path?

## 1. Deferred head-integrity trigger must branch on TG_OP

The first SQL draft selected affected ids with expressions such as `coalesce(NEW.id, OLD.id)`.

That is unsafe for DELETE/INSERT trigger execution because the unavailable transition record is not a normal populated row.

**Correction:** branch explicitly on `TG_OP` and use only `OLD` for DELETE and only `NEW` for INSERT/UPDATE.

This is a runtime implementation correction, not an architecture change.

## 2. One-ACTIVE-version index changes correction ordering

The physical schema deliberately includes a partial unique index allowing at most one `ACTIVE` version of a DirectionNode or PracticeSession.

The earlier conceptual correction sequence said:

1. insert v2 ACTIVE;
2. mark v1 SUPERSEDED;
3. move the stable head to v2.

That sequence would temporarily violate the immediate partial unique index.

**Accepted executable ordering:**

1. lock the stable logical record;
2. pre-generate the new version id (`v2_id`);
3. mark v1 `SUPERSEDED` with `superseded_by_version_id = v2_id`;
4. insert v2 `ACTIVE` using the pre-generated id;
5. move `current_version_id` to v2;
6. commit, allowing deferred same-record/head constraints to validate the final state.

The supersession FK is DEFERRABLE, so step 3 can safely point to the v2 id before the v2 row is inserted in the same transaction.

This preserves the stronger database invariant of at most one ACTIVE version without needing another column or weaker uniqueness semantics.

## 3. Stable/version cycle remains restorable

Stable rows may initially have `current_version_id = NULL`; versions are inserted; the head pointer is advanced in the same transaction. The composite head FK and head-integrity constraint trigger are deferred.

**Pass.** The final state is enforced at transaction end while creation/correction can pass through temporary intermediate states.

## 4. Semantic payload immutability

Version rows protect identity, payload, provenance, and recorded time from UPDATE while permitting only lifecycle/supersession metadata to move from ACTIVE into terminal state.

**Pass.** Corrections create new versions rather than rewriting history.

## 5. Terminal lifecycle monotonicity

- version: `ACTIVE → SUPERSEDED | RETRACTED`;
- edge/evidence/practice: `ACTIVE → RETRACTED`;
- terminal rows do not silently reactivate.

**Pass.** No restore/reactivation behavior is invented in Slice 1A.

## 6. Time range enforcement

Known bounded PracticeSession ranges require `occurred_to > occurred_from`, matching canonical half-open `[start,end)` semantics. Point-like occurrence is represented with no end boundary.

**Pass.** A known coarse uncertainty window may coexist with a smaller known duration; SQL does not incorrectly force duration to equal uncertainty-window width.

## 7. Cross-owner integrity

All canonical rows carry owner scope; local module links use same-owner composite FKs where practical; generic Evidence refs remain resolver-validated rather than polymorphic DB-FK coupled.

**Pass.** No cross-owner shortcut was introduced.

## 8. Command/outbox integrity

`PROCESSING` is internal physical command-claim state; terminal public states remain `APPLIED | REJECTED | NOOP`. Outbox rows can optionally reference a real command receipt.

**Pass.** The database supports deterministic retry identity without treating the outbox as life history.

## 9. Privilege boundary

Wayfinder schemas, tables, and internal functions remain unavailable to `public`, `anon`, and normal `authenticated` direct access. Public command/read surfaces will be introduced deliberately later.

**Pass.** No frontend table-write path exists after this migration.

## 10. Minimum-shape challenge

No additional table is required by the SQL implementation. No accepted table can be removed without losing a first-slice invariant.

**Pass.** Ten tables remain justified.

## Result

No ontology, Stateful Module Protocol, or physical-topology change is required.

Before deployment:

1. fix trigger `TG_OP` handling;
2. update correction-sequence documentation to the pre-generated-version ordering;
3. run one more static SQL confirmation pass;
4. if clean, apply the migration to the existing Vlourish Supabase host under the isolated `wf_*` namespaces.
