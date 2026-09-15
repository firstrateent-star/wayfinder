# Object Contract Stress Test — v0.5

**Target:** `docs/03-object-contracts.md` v0.5  
**Result:** smaller semantic/operational issues found; no new root ontology primitive required

## Recursive pressure cases

### 1. Evidence bears on an Outcome

A completed practice session is linked to an Outcome.

**Problem:** `SUPPORTS` is ambiguous. Does the session support the *intentional strategy*, show *progress*, or support the claim that the Outcome has been *fulfilled*?

**Boundary:** structural/intended contribution belongs in DirectionEdge. Evidence must identify the aspect of the target it bears on.

**Change:** EvidenceLink gets a typed target wrapper with an optional stable `aspect` key, e.g. `fulfillment`, `progress`, `validity`, `quality`.

### 2. Same idempotency key, different payload

A client accidentally reuses a key after editing the payload.

**Required behavior:** reject the conflicting replay. Idempotency means “same logical attempt, same logical result,” not “silently apply the newest payload.”

### 3. Authorization grant revoked between proposal and execution

An AI proposal was created while a grant existed; the user revokes the grant before execution.

**Required behavior:** AuthorizationContext is evidence presented to the domain, not a trusted bypass token. Authorization must be revalidated at execution time.

### 4. Action withdrawn vs record retracted

The person decides not to pursue an Action anymore.

**Result:** `intentState = WITHDRAWN` is correct. `RecordLifecycle = RETRACTED` would mean the record itself should no longer be treated as a valid canonical representation. These meanings must remain distinct.

### 5. Historical reference intentionally deleted

Privacy policy removes the underlying content that a historical RecordVersionRef once addressed.

**Problem:** “must remain resolvable” cannot mean indefinite content retention.

**Change:** define reference resolution states. A version reference may resolve to content, redaction/deletion tombstone, unavailable source, or missing/corrupt reference. The failure mode must be explicit.

### 6. Projection source becomes superseded

A weekly metric used PracticeSession version `v1`; the session is corrected to `v2`.

**Required behavior:** the projection must not remain silently current. It must be invalidated/recomputed or visibly stale.

**Change:** add invariant; exact cache invalidation mechanism belongs in projection runtime/domain protocol.

### 7. Domain commit succeeds but DomainChange publication fails

Canonical truth changes, but the projection engine never learns about it.

**Finding:** this is not solved by the `DomainChange` payload. The domain protocol must require transactionally reliable publication (outbox or equivalent) and idempotent consumers.

No new object primitive required yet.

### 8. A command changes three records atomically

One practice correction supersedes a session, creates a corrected version, and retracts a bad observation.

**Result:** `DomainChange.affected[]` and `CommandReceipt.affectedRefs[]` can represent this. The domain protocol must define atomicity.

### 9. Practice duration conflicts with exact start/end

Session says 6:00–6:42 but `durationSeconds = 3000`.

**Finding:** duplicated factual representations can contradict each other. If both exact timing and explicit duration are present, the domain must validate consistency or designate one as derived/estimated.

No shared ontology change required.

### 10. Permission-restricted source feeds an unrestricted projection

A private health observation contributes to a general “energy” projection.

**Finding:** provenance alone does not prevent information leakage. Read/derivation authorization must propagate through composition. This belongs in the Domain/Intelligence protocols and later permission contracts.

## Reflection

The v0.5 contracts survive most semantic pressure. Remaining failures are now mostly about operational guarantees rather than missing ontology.

### Changes accepted for next contract version

- explicit Evidence target aspect;
- explicit reference-resolution result;
- idempotency conflict rule;
- execution-time authorization revalidation;
- projection invalidation requirement.

### Changes delegated to the next layer

- transactional DomainChange publication;
- atomic multi-record mutation;
- permission propagation;
- projection recomputation scheduling.

These are Domain Protocol/System Architecture responsibilities rather than reasons to inflate object contracts.