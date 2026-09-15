# Wayfinder — Project State / Chat Recovery

**Read this first if context is lost.**  
**Repository:** `firstrateent-star/wayfinder`  
**Current milestone:** executable Slice 1A backend + Helm v0 + first thin React client scaffold  
**Current phase:** validate/deploy the web client, then use real interaction as the next Flower evidence source  
**Canon:** see `docs/CANON.md`  
**Frontend architecture:** see `docs/14-frontend-architecture.md`

---

## 1. Root intent

Wayfinder is a personal Life OS expressed through an RPG-like experience, but the RPG is a projection/experience layer rather than the source of truth.

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

Flower/Vlourish recursively challenges every layer before the next layer depends on it.

## 2. Non-negotiable laws

1. Reality comes before interpretation.
2. Unknown is not zero.
3. Planned is not happened.
4. AI is non-authoritative over canonical reality.
5. Permanent growth requires evidence.
6. Derived state is disposable/reconstructable.
7. Human-authored meaning remains distinct from system interpretation.
8. Important conclusions expose lineage.
9. Stateful modules own their canonical records; life domains own factual reality.
10. The system models the person; it is not the person.

Executable consequences already proven:

- authenticated clients cannot directly access private `wf_*` canonical tables;
- application mutation is command-only;
- command ids are retry/idempotency identities;
- same command id + changed material is a conflict;
- corrections create new versions and preserve old history;
- stale evidence remains explainable but does not silently count as current;
- known ranges use `[start,end)` semantics;
- empty stored results do not prove lived-life absence;
- result completeness is distinct from epistemic coverage;
- Action fulfillment, Bearing, and Helm are projections, not canonical facts.

## 3. Architecture that survived stress testing

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

Implementation starts as a modular monolith on Postgres/Supabase.

## 4. Database host and boundary

Wayfinder is colocated inside the existing **`vlourish` Supabase project**:

```text
project ref: ngakauhlcmvwnmimtsca
region: us-east-1

wf_system
wf_direction
wf_practice
wf_evidence
```

Shared physical infrastructure does **not** imply shared canonical ownership. Do not create hidden dependencies on `vl_*` tables.

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

## 5. Public command API

Authenticated writes only through:

```text
wf_ensure_owner
wf_direction_create_node
wf_direction_create_edge
wf_practice_create
wf_practice_log_session
wf_practice_correct_session
wf_evidence_create_fulfillment_link
```

Path:

```text
client intent
  ↓
typed RPC
  ↓
auth.uid() → owner
  ↓
command claim/idempotency
  ↓
validation + authorization
  ↓
owning module canonical write
  ├── receipt
  └── outbox change
```

## 6. Public read/projection API

Base reads:

```text
wf_direction_current()
wf_practice_recent(from,to,limit)
wf_evidence_for_target(action_id,action_version,limit)
```

Derived/composed reads:

```text
wf_action_fulfillment_v0(action_id)
wf_bearing_v0()
wf_helm_v0(from,to,session_limit)
```

Fulfillment states:

```text
CURRENT_EVIDENCE_PRESENT
STALE_RECORDED_EVIDENCE_ONLY
NO_RECORDED_EVIDENCE
```

Bearing states:

```text
NO_ACTIVE_ACTIONS
RECORDED_EVIDENCE_OF_MOVEMENT
NO_RECORDED_EVIDENCE_OF_MOVEMENT
```

Bearing is deliberately descriptive rather than a percentage/score. Helm composes Direction + Bearing + scoped Practice and is never persisted as irreplaceable truth.

## 7. Backend gates already passed

Live Postgres tests have proven:

- owner bootstrap and owner isolation;
- Direction/Outcome/Action creation + SUPPORTS edges;
- Practice + PracticeSession creation;
- retry idempotency and command conflict detection;
- correction versioning and stale-write rejection;
- Evidence exact lineage + duplicate NOOP behavior;
- stale evidence after correction;
- direct authenticated private-table denial;
- `[start,end)` temporal boundaries;
- empty result semantics;
- result-limit coverage semantics;
- result coverage vs lived-reality epistemic coverage;
- Fulfillment v0;
- Bearing v0 and active-intent filtering;
- Helm v0 under normal authenticated execution.

See `lab/` for the recursive test trail and `supabase/migrations/` for executable lineage.

## 8. Frontend decision

First client lives at:

```text
apps/web/
```

Stack:

```text
React 18
TypeScript
Vite
Tailwind CSS
shadcn-style primitives
@supabase/supabase-js
React Router
```

Frontend law:

> The client may present state, collect intent, call commands, and request projections. It does not establish canonical truth.

The application boundary is:

```text
React
  ↓
wayfinder-rpc.ts
  ↓
supabase.rpc(...)
  ↓
approved public Wayfinder RPC
  ↓
private wf_* modules
```

No feature/component should use `supabase.from(...)` for canonical Wayfinder state.

## 9. Frontend implemented so far

Current files include:

```text
apps/web/
├── package.json
├── vite.config.ts
├── tailwind.config.ts
├── components.json
├── .env.example
├── scripts/check-boundaries.mjs
└── src/
    ├── app/App.tsx
    ├── components/ui/{button,card,input}.tsx
    ├── features/auth/AuthProvider.tsx
    ├── features/helm/HelmView.tsx
    ├── features/practice/QuickPracticeCapture.tsx
    ├── features/direction/QuickDirectionCapture.tsx
    ├── lib/supabase.ts
    ├── lib/wayfinder-rpc.ts
    ├── lib/wayfinder-types.ts
    ├── pages/LoginPage.tsx
    ├── pages/HelmPage.tsx
    └── main.tsx
```

Implemented behavior:

- Supabase magic-link authentication;
- session listener;
- owner bootstrap through `wf_ensure_owner` using browser IANA timezone;
- logged-out users route to `/login`;
- authenticated/bootstrapped users route to `/helm`;
- `wf_helm_v0` drives the screen;
- Bearing state and Action evidence language preserve epistemic humility;
- current Direction/Outcome/Quest records render from RPC data;
- recent Practice renders stored-record coverage separately from lived-reality coverage;
- Practice quick capture can create a Practice and log an exact PracticeSession;
- Practice capture retains command ids across network retry attempts;
- Direction capture creates Direction/Outcome/Quest/Action records;
- Action capture may add an approved SUPPORTS edge to an active target;
- no XP/progress/completion truth is invented client-side.

## 10. Frontend architecture guard

`apps/web/scripts/check-boundaries.mjs` fails the build if application code attempts direct Supabase table/schema access patterns.

`npm run build` runs the boundary guard before TypeScript + Vite build.

GitHub Actions workflow:

```text
.github/workflows/web-ci.yml
```

The first CI pass completed successfully. A second validation run was triggered after the latest frontend contract alignment; check the most recent `Wayfinder Web CI` run before claiming the frontend gate fully passed.

## 11. Environment configuration

Local/deployment values:

```text
VITE_SUPABASE_URL=https://ngakauhlcmvwnmimtsca.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<Supabase publishable key>
```

Never place service-role credentials in the browser client.

## 12. What is intentionally NOT built yet

Do not infer permission from the existence of the frontend to add:

- Character/XP persistence;
- universal Skills;
- astrology engine;
- Journey canonical model;
- Atlas/world model;
- AI canonical writes;
- direct private-table reads/writes;
- frontend-owned progress math;
- fake `completed=true` Actions;
- claims that empty data means something did not happen in real life.

## 13. Exact next move

If context is lost, continue in this order:

```text
1. check latest Wayfinder Web CI result
2. fix any TypeScript/Vite/boundary failure
3. mark frontend scaffold build gate passed
4. configure real Supabase URL + publishable key in deployment environment
5. deploy `apps/web` as the first preview
6. test magic-link auth end-to-end
7. test owner bootstrap + Helm against an actual signed-in browser user
8. test retry behavior from UI
9. Flower/stress-test wording, empty states, stale evidence, and capture ergonomics
10. only then expand Evidence attachment/correction UX and later Journey/Character/Navigator surfaces
```

Suggested recovery prompt:

> Open `PROJECT_STATE.md` in `firstrateent-star/wayfinder`, then read `docs/CANON.md`, `docs/14-frontend-architecture.md`, and the latest `apps/web` code. Continue from the exact next move. Do not reuse the old Wayfinder architecture. Preserve the command-only write boundary and recursive Flower/stress-test methodology.

## 14. Permanent process

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
  └── YES → BUILD → REAL EVIDENCE → FLOWER AGAIN ↺
```

A layer is never declared eternally finished; it is only stable enough to expose to the next evidence source.
