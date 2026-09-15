# Physical Schema Stress Test — v0.1

**Target:** `docs/10-physical-schema.md` v0.1  
**Result:** viable but can be simplified and hardened before deployment

## 1. `practice_versions` is not required by Slice 1A

PracticeSession needs exact historical versions because corrections/evidence depend on them. The Practice identity itself only needs a stable label for the first slice.

**Finding:** versioning Practice name/description now is speculative complexity.

**Change:** keep `wf_practice.practices` as a stable Entity row with mutable display metadata, lifecycle, and timestamps. Do not allow that metadata to participate in durable evidence lineage in 1A. Add versioning later if Practice metadata becomes evidence-bearing.

## 2. `current_version_id` points to the wrong record

A bug could update `direction.nodes.current_version_id` to a version belonging to another node/owner if only a simple FK is used.

**Change:** use owner-aware composite constraints:

- stable tables expose unique `(id, owner_id)`;
- version rows FK `(record_id, owner_id)` to the stable row;
- version rows expose unique `(id, record_id, owner_id)`;
- current pointer can be protected by composite FK `(current_version_id, id, owner_id)` to `(version_id, record_id, owner_id)` where practical.

Same pattern applies to PracticeSession.

## 3. Direction edge crosses owner boundary

`from_node_id` belongs to owner A and `to_node_id` belongs to owner B.

**Change:** composite owner-aware endpoint FKs or equivalent command validation are mandatory. Prefer database enforcement inside the same module because it is cheap and local.

## 4. Session points to another owner's Practice

Same issue as edges.

**Change:** same-owner composite FK from session-version `(practice_id, owner_id)` to practices `(id, owner_id)`.

## 5. Rejected command writes a ModuleChange

A rejected command changes no canonical record.

**Correction:** persist a deterministic rejected receipt when appropriate, but do **not** emit a ModuleChange for a rejection. A true NOOP also does not require a change notification unless a module explicitly defines one.

## 6. Command receipt lacks requested time

The Command contract distinguishes `requestedAt` from processing time.

**Change:** add `requested_at` to command receipts. Keep `created_at/processed_at` as infrastructure time.

## 7. Concurrent same Command id

Two transactions attempt the same id concurrently.

**Pass with implementation rule:** claim the command id first inside the transaction. The unique PK serializes conflicting claims. On same-hash conflict after the first transaction commits, return the existing terminal result; on different hash, reject.

A temporary internal PROCESSING status is allowed but is not a public terminal CommandReceipt state.

## 8. Security-definer RPC trusts owner_id argument

**Failure:** caller could request another owner's record.

**Rule:** first-slice mutation/read RPCs derive the owner from `auth.uid()` (or validate an explicitly selected owner membership later). Client owner id is never trusted merely because it was supplied.

Security-definer functions must harden `search_path` and fully qualify referenced objects.

## 9. Private schemas make RLS irrelevant

Not entirely. Private/unexposed schemas reduce Data API surface, but a bug in an RPC could still cross owner boundaries.

**Rule:** retain owner-aware DB constraints/RLS where useful as defense in depth; explicit authorization inside command/read functions remains primary for security-definer access.

## 10. Generic Evidence refs have no FK

**Accepted trade-off.** A polymorphic cross-module FK is not available without a central registry. Evidence command must resolver-validate exact refs before insert, and current reads must detect later missing/tombstoned refs.

Do not add a universal record registry merely to gain an FK before evidence shows it is needed.

## 11. Evidence self-support/circular misuse

Generic schema technically allows source and target to be the same record.

**Rule:** Evidence command rejects direct self-evidence. Slice 1A additionally restricts target semantics to Direction Action fulfillment and source semantics to current PracticeSession version for the initial UI path.

The table may stay generic; command capability is narrow.

## 12. Time-zone / DST

`timestamptz` preserves an instant, while `occurred_zone_id` preserves local context. This survives DST display better than storing naive local timestamps.

**Pass.** Approximate events use bounded timestamps + precision. Fully unknown event time remains outside Slice 1A.

## 13. Outbox exists before a consumer

This is small infrastructure cost and preserves the write guarantee. No consumer-state table or message broker is required.

**Pass.** A simple publisher can be added when the first async consumer exists.

## 14. Persistent read models

Still unnecessary.

**Pass.** Journey/Bearing/Fulfillment remain on-demand.

## Reflection

The main improvement is implementation economy: version only the records whose historical payload already matters to Slice 1A, while strengthening owner-aware referential integrity inside each module.

Revise schema and run another pass focused on correction transactions, security, deletion, and migration.