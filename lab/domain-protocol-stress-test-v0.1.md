# Domain Protocol Stress Test — v0.1

**Target:** `docs/04-domain-protocol.md` v0.1  
**Result:** protocol needs operational strengthening before database design

## 1. Practice write succeeds but projection notification is lost

The session transaction commits, then the process crashes before publishing a DomainChange.

**Failure:** canonical truth and derived state silently diverge.

**Required protocol:** canonical mutation and durable DomainChange/outbox append are coupled atomically (transactional outbox or equivalent). Delivery may be at-least-once, so consumers must be idempotent.

## 2. Connector is down but historical reads are healthy

Finance sync is unavailable, but previously persisted transactions are readable.

**Failure:** domain-level healthy/unhealthy is too coarse.

**Required protocol:** readiness is capability/dependency scoped. Reads, writes, sync, reference resolution, and optional derived capabilities can differ in readiness.

## 3. UI wants a bounded read

The caller asks for Practice sessions this week.

**Failure:** current protocol says “bounded reads” but does not require returned coverage/as-of metadata.

**Required protocol:** read results that can imply absence expose Coverage and evaluation time when relevant.

## 4. Another domain needs a PracticeSession

Creative wants to reference a PracticeSession.

**Boundary:** it must resolve through a reference/read contract, not query Practice tables directly.

**Required protocol:** every externally referenceable record has a resolver capable of stable/current and version-specific resolution under authorization.

## 5. Cross-domain evidence

Training suggests that an Event supports a Direction Outcome.

**Boundary:** Training must not write the Evidence store directly.

**Required protocol:** domains may emit evidence candidates/suggestions or commands to the owning core capability; cross-domain shared records still have one owner.

## 6. One user action spans multiple domains

A paid performance should create Creative, Work, and Finance consequences.

**Finding:** one domain must not mutate all three. A system-level orchestrator may issue separate commands and coordinate eventual completion. Do not require a distributed cross-domain transaction.

## 7. Same external transaction imported twice

Distinct import runs create different Command ids for the same bank transaction.

**Required protocol:** semantic deduplication is domain-owned using source/external identity or domain-specific uniqueness rules. Command idempotency is not semantic dedupe.

## 8. Correction requires historical explanation

A session is corrected after it fed a projection.

**Required protocol:** domain resolution must preserve version-addressable history/tombstones sufficient for lineage rules and publish a change that invalidates dependents.

## 9. Private data feeds a broad read model

A protected record contributes to a projection.

**Failure:** current protocol does not state that derivations/reads must honor source authorization.

**Required protocol:** derived access cannot silently become broader than the source lineage unless an explicit policy allows a safe aggregate.

## 10. Domain implementation evolves

A domain upgrades internal schema and rules.

**Required protocol:** module identity/version is not enough by itself. Stable public record/reference/command/read identifiers cannot be silently renamed when implementation details change.

## Reflection

The domain boundary is correct. The weakness is not ontology; it is missing operational law around transactionality, readiness, reference resolution, permissions, and public contract stability.

Revise the protocol, then repeat.