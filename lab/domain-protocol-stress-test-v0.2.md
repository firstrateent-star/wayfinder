# Domain Protocol Stress Test — v0.2

**Target:** `docs/04-domain-protocol.md` v0.2  
**Result:** architecture holds; several boundary clarifications required

## 1. DomainChanges arrive out of order

A consumer receives a later correction notification before an earlier creation notification.

**Potential trap:** treating DomainChange as an event-sourcing log would allow out-of-order delivery to reconstruct the wrong world.

**Boundary:** DomainChange is a durable invalidation/change-notification stream, not automatically the canonical history ledger. Consumers that need current truth resolve current records/read models after notification. A domain may later offer an ordered replay contract explicitly, but core architecture must not assume one.

No sequence field is required for the first slice.

## 2. Projection consumer crashes mid-processing

The same outbox change is delivered again.

**Pass:** at-least-once delivery plus consumer idempotency handles this. The projection consumer must key processed work by DomainChange id or otherwise make recomputation idempotent.

## 3. Domain is disabled after durable records exist

A user disables a domain feature but old evidence still references historical records.

**Problem:** `lifecycle = disabled` cannot mean “references stop resolving.”

**Rule:** disabling active behavior must not orphan durable history. Historical resolver compatibility, explicit migration, or tombstone resolution remains available.

## 4. Schema migration changes internal tables

The domain implementation replaces its persistence layout.

**Rule:** internal schema may change; public RecordRefs/RecordVersionRefs and historical resolution semantics must survive or be explicitly migrated. Implementation convenience cannot silently invalidate lineage.

## 5. Derived consumer wants to “fix” a life-domain record

A Character projection decides a PracticeSession is inconsistent and writes back to Practice.

**Failure:** this creates feedback loops where derived interpretation mutates source truth.

**Rule:** derivation/projection consumers are read-only with respect to life-domain canonical facts. They may raise a proposal/command for authorized handling; they do not silently self-correct source domains.

## 6. Materialized read joins domain tables directly

A fast Helm query bypasses the Practice read contract and directly joins internal tables.

**Risk:** UI/read-model implementation becomes coupled to private schemas and bypasses coverage/permission rules.

**Rule:** cross-domain/read-model composition consumes public read/reference contracts or explicitly exported stable views, not private tables.

## 7. Command applies but receipt response is lost

Client retries the same Command id.

**Pass:** command identity and durable command result semantics allow same logical receipt without duplicate effects.

## 8. Domain sync is degraded, persisted history healthy

**Pass:** capability-scoped readiness handles this.

## 9. Cross-domain workflow partially succeeds

Creative succeeds; Finance fails.

**Pass with explicit boundary:** orchestrator must surface partial completion and retry/compensate intentionally. Domain protocol must not imply a distributed transaction occurred.

## 10. Evidence service is unavailable

Practice logging still succeeds; evidence linkage is delayed.

**Pass:** optional shared capability failure does not invalidate Practice truth. Derived/shared work is eventually consistent.

## Reflection

No new ontology or object-contract primitive is required. The main remaining risk is architectural misuse: treating change notifications as canonical replay, allowing derived write-back, or bypassing domain reads for convenience.

Apply these laws and run a convergence pass.