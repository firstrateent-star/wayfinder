# Object Contract Stress Test — v0.6

**Target:** `docs/03-object-contracts.md` v0.6  
**Result:** no root ontology change; four contract-level improvements required

## 1. Two Wayfinder users can both have a PracticeSession

A future production system stores records for many users. Shared references use globally unique ids, but RecordEnvelope currently has no explicit ownership/security scope.

**Risk:** ownership becomes an implementation convention rather than part of the shared contract, making RLS and cross-domain composition easier to get wrong.

**Change:** canonical records get an `ownerRef` in the logical envelope. Subject and owner remain distinct.

## 2. Command `id` and `idempotencyKey` duplicate identity

Every mutation already requires a stable command id. Carrying a second idempotency identity creates opportunities for contradictory bookkeeping.

**Change:** collapse them. `Command.id` becomes the retry/idempotency identity. A true retry reuses the same command id; same id + different material content is a conflict.

Semantic/business duplicate prevention remains domain-specific.

## 3. A projection consumes 400,000 transactions

Listing every exact RecordVersionRef inline in `Projection.inputRefs` and `Provenance.derivedFrom` does not scale.

**Boundary:** we still need exact historical ancestry. We cannot replace exact lineage with only a query description because later source changes would make the old input set unknowable.

**Change:** introduce `LineageSpec`, supporting either small direct version refs or a versioned immutable lineage-manifest reference. Initial implementation may use direct refs only; the contract leaves a scalable seam without changing ontology.

## 4. Open-ended time is ambiguous

`TemporalRange { from?, to? }` cannot distinguish:

- endpoint unknown;
- endpoint not applicable/unbounded;
- state currently open/ongoing.

**Change:** boundaries become explicit `KNOWN | OPEN | UNKNOWN` values. This avoids silently treating missing temporal data as a semantic assertion.

## 5. Private source creates a general projection

A health record is private but contributes to a broad energy projection.

**Result:** no new object primitive. Domain/query/intelligence layers must prevent derived records from widening access beyond their source lineage without an explicit policy. Add invariant and handle in Domain Protocol.

## 6. Connector reimports the same bank transaction with a new command id

Command idempotency cannot solve semantic duplicates across distinct import attempts.

**Result:** correct. Source/domain-specific natural-key or external-id deduplication belongs to the owning domain. Do not turn command idempotency into a universal dedupe system.

## 7. One real-world event spans multiple domains

A paid performance is creative practice, work, social interaction, and financial income.

**Result:** current architecture survives. One domain may own the occurrence and other domains reference it, or each domain may preserve domain-specific records sharing source/equivalence lineage. No universal Event table is needed.

## 8. Offline edit races with online edit

Version preconditions detect the stale mutation. A rejected command can surface a conflict without destroying either version.

**Result:** pass.

## 9. Projection cache disappears

Canonical domain history and lineage remain. Projection can be reconstructed.

**Result:** pass.

## 10. Missing weekend data

Coverage scope prevents “zero activity” from being inferred from partial data.

**Result:** pass.

## Reflection

The contract is converging. The remaining accepted changes improve operational scale and security without enlarging the root ontology.

After applying these changes, repeat a final contract pass focused on whether any blocking ambiguity remains for the first executable slice.