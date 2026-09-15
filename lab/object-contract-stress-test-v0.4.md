# Object Contract Stress Test — v0.4

**Target:** `docs/03-object-contracts.md` v0.4  
**Method:** recursive Flower / adversarial scenario pressure  
**Result:** structural changes required

## Center

Can the current contracts preserve truth, lineage, authority, and explainability while remaining simple enough for an early vertical slice?

## Scenarios

### 1. Corrected practice session already used by a projection

A 90-minute PracticeSession produces a weekly practice metric. The user later corrects the session to 60 minutes.

**Failure:** `RecordRef` identifies the logical record but not the exact version consumed. The historical-resolution rule is semantic but not representable in the reference itself.

**Change:** add `RecordVersionRef`. Stable references identify a logical record; lineage references identify an immutable consumed version.

### 2. AI proposes a write and retries after a network timeout

The same command is sent twice.

**Failure:** `idempotencyKey` is optional, and `authorization: string` is too weak to prove who actually authorized execution.

**Change:** idempotency becomes required for mutation commands. Requester and authorizer become distinct. Authorization gets a structured mode and optional grant reference.

### 3. Two devices edit the same Action

Both devices read version A. One edits first; the second submits stale data later.

**Failure:** nothing allows a command to state the version it expected to mutate.

**Change:** add optional version preconditions. Mutations of existing non-commutative records should use them.

### 4. A domain corrects an Observation

The domain publishes a `DomainEvent` saying an Observation was superseded.

**Failure:** the contract conflates two meanings of event: a lived-reality Event and a system notification that canonical state changed.

**Change:** replace the cross-system `DomainEvent` concept with `DomainChange`. A DomainChange is infrastructure, not lived evidence.

### 5. A Direction node is marked `completed`

An Action is marked complete even though no occurrence has been recorded.

**Failure:** generic `status: string` invites intent state and factual fulfillment to collapse.

**Change:** Direction nodes carry only intent lifecycle such as active, paused, or withdrawn. Fulfillment/achievement is evaluated from evidence, not silently asserted by the node.

### 6. “No workouts this week”

Training has data for Monday–Wednesday but the connector was disconnected Thursday–Sunday.

**Failure:** current Coverage does not make its scope precise enough. `COMPLETE` without exact domain/type/time/source scope is dangerously broad.

**Change:** Coverage becomes explicitly scoped and evaluated at a time.

### 7. Approximate historical event

The person remembers that a conversation happened “sometime last Saturday afternoon.”

**Failure:** raw strings cannot distinguish exact instants from bounded approximate time.

**Change:** add minimal temporal point/range contracts. Approximation should be represented as a range rather than false timestamp precision.

### 8. Evidence generated from evidence

One event creates a metric, then a signal, then a Character projection.

**Failure:** `sourceRefs: RecordRef[]` does not guarantee exact input versions and could allow stale or double-counted ancestry.

**Change:** projections and derivations depend on versioned input references.

### 9. Evidence link itself is corrected

The system originally treats a session as supporting an Outcome, then later learns the relation was wrong.

**Failure:** EvidenceLink has no common lifecycle/version semantics.

**Change:** shared canonical records need a logical envelope: reference, version, lifecycle, record time, provenance.

### 10. Privacy deletion conflicts with historical lineage

A source record must be deleted for privacy reasons after it was used in a projection.

**Result:** lineage and privacy can conflict. The contract must permit a historical reference to resolve to a tombstone/redaction rather than silently dangling or forcing indefinite retention.

**Deferred:** exact deletion/tombstone persistence policy. Add invariant that unresolved/redacted lineage is explicit.

## Findings

1. Stable identity and historical version identity are different.
2. Intent lifecycle and fulfillment are different.
3. Domain change notification and lived Event are different.
4. Authorization and request origin are different.
5. Coverage only has meaning relative to an explicit scope.
6. Derived inputs must be version-addressable.
7. Common lifecycle/version metadata should be a logical contract, not necessarily one SQL table.

## Flower reflection

The contracts are conceptually sound but still too permissive at the seams where systems fail in production: retries, corrections, stale writes, time ambiguity, authorization, and derivation lineage.

**Decision:** revise contracts, then run the same pressure again.