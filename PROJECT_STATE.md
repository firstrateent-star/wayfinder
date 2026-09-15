# Wayfinder — Project State / Chat Recovery

**Read this first if context is lost.**  
**Repository:** `firstrateent-star/wayfinder`  
**Current milestone:** live deployed Slice 1A + Helm v0.2 + atomic capture + Evidence/correction controls  
**Current phase:** browser-live validation of the complete reality → evidence → correction → projection loop  
**Canon:** `docs/CANON.md`  
**Frontend architecture:** `docs/14-frontend-architecture.md`  
**Latest live-use Flower:** `lab/live-slice-flower-v0.1.md`

---

## 1. Non-negotiable project direction

Wayfinder is being rebuilt from the ground up using the newer Vlourish / Flower architecture.

**Do not merge or migrate the old Wayfinder architecture into this system.** Old code may be read as research evidence only.

Wayfinder is a personal Life OS expressed through an RPG-like experience, but the RPG is a projection/experience layer rather than canonical truth.

Root proposition:

> A person exists through time, interacts with reality, forms intentions, takes actions, receives consequences, interprets experience, and changes as a result.

Core law:

```text
REALITY
  ↓
EVIDENCE
  ↓
UNDERSTANDING
 ↙          ↘
DIRECTION   GROWTH
    \       /
      ACTION
        ↓
      REALITY
        ↺
```

Flower/Vlourish recursively challenges every layer before the next layer depends on it.

## 2. Canonical laws

1. Reality before interpretation.
2. Unknown ≠ zero.
3. Planned ≠ happened.
4. AI is never authoritative over canonical reality.
5. Permanent growth requires evidence.
6. Derived state is disposable/reconstructable.
7. Human meaning stays distinct from system interpretation.
8. Important conclusions expose lineage.
9. Stateful modules own canonical records.
10. System models the person; it is not the person.
11. Cross-domain interaction uses explicit seams.
12. Authority and intelligence are separate.
13. Ontology stays smaller than life.
14. History is preserved while interpretation evolves.
15. Build through complete vertical slices.
16. **One indivisible user save should map to one atomic authoritative command.**

## 3. Architecture

```text
8 EXPERIENCE     Helm · Character · Journey · Atlas · Navigator
7 INTELLIGENCE   Navigator · Flower · reasoning · context
6 PROJECTIONS    state · growth · momentum · patterns
5 EVIDENCE       evidence + relationships
4 DIRECTION      values · directions · outcomes · commitments · quests · plans · actions
3 LIFE DOMAINS   Practice first; later Body/Work/Money/People/etc.
2 REALITY        events · observations · time · provenance
1 SYSTEM         owner identity · permissions · ids · contracts
```

Implementation is a modular monolith on one Postgres/Supabase host.

AI permissions remain:

```text
READ
PROPOSE
EXECUTE only through authorized command paths
```

## 4. Database host and private boundary

Supabase project:

```text
name: vlourish
project ref: ngakauhlcmvwnmimtsca
region: us-east-1
```

Wayfinder private namespaces:

```text
wf_system
wf_direction
wf_practice
wf_evidence
```

Existing Vlourish namespaces (`vl_*`) share physical infrastructure only. There is no implicit canonical ownership relationship.

Canonical tables:

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

Authenticated/anon clients cannot directly use the private canonical schemas.

## 5. Public command API

Lower-level approved commands:

```text
wf_ensure_owner
wf_direction_create_node
wf_direction_create_edge
wf_practice_create
wf_practice_log_session
wf_practice_correct_session
wf_evidence_create_fulfillment_link
```

Live UI atomic commands added after first real-use Flower:

```text
wf_practice_capture_session
wf_direction_capture_node
```

### Atomic Practice capture

`wf_practice_capture_session` validates the whole intended session **before** it creates a new Practice. It then resolves/creates the Practice and writes Session + SessionVersion in the same transaction.

This removed the old partial-commit shape:

```text
create Practice → commit
then log Session → possible failure
```

### Atomic Direction capture

`wf_direction_capture_node` creates the Direction node and optional Action SUPPORTS edge in one transaction.

### Exact-name Practice reuse

For future capture only, active Practices with the same owner and exact normalized name:

```text
lower(trim(name))
```

are treated as the same capture identity. This is lexical only, not fuzzy/AI semantic dedupe.

Concurrent same-name resolve/create is serialized by a transaction-scoped advisory lock.

Existing historical duplicate records are preserved until there is an explicit lifecycle/cleanup operation.

## 6. Versioning / evidence laws

- DirectionNode and PracticeSession are versioned.
- Practice is intentionally unversioned in Slice 1.
- Correction creates a new PracticeSession version.
- Evidence uses exact version refs.
- Evidence does not silently migrate across correction.
- Old evidence becomes historical/stale when its source version is no longer current.
- Action does not receive canonical `completed=true`.

Evidence shape:

```text
PracticeSession@exact_version
          ↓ SUPPORTS fulfillment
Action@exact_version
```

## 7. Public reads / projections

Base/current reads:

```text
wf_direction_current()
wf_practice_recent(from,to,limit)
wf_practice_catalog_v0()
wf_evidence_for_target(action_id,action_version,limit)
```

Derived reads:

```text
wf_action_fulfillment_v0(action_id)
wf_bearing_v0()
wf_helm_v0(from,to,session_limit)
```

### Practice catalog

`wf_practice_catalog_v0()` reads active stored Practice records directly instead of inferring known Practices from recent sessions.

It exposes:

- stored active Practice records;
- active-session count;
- duplicate exact-normalized-name group counts;
- one deterministic `capture_preferred` record per normalized name;
- COMPLETE result coverage for the stored catalog;
- UNKNOWN lived-reality epistemic coverage.

### Helm

Current rule version:

```text
helm_v0.2
```

Composition:

```text
Direction current
Bearing v0
Practice catalog
Recent Practice
```

Helm is derived/composed and is never canonical history.

## 8. First real browser session — proven

Production deployment is live on Vercel.

Auth sequence now works with a Supabase-created email/password user:

```text
password auth ✅
Supabase session ✅
wf_ensure_owner ✅
first Wayfinder owner ✅
Helm load ✅
PracticeSession write ✅
Action write ✅
```

Magic-link testing exposed email rate limits and redirect complexity; password auth is currently the reliable development path.

## 9. Important live bug found and fixed

The first real PracticeSession/Action writes failed with:

```text
permission denied for schema wf_practice
permission denied for schema wf_direction
SQLSTATE 42501
```

Root cause:

- public RPC runs SECURITY DEFINER;
- version-head integrity constraint triggers are DEFERRABLE INITIALLY DEFERRED;
- deferred triggers fire at transaction end after the outer RPC's definer context returns;
- authenticated role correctly lacks direct private-schema access;
- trigger function therefore failed as the invoker.

Fix:

```text
wf_direction.assert_node_head_integrity()  SECURITY DEFINER
wf_practice.assert_session_head_integrity() SECURITY DEFINER
```

Migration:

```text
20260915071600_secure_deferred_version_head_triggers.sql
```

Private schema access was **not** opened to clients.

## 10. Live-use Flower hardening built

Migration:

```text
20260915074000_harden_live_capture_workflows.sql
```

Adds/hardens:

```text
wf_practice_capture_session
wf_direction_capture_node
wf_practice_catalog_v0
wf_practice_create exact-name reuse
wf_helm_v0 → helm_v0.2
```

Detailed reasoning and tests:

```text
lab/live-slice-flower-v0.1.md
```

## 11. Backend stress tests after hardening

All destructive/live-shape tests were executed inside explicit transactions and rolled back.

Passed:

```text
atomic new Practice + Session             ✅
same command retry → same refs            ✅
replayed=true                             ✅
invalid occurrence → no Practice residue  ✅
normalized duplicate create → NOOP        ✅
atomic Direction node + SUPPORTS edge     ✅
invalid target → no node residue          ✅
Evidence attach → Bearing current         ✅
Session correction → evidence stale       ✅
stale evidence retained/explainable        ✅
Helm v0.2                                 ✅
Practice catalog                          ✅
```

## 12. Current live data caveat

The first failed browser attempts created several active Practice rows before Session creation failed. Current stored test history includes an exact normalized-name duplicate group for Music Production plus a Drawing Practice.

Do **not** silently delete these records.

The new catalog marks one record `capture_preferred`, and future same-name capture reuses it. A future explicit retraction/merge workflow can clean historical duplicate display state while preserving truth.

## 13. Frontend

Location:

```text
apps/web/
```

Stack:

```text
React
TypeScript
Vite
Tailwind
shadcn-style primitives
@supabase/supabase-js
react-router-dom
```

Frontend law:

> The client presents state, collects intent, calls commands, and requests projections. It does not establish canonical truth.

Boundary:

```text
React
  ↓
wayfinder-rpc.ts
  ↓
supabase.rpc(...)
  ↓
public Wayfinder RPC
  ↓
private wf_* modules
```

Boundary checker rejects direct Wayfinder table/schema access from frontend source.

## 14. Current frontend capabilities

```text
/login                         ✅
password auth                  ✅
magic-link path                present but not preferred for dev
owner bootstrap                ✅
/helm                          ✅
Bearing                        ✅
Direction current              ✅
Practice catalog               ✅
Recent Practice                ✅
Atomic Practice capture        ✅ deployed
Atomic Direction capture       ✅ deployed
Evidence attachment UI         ✅ deployed
Practice correction UI         ✅ deployed
RPC detailed errors            ✅
retry identity                 ✅
coverage language              ✅
```

Evidence UI records exact SessionVersion → ActionVersion lineage.

Correction UI preserves version history and only permits duration editing for exact INSTANT→INSTANT bounded temporal records.

## 15. Build/deploy status

Latest hardened web build has passed:

```text
frontend boundary check ✅
TypeScript               ✅
Vite build               ✅
GitHub Actions            ✅
Vercel deployment         ✅
```

## 16. What is intentionally not built yet

Do not jump ahead to:

- Character/XP persistence;
- universal Skills;
- astrology engine;
- Journey canonical model;
- Atlas/world model;
- AI canonical writes;
- direct private-table access;
- frontend-owned progress math;
- fake Action completion;
- claims that empty data means something did not happen in life.

Direction/Action correction/lifecycle controls and Evidence retraction/qualification controls are also not yet exposed.

## 17. Exact next move

**Do not redesign from theory first. Use the deployed app as the next evidence source.**

Browser-live gate:

```text
1. refresh deployed Wayfinder
2. confirm Practice selector reads catalog (not only sessions)
3. record a new PracticeSession using atomic capture
4. create Direction/Outcome/Quest if desired
5. create Action, optionally SUPPORTS a target
6. attach the PracticeSession as evidence for the Action
7. confirm Bearing → CURRENT_EVIDENCE_PRESENT / recorded movement
8. correct that PracticeSession
9. confirm Bearing shows historical/stale evidence rather than silently following correction
10. attach the corrected Session version
11. confirm Bearing returns to current recorded movement
12. Flower the lived UI and workflow again
```

Only after that loop survives browser use should Journey/Character/Navigator consume it.

## 18. Recovery prompt

If context is lost:

> Open `PROJECT_STATE.md` in `firstrateent-star/wayfinder`, then read `docs/CANON.md`, `docs/14-frontend-architecture.md`, `docs/15-web-client-v0.1.md`, and `lab/live-slice-flower-v0.1.md`. Inspect the latest `apps/web` and migrations. Continue from the browser-live evidence/correction gate. Do not merge/reuse old Wayfinder architecture. Preserve command-only mutation, private canonical schemas, exact-version evidence lineage, and recursive Flower/stress-testing.

## 19. Permanent process

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
 ├─ NO → recurse
 └─ YES → BUILD → REAL EVIDENCE → FLOWER AGAIN ↺
```
