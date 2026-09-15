# Domain Protocol Stress Test — v0.3 Convergence Pass

**Target:** `docs/04-domain-protocol.md` v0.3  
**Result:** domain protocol stability gate passed for the first executable slice

## Pressure matrix

### Practice create/correct/read

Create, retry, correct with version precondition, read current, resolve old version.

**Pass.** Ownership, version resolution, correction lineage, command retry, and bounded reads have explicit seams.

### Domain outage isolation

Practice AI helper fails while persisted Practice reads/writes remain healthy.

**Pass.** Capability-scoped readiness avoids global false failure.

### Lost publisher process

Canonical transaction commits and process dies before external delivery.

**Pass.** Transactional outbox/equivalent preserves DomainChange durability.

### Duplicate/out-of-order notification

Projection consumer sees duplicate or reordered DomainChanges.

**Pass.** Consumers are idempotent and DomainChange is treated as invalidation/change notification, not an assumed ordered event-sourcing ledger. Current truth is re-resolved when needed.

### Internal schema rewrite

Practice tables are redesigned after evidence already references old sessions.

**Pass.** Public refs/version resolution must survive or explicitly migrate/tombstone.

### Derived feedback loop

Character detects a pattern and tries to edit Practice history.

**Pass.** Derived systems are read-only toward source truth; correction requires an authorized source-domain command.

### Cross-domain workflow partial failure

Creative succeeds while Finance fails.

**Pass.** Orchestration exposes partial completion; no fake distributed transaction.

### Cross-domain performance shortcut

Helm wants to directly join all private tables.

**Pass.** Stable public read/reference contracts or exported views preserve boundaries.

### Disabled domain with historical lineage

Feature is disabled but old evidence points to its records.

**Pass.** disabling behavior cannot orphan durable history.

### Semantic duplicate import

Same external item arrives through separate commands.

**Pass.** owning domain handles semantic dedupe; command id handles transport retry only.

### Permission-sensitive derivation

Restricted source feeds a broader projection.

**Pass at architecture boundary.** privilege widening is explicitly prohibited; exact inheritance mechanics remain a later permission-contract task and are not required for the single-owner Practice slice.

### External side effects

Future domains may eventually trigger irreversible external actions (payments, messages, bookings).

**Boundary:** those require additional execution/confirmation/compensation contracts and are not smuggled into the first life-domain protocol. No need to solve them before Practice.

## Convergence result

- New root ontology primitives required: **0**
- Object contract reopen required: **0**
- Blocking transaction ambiguity: **0**
- Blocking reference ambiguity: **0**
- Blocking readiness ambiguity: **0**
- Blocking first-slice cross-domain issue: **0**

The protocol is stable enough to support first-schema design, but the recursive process should now pressure-test the **System Architecture and first vertical-slice boundary together** before database tables are created.

**DOMAIN PROTOCOL STABILITY GATE: PASSED**