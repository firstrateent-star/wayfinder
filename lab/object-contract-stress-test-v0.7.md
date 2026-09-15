# Object Contract Stress Test — v0.7 Convergence Pass

**Target:** `docs/03-object-contracts.md` v0.7  
**Result:** contract stability gate passed for the first executable slice

## Pressure matrix

### Create → retry → receipt

A user creates a PracticeSession, the network times out, and the client retries the exact same Command id.

**Pass:** Command id is the retry identity; receipt/effects remain singular.

### Conflicting replay

The same Command id is reused with a changed duration.

**Pass:** contract requires conflict rejection.

### Concurrent correction

Two clients correct the same session version.

**Pass:** version preconditions detect the stale writer.

### Correction after derivation

Session v1 fed a projection; v2 supersedes it.

**Pass:** lineage points to v1 and the projection must be recomputed/invalidated rather than silently treated as current.

### Large derivation

A future annual finance projection consumes hundreds of thousands of records.

**Pass:** immutable lineage manifest seam avoids unbounded inline refs without weakening historical ancestry.

### Open-ended State

A project is known active today but has no known end date.

**Pass:** OPEN and UNKNOWN temporal boundaries are distinct.

### Partial source coverage

A connector covers only part of the requested interval.

**Pass:** absence cannot be inferred outside the exact Coverage scope.

### AI proposal after permission revocation

Proposal survives longer than authorization.

**Pass:** domain must revalidate AuthorizationContext at execution.

### Cross-user ownership

Two owners have similar domain records.

**Pass:** owner scope is explicit in record, command, and domain-change envelopes while global record ids remain collision-resistant.

### Direction fulfillment

An Action exists but never occurred.

**Pass:** intent state cannot manufacture occurrence or fulfillment.

### Same-world occurrence touches multiple domains

A paid performance affects Creative, Work, Finance, and Relationships.

**Pass:** no universal Event table required; domains can reference shared occurrence/equivalence lineage.

### Privacy deletion

A historical source is deleted under policy.

**Pass:** historical reference can resolve to explicit deletion/redaction rather than becoming invisible corruption.

### Projection used as evidence

An interpretation references a Character/metric projection.

**Pass with boundary:** only a version-addressable projection may participate in durable evidence/lineage. Ephemeral UI-only projections must not be referenced as if historically resolvable.

### Direction node edited after evidence linkage

Outcome wording changes after evidence was linked to the prior version.

**Pass:** evidence remains historically attached to the exact target version. Re-evaluation may explicitly carry/recreate evidence for the new version; it is not silently inherited across potentially semantic changes.

## Final contract invariants surfaced

1. Anything placed in durable evidence/provenance lineage must be version-addressable.
2. An ephemeral projection cannot become durable evidence without a resolvable snapshot/version.
3. Evidence does not automatically carry across target revisions.
4. Direction node `kind` is part of stable record semantics; materially changing kind should normally create/supersede a record rather than mutate identity in place.

## Convergence result

- New root ontology primitives required: **0**
- New shared contract families required: **0**
- Blocking authority ambiguity: **0**
- Blocking time ambiguity: **0**
- Blocking correction/lineage ambiguity: **0**
- Blocking first-slice scalability issue: **0**

The object contracts are not “finished.” They are stable enough that the Domain Protocol can now be pressure-tested against them.

**OBJECT CONTRACT STABILITY GATE: PASSED**