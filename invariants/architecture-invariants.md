# Wayfinder Architecture Invariants

**Version:** 0.6

These begin as written constraints and should progressively become executable tests.

## Truth and uncertainty

- [ ] Unknown must never silently become zero.
- [ ] Missing evidence must not silently become evidence of absence.
- [ ] A lived-reality zero/none/absence conclusion requires direct evidence or sufficiently complete bounded source coverage.
- [ ] Database/query completeness must not be mislabeled as complete coverage of lived reality.
- [ ] The system may truthfully describe absence of its own records (for example “no sessions logged”) without claiming the underlying lived event did not occur.
- [ ] A scheduled or planned record must not become factual solely because time passes.
- [ ] An interpretation must not silently become an observation or fact.
- [ ] A reflection must preserve authorship.
- [ ] Conflicting observations/evidence may coexist without forced resolution.
- [ ] Epistemic completeness, derivation mode, dispute, and confidence must not be collapsed into one certainty flag.
- [ ] Source/provenance and inference/derivation mode must remain distinct.
- [ ] Canonical inside Wayfinder must not be presented as metaphysical certainty.
- [ ] Corrections must not erase provenance without an explicit retention/privacy policy.

## Stateful module boundaries

- [ ] A stateful module cannot directly mutate another module's canonical persistence.
- [ ] Core modules and life-domain modules use the same shared execution/version/reference laws without pretending they have the same business semantics.
- [ ] Shared System Kernel writes needed for command receipts and transactional outbox are infrastructure participation, not foreign canonical ownership.
- [ ] A module can be unavailable without making unrelated module truth unavailable.
- [ ] New modules integrate through registration/contracts rather than edits scattered across unrelated code.
- [ ] Life-domain asymmetry is allowed; domains are not forced to expose identical metrics or rewards.
- [ ] Shared references do not imply shared persistence ownership.
- [ ] Disabling/retiring a module must not silently orphan durable lineage-bearing references.
- [ ] Internal schema migrations must preserve public reference/version semantics or explicitly migrate/tombstone them.

## References, ownership, and relations

- [ ] `RecordRef` addresses a logical record; `RecordVersionRef` addresses an exact historical version; `EntityRef` is reserved for continuing identity.
- [ ] RecordRef namespace/type identifiers are stable machine keys, not display labels.
- [ ] Anything placed in durable evidence/provenance lineage is version-addressable.
- [ ] Historical references may resolve to explicit redacted/deleted tombstones under policy; they must not silently become ordinary absence.
- [ ] An unexpected dangling/corrupt reference must be detectable.
- [ ] Every canonical record has explicit owner scope distinct from subject.
- [ ] Every owner-scoped physical row must maintain referential integrity to the owning Wayfinder owner unless a documented bootstrap exception exists.
- [ ] One owner's reads/writes cannot resolve or mutate another owner's protected canonical records without explicit authorization.
- [ ] A factual Relation must not be silently treated as a Direction edge.
- [ ] Direction edges connect Direction nodes only; cross-layer epistemic bearing uses Evidence.
- [ ] A created output may be an Entity without requiring a separate Artifact root primitive.

## Commands and authority

- [ ] AI cannot directly establish canonical reality.
- [ ] Canonical mutation must pass through an authorized Command and owning-module validation.
- [ ] Frontend/direct-table mutation is not an accepted canonical application write path.
- [ ] Command id is the retry/idempotency identity; a true retry cannot duplicate canonical effects.
- [ ] Reuse of one Command id with materially different content must be rejected.
- [ ] Material command request hashing uses deterministic canonical serialization; JSON key order, whitespace, or client serialization differences cannot alter retry semantics.
- [ ] Semantic duplicate prevention across different Command ids remains owning-module responsibility.
- [ ] Authorization is revalidated at execution time rather than trusted because a proposal was previously allowed.
- [ ] Stale non-commutative updates protected by version preconditions must be rejected rather than silently overwrite newer state.
- [ ] Read-only reasoning paths must not create writes.

## Transaction and change delivery

- [ ] A successful owning-module mutation atomically commits canonical record changes, command-result identity, and durable outbox ModuleChange (or an equivalent guarantee).
- [ ] ModuleChange delivery may be at least once; consumers must be idempotent.
- [ ] Canonical truth must not depend on successful immediate delivery to async consumers.
- [ ] ModuleChange is not assumed to be a complete ordered event-sourcing ledger.
- [ ] Derived consumers that need current truth re-resolve canonical state unless an explicit replay contract exists.

## Evidence and derivation

- [ ] Permanent growth requires qualifying evidence.
- [ ] Important derived claims can expose supporting lineage.
- [ ] A projection can be rebuilt without deleting lived history.
- [ ] Changing a projection rule must not silently rewrite canonical history.
- [ ] Confidence must not be presented as objective truth.
- [ ] A record must not count as independent evidence for itself.
- [ ] Derived evidence/lineage must not contain circular self-support.
- [ ] Multiple descendants of the same underlying lineage must not be naively counted as independent evidence.
- [ ] A Projection cannot create new evidentiary weight merely by summarizing its sources.
- [ ] Superseding/retracting an evidence source must trigger re-evaluation or invalidation of dependent current derived state.
- [ ] Evidence does not silently migrate to a new source or target version after correction.
- [ ] An ephemeral projection cannot participate in durable evidence/lineage unless a resolvable version/snapshot exists.
- [ ] Derived systems may propose corrections but do not silently mutate the source canonical facts they interpret.

## Direction

- [ ] One Action may support multiple Direction nodes.
- [ ] An Action is valid even when it has no goal ancestor.
- [ ] Action existence is not occurrence evidence.
- [ ] Action fulfillment is a projection/evaluation of evidence, not a silent canonical Direction mutation.
- [ ] Completing/performing an Action and achieving an Outcome remain distinct.
- [ ] Creating a Quest does not itself create evidence of growth.
- [ ] Commitment and Outcome remain distinct concepts.
- [ ] `PART_OF` and `DEPENDS_ON` cycles must be rejected or explicitly justified by the relation contract.

## Time

- [ ] Occurrence time and record time are distinct when both matter.
- [ ] Validity time and occurrence time are distinct when both matter.
- [ ] Planned time and occurred time are never treated as interchangeable.
- [ ] Approximate historical time must not be silently presented as exact.
- [ ] OPEN and UNKNOWN temporal boundaries remain distinct.
- [ ] Known temporal ranges use half-open `[start, end)` semantics.
- [ ] Adjacent known ranges therefore do not double-count their shared boundary.
- [ ] A coarse occurrence uncertainty window must not be mistaken for actual event duration; duration consistency checks are precision-aware.

## Corrections and lifecycle

- [ ] A corrected record may cease to be current without silently disappearing from required lineage.
- [ ] Full event sourcing is not required as long as correction/supersession lineage is preserved.
- [ ] Privacy/deletion policy may override content retention only through an explicit rule/tombstone state.
- [ ] Ordinary correction/removal must not silently hard-delete lineage-bearing records.
- [ ] A stable record's `current_version_id` must resolve to a version of that same record and owner.
- [ ] A current pointer must not point to a `SUPERSEDED` version.
- [ ] A `superseded_by` pointer must resolve to a replacement version of the same logical record/owner unless a future explicit split/merge contract says otherwise.
- [ ] Historical lifecycle transitions are monotonic in the first slice: `ACTIVE → SUPERSEDED` or `ACTIVE → RETRACTED`; terminal historical versions do not silently reactivate.
- [ ] Immutable-payload record families such as initial DirectionEdge/EvidenceLink permit only the explicitly defined lifecycle transition, not semantic payload mutation.

## Projections and reads

- [ ] Projection is the canonical derived abstraction; Growth, Momentum, Bearing, Mastery, Character, Fulfillment, and similar systems are projection families rather than root truth.
- [ ] Deleting a projection cache must not destroy canonical lived history.
- [ ] Projection outputs carry lineage/rule/model identity sufficient for reconstruction/explanation when they are durable/evidence-bearing.
- [ ] Cheap deterministic projections may be computed on demand; persistence is not required merely because a projection exists.
- [ ] Cached/async projections that are materially stale must not silently present themselves as current.
- [ ] Journey is a user-meaningful history projection, not a raw command/outbox/ModuleChange audit log.

## Failure and consistency

- [ ] AI failure does not prevent basic canonical truth capture/read.
- [ ] Projection/consumer failure does not roll back already committed source truth.
- [ ] Evidence-module failure does not invalidate a committed life-domain fact.
- [ ] Cross-module workflows may be partially complete; the system must not pretend they were atomically all-or-nothing.

## System humility

- [ ] The system can represent incomplete, disputed, stale, corrected, contradictory, or partially unavailable understanding.
- [ ] Character and other RPG representations are projections, not identity truth.
- [ ] The system may model the person incorrectly; model state must remain correctable and explainable.

## Test promotion rule

Whenever an invariant can be mechanically tested, add an automated test and reference that test here. Written-only invariants are a temporary bootstrap state, not the desired endpoint.
