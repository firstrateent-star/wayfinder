# Wayfinder — Project State / Chat Recovery

**Repository:** `firstrateent-star/wayfinder`  
**Current milestone:** live Slice 1A backbone + Helm v0.2 + Journey v0.1  
**Current phase:** browser-live validation of Journey  
**Canon:** `docs/CANON.md`  
**Journey:** `docs/16-journey-v0.md`  
**Latest Flower:** `lab/journey-v0-flower-and-stress-test.md`

## Non-negotiable direction

Wayfinder is being rebuilt from the ground up with the newer Vlourish / Flower architecture. Do **not** merge or migrate the old Wayfinder architecture into this system; old code is research evidence only.

Wayfinder is a personal Life OS with an eventual RPG-like experience, but RPG/Character mechanics remain projections rather than canonical truth.

Core laws include:

- reality before interpretation;
- unknown is not zero;
- planned is not happened;
- AI is non-authoritative over canonical reality;
- permanent growth requires evidence;
- derived state is reconstructable;
- important conclusions expose lineage;
- history is preserved while interpretation can evolve;
- one indivisible user save should use one atomic authoritative command when partial commit would violate intent;
- a shared timeline must preserve the distinction between **occurred time** and **recorded time**.

## Architecture

```text
8 EXPERIENCE     Helm · Journey · Character · Atlas · Navigator
7 INTELLIGENCE   Navigator · Flower · reasoning · context
6 PROJECTIONS    Helm · Journey · Bearing · growth · patterns
5 EVIDENCE       evidence + relationships
4 DIRECTION      value · direction · outcome · commitment · quest · plan · action
3 LIFE DOMAINS   Practice first; later asymmetric domains
2 REALITY        events · observations · time · provenance
1 SYSTEM         owner · permission · ids · contracts
```

Modular monolith on Supabase/Postgres.

## Database boundary

Supabase project ref: `ngakauhlcmvwnmimtsca`

Private Wayfinder schemas:

```text
wf_system
wf_direction
wf_practice
wf_evidence
```

Canonical tables remain private. Authenticated clients use public typed RPCs only.

Canonical tables:

```text
wf_system: owners, command_receipts, module_change_outbox
wf_direction: nodes, node_versions, edges
wf_practice: practices, sessions, session_versions
wf_evidence: links
```

`vl_*` schemas share physical infrastructure only; they do not own Wayfinder truth.

## Command/write boundary

Approved lower-level commands:

```text
wf_ensure_owner
wf_direction_create_node
wf_direction_create_edge
wf_practice_create
wf_practice_log_session
wf_practice_correct_session
wf_evidence_create_fulfillment_link
```

Atomic live-use commands:

```text
wf_practice_capture_session
wf_direction_capture_node
```

Exact Practice-name reuse is lexical `lower(trim(name))`, not fuzzy AI identity.

Versioned records: DirectionNode, PracticeSession. Practice is intentionally unversioned in Slice 1.

Evidence always uses exact historical versions and does not silently migrate across correction.

## Reads / projections

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
wf_helm_v0(from,to,session_limit)      -- helm_v0.2
wf_journey_v0(from,to,limit)           -- journey_v0.1
```

Helm composes current Direction + Bearing + Practice catalog + recent Practice.

## Journey v0.1

Journey asks:

> **How did the Wayfinder record arrive here?**

Journey is a reconstructable temporal projection, not a canonical event table or complete biography.

Included item kinds:

```text
PRACTICE_SESSION
DIRECTION_RECORDED
DIRECTION_RELATION_RECORDED
EVIDENCE_RECORDED
PRACTICE_SESSION_CORRECTED
```

Time semantics:

```text
PracticeSession            → OCCURRED → occurred_from
Direction / relationships  → RECORDED → recorded_at
Evidence                   → RECORDED → recorded_at
Correction                 → RECORDED → new-version recorded_at
```

A corrected logical PracticeSession still produces only one lived Practice item. Correction transitions are separate record-time items, preventing version history from double-counting lived activity.

Evidence items preserve exact source/target versions and expose whether those historical refs are still current.

Migration:

```text
20260915171000_add_wayfinder_journey_v0.sql
```

Frontend:

```text
/journey
apps/web/src/pages/JourneyPage.tsx
apps/web/src/features/journey/JourneyView.tsx
```

The UI includes 7/30/90-day scopes, grouped days, Reality/Direction/Evidence/Correction layers, explicit Occurred/Recorded labels, evidence lineage state, and result-vs-epistemic coverage language.

See ADR-029: `decisions/ADR-029-journey-preserves-multiple-time-semantics.md`.

## Stress evidence

Rollback testing proved:

```text
correct Session v1 → v2
→ exactly one lived PRACTICE_SESSION item   ✅
→ one correction item                      ✅
→ old EvidenceLink remains                 ✅
→ old source reports is_current=false      ✅
→ changed_fields identifies change         ✅
```

Journey intentionally does not use `module_change_outbox` as life history and does not infer causality from temporal adjacency.

## Live browser backbone already proven

```text
password auth             ✅
owner bootstrap           ✅
Helm load                 ✅
PracticeSession write     ✅
Action write              ✅
atomic capture            ✅
Evidence UI               ✅ deployed
correction UI             ✅ deployed
```

A prior live bug in deferred version-head triggers was fixed by making the two deferred integrity trigger functions `SECURITY DEFINER`; private schemas were not opened to clients.

## Frontend boundary

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

The build guard rejects direct private Wayfinder table/schema access from frontend source.

Journey frontend code passed boundary check, TypeScript, Vite build, and GitHub Actions.

## Known data caveat

Early failed capture attempts left several active historical Practice records, including duplicate normalized `Music Production` records. Do not silently delete them. Current capture selects a deterministic preferred record; future explicit lifecycle/merge tooling can clean presentation without rewriting history.

## Not built yet

Do not jump ahead to:

- Character/XP persistence;
- universal Skills;
- astrology engine;
- canonical Journey tables;
- Atlas/world model;
- AI canonical writes;
- AI-authored Journey narrative presented as fact;
- direct private-table access;
- frontend-owned progress math.

Reflection/Interpretation exist in the ontology but do not yet have an executable canonical storage slice. Journey v0.1 is intentionally pre-interpretive.

## Exact next move

Use the deployed Journey as the next evidence source:

```text
1. refresh Wayfinder
2. open Journey from Helm
3. verify Practice + Direction history feels legible
4. test 7 / 30 / 90 day scopes
5. attach Evidence in Helm
6. confirm Evidence appears in Journey
7. correct the source PracticeSession
8. confirm Journey shows one lived session + one correction
9. confirm old Evidence is historical exact lineage
10. Flower the lived Journey experience
```

Do not automatically build Character next. Let live Journey usage tell us whether the missing next concept is Reflection/Meaning, Character projection, or another seam.

## Recovery prompt

> Open `PROJECT_STATE.md`, then read `docs/CANON.md`, `docs/16-journey-v0.md`, `lab/journey-v0-flower-and-stress-test.md`, and the latest `apps/web`. Continue from Journey browser-live validation. Preserve private canonical schemas, command-only mutation, exact-version evidence lineage, atomic user-intent boundaries, explicit occurred-vs-recorded time semantics, and recursive Flower/stress-testing.
