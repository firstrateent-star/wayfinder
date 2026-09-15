# Live Slice Flower v0.1

**Status:** CANDIDATE-STABLE backend hardening; browser validation of the new evidence/correction controls is next.  
**Evidence source:** first real authenticated use of the deployed Wayfinder web client.  
**Scope:** Practice capture, Direction capture, Evidence attachment, correction lineage, Bearing, and failure recovery.

## Why this Flower exists

The first live user session produced evidence that our backend concepts were stronger than our first client workflow boundary.

Two important failures surfaced:

1. deferred version-head constraint triggers executed after the public SECURITY DEFINER RPC returned, so they inherited the authenticated caller's restricted schema permissions and failed with `42501` against private `wf_practice` / `wf_direction` schemas;
2. the original Practice UI implemented one human intent — “record a practice session” — as two independently committed commands (`practice.create` then `practice.log_session`), so a failure between those commands could leave a Practice without its intended session.

The trigger-permission failure was fixed in `20260915071600_secure_deferred_version_head_triggers.sql`. This Flower addresses the deeper workflow boundary revealed by the partial writes.

## Root question

> What must be true for one human capture action to remain trustworthy when the network, browser, API layer, validation, concurrency, or a later step fails?

## Flower dimensions

### 1. Authority

Canonical reality remains owned by the backend module. The browser may collect intent and request a command, but it must not become the workflow authority.

**Surviving rule:** one user-facing save operation should correspond to one authoritative command whenever the user experiences it as one indivisible action.

### 2. Atomicity

The old Practice capture path was:

```text
UI intent
  ↓
create Practice     ← commit A
  ↓
log Session         ← commit B
```

That shape admits the partial state `Practice exists AND intended Session does not`.

The hardened path is:

```text
UI intent
  ↓
wf_practice_capture_session(command_id, ...)
  ↓
validate whole intent
  ↓
resolve/create Practice
  ↓
create Session + SessionVersion
  ↓
advance current version head
  ↓
complete receipt + outbox
  ↓
COMMIT ALL OR ROLLBACK ALL
```

Direction capture now follows the same rule for `node + optional SUPPORTS edge` through `wf_direction_capture_node`.

### 3. Idempotency

A retry must not become a second event.

For a command identity `c` and normalized material request `r`:

```text
F(c, r) = terminal receipt
F(c, r) again = same terminal receipt, replayed=true
F(c, r2) where r2 != r = COMMAND_ID_CONFLICT
```

The frontend retains the command UUID across retry while material input is unchanged and discards it when material input changes.

### 4. Practice duplicate semantics

A live failure created multiple active Practice rows with names differing only by case. Silently deleting them would destroy evidence of what actually happened during testing.

The new rule is deliberately narrow:

```text
same owner
AND active Practice
AND lower(trim(name)) is exactly equal
→ resolve/reuse one preferred Practice for future capture
```

This is **not** fuzzy semantic deduplication. “Run” and “Running” are not assumed identical. Existing duplicates remain preserved until an explicit lifecycle/cleanup command exists.

Concurrent same-name create/capture requests are serialized with a transaction-scoped advisory lock derived from owner + normalized exact name.

Preference among already-existing duplicates is deterministic:

1. prefer a Practice already referenced by a current active session;
2. then older `created_at`;
3. then id as a deterministic tie-breaker.

`wf_practice_create` now returns `NOOP` with the preferred existing Practice ref for an exact normalized duplicate instead of creating another row.

### 5. Catalog vs activity

The first UI inferred “known Practices” from recent PracticeSessions. That is structurally wrong: a Practice may exist without a session in the selected time window.

New read:

```text
wf_practice_catalog_v0()
```

It reads active stored Practice records directly and reports:

- active stored records;
- active session count per Practice;
- exact normalized-name duplicate group information;
- one `capture_preferred` record per normalized name;
- COMPLETE coverage of the stored active Practice query;
- UNKNOWN epistemic coverage of all practices in lived reality.

`wf_helm_v0` v0.2 now composes this catalog separately from recent Practice activity.

### 6. Evidence

PracticeSession and Action remain independent facts/intents until the user explicitly records a relationship.

The UI now exposes the existing canonical command:

```text
PracticeSession@version
       ↓ SUPPORTS fulfillment
Action@version
```

The link is exact-version evidence. It does not set `completed=true`, does not rewrite Action state, and does not claim outcome achievement.

### 7. Correction

Correction creates a new PracticeSession version. Evidence does not silently migrate.

```text
Session v1 ──evidence──> Action v1
    ↓ correction
Session v2

Evidence to v1 remains historical/stale.
```

This makes correction behavior explainable and preserves historical truth. The new UI only permits duration editing where the record has an exact INSTANT→INSTANT bounded range; coarse temporal records do not gain invented precision.

### 8. Bearing

Bearing remains descriptive rather than numeric.

Expected state transition:

```text
active Action + no evidence
→ NO_RECORDED_EVIDENCE_OF_MOVEMENT

attach current exact evidence
→ RECORDED_EVIDENCE_OF_MOVEMENT

correct source Session without relinking
→ source evidence becomes stale
→ NO_RECORDED_EVIDENCE_OF_MOVEMENT
```

The stale link remains visible as historical evidence rather than disappearing.

### 9. Coverage

Three different statements must never collapse into one:

```text
query returned no rows
≠ database contains no relevant rows outside query scope
≠ event did not happen in lived reality
```

Practice catalog completeness is about stored active Practice records. Recent Practice result coverage is about the selected time/query window. Lived-reality coverage remains UNKNOWN.

### 10. Security boundary

The fix does **not** grant authenticated users direct access to private canonical schemas.

The intended path remains:

```text
authenticated browser
  ↓
public SECURITY DEFINER RPC
  ↓
private wf_* canonical module
  ↓
constraint / trigger validation
  ↓
commit
```

Deferred integrity trigger functions themselves require SECURITY DEFINER because they execute at transaction end after the outer RPC's definer context has returned.

### 11. Mathematics / formal invariants

**Atomic user intent**

For capture transaction `T` with required canonical writes `W={w1..wn}`:

```text
commit(T) ⇒ all(W)
¬all(W) ⇒ rollback(T)
```

There is no accepted terminal state where only a strict subset of required writes survives.

**Exact-name equivalence for Practice reuse**

For active practices owned by the same owner:

```text
p ~ q iff lower(trim(p.name)) = lower(trim(q.name))
```

This equivalence is intentionally lexical, not semantic.

**Evidence lineage**

An evidence edge is a relation over exact record versions:

```text
E ⊆ PracticeSessionVersion × ActionVersion
```

Correction changes the source vertex rather than mutating the existing vertex, so old evidence cannot accidentally become evidence for the new representation.

**Coverage axes**

Result completeness and epistemic completeness are independent dimensions rather than a single scalar confidence score.

## Backend changes built from this Flower

### New command RPCs

```text
wf_practice_capture_session(...)
wf_direction_capture_node(...)
```

### Hardened command

```text
wf_practice_create(...)
```

Exact normalized active duplicates now return `NOOP` with the preferred existing ref.

### New read

```text
wf_practice_catalog_v0()
```

### Helm

```text
wf_helm_v0 rule_version = helm_v0.2
```

Now composes:

```text
Direction
Bearing
Practice catalog
Recent Practice
```

### Frontend

- Practice capture uses the atomic PracticeSession command.
- Direction capture uses the atomic node + optional relationship command.
- Practice selector uses the direct catalog instead of inferring Practices from recent sessions.
- Evidence attachment UI links exact current versions.
- Correction UI creates new PracticeSession versions and preserves stale lineage behavior.
- RPC errors expose backend message/code instead of collapsing to a generic failure.

## Live stress tests

All database tests below were executed inside transactions and rolled back so test fixtures did not become user history.

| Test | Result |
|---|---|
| Atomic new Practice + Session capture | PASS |
| Same command retry | PASS — same refs, `replayed=true` |
| Invalid occurrence with new Practice name | PASS — REJECTED and zero Practice residue |
| Exact normalized duplicate Practice create | PASS — `NOOP`, preferred existing ref returned |
| Atomic Direction node + SUPPORTS edge | PASS — both refs returned in one receipt |
| Invalid SUPPORTS target | PASS — zero Direction node residue |
| Evidence attachment | PASS — Bearing becomes `RECORDED_EVIDENCE_OF_MOVEMENT` |
| Correct evidence source Session | PASS — Bearing source state becomes `STALE_RECORDED_EVIDENCE_ONLY` |
| Stale source evidence count | PASS — historical link retained and counted stale |
| Helm v0.2 composition | PASS |
| Practice catalog duplicate visibility | PASS |

## What this Flower rejects

- client-side multi-command orchestration for one indivisible user save;
- fuzzy Practice deduplication;
- deleting historical duplicate test records merely to make the UI look cleaner;
- moving Evidence links to a corrected record version automatically;
- converting evidence into a boolean Action completion field;
- claiming no lived practice because a catalog/session query is empty;
- solving private-schema trigger failures by opening canonical tables to authenticated clients.

## Open edges

1. Historical duplicate Practice rows from the pre-atomic live test remain preserved. A future explicit retraction/merge workflow may resolve them without falsifying history.
2. Browser-live validation of the new atomic capture, evidence attachment, correction, and stale-evidence presentation is the next evidence source.
3. Action/Direction correction and intent lifecycle controls are not yet exposed in the UI.
4. Evidence retraction/qualification UI is not yet exposed.
5. Only after the complete reality → evidence → correction → projection loop survives real use should Journey/Character/Navigator depend on it.

## Next gate

```text
REAL BROWSER
  ↓
record PracticeSession atomically
  ↓
create Action atomically
  ↓
attach evidence
  ↓
confirm Bearing transition
  ↓
correct PracticeSession
  ↓
confirm evidence becomes stale
  ↓
re-link corrected version
  ↓
confirm Bearing returns to current recorded movement
  ↓
FLOWER AGAIN
```
