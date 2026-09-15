# Physical Schema Stress Test — v0.3

**Target:** `docs/10-physical-schema.md` v0.3  
**Result:** architecture still holds; four enforceable clarifications surfaced before final gate

## 1. Current pointer references a SUPERSEDED version

Composite FK proves that the pointer belongs to the same logical record/owner, but it does not prove the pointed version is an acceptable latest state.

**Risk:** a bug could leave `current_version_id = v1` after v1 is marked SUPERSEDED.

**Change:** add a deferred invariant/constraint trigger for versioned stable rows:

- `current_version_id` must resolve to the same record/owner;
- the pointed version must not be `SUPERSEDED`;
- when a non-retracted current representation exists, it is `ACTIVE`;
- `RETRACTED` may remain the latest pointed version when the logical record intentionally has no active representation.

The same trigger can verify correction lineage at transaction end.

## 2. `superseded_by_version_id` points to another logical record

A simple UUID FK is too weak.

**Change:** self-replacement pointers use same-record/owner composite integrity:

`(superseded_by_version_id, record_id, owner_id)` → `(id, record_id, owner_id)`.

Slice 1A supports one-to-one correction replacement. Split/merge replacement remains a future module-specific extension; the general ontology does not require every physical module to implement it now.

## 3. Lifecycle is reversed accidentally

A maintenance function changes `SUPERSEDED → ACTIVE`.

**Change:** enforce monotonic lifecycle transitions for historical versions:

- `ACTIVE → SUPERSEDED`
- `ACTIVE → RETRACTED`
- terminal historical states do not silently reactivate.

DirectionEdge/EvidenceLink allow `ACTIVE → RETRACTED` only in Slice 1A.

This belongs in the same immutable/lifecycle protection trigger family.

## 4. Date/range boundary ambiguity

A day-only session normalized from local midnight to next local midnight needs a precise inclusion convention. Without one, adjacent days can overlap at midnight and duration calculations can disagree.

**Change:** Wayfinder time ranges use **half-open interval semantics `[start, end)`** whenever both boundaries are known. The start is included; the end is excluded.

This should be clarified in the shared Object Contracts as well as the physical schema. It is a contract clarification, not a new primitive.

## 5. Known duration with coarse occurrence window

User says “I practiced for 30 minutes sometime Saturday.” Occurrence range represents the whole possible day while duration is 30 minutes.

**Rule:** do not require `duration_seconds == occurred_to - occurred_from` unless the occurrence bounds represent the actual exact session interval. A coarse uncertainty window and a known duration are compatible.

The validation rule must be precision-aware.

## 6. All module rows need owner FK discipline

`owner_id` columns without FK can orphan after manual maintenance.

**Change:** all canonical/system rows with owner scope FK to `wf_system.owners(id)` using guarded/restrictive semantics. Owner purge is a deliberate procedure that deletes owned records in an explicit order; it is not an accidental auth cascade.

## 7. Command request hash differs because JSON key order differs

Two semantically identical retries serialize object keys differently.

**Change:** request hashing requires canonical deterministic serialization/normalization. Hash semantics are part of the command implementation contract; plain client JSON text hashing is insufficient.

No new column required.

## 8. Evidence currentness race

Evidence validates Session v1 as current; concurrently Practice corrects to v2 before the Evidence transaction commits.

**Result:** safe without distributed locking. The EvidenceLink may be born stale, but it still references the exact version the user linked. On-demand current Fulfillment/Bearing re-resolves currentness and will not count stale v1.

Do not introduce cross-module distributed/locking semantics merely to guarantee evidence target currentness at a global instant.

## 9. Evidence integrity audit finds missing ref

**Pass:** this is a diagnostic integrity failure, not negative evidence. It must surface separately from ordinary empty results.

## 10. Outbox is never published because Slice 1A has no async worker

**Pass.** Durable rows may accumulate initially. The outbox proves atomic change capture; the first dispatcher is added only when an asynchronous consumer exists. Do not mark rows published merely to keep the table empty.

## 11. Backup/restore

Owner-aware FKs + stable/version cycles remain restorable if current-pointer constraints are deferrable and the restore test is part of migration CI.

**Pass with executable-test requirement.**

## 12. Minimum-table challenge

Could command receipts/outbox be removed until later?

**No.** Command retry semantics and atomic durable change notification are foundational behaviors already accepted by the protocol. Their cost is small and they intentionally exercise the architecture from the first real write.

Could DirectionEdge be replaced by `parent_id`?

**No.** That would prematurely collapse Direction back into a tree and break one Action→multiple Direction relationships.

Could EvidenceLink be a column on PracticeSession?

**No.** That would make Practice authoritative over Direction/Evidence and prevent one session from bearing on multiple targets.

The remaining 10-table shape is justified.

## Result

No new table family, module, or ontology primitive is required.

Before final schema gate:

1. clarify half-open TemporalRange in Object Contracts;
2. add current-pointer/lifecycle/supersession DB-invariant requirements to schema;
3. require owner FKs and canonical request hashing;
4. run one final pass after those changes.
