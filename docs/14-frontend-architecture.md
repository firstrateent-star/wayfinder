# Wayfinder Frontend Architecture

**Version:** 0.1  
**Status:** CANDIDATE  
**Purpose:** Define the first user-facing application layer over the proven Wayfinder Slice 1A backend without allowing the frontend to become a second source of domain truth.

## Decision

Build the first Wayfinder interface as a thin React web application inside the existing repository.

Recommended stack:

```text
React
TypeScript
Vite
Tailwind CSS
shadcn/ui
@supabase/supabase-js
```

Location:

```text
apps/web/
```

## Why this stack

The current Wayfinder product does not need server-side rendering, a second backend framework, or a frontend-owned domain model. Vite + React keeps the application small, fast to iterate, easy to inspect, and easy to rewrite while the backend remains the architectural authority.

TypeScript provides explicit API contracts. Tailwind + shadcn/ui provide composable interface primitives without forcing a heavy product framework. Supabase JS handles Auth and calls the already-exposed public RPC boundary.

A future native/mobile client can consume the same RPC/read contracts without changing the canonical backend.

## Frontend law

> The frontend may present state, collect intent, call commands, and request projections. It does not establish canonical truth itself.

Therefore the frontend must not:

- write directly to `wf_*` tables;
- reproduce canonical validation as authoritative business logic;
- set `action.completed` or similar invented facts;
- infer lived-reality absence from empty result sets;
- persist Bearing, Fulfillment, or Helm as irreplaceable truth;
- create hidden dependencies on `vl_*` schemas;
- let AI-generated UI code bypass public Wayfinder command/read contracts.

Client-side validation is allowed for usability but the backend remains authoritative.

## Client architecture

```text
apps/web/src/
├── app/
│   ├── App.tsx
│   └── routes.tsx
├── lib/
│   ├── supabase.ts
│   ├── wayfinder-rpc.ts
│   └── wayfinder-types.ts
├── features/
│   ├── auth/
│   ├── helm/
│   ├── direction/
│   ├── practice/
│   └── evidence/
├── components/
│   └── reusable presentation components
└── pages/
    ├── HelmPage.tsx
    └── LoginPage.tsx
```

Avoid importing database-generated table types into product features as the primary application contract. The frontend should type the **public RPC responses and commands**, because those are the stable application boundary.

## Supabase interaction boundary

```text
React component
      ↓
feature hook / action
      ↓
wayfinder-rpc.ts
      ↓
supabase.rpc(...)
      ↓
public Wayfinder RPC
      ↓
private wf_* canonical modules
```

No component should call `supabase.from('wf_*...')`.

A test/lint guard should eventually fail the build if application code attempts direct canonical table access.

## First session bootstrap

```text
Load app
  ↓
Supabase Auth session?
  ├── NO → Login
  └── YES
        ↓
     wf_ensure_owner(timezone)
        ↓
     owner ready
        ↓
     load Helm
```

The browser can suggest an IANA timezone from `Intl.DateTimeFormat().resolvedOptions().timeZone`, but the backend validates accepted state.

## Helm v0 UI

The first meaningful product screen should visualize the existing `wf_helm_v0` contract rather than inventing a dashboard schema.

Suggested hierarchy:

```text
HELM
│
├── Bearing
│   ├── current broad state
│   └── active Actions + evidence status
│
├── Direction
│   ├── active Directions / Outcomes
│   └── relationships relevant to active Actions
│
├── Recent Practice
│   ├── sessions in selected scope
│   └── explicit coverage language
│
└── Capture
    └── fastest path to record what just happened / what matters next
```

Do not display invented certainty. For example:

- good: `No matching practice records in this period.`
- bad: `You did not practice.`

- good: `No recorded evidence of movement.`
- bad: `You made no progress.`

## Initial UI language for projections

Action fulfillment states should be translated carefully:

```text
CURRENT_EVIDENCE_PRESENT
→ Recorded evidence currently supports this Action.

STALE_RECORDED_EVIDENCE_ONLY
→ Historical evidence exists, but its underlying record has changed.

NO_RECORDED_EVIDENCE
→ Wayfinder has no recorded evidence for this Action yet.
```

Bearing should remain descriptive rather than gamified at first.

## Quick Capture v0

The first capture interface should support only capabilities already backed by commands:

```text
Create Direction node
Create Direction SUPPORTS edge
Create Practice
Log PracticeSession
Correct PracticeSession
Attach fulfillment Evidence
```

The UI may make these flows friendlier, but should not create new backend semantics simply because a screen needs them.

## State management

Start without a global state framework.

Use:

- React local state for ephemeral UI state;
- a small query/cache library only if real complexity appears;
- RPC responses as the source for backend-facing state.

Do not introduce Redux/Zustand/global event buses before actual evidence requires them.

## Routing

Initial routes can remain minimal:

```text
/login
/helm
```

Later candidate routes:

```text
/journey
/direction
/character
/atlas
/navigator
```

Those later routes are not permission to build their domain models prematurely.

## Design orientation

The experience should feel like a calm personal navigation instrument rather than an enterprise dashboard or noisy productivity app.

Priorities:

1. Where am I?
2. What currently matters?
3. What evidence do I have?
4. What happened recently?
5. What is the next meaningful action?

The RPG layer can become richer later, after evidence supports Character/progression semantics.

## Lovable boundary

Lovable can be used as a visual/UI implementation accelerator because it can produce React code quickly. If used:

- GitHub remains canonical;
- generated code must be reviewable and rewritable;
- no direct private-table access;
- no Lovable-created database schema without passing Wayfinder architecture gates;
- no invented XP, completion, goals, or derived truth;
- Supabase interaction must route through the approved public RPC contract.

Lovable is a builder, not the architect.

## Frontend validation gate

Before expanding beyond the first screen, test:

```text
[ ] Logged-out user cannot load Helm.
[ ] Authenticated user bootstraps only their own owner.
[ ] UI cannot directly access private wf_* tables.
[ ] Helm renders empty data without claiming lived-life absence.
[ ] Result-limit/coverage language remains epistemically correct.
[ ] Stale evidence is visually distinguishable from current evidence.
[ ] Command retries do not create duplicate UI records.
[ ] Backend REJECTED/NOOP/APPLIED states are handled distinctly.
[ ] Correction flow uses expected version and surfaces stale-write rejection.
[ ] No projection is treated as canonical persistence in client state.
```

Then Flower the actual interface against real usage before adding Journey, Character, Navigator, or additional domains.

## First implementation sequence

```text
1. create Vite React TypeScript application in apps/web
2. install Tailwind + shadcn/ui + Supabase JS
3. configure environment variables
4. add Supabase client
5. implement auth/session shell
6. call wf_ensure_owner
7. create typed Wayfinder RPC adapter
8. render wf_helm_v0
9. implement quick PracticeSession capture
10. implement Direction/Action capture
11. implement Evidence attachment
12. run frontend boundary/stress tests
13. Flower from actual use
```

## Boundary with future intelligence

Navigator/AI should eventually call the same application commands and reads rather than receive privileged database access.

Future path:

```text
Navigator
   ↓
read context / propose command
   ↓
user confirmation or explicit authorization
   ↓
Wayfinder command API
   ↓
canonical module
```

This preserves one reality path regardless of whether the user acts through a button, voice, chat, import, or future agent.
