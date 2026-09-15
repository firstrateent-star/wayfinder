# Wayfinder Web Client v0.1

**Status:** EXECUTABLE SCAFFOLD — BUILD GATE PASSED, LIVE BROWSER GATE PENDING  
**Location:** `apps/web/`

## Purpose

Expose the already-proven Wayfinder command/read boundary to a real person without allowing the browser to become a second domain model.

## Stack

```text
React + TypeScript + Vite
Tailwind CSS + shadcn-style primitives
@supabase/supabase-js
React Router
```

## Implemented path

```text
Supabase Auth session
      ↓
wf_ensure_owner(browser IANA timezone)
      ↓
wf_helm_v0(last 7 days)
      ↓
Helm UI
├── Bearing
├── Direction
├── recent Practice
└── coverage language
```

Quick capture currently uses only approved commands:

```text
wf_practice_create
wf_practice_log_session
wf_direction_create_node
wf_direction_create_edge
```

No canonical table access exists in feature code.

## Retry design

Quick capture retains generated Command ids across a failed network attempt. A retry therefore reuses the same idempotency identity rather than silently creating another canonical record.

If the user materially edits the pending input, the pending command identity is discarded and a new request identity is created.

## Epistemic UI rules already implemented

The client says:

- `No matching PracticeSession records are stored in this selected period.`
- `No recorded evidence yet.`
- `Historical evidence; underlying record changed.`

It does not convert those statements into claims such as:

- `You did not practice.`
- `You made no progress.`
- `This Action is completed.`

## Architecture guard

`apps/web/scripts/check-boundaries.mjs` rejects direct Supabase table/schema access patterns from frontend application code.

The production build runs:

```text
boundary check
↓
TypeScript build
↓
Vite build
```

GitHub Actions run **#2** completed successfully after the latest RPC type alignment.

## Environment

Required deployment variables:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
```

Only a browser-safe publishable key belongs in this client. Never use the service-role key.

## Gate still pending

The scaffold/build gate is passed. Do not call the frontend user-tested yet.

Next evidence must come from an actual browser session:

```text
magic-link auth
↓
owner bootstrap
↓
Helm load
↓
empty-state inspection
↓
Practice capture
↓
Direction/Action capture
↓
retry test
↓
refresh/re-login persistence
```

Then Flower the interface again before expanding its domain surface.
