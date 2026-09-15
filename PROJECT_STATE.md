# Wayfinder — Project State / Chat Recovery

**Purpose:** This is the single recovery document to read first if a ChatGPT conversation runs out of space, context is lost, or work resumes in a new chat.

**Repository:** `firstrateent-star/wayfinder`  
**Current milestone:** Backend Slice 1A + Helm v0 executable  
**Current phase:** Begin thin frontend over the proven command/read API  
**Last architectural status:** Canon v0.7, with frontend architecture now being defined as the next candidate layer.

---

## 1. Root intent

Wayfinder is a personal Life OS expressed through an RPG-like experience, but the RPG is a projection layer rather than the source of truth.

Root proposition:

> A person exists through time, interacts with reality, forms intentions, takes actions, receives consequences, interprets experience, and changes as a result.

Core loop:

```text
REALITY
  ↓ observation
FACTS
  ↓ evidence
UNDERSTANDING
  ↙          ↘
DIRECTION   GROWTH
   \          /
      ACTION
        ↓
      REALITY
        ↺
```

Flower/Vlourish operates recursively across the loop and across architecture layers.

---

## 2. Non-negotiable architectural laws

1. Reality comes before interpretation.
2. Unknown is not zero.
3. Planned is not happened.
4. AI is non-authoritative over canonical reality.
5. Permanent growth requires evidence.
6. Derived state is disposable and reconstructable.
7. Meaning authored by the person is distinct from system interpretation.
8. Important conclusions must expose lineage.
9. Stateful modules own their canonical records; life domains own their factual reality.
10. The system models the person; it is not the person.

Additional executable rules now proven:

- authenticated clients cannot directly mutate private canonical tables;
- commands are the only application mutation path;
- command ids are idempotency/retry identities;
- same command id + different material content is a conflict;
- corrections create new versions and preserve old history;
- stale evidence remains explainable but is not counted as current;
- known temporal ranges use half-open `[start,end)` semantics;
- result completeness is not epistemic/lived-reality completeness;
- Action fulfillment is derived from Evidence, never stored as `completed=true`;
- Bearing is a projection, not a score or canonical fact;
- Helm is a composed read, not a persisted source-of-truth table.

---

## 3. Architecture that survived recursive stress testing

The system is organized in layers:

```text
8. EXPERIENCE
   Helm · Character · Journey · Atlas · Navigator

7. INTELLIGENCE
   Navigator · Flower · Reasoning · Context

6. PROJECTIONS
   State · Growth · Momentum · Patterns

5. EVIDENCE & RELATIONSHIPS

4. DIRECTION
   Values · Direction · Outcomes · Commitments · Quests · Plans · Actions

3. LIFE DOMAINS
   Practice first; later Body, Work, Money, Relationships, Creative, Home, etc.

2. REALITY KERNEL
   Events · observations · time · provenance

1. IDENTITY / SYSTEM KERNEL
   owner identity · permissions · ids · contracts
```

The implementation begins as a **modular monolith** on one Postgres/Supabase database.

---

## 4. Physical database host

The user chose to colocate Wayfinder in the existing `vlourish` Supabase project rather than create another project.

Wayfinder is isolated in dedicated top-level schemas:

```text
wf_system
wf_direction
wf_practice
wf_evidence
```

This is shared physical infrastructure, not shared canonical ownership. Wayfinder should not directly depend on `vl_*` canonical tables unless a future explicit integration contract is designed.

Canonical tables are private from normal `anon` / `authenticated` roles. Public RPCs are the application boundary.

---

## 5. Current Slice 1A physical model

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

No universal facts table, universal entity table, projection warehouse, Character table, XP table, Skills table, Calendar table, agent framework, or generic workflow engine exists yet.

---

## 6. Current public command API

Authenticated users mutate state only through typed RPCs:

```text
wf_ensure_owner
wf_direction_create_node
wf_direction_create_edge
wf_practice_create
wf_practice_log_session
wf_practice_correct_session
wf_evidence_create_fulfillment_link
```

Write execution model:

```text
AUTHENTICATED USER
       ↓
TYPED COMMAND RPC
       ↓
auth.uid() → owner
       ↓
command-id claim / idempotency
       ↓
validation + authorization
       ↓
OWNING MODULE
       ↓
canonical write
       ├── command receipt
       └── module-change outbox
```

Direct frontend writes to private `wf_*` tables are forbidden.

---

## 7. Current public read / projection API

Base reads:

```text
wf_direction_current()
wf_practice_recent(from, to, limit)
wf_evidence_for_target(action_id, action_version, limit)
```

Projection/composed reads:

```text
wf_action_fulfillment_v0(action_id)
wf_bearing_v0()
wf_helm_v0(from, to, session_limit)
```

### Action Fulfillment v0

Current states:

```text
CURRENT_EVIDENCE_PRESENT
STALE_RECORDED_EVIDENCE_ONLY
NO_RECORDED_EVIDENCE
```

It exposes exact EvidenceLink + PracticeSession version lineage.

### Bearing v0

Current broad states:

```text
NO_ACTIVE_ACTIONS
RECORDED_EVIDENCE_OF_MOVEMENT
NO_RECORDED_EVIDENCE_OF_MOVEMENT
```

Bearing is intentionally not a percentage or score. It distinguishes structural Direction from currently active Direction and exposes evidence lineage.

### Helm v0

Helm is the current composed answer to “Where am I?”

It combines:

```text
scope [from,to)
Direction current graph
Bearing v0
recent Practice sessions
coverage metadata
```

Helm is recomputable. No Helm table exists.

---

## 8. Executable tests already passed

### Command/write gate

Live transactional tests against real Postgres passed:

- owner bootstrap;
- Direction/Outcome/Action creation;
- Direction SUPPORTS edges;
- Practice creation;
- PracticeSession creation;
- true retry does not duplicate state;
- same command id + changed payload raises `COMMAND_ID_CONFLICT`;
- fulfillment Evidence creation;
- semantic duplicate Evidence becomes NOOP;
- PracticeSession correction creates v2, supersedes v1, advances current head;
- stale correction returns `REJECTED / STALE_VERSION`;
- invalid precision rejected;
- exact interval/duration mismatch rejected;
- null command id rejected;
- direct authenticated access to private Wayfinder tables denied;
- cross-owner command isolation passed;
- only APPLIED canonical changes emit ModuleChange rows.

### Read gate

Live read testing passed attacks on:

- temporal boundaries under `[start,end)`;
- owner isolation;
- stale Evidence;
- empty results;
- result-limit behavior;
- result coverage vs epistemic coverage.

### Projection gate

Live tests passed for:

- Action Fulfillment v0;
- stale-only evidence state;
- Bearing v0;
- evidence lineage in Bearing;
- filtering paused Direction targets from current Bearing movement;
- Helm v0 under the normal authenticated execution path.

---

## 9. Important conceptual discoveries from the recursive Flower process

### Artifact was not a root primitive

Artifact-like outputs are Entities, so `Artifact` was removed as a root ontology primitive.

### Relation and Commitment were missing

`Relation` became a Reality primitive for factual relationships. `Commitment` became a Direction primitive so obligation/promise does not collapse into desired Outcome.

### RecordRef vs RecordVersionRef

`RecordRef` addresses logical identity. `RecordVersionRef` addresses an exact historical representation. Evidence/derivations use exact version refs when historical truth matters.

### Direction graph vs Evidence graph

```text
ACTION ──SUPPORTS──> OUTCOME
```

is Direction structure.

```text
PRACTICE SESSION ──SUPPORTS──> ACTION FULFILLMENT
```

is Evidence.

These are deliberately different graph semantics.

### Empty database result is not lived-life absence

“No PracticeSession records are stored in this Wayfinder scope” is valid.

“You did not practice” is not justified unless appropriate evidence/coverage exists.

### Derived descendants do not create independent evidence mass

If one lived occurrence produces a metric, signal, pattern, and growth projection, those descendants must preserve ancestry and cannot all be naïvely counted as independent evidence.

### Shared host does not imply shared canon

Wayfinder lives physically inside the Vlourish Supabase host, but its canon remains isolated in `wf_*` schemas.

---

## 10. Current GitHub architecture documents

Key documents, in reading order:

```text
docs/CANON.md
docs/00-constitution.md
docs/01-ontology.md
docs/02-system-architecture.md
docs/03-object-contracts.md
docs/04-domain-protocol.md
docs/05-intelligence-runtime.md
docs/06-build-roadmap.md
docs/07-glossary.md
docs/08-validation-loop.md
docs/09-first-vertical-slice.md
docs/10-physical-schema.md
docs/11-database-bootstrap.md
docs/12-command-api.md
docs/13-projection-reads.md
```

The `lab/` directory contains the recursive stress-test history. The `decisions/` directory contains ADRs so architecture changes preserve reasoning history rather than rewriting it.

---

## 11. Current Supabase migration lineage

Repository path: `supabase/migrations/`

Current progression includes:

```text
bootstrap_wayfinder_namespaces
create_wayfinder_slice1_core
harden_wayfinder_version_heads
index_wayfinder_foreign_keys
add_wayfinder_command_runtime
add_wayfinder_slice1_commands
harden_wayfinder_command_validation
add_wayfinder_slice1_reads
harden_wayfinder_read_coverage
add_wayfinder_projection_reads_v0
harden_wayfinder_bearing_explainability
```

Exact timestamped files in the repository are authoritative.

---

## 12. Current security posture

The frontend is not allowed to access private tables directly.

Public RPCs are `SECURITY DEFINER` boundaries. Supabase linter warns when authenticated users can execute SECURITY DEFINER functions. For Wayfinder this is intentional because those RPCs are the designed application boundary.

Every exposed RPC must continue to satisfy:

```text
fixed/hardened search_path
fully qualified private object access
auth.uid() owner derivation
owner-scoped reads/writes
anon denied
cross-owner tests
no client-supplied owner authority
```

Do not “fix” the linter warning by exposing canonical tables.

---

## 13. Next build — frontend

The next layer should be a **thin web client**, not another architectural backend rewrite.

Recommended stack:

```text
React
TypeScript
Vite
Tailwind CSS
shadcn/ui
@supabase/supabase-js
```

Repository location:

```text
apps/web/
```

The frontend should call only public Wayfinder RPCs and Supabase Auth. It must not know how `wf_*` tables are shaped internally.

The first UI should be intentionally small:

```text
Auth / owner bootstrap
        ↓
Helm screen
        ├── Bearing summary
        ├── active Direction / Actions
        ├── recent Practice
        └── evidence state

Quick capture
        ├── create Direction/Outcome/Action
        ├── create Practice
        ├── log PracticeSession
        └── attach fulfillment Evidence
```

No Character/XP system should be invented in the frontend yet.

Lovable may be used later as a **UI/code-generation accelerator**, but it must not become the architectural authority. Any Lovable-generated code should live in this GitHub repository and obey the same RPC-only boundary.

---

## 14. Exact next move if context is lost

If a new chat starts, tell the assistant:

> Open `PROJECT_STATE.md` in `firstrateent-star/wayfinder`, then read `docs/CANON.md` and `docs/14-frontend-architecture.md`. Continue from the frontend scaffold. Do not merge or reuse the old Wayfinder architecture. Preserve the command-only write boundary and the recursive Flower/stress-test methodology.

Then the implementation order is:

```text
1. scaffold apps/web
2. Supabase client + auth session
3. owner bootstrap
4. typed RPC adapter layer
5. Helm v0 screen
6. quick-capture commands
7. frontend boundary tests
8. Flower/stress-test UI semantics against backend invariants
9. only then expand Journey / Direction / Character surfaces
```

---

## 15. Permanent process

Every layer follows:

```text
DESIGN
  ↓
FLOWER
  ↓
STRESS TEST
  ↓
CHANGE
  ↓
FLOWER AGAIN
  ↓
STRESS TEST AGAIN
  ↓
STABLE?
  ├── NO → recurse
  └── YES
        ↓
      BUILD
        ↓
   REAL EVIDENCE
        ↓
   FLOWER AGAIN
        ↺
```

A layer is never considered eternally “finished.” It is considered stable enough to expose to the next evidence source.
