# Wayfinder Web Client v0.1

**Status:** LIVE DEPLOYED — AUTH + OWNER + HELM + FIRST WRITES PROVEN; HARDENED LOOP DEPLOYED FOR BROWSER VALIDATION  
**Location:** `apps/web/`

## Purpose

Expose the Wayfinder command/read boundary to a real person without allowing the browser to become a second domain model.

The first real authenticated browser session is now an explicit architecture evidence source. Live use already found and corrected two structural issues: deferred private-schema trigger permissions and client-side multi-command capture.

See `lab/live-slice-flower-v0.1.md` for the recursive Flower and stress-test trail.

## Stack

```text
React + TypeScript + Vite
Tailwind CSS + shadcn-style primitives
@supabase/supabase-js
React Router
```

## Live path

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
├── Practice catalog
├── recent Practice
├── coverage language
├── atomic Practice capture
├── atomic Direction capture
├── exact-version Evidence attachment
└── PracticeSession correction
```

## Browser write boundary

The primary live capture controls now use one backend command per indivisible user intent:

```text
Record PracticeSession
  → wf_practice_capture_session

Create Direction/Outcome/Quest/Action
  + optional Action SUPPORTS edge
  → wf_direction_capture_node

Attach fulfillment evidence
  → wf_evidence_create_fulfillment_link

Correct PracticeSession
  → wf_practice_correct_session
```

The older lower-level command RPCs remain available as backend primitives, but the live UI no longer orchestrates `Practice create → Session create` or `Action create → Edge create` as separate commits.

No canonical table access exists in feature code.

## Atomic capture

The live-use Flower established this rule:

> If the person experiences a save as one indivisible act, the backend command boundary should make the required canonical writes one transaction.

Practice capture now:

1. validates the whole requested session;
2. resolves an existing Practice or creates one;
3. creates Session + SessionVersion;
4. advances the version head;
5. writes receipt/outbox;
6. commits everything together.

Direction capture similarly creates a new node plus optional SUPPORTS edge in one transaction.

## Retry design

Each capture retains a generated Command id across a failed retry while material input remains unchanged.

```text
same command id + same material
→ replay same terminal receipt

same command id + changed material
→ conflict

material changes in browser
→ discard pending command id
```

This is retry safety, not deduplication by UI timing.

## Practice catalog and duplicate behavior

The Practice selector no longer infers Practices from recent PracticeSessions. Helm v0.2 includes `wf_practice_catalog_v0()`, which directly reads active stored Practice records.

Exact case/whitespace-equivalent active names are resolved through a deterministic preferred record for future capture. This is lexical identity only; no fuzzy or AI semantic merge occurs.

Existing duplicate rows created during the pre-atomic live failure are preserved rather than silently deleted. The catalog exposes duplicate-group metadata while capture presents one preferred record per normalized exact name.

## Evidence and correction

The client can now record:

```text
PracticeSession@version
    SUPPORTS fulfillment
Action@version
```

This does not set a boolean Action completion value.

PracticeSession correction creates a new historical version. Evidence tied to the old source version remains historical/stale instead of silently moving to the correction.

The correction UI only edits duration when the source has an exact INSTANT→INSTANT bounded range. Coarse temporal records do not receive invented precision from the browser.

## Epistemic UI rules

The client may say:

- `No matching PracticeSession records are stored in this selected period.`
- `No recorded evidence yet.`
- `Historical evidence; underlying record changed.`
- `Result coverage: complete for stored records in this query.`

It must not convert those statements into:

- `You did not practice.`
- `You made no progress.`
- `This Action is completed.`
- `These are all the Practices in your life.`

Practice catalog storage completeness and lived-reality epistemic completeness remain separate.

## Security boundary

```text
React feature
  ↓
wayfinder-rpc.ts
  ↓
supabase.rpc(...)
  ↓
public SECURITY DEFINER Wayfinder RPC
  ↓
private wf_* schema
```

`apps/web/scripts/check-boundaries.mjs` rejects direct Wayfinder table/schema access patterns from frontend code.

A live `42501` failure proved a subtle point: deferred constraint triggers run after the outer RPC definer context returns. The deferred version-head integrity trigger functions are therefore themselves SECURITY DEFINER while canonical schemas remain inaccessible to authenticated clients.

## Build/deployment gate

The deployed client passes:

```text
frontend boundary check
↓
TypeScript build
↓
Vite build
↓
Vercel deployment
```

The hardened atomic/evidence/correction frontend build passed CI and deployed successfully.

## Live evidence already proven

```text
password auth                 ✅
owner bootstrap               ✅
Helm read                     ✅
PracticeSession write         ✅
Action write                  ✅
deferred invariant fix        ✅
backend atomic capture tests  ✅
evidence → Bearing test       ✅
correction → stale test       ✅
```

## Next browser gate

The next evidence source is the deployed UI itself:

```text
record another PracticeSession using atomic capture
↓
create Direction/Outcome + Action with SUPPORTS relationship
↓
attach Session evidence to Action
↓
observe Bearing become current recorded movement
↓
correct the Session
↓
observe evidence become historical/stale
↓
attach corrected Session version
↓
observe Bearing return to current recorded movement
```

Only after this loop survives real interaction should the frontend domain surface expand materially toward Journey, Character, or Navigator.
