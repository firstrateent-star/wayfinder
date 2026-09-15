# Physical Schema Stress Test — v0.5 Confirmation

**Target:** `docs/10-physical-schema.md` v0.5  
**Result:** **PASS — physical schema convergence gate satisfied**

## Purpose

This pass intentionally tries to force one more material schema/topology change after the v0.4 findings were applied. The bar is not “looks good”; the bar is whether the first executable slice still contains a structural contradiction that would make project creation premature.

## 1. Duplicate command race

Two transactions submit the same command id concurrently.

- both compute the same canonical request hash;
- unique `command_id` serializes the claim;
- the loser re-reads the terminal receipt after the winner commits;
- no duplicate canonical effect is created.

Different hash with same id is a conflict.

**PASS.** Implementation must test the wait/unique-conflict path explicitly; no new table/column required.

## 2. Correction race

Two clients correct Session v1.

- stable session row lock + expected-version precondition serializes correction;
- first produces v2;
- second sees current != expected and rejects;
- historical v1 remains resolvable.

**PASS.**

## 3. Deferred current/supersession integrity

Correction temporarily creates v2 before all lifecycle/head pointers are updated.

- deferred constraints/triggers allow valid transaction ordering;
- transaction end requires same-record owner integrity;
- head cannot settle on SUPERSEDED;
- superseded-by cannot point to another logical record.

**PASS.**

## 4. Backup/restore ordering

Stable/version tables form intentional cyclic referential relationships through head pointers.

DEFERRABLE constraints plus migration ordering allow restoration; CI must include a schema/data round-trip test.

**PASS with executable test requirement.** No topology change.

## 5. Owner bootstrap race

Two first-login ensure-owner calls converge through unique auth_user_id/upsert semantics.

**PASS.** Narrow bootstrap exception remains justified.

## 6. Auth/account deletion

Deleting `auth.users` while Wayfinder owner history exists is restricted.

**PASS by design.** Production account deletion UX is deferred until explicit privacy purge exists. This is safer than accidental cascade loss.

## 7. Cross-owner attack

Client attempts to supply another owner's ids.

- owner is derived from trusted auth context;
- commands/resolvers scope by owner;
- same-owner FKs protect module-local relations;
- generic Evidence refs are resolver-authorized before insert.

**PASS.** Migration/RPC tests must attempt cross-owner access and service-role context misuse.

## 8. Practice retraction

A Practice is retracted after historical sessions exist.

Historical sessions remain valid records; future log-session commands require an ACTIVE Practice. Practice does not reactivate by maintenance update.

**PASS.** No cascade deletion.

## 9. Direction node retraction with edges

A logical Direction node becomes retracted while structural edges still exist historically.

Current graph reads require active edge + active/current endpoint representations; historical graph explanation may still resolve the old relation.

**PASS.** This is resolver/read behavior, not a reason to mutate/delete edges.

## 10. Evidence staleness and missing reference

- superseded source/target → stale historical Evidence, excluded from current Fulfillment/Bearing;
- retracted source/target → historical but not current support;
- unexpected MISSING resolver result → integrity diagnostic, never negative evidence.

**PASS.** No invalidation table required in Slice 1A.

## 11. Time boundaries

Adjacent day windows use `[start, end)` and cannot overlap at midnight. Known bounded ranges require `end > start`. Point occurrence uses no fabricated zero-width interval. DST normalization uses original zone id.

**PASS.**

## 12. Coarse time + known duration

“30 minutes sometime Saturday” stores a coarse occurrence window plus known duration. Exact-duration equality is only enforced when the bounds explicitly mean the actual event interval.

**PASS.**

## 13. Outbox without dispatcher

Outbox rows can remain unpublished until a real async consumer exists. Canonical truth is already committed and does not depend on transport.

**PASS.** No worker/consumer tables justified yet.

## 14. Read-model pressure

Journey, Fulfillment, Bearing, and Helm can be computed on demand from the first-slice tables. No projection cache is required to make the product function.

**PASS.**

## 15. Minimum schema challenge

Attempted again to remove command receipts, outbox, DirectionEdge, or EvidenceLink. Each removal destroys an accepted invariant or couples modules incorrectly.

Attempted to add universal record registry, projection warehouse, invalidation table, workflow engine, or lineage manifest. None is required by the first slice.

**PASS.** Ten-table shape remains the smallest architecture that preserves the chosen guarantees.

## 16. Ontology back-pressure

No scenario in this pass required:

- a new root ontology category;
- a new root Reality/Direction/Epistemic primitive;
- a new shared stateful-module type;
- a new first-slice table family.

**PASS.**

## Gate result

### Physical Schema Gate: PASSED

Wayfinder is now authorized to create an **empty** Supabase project using the accepted regional/organization choice.

This does **not** authorize schema migration yet.

After project creation:

1. record project metadata in Canon;
2. write migration 0001 from the v0.5 physical schema;
3. Flower/stress-test the SQL itself, including security/RLS/RPC and restore behavior;
4. only then apply the migration;
5. run Supabase security/performance advisors and executable invariant tests;
6. re-enter the validation loop using real database evidence.

The recursion continues; the source of evidence changes from abstract design to executable Postgres behavior.
