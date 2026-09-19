# Wayfinder — Project State / Chat Recovery

**Repository:** `firstrateent-star/wayfinder`  
**Supabase project:** `ngakauhlcmvwnmimtsca`  
**Current milestone:** Navigator v0.2 + Canonical Context v0.1  
**Current phase:** grounded canonical context is implemented and gated; next build is governed multi-domain Admission Planning  
**Current roadmap:** `docs/06-build-roadmap.md` v1.0  
**Mature architecture:** `docs/18-mature-life-rpg-architecture-v0.2.md`  
**Knowledge/Inquiry spine:** `docs/21-knowledge-inquiry-and-acquisition-spine-v0.1.md`  
**Semantic Admission/Training:** `docs/26-semantic-admission-training-v0.1.md`  
**Semantic Episode:** `docs/30-semantic-episode-graph-v0.1.md`  
**Navigator semantic cutover:** `docs/31-navigator-semantic-cutover-v0.2.md`  
**Navigator canonical context:** `docs/32-navigator-canonical-context-v0.1.md`  
**Latest ADR:** `decisions/ADR-043-live-semantic-reasoning-is-provider-neutral-context-bounded-and-read-only.md`

## Non-negotiable direction

Wayfinder is being rebuilt from the ground up using the newer Vlourish / Flower architecture. Old Wayfinder code is research evidence only; do not merge/migrate it into this architecture.

Wayfinder is a personal Life OS expressed as a Life RPG. The RPG is a projection over evidence-backed lived reality; it is not the source of truth.

## Core laws

- reality before interpretation;
- unknown is not zero;
- planned is not happened;
- AI is non-authoritative over canonical reality;
- permanent growth requires evidence;
- derived state is reconstructable;
- important conclusions expose lineage;
- history is preserved while interpretation can evolve;
- occurred, recorded, planned, scheduled, due, and valid time are distinct;
- complex underneath, quiet on the player surface;
- the player should not have to manually model their life;
- RPG mechanics are projections by default;
- Character is composed, not a canonical aggregate;
- equipment modifies effective state, not permanent base mastery;
- Navigator asks questions only when missing information materially matters;
- astrology/tarot are symbolic guidance/reflection, not canonical empirical truth;
- Schedule owns planned temporal allocation, not occurrence;
- Requirement/Standard is distinct from Direction/Goal and Schedule;
- Requirement evaluation is coverage-aware;
- Requirement metrics remain owned by the domain that understands them;
- Owner/auth identity, Person identity, Body observations, and Character projection are distinct;
- Reference Knowledge is separate from Player Reality;
- the language model is a reasoner/interface, not the authoritative encyclopedia;
- available information does not automatically deserve Home visibility;
- information gaps resolve through typed resolvers before asking the player;
- Initial Position is derived rather than a canonical aggregate;
- Discovery questions originate from typed Information Needs;
- Discovery writes only through explicit owning-domain commands;
- a player declining to add information does not establish canonical absence;
- no model-improvised fallback when a resolver cannot establish an answer;
- **input is not player state;**
- **understanding precedes persistence;**
- **no owner, no persistence;**
- **one canonical owner per semantic claim;**
- confidence alone never authorizes persistence;
- conversational disclosure is not automatically canonical write authorization;
- candidates are transient/runtime artifacts by default;
- valid partial reality may be stored only when missing detail remains explicitly unknown;
- persistence without downstream recomputation is incomplete ingestion.

## Mature architecture

```text
TIME
 |
 +--> CANONICAL PLAYER PLANE
 |      System / Person / Body / Direction / Practice / Schedule / Training / ...
 |
 +--> KNOWLEDGE PLANE
 |      deterministic / reference / guidance / live external
 |
 +--> ACQUISITION + INQUIRY
 |      SourceEnvelope / semantic candidates / InformationNeed / QuestionPlanner
 |
 +--> INTELLIGENCE + GUIDANCE
 |      Discovery / Position / Requirements / Growth / Planning
 |
 +--> GAME / PROJECTION
 |      Character / Skills / Role / XP / Stats / Stamina / ...
 |
 +--> EXPERIENCE
        Helm / Navigator / Character / Quests / Calendar / Atlas
```

Cross-cutting:

```text
Time
Provenance
Authority
Coverage
Uncertainty
Freshness
Permissions
Lineage
```

Epistemic layers:

```text
1. RECORDED REALITY
2. DETERMINISTIC DERIVATION
3. INTELLIGENT INFERENCE
4. SYMBOLIC INTERPRETATION
```

A lower-authority layer must never masquerade as a higher-authority layer.

## Current private Wayfinder schemas

```text
wf_system
wf_person
wf_direction
wf_practice
wf_evidence
wf_body
wf_schedule
wf_training
```

Authenticated clients and Edge Functions use narrow public typed RPCs. Private canonical schemas are not directly exposed to `anon` / `authenticated`.

## Proven foundational substrate

Still valid:

- owner bootstrap and auth scope;
- idempotent command runtime;
- private module boundaries;
- exact-version lineage;
- correction/supersession with stale-write rejection where implemented;
- transactional ModuleChange outbox;
- result coverage vs epistemic coverage;
- occurred vs recorded vs planned time separation;
- public read/projection seam;
- frontend private-table guard;
- deferred version-head integrity;
- modular-monolith physical architecture in one Supabase/Postgres project.

## Person + Temporal Kernel — ✅ LIVE

Person owns only modeled identity and stable/correctable origin facts:

```text
display/preferred name
birth date?
birth local time?
birth-time accuracy? EXACT | APPROXIMATE
birth-place label?
```

Body, Role, Skill, XP, finances, current location and astrology interpretation do not belong in Person.

Temporal helper:

```text
wf_system.local_day_bounds(local_date, zone_id)
```

resolves a local day into the true half-open UTC interval and preserves DST.

## Body v0.1 — ✅ LIVE

Canonical metrics currently:

```text
height
weight
```

They are temporal observations rather than Person profile fields.

## Character Creation — ✅ LIVE

Backend:

```text
wf_character_initialize_v0
```

routes one indivisible user intent across Person + optional Body observations atomically.

Player flow gates authenticated users:

```text
Person missing -> Character Creation
Person exists  -> Helm
```

No Role, Skill, XP, Level, Path or self-rated stats are collected.

## Knowledge + Inquiry Acquisition Spine — ✅ EXECUTABLE

Shared runtime in:

```text
supabase/functions/_shared/intelligence/
```

Resolution order:

```text
canonical state
 -> deterministic derivation
 -> trusted reference knowledge
 -> live external context when materially needed
 -> player question when appropriate
 -> preserve unknown
```

Question priority classes:

```text
P0_BLOCKING
P1_HIGH_IMPACT
P2_HIGH_LEVERAGE
P3_CALIBRATION
P4_OPTIONAL
```

There is no LLM-guess fallback.

## Birth Context — ✅ LIVE

JWT Edge Function:

```text
birth-context
```

```text
Person birth facts
 -> place resolution
 -> ambiguity/question when needed
 -> timezone resolution
 -> historical local instant resolution
 -> natal readiness
```

## Deterministic Natal Geometry — ✅ LIVE

JWT Edge Function:

```text
natal-geometry
```

Pinned calculator:

```text
Astronomy Engine 2.1.19
```

Outputs Sun through Pluto geometry, Ascendant/MC/Descendant/IC, Equal + Whole Sign houses, and pairwise aspect geometry. Symbolic meaning remains separate.

## Schedule v0.1 — ✅ LIVE

Private module:

```text
wf_schedule
├── allocations
└── allocation_versions
```

Kinds:

```text
HARD
SOFT
WINDOWED
FLOATING
```

Schedule owns planned temporal allocation only. A passed interval never proves activity occurred.

## Requirement contract v0.1 — ✅ EXECUTABLE

There is intentionally no universal `wf_requirements` canonical table.

Shared evaluator supports:

```text
AT_LEAST
AT_MOST
BETWEEN
EXACT
```

Coverage:

```text
COMPLETE
PARTIAL
UNKNOWN
```

Evaluation:

```text
SATISFIED
IN_PROGRESS
CLOSED_BELOW_TARGET
BREACHED
UNKNOWN
```

Domain owners supply the metric observations and coverage semantics.

## Initial Position / Helm — ✅ LIVE SEED

Helm remains a relevance projection, not a dashboard.

Initial Position composes grounded Person/Body/Schedule context and Question Planner. Real use showed that merely saving answers was insufficient; this directly led to Semantic Admission.

Home law:

```text
AVAILABLE INFORMATION != INFORMATION THAT DESERVES ATTENTION
```

## Semantic Admission v0.1 — ✅ LIVE / CI PASSED

Reference: `docs/26-semantic-admission-training-v0.1.md`, ADR-040.

Runtime:

```text
supabase/functions/_shared/intelligence/semantic-admission.ts
```

Core types:

```text
SourceEnvelope
SemanticCandidate
CandidateGraph
AdmissionContract
AdmissionDecision
AdmissionRegistry
```

Admission outcomes:

```text
ACCEPT
ACCEPT_PARTIAL
NEEDS_CLARIFICATION
NEEDS_AUTHORIZATION
SESSION_ONLY
REFLECTION
REJECT
```

Routing law:

```text
raw input
 -> recognition
 -> transient candidate graph
 -> knowledge/context resolution
 -> exactly one owning AdmissionContract
 -> admission decision
 -> explicit authorization where required
 -> typed owning-domain command
 -> canonical state
 -> recomputation
```

No generic facts/memory/notes table exists for unclaimed information.

Live JWT Edge Function:

```text
semantic-admission
version 1
status ACTIVE
verify_jwt true
```

The Edge Function currently registers only the Training semantic contract. It explicitly reports that raw input is not persisted by the Semantic Admission layer.

## Training v0.1 — ✅ LIVE / DATABASE GATE PASSED

Private module:

```text
wf_training
├── sessions
├── session_versions
└── exercise_sets
```

Public typed RPCs:

```text
wf_training_capture_strength_session
wf_training_recent_v0
```

Current minimal factual semantics:

```text
STRENGTH session
INSTANT | DAY | APPROXIMATE occurrence
exercise reference key + label
reps optional
load optional LB/KG
RPE optional
```

`wf_training_recent_v0` returns stored-record query coverage separately from lived-reality epistemic coverage, which remains UNKNOWN by default.

Direct authenticated table access to `wf_training` has been live-tested denied.

### Semantic proving recognizer

Runtime:

```text
supabase/functions/_shared/intelligence/training-semantic.ts
```

This is deliberately a narrow deterministic recognizer, not the final general NLP system.

Current reference concept:

```text
barbell_bench_press
aliases: bench / bench press / barbell bench press / benched
```

Proven behavior:

```text
"I benched 185 lbs for 8 reps for 3 sets today"
 -> ACCEPT when RECORD + explicit authorization
 -> 3 canonical Barbell Bench Press sets

"I benched 185 for 8 three times today"
 -> NEEDS_CLARIFICATION
 -> training.exercise_set.structure
 -> no write

"I crushed legs today"
 -> ACCEPT_PARTIAL
 -> generic lower-body strength session
 -> no invented exercises/reps/load

clear training disclosure in ordinary conversation
 -> NEEDS_AUTHORIZATION
 -> no write

irrelevant/unowned input
 -> no claim
 -> no persistence
```

### Live database proof

A production transaction captured a synthetic 3-set 185 LB × 8 bench session via the authenticated public RPC and read the structured session back through `wf_training_recent_v0`.

The transaction was rolled back. A follow-up query confirmed zero synthetic rows remained.

### CI

```text
lab/semantic-admission-training-v0.1.test.ts
```

Wayfinder Intelligence CI passed with Semantic Admission Edge type-check and all Training semantic tests.

### Performance hardening

The first advisor pass found four unindexed composite Training foreign keys. They were covered by:

```text
20260916043500_index_wayfinder_training_foreign_keys.sql
```

A second advisor pass no longer reports Training `unindexed_foreign_keys`.

## Current Security Advisor context

Authenticated execution warnings for Wayfinder public `SECURITY DEFINER` RPCs, including the new Training RPCs, are intentional because these functions are the owner-scoped API boundary:

```text
authenticated client / Edge Function
 -> public typed SECURITY DEFINER RPC
 -> private canonical schema
```

Direct private-schema access is denied.

Existing `vl_*` RLS-without-policy findings are separate from Wayfinder.

`Leaked Password Protection Disabled` remains a production-hardening item.

## Strongest next build — General Navigator + Admission Planner

The semantic architecture is now ahead of the production conversation layer. The immediate frontier is to finish the Semantic Episode live gate and cut Navigator over to the shared semantic runtime before adding another canonical domain.

Current cutover:

```text
natural conversation
 -> live semantic reasoner
 -> bounded Semantic Episode
 -> Candidate Life Graph
 -> Wayfinder Capacity
 -> SESSION_ONLY / CLARIFY / route eligibility
 -> explicit domain action
 -> existing Training confirmation boundary
 -> typed canonical command
```

Navigator v0.2 keeps general semantic conversation non-authoritative and transient. Training remains the only conversational canonical write path until the Admission Planner is proven.

The next architecture steps are:

1. pass the live multi-turn Semantic Episode corpus with zero fabrication and no unresolved gate failures;
2. deploy Navigator v0.2;
3. register real canonical context providers for Training, Person, Direction, Schedule, Practice/Journey and other relevant reads;
4. build the Admission Planner so one utterance can produce zero to many independently governed domain proposals;
5. lower eligible semantic meaning into owning-domain admission without forcing the player to restate it;
6. recompute Position, Requirements, Character projections and Bearing after accepted writes;
7. then expand canonical capacity, including Nutrition, through the common Navigator/Admission spine.

Nutrition remains the next strong independent domain proof, but it should now enter through this generalized nervous system rather than become a second domain-specific conversation flow.

## Deferred until earned

Do not prematurely build:

- generic `misc_facts`, notes, memory or other junk-drawer canonical tables;
- universal persistent candidate backlog;
- raw chat/voice transcript as the life model;
- persistence based only on model confidence;
- autonomous AI canonical writes;
- permanent XP ledger;
- giant stat table;
- persisted Role/Class;
- universal skill taxonomy;
- universal life-event/facts table;
- universal Knowledge database;
- vector database merely because Knowledge exists;
- astrology/tarot interpretations as empirical facts;
- calendar entries as occurrence evidence;
- incomplete nutrition logs as zero intake;
- broad input-heavy player dashboards;
- domain widgets on Home merely because a domain exists;
- speculative empty schemas.

## Recovery instruction

Before editing, fetch latest `main` and current target files. Do not rely on this file's commit SHA as if no later commit can exist.

Navigator v0.2 is live and Canonical Context v0.1 now supplies bounded owner-scoped reads for Person, Direction, Schedule, Training and Practice. The immediate architectural target is **Admission Planner → owning-domain authorization/commands → downstream recomputation**. Nutrition follows through that common seam rather than preceding it.
