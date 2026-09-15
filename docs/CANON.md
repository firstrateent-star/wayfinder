# Wayfinder Canon

**Foundation version:** 0.9  
**Status:** Active bootstrap canon with live deployed Slice 1A + Helm v0.2  
**Purpose:** Define what Wayfinder currently depends on being true.

Wayfinder is an evidence-grounded personal life navigation operating system. It models a person's relationship with lived reality, chosen direction, commitments, action, evidence, interpretation, and growth over time.

The RPG is a representation layer. It is not the source of truth.

## Canon status vocabulary

- **CANONICAL** — architecture may depend on this.
- **CANDIDATE-STABLE** — repeatedly stress-tested and supported by enough evidence for the next layer to depend on provisionally.
- **CANDIDATE** — defined enough to test, but not yet stable.
- **EXPERIMENTAL** — intentionally open for exploration.
- **SUPERSEDED** — retained for reasoning history but no longer authoritative.

## Current registry

| Area | Status | Canon source |
|---|---|---|
| Constitution | CANONICAL | `00-constitution.md` |
| Root ontology v0.3 | CANONICAL / STABILITY GATE PASSED | `01-ontology.md` |
| System architecture v0.4 | CANDIDATE-STABLE / GATE PASSED | `02-system-architecture.md` |
| Object contracts v0.9 | CANDIDATE-STABLE / GATE PASSED | `03-object-contracts.md` |
| Stateful Module Protocol v0.4 | CANDIDATE-STABLE / GATE PASSED | `04-domain-protocol.md` |
| Intelligence runtime | EXPERIMENTAL | `05-intelligence-runtime.md` |
| Build roadmap | CANDIDATE | `06-build-roadmap.md` |
| Recursive validation loop | CANDIDATE-STABLE | `08-validation-loop.md` |
| First executable vertical slice v0.2 | CANDIDATE-STABLE / GATE PASSED | `09-first-vertical-slice.md` |
| Physical schema v0.5 | CANDIDATE-STABLE / GATE PASSED | `10-physical-schema.md` |
| Database bootstrap | DEPLOYED | `11-database-bootstrap.md` |
| Command API | DEPLOYED / LIVE WRITE GATE PASSED | `12-command-api.md` |
| Slice 1A read API | DEPLOYED / READ GATE PASSED | migrations + live tests |
| Projection reads v0 | DEPLOYED / PROJECTION READ GATE PASSED | `13-projection-reads.md` |
| Frontend architecture v0.1 | CANDIDATE-STABLE / LIVE DEPLOYED | `14-frontend-architecture.md` |
| Web client v0.1 | LIVE AUTH + HELM + FIRST WRITES PROVEN | `15-web-client-v0.1.md` |
| Live Slice Flower | CANDIDATE-STABLE | `lab/live-slice-flower-v0.1.md` |
| Character system | EXPERIMENTAL | Lab |
| Archetypes | EXPERIMENTAL | Lab |
| Skills/mastery | EXPERIMENTAL | Lab |
| Astrology | EXPERIMENTAL / domain candidate | Lab |
| Atlas/world model | EXPERIMENTAL | Lab |
| Agent autonomy | EXPERIMENTAL | Lab |

## Root definition

> Wayfinder turns lived reality into understandable state, intentional direction, meaningful action, evidence of change, and accumulated personal growth.

## Root laws

1. Reality comes before interpretation.
2. Unknown is not zero.
3. Planned is not happened.
4. AI is not authoritative over canonical reality.
5. Permanent growth requires evidence.
6. Derived state is disposable and reconstructable.
7. Meaning authored by the person is distinct from system interpretation.
8. Important derived conclusions must expose lineage.
9. Stateful modules own their canonical records; life domains own their factual reality.
10. The system models the person; it is not the person.
11. **When a person experiences a save as one indivisible act, required canonical writes should share one authoritative transaction.**

## Accepted architecture through live Slice 1A

- `RecordRef` addresses logical identity; `RecordVersionRef` addresses exact historical representation.
- Owner scope is explicit and distinct from subject.
- Known TemporalRanges use half-open `[start,end)` semantics.
- Canonical mutation is command-only and owner authorization is revalidated at execution.
- Command id is retry/idempotency identity; deterministic normalized material determines conflict identity.
- A user-facing atomic capture is not implemented as multiple independently committed client commands when partial state would contradict the user's intent.
- Correction preserves historical versions and rejects stale non-commutative writes.
- ModuleChange is durable change infrastructure, not lived-reality Event truth.
- Wayfinder is a modular monolith on one Postgres/Supabase host with isolated `wf_*` namespaces.
- Sharing the Vlourish physical host does not grant Vlourish canonical ownership over Wayfinder data.
- Evidence uses exact historical refs and does not silently migrate across correction.
- Operational change/result refs may use a plain RecordRef for intentionally unversioned records; durable evidence/derivation lineage remains version-addressed where history matters.
- Result completeness and epistemic coverage are separate axes.
- Fulfillment, Bearing, and Helm are projections/composed reads, not canonical truth stores.
- Practice catalog completeness concerns stored active Practice records only and does not imply complete capture of lived practices.
- Exact normalized Practice-name reuse is lexical (`lower(trim(name))`) rather than fuzzy/semantic identity.

See ADR-016 through ADR-026 and `lab/live-slice-flower-v0.1.md`.

## Deployed database

Wayfinder currently lives inside the existing `vlourish` Supabase project in isolated top-level schemas:

```text
wf_system
wf_direction
wf_practice
wf_evidence
```

Canonical Slice 1A tables:

```text
wf_system
├── owners
├── command_receipts
└── module_change_outbox

wf_direction
├── nodes
├── node_versions
└── edges

wf_practice
├── practices
├── sessions
└── session_versions

wf_evidence
└── links
```

Authenticated clients do not directly access canonical tables. Public typed RPCs form the application boundary.

## Live command/write evidence

Deployed lower-level commands include:

- `wf_ensure_owner`
- `wf_direction_create_node`
- `wf_direction_create_edge`
- `wf_practice_create`
- `wf_practice_log_session`
- `wf_practice_correct_session`
- `wf_evidence_create_fulfillment_link`

Live-use atomic capture commands now include:

- `wf_practice_capture_session`
- `wf_direction_capture_node`

`wf_practice_capture_session` validates the whole requested session before it can create a new Practice, then resolves/creates the Practice and writes the versioned PracticeSession in one transaction.

`wf_direction_capture_node` creates one Direction node and an optional Action SUPPORTS edge in one transaction.

`wf_practice_create` now resolves an exact case/whitespace-normalized active same-name Practice to a deterministic preferred record and returns `NOOP` instead of creating another duplicate. This is not fuzzy semantic dedupe.

Live transactional testing proved idempotent retries, command-id conflict detection, stale correction rejection, exact correction lineage, current/stale Evidence behavior, owner isolation, direct-table denial, atomic command/outbox behavior, atomic multi-record capture, no partial residue on validation failure, and deterministic same-name Practice reuse.

See:

- `lab/command-api-live-test-v0.1.md`
- `lab/live-slice-flower-v0.1.md`

## Live read evidence

Deployed base/current reads:

- `wf_direction_current()`
- `wf_practice_recent(from,to,limit)`
- `wf_practice_catalog_v0()`
- `wf_evidence_for_target(action_id,action_version,limit)`

`wf_practice_catalog_v0()` directly reads active stored Practice records. It exposes deterministic capture preference for historical exact-name duplicates while preserving every active record in the returned catalog.

Recursive live passes proved:

- half-open temporal boundaries;
- owner isolation;
- stale Evidence handling;
- empty stored-result semantics;
- result-limit behavior;
- separation of `result_coverage` from `epistemic_coverage`;
- stored Practice catalog completeness without claiming complete lived-reality coverage.

**READ GATE: PASSED**

See ADR-026 and:

- `lab/read-api-live-test-v0.1.md`
- `lab/read-api-live-test-v0.2-confirmation.md`
- `lab/live-slice-flower-v0.1.md`

## Live projection reads

Deployed:

- `wf_action_fulfillment_v0(action_id)`
- `wf_bearing_v0()`
- `wf_helm_v0(from,to,session_limit)`

Action Fulfillment states:

- `CURRENT_EVIDENCE_PRESENT`
- `STALE_RECORDED_EVIDENCE_ONLY`
- `NO_RECORDED_EVIDENCE`

Bearing states:

- `NO_ACTIVE_ACTIONS`
- `RECORDED_EVIDENCE_OF_MOVEMENT`
- `NO_RECORDED_EVIDENCE_OF_MOVEMENT`

Bearing deliberately does not manufacture a progress percentage. It exposes exact qualifying lineage and only presents SUPPORTS targets that are current ACTIVE intentions.

`wf_helm_v0` is currently rule version `helm_v0.2` and composes:

```text
Direction current
Bearing
Practice catalog
Recent Practice
```

The nested coverage/lineage semantics remain intact; Helm is not canonical history.

**PROJECTION READ GATE: PASSED**

See:

- `docs/13-projection-reads.md`
- `lab/projection-read-stress-test-v0.1.md`
- `lab/projection-read-stress-test-v0.2.md`
- `lab/projection-read-live-test-v0.1.md`
- `lab/live-slice-flower-v0.1.md`

## Security posture

The public authenticated Wayfinder RPCs are intentionally `SECURITY DEFINER` because the private `wf_*` schemas are not exposed to ordinary clients.

Each RPC must continue to:

- derive owner identity from `auth.uid()`;
- use fixed `search_path=pg_catalog`;
- fully qualify private objects;
- scope reads/writes by owner;
- deny anon unless explicitly justified;
- pass cross-owner tests.

A first real browser write revealed an important deferred-trigger rule: DEFERRABLE version-head constraint triggers execute at transaction end after the outer public RPC's definer context has returned. Because private schemas correctly deny direct authenticated access, the deferred integrity trigger functions themselves must run as SECURITY DEFINER.

Current deferred integrity functions:

```text
wf_direction.assert_node_head_integrity()   SECURITY DEFINER
wf_practice.assert_session_head_integrity() SECURITY DEFINER
```

This preserves the private-schema boundary; authenticated table/schema privileges were not broadened.

Supabase's security advisor intentionally warns that authenticated users can execute privileged public RPCs. This warning is accepted only because the functions are the designed privilege boundary and are continuously stress-tested. New public RPCs must receive the same review.

## Current implementation gate

### Status: **LIVE SLICE 1A + HELM v0.2 + FIRST REAL WRITES PROVEN; COMPLETE LOOP BROWSER GATE IN PROGRESS**

The deployed system can now answer or record, without a frontend inventing truth:

- What current Directions/Actions are recorded?
- What active stored Practices are recorded?
- What PracticeSessions are recorded in a declared time scope?
- What exact Evidence bears on an Action?
- Is that Evidence still current after correction?
- What is the current Action Fulfillment evidence state?
- Is there recorded evidence of movement across active Actions?
- What does the composed Helm view currently show?
- Can one Practice capture remain atomic across Practice + Session writes?
- Can one Direction capture remain atomic across Node + optional SUPPORTS edge?

Proven in the real browser so far:

```text
password auth          ✅
owner bootstrap        ✅
Helm load              ✅
PracticeSession write  ✅
Action write           ✅
```

Backend rollback/stress tests have additionally proven the new atomic capture, exact Evidence, correction → stale lineage, and Helm v0.2 behavior.

Still not authorized by default:

- Character/XP/skills persistence;
- speculative future domain tables;
- AI-authored canonical truth;
- frontend direct canonical-table writes;
- hidden dependencies on `vl_*` canonical tables;
- treating no stored record as proof no lived event occurred.

## Frontend boundary

The frontend is an Experience/Application layer, not a second domain model.

```text
React UI
   ↓
Wayfinder RPC adapter
   ↓
Supabase public RPC
   ↓
private wf_* module
```

The UI may collect intent, render state, and perform client-side usability validation, but canonical validation remains server-owned. The frontend must not call private `wf_*` tables directly.

Current deployed UI includes:

- Helm/Bearing/Direction/recent Practice;
- direct Practice catalog-backed selector;
- atomic Practice capture;
- atomic Direction capture;
- exact-version fulfillment Evidence attachment;
- PracticeSession correction with history preservation;
- retry-safe command identities;
- explicit result vs epistemic coverage language.

See:

- `docs/14-frontend-architecture.md`
- `docs/15-web-client-v0.1.md`

## Recovery / chat handoff

`PROJECT_STATE.md` at the repository root is the authoritative human-readable recovery checkpoint for continuing work in a new conversation. It summarizes the architecture, deployed backend, tests, migration lineage, current APIs, and exact next implementation sequence.

When a conversation loses context, read in this order:

1. `PROJECT_STATE.md`
2. `docs/CANON.md`
3. `docs/14-frontend-architecture.md`
4. `docs/15-web-client-v0.1.md`
5. `lab/live-slice-flower-v0.1.md`

## Next evidence source

The next evidence source is the complete loop through the deployed browser:

```text
atomic PracticeSession capture
↓
atomic Action capture
↓
attach exact Evidence
↓
observe Bearing current movement
↓
correct PracticeSession
↓
observe old Evidence become stale
↓
attach corrected exact version
↓
observe Bearing return to current recorded movement
↓
Flower again
```

Journey, Character, Navigator, and broader life domains should not materially depend on this layer until that browser loop survives real interaction.

## Change control

A change to Canon should update the relevant canonical document and, when it changes a durable architectural decision, add or supersede an ADR. Do not silently rewrite foundational reasoning.
