# Physical Schema Stress Test — v0.2

**Target:** `docs/10-physical-schema.md` v0.2  
**Result:** no new table family required; hardening and lifecycle clarifications remain before convergence

## 1. Correction race on the same PracticeSession

Two clients both read session v1 and submit different corrections with expected version v1.

**Pass if implemented as specified:** both transactions lock the stable session row; the first advances to v2, the second sees that `current_version_id != expected_version_id` and returns a stale-precondition rejection.

No lost update occurs.

## 2. Current pointer accidentally points at another record

A coding bug tries to set Session A's `current_version_id` to Session B's version.

**Pass only with composite integrity:** `(current_version_id, id, owner_id)` must resolve to `(version_id, session_id, owner_id)` in the version table, or an equivalent deferred constraint/trigger must enforce it.

The same law applies to DirectionNode.

**Implementation note:** creation can insert stable row with NULL pointer, insert v1, then set the pointer inside the same transaction. A DEFERRABLE current-pointer constraint is acceptable if required by DDL ordering/restore behavior.

## 3. Immutable historical payload is accidentally edited

A maintenance query updates the title on `node_versions` v1 instead of creating v2.

**Risk:** exact RecordVersionRef semantics become false.

**Change:** historical semantic payload columns should be database-protected against UPDATE after insert. Lifecycle-only fields (`lifecycle_status`, `superseded_by_version_id`, retraction metadata) may change under controlled functions.

This may be implemented with a small trigger or with privileges/functions plus executable invariant tests. Prefer a DB trigger if it remains simple.

## 4. Command receipt is pruned, then an old command retries

If command receipts are deleted while canonical effects remain, the same Command id can be replayed as though new and duplicate effects.

**Failure in prior retention wording:** command receipts cannot simply have a short operational retention policy while the idempotency promise remains unbounded.

**Change:** retain command identity/results durably for Slice 1A. Future compaction may replace full receipts with an immutable idempotency tombstone/registry, but deleting the identity entirely requires an explicit finite retry-horizon decision.

Outbox retention is different: published change-delivery rows may be pruned under policy because ModuleChange is not the canonical history ledger.

## 5. Auth account is deleted before Wayfinder data

A casual `ON DELETE CASCADE` from `auth.users` could destroy all Wayfinder history through an auth operation rather than an explicit Wayfinder privacy workflow.

**Change:** do not cascade app history directly from `auth.users` in Slice 1A. Prefer `ON DELETE RESTRICT` (or equivalent guarded handling) and an explicit future owner-deletion procedure that intentionally purges module data before/with auth deletion.

Account deletion is not an ordinary module correction.

## 6. Owner bootstrap trigger breaks signup

Automatically creating the Wayfinder owner inside an `auth.users` trigger couples app-schema errors to authentication signup.

**Economy/risk finding:** do not require that trigger in Slice 1A.

Use an explicit bootstrap/ensure-owner boundary after authentication. Canonical command/read functions fail clearly if no Wayfinder owner mapping exists. A helper RPC may create it idempotently.

No additional table is required.

## 7. SECURITY DEFINER function is called with another owner's id

**Pass only if:** owner is derived from `auth.uid()`/trusted server context. Client-supplied owner ids are filters at most, never authority.

Also require:

- fixed/hardened `search_path`;
- fully qualified private objects;
- revoke table privileges from `anon`/`authenticated`;
- grant only the intended RPC execute privileges;
- tests for cross-owner reads and writes.

RLS is defense in depth, not a substitute for function authorization.

## 8. Direction node title edit after EvidenceLink creation

Action v1 becomes v2. Evidence still targets exact v1.

**Pass:** current Action Fulfillment checks whether target version is still current/accepted. It reports stale evidence rather than silently treating link as evidence for v2.

No async invalidation table is needed for Slice 1A because Fulfillment/Bearing are on-demand.

## 9. PracticeSession correction after EvidenceLink creation

Session v1 → v2.

**Pass:** same on-demand currentness rule detects stale source v1. Historical EvidenceLink remains explainable.

This validates the choice not to add an evidence-invalidation table yet.

## 10. Evidence exact ref later becomes physically missing

A database corruption or unsupported manual delete removes a referenced version.

**Required behavior:** resolver returns `MISSING`, not “no evidence.” Current read surfaces degrade/diagnose the integrity problem.

No universal FK is added, but an integrity audit query/test should periodically be able to find dangling generic Evidence refs.

## 11. Partial privacy redaction of one session

The current schema has non-null semantic payload fields and immutable-version expectations.

**Boundary:** this feature is intentionally **not implemented** in Slice 1A. Do not fake it with ordinary DELETE. Before partial-record privacy deletion is exposed, design module-specific tombstone/redaction behavior and re-run the architecture loop.

Full owner/account purge is a separate explicit future workflow.

## 12. Schema migration changes the meaning of historical rows

Adding a field is harmless, but reinterpreting an old stored field under new code can silently rewrite history semantically.

**Change:** `schema_version` must be honored by resolvers. Migrations may add adapters for old schema versions or create new canonical versions when semantics truly change. Do not bulk rewrite immutable historical payload merely to fit current code without preserving prior meaning.

## 13. Restore from backup with stable↔version composite references

Circular-ish stable current pointers and version→stable FKs can make restore ordering sensitive.

**Change:** current-pointer constraints should be DEFERRABLE where practical, and migrations/restore tests must prove a dump can be restored without temporarily violating impossible ordering constraints.

This is an implementation detail, not a new ontology concept.

## 14. Coarse date-only practice entry across DST

User records “I practiced Saturday” in a local timezone.

**Pass if normalization is explicit:** convert the local-day bounds using the zone in effect for that date and persist bounded UTC instants plus `precision = DAY` and `occurred_zone_id`. Do not manufacture a noon/midnight point and later display it as exact.

## 15. Command rejected after command id is claimed

If the function throws an exception, the transaction may roll back the newly inserted REJECTED receipt.

**Required implementation shape:** semantic validation failure that should be idempotently remembered must be converted to a structured terminal receipt and committed without canonical mutation/outbox. Fatal/untrusted authorization failures may abort without receipt.

## 16. Command receipt response needs to reproduce generated ids

`affected_refs` is sufficient for Slice 1A because create commands can return/re-resolve the created logical/version refs from the stored receipt. No generic `response_json` column is required yet.

**Pass.** Avoid storing arbitrary duplicated response payload until evidence requires it.

## 17. Outbox row has `published_at` but future consumers multiply

`published_at` means published to the transport/dispatcher, not “all consumers processed this change.” Per-consumer acknowledgements are intentionally absent because no multi-consumer durable bus exists yet.

**Pass with wording clarification.** Do not let `published_at` acquire stronger semantics later by accident.

## 18. Practice name changes retroactively in Journey

Practice metadata is unversioned, so old sessions may display the current Practice name.

**Accepted Slice 1A trade-off:** Practice name is display metadata, not historical evidence payload. The stable Practice id remains the meaning-bearing reference. If historical naming becomes materially meaningful, promote Practice metadata to versioned canonical payload through a deliberate migration.

## Convergence direction

No new persistent table is justified by this pass.

Changes for schema v0.3:

1. durable command-receipt/idempotency retention;
2. explicit protected immutable payload rule;
3. guarded auth/owner deletion rather than auth cascade;
4. explicit post-auth owner bootstrap;
5. resolver-aware `schema_version` migration law;
6. deferrable current-pointer integrity/restore requirement;
7. outbox `published_at` semantics clarified;
8. dangling generic Evidence refs become an executable integrity audit.

Then run a final adversarial schema convergence pass.