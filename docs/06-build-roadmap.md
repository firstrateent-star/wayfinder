# Wayfinder Build Roadmap

**Version:** 1.0  
**Status:** CANDIDATE-STABLE — Semantic Admission v0.1 + first real Training domain live

Wayfinder grows through complete vertical slices. Progress is measured by how much real life the system can model, resolve, explain, and guide without weakening truth boundaries or burdening the player with unnecessary input.

## Phase 0 — Foundation

**Status:** ✅ stable enough / recursive

Canonical ontology, object contracts, module protocol, architecture laws, ADR process, validation loop, and recovery documentation exist.

## Phase 1 — Executable kernel

**Status:** ✅ passed

Proven:

```text
owner/auth scope
private canonical schemas
command envelope + idempotency
version/correction lineage
transactional ModuleChange outbox
public typed RPC boundary
coverage vs epistemic coverage
occurred vs recorded time
```

## Phase 2 — Direction / Practice / Evidence proving substrate

**Status:** ✅ backend proven

Direction, PracticeSession, EvidenceLink, correction, exact-version lineage, and atomic capture remain architectural proof infrastructure.

## Phase 3 — Reconstructable projections

**Status:** ✅ backend proven

Action Fulfillment, Bearing, Helm and Journey proved that derived state can remain reconstructable rather than duplicated as canonical truth.

## Phase 4 — Quiet player shell

**Status:** ✅ live

> Complex underneath. Quiet on the surface.

Do not turn new backend capabilities into permanent Home widgets.

## Phase 5 — Mature Life RPG architecture

**Status:** ✅ candidate-stable target

Reference: `docs/18-mature-life-rpg-architecture-v0.2.md`.

Key laws:

```text
Reality before interpretation
Unknown != zero
Planned != happened
AI is non-authoritative over canonical reality
RPG mechanics are projections by default
Character is composed, not a canonical aggregate
Time is cross-cutting
Schedule != occurrence
Requirement != goal != schedule
Reference Knowledge != Player Reality
Available information != information deserving attention
```

## Phase 6 — Person + Temporal Kernel

**Status:** ✅ LIVE / GATE PASSED

Person owns preferred identity and stable/correctable birth/origin facts only. `wf_system.local_day_bounds(...)` provides DST-aware local-day boundaries.

## Phase 7 — Body asymmetric slice

**Status:** ✅ LIVE / GATE PASSED

Height and weight are temporal Body observations. Unit normalization is deterministic derivation.

## Phase 8 — Atomic Character Creation backend

**Status:** ✅ LIVE / ATOMICITY GATE PASSED

`wf_character_initialize_v0` atomically routes one player intent across Person + Body while preserving module ownership. No canonical Character table exists.

## Phase 9 — Knowledge + Inquiry Acquisition Spine

**Status:** ✅ EXECUTABLE FRAMEWORK / CI PASSED

Reference: `docs/21-knowledge-inquiry-and-acquisition-spine-v0.1.md`, ADR-035.

```text
KnowledgeQuery / KnowledgeResolution
KnowledgeProviderRegistry
KnowledgeRouter
InformationNeed
InformationResolutionRouter
QuestionPlanner
QuestionOpportunity
P0-P4 priority classes
question budgets / sensitivity / cooldown hooks
```

Resolution law:

```text
canonical state
 -> deterministic derivation
 -> reference knowledge
 -> live external context when materially needed
 -> player question when appropriate
 -> preserve unknown
```

There is no model-improvised fallback.

## Phase 10 — Birth-context Knowledge proving slice

**Status:** ✅ LIVE / EDGE FUNCTION ACTIVE / CI PASSED

Reference: `docs/22-birth-context-knowledge-slice-v0.1.md`, ADR-036.

```text
Person birth facts
 -> geo.resolve_place
 -> ambiguity/question when required
 -> geo.resolve_timezone
 -> time.resolve_local_instant
 -> natal readiness
```

## Phase 11 — Deterministic natal geometry

**Status:** ✅ LIVE / EDGE FUNCTION ACTIVE / CI PASSED

Reference: `docs/23-natal-geometry-v0.1.md`, ADR-037.

```text
resolved UTC birth instant
+ WGS84 coordinates
+ pinned Astronomy Engine version
 -> Sun through Pluto geometry
 -> Ascendant / MC / Descendant / IC
 -> Equal + Whole Sign houses
 -> pairwise aspect geometry
```

No symbolic interpretation or active-orb assertion is stored as astronomical truth.

## Phase 12 — Character Creation player experience

**Status:** ✅ IMPLEMENTED / WEB CI PASSED

Authenticated players without a canonical Person are routed to `/create-character` before Helm.

The flow collects only grounded starting facts:

```text
Name
Birth date
Birth time optional/approximate/unknown
Birthplace optional
Height optional
Weight starting observation optional
```

No Role, XP, Level, Skill, Path, stat self-rating, or giant questionnaire.

## Phase 13 — Schedule v0.1

**Status:** ✅ LIVE / DATABASE GATE PASSED

Private module:

```text
wf_schedule
├── allocations
└── allocation_versions
```

Modes:

```text
HARD
SOFT
WINDOWED
FLOATING
```

Schedule owns planned temporal allocation only. Passing time does not turn Schedule into occurrence evidence.

## Phase 14 — Requirement contract v0.1

**Status:** ✅ EXECUTABLE / CI PASSED

Reference: `docs/24-character-schedule-requirements-v0.1.md`, ADR-038.

No universal `wf_requirements` truth table exists. The owning domain supplies metric semantics; the shared runtime evaluates temporal rules.

Rules:

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

## Phase 15 — Initial Position + Discovery Session

**Status:** ✅ LIVE / RECURSIVE SEED

Reference: `docs/25-initial-position-discovery-v0.1.md`, ADR-039.

Helm composes sparse player-specific Position from grounded reads and Question Planner. Initial Discovery proved question -> explicit answer -> owning-domain Schedule write -> refreshed Position, but real use exposed the next requirement:

> Discovery must change understanding, not merely increase a record count.

That observation directly motivated Semantic Admission.

## Phase 16 — Semantic Admission v0.1

**Status:** ✅ LIVE / EDGE FUNCTION ACTIVE / CI PASSED

Reference: `docs/26-semantic-admission-training-v0.1.md`, ADR-040.

Core laws:

```text
Input is not player state
Understanding precedes persistence
No owner, no persistence
One canonical owner per claim
Domain admission is an epistemic firewall
Confidence alone never authorizes persistence
Conversational disclosure != write authorization
Candidates are transient by default
```

Executable spine:

```text
SourceEnvelope
 -> semantic recognition
 -> CandidateGraph
 -> AdmissionRegistry
 -> owning AdmissionContract
 -> ACCEPT | ACCEPT_PARTIAL | CLARIFY | AUTHORIZATION | DROP
 -> typed domain command when justified
```

Current live JWT-protected Edge Function:

```text
semantic-admission
```

Raw text/voice input is not archived by the admission layer.

## Phase 17 — Training v0.1 first real Semantic Admission domain

**Status:** ✅ LIVE / DATABASE GATE + CI + ROLLBACK TEST PASSED

Private module:

```text
wf_training
├── sessions
├── session_versions
└── exercise_sets
```

Public typed boundary:

```text
wf_training_capture_strength_session
wf_training_recent_v0
```

Current proving semantics:

```text
"I benched 185 lbs for 8 reps for 3 sets today"
 -> resolved Barbell Bench Press
 -> three canonical sets when explicitly authorized

"I benched 185 for 8 three times today"
 -> NEEDS_CLARIFICATION
 -> no write

"I crushed legs today"
 -> ACCEPT_PARTIAL
 -> generic strength session
 -> no invented exercises/reps/load

irrelevant unowned input
 -> no persistence
```

`wf_training_recent_v0` separates result completeness from lived-reality coverage. Direct authenticated access to private Training tables is denied.

After the first advisor pass, all new composite Training foreign keys received covering indexes; the second advisor pass no longer reports Training `unindexed_foreign_keys`.

## Phase 18 — Nutrition v0.1 second Semantic Admission proof

**Status:** ← NEXT STRONGEST DOMAIN TARGET

Build a semantically different domain without changing the central admission spine.

Minimum target:

```text
meal/intake reality
food identity/reference resolution
quantity certainty
measured vs estimated vs unknown nutrient values
protein aggregation
intake coverage
```

First proving statements should include:

```text
"I had three eggs and toast"
```

The system should be able to establish what is actually known while preserving uncertainty around bread type/quantity or other missing detail. It must not fabricate macro precision.

Then connect domain-owned protein observations to the existing Requirement evaluator:

```text
protein >= target grams / local day
```

Incomplete intake coverage must remain incomplete rather than becoming zero intake.

## Phase 19 — General semantic recognition + multi-domain decomposition

**Status:** candidate after Training + Nutrition prove the contract

Replace/augment bounded deterministic proving recognizers with model-assisted semantic recognition that still outputs transient candidates and never bypasses domain admission.

Prove one utterance can create independent candidates for different owners:

```text
Training
Nutrition
Direction
Schedule
Finance later
```

Each candidate may independently accept, clarify, require authorization, or drop.

Atomicity follows user intent, not sentence boundaries.

## Phase 20 — Navigator domain-driven active-learning loop

**Status:** candidate

Domains should generate Information Needs from real gaps in their own understanding. Question Planner arbitrates across domains rather than relying on a global questionnaire.

```text
Domain read/projection
 -> coverage + uncertainty
 -> Information Need
 -> Question Planner
 -> Navigator
 -> answer
 -> Semantic Admission
 -> domain state changes
 -> needs reprioritized
```

Navigator should answer the supported portion first and ask only the smallest high-value question when needed.

## Phase 21 — Richer Position + relevance-driven Helm

**Status:** v0 seed live; richer composition candidate

Grow Position only as grounded signals earn relevance, for example:

```text
next hard commitment
meaningful recorded window
one weekly strength exposure remaining
recorded protein below target but coverage incomplete
```

Home remains a relevance projection, not a dashboard.

## Phase 22 — Inventory + Effective Capability

**Status:** candidate

Prove one real item and explainable capability effect.

```text
BASE CAPABILITY
+ equipment
+ environment
+ condition
+ access
+ allies
= EFFECTIVE CAPABILITY
```

Support BOOST, MULTIPLIER, GATE, UNLOCK, REDUCER, CONSTRAINT, SYNERGY.

Gear does not permanently manufacture mastery.

## Phase 23 — Skill + Role projections

**Status:** candidate

Infer one narrow Skill from admitted canonical evidence and one higher-order Role pattern. Raw natural-language candidates may not award mastery directly.

## Phase 24 — Cross-domain strength / growth analysis

**Status:** candidate after Training + Nutrition baseline

```text
Training
+ Nutrition
+ Body
+ Recovery
+ Time
+ Equipment
 -> strength/growth analysis
```

Avoid unjustified causal certainty.

## Phase 25 — Daily / Weekly Review

**Status:** candidate

Reviews remain projections by default.

System Review != player-authored Reflection.

## Phase 26 — Symbolic guidance

**Status:** candidate after grounded life context

Astrology:

```text
canonical birth facts
 -> deterministic natal/transit geometry
 -> versioned symbolic astrology knowledge
 -> clearly labeled interpretation
```

Tarot may later join the same symbolic/reflection family:

```text
recorded draw
+ versioned card/spread knowledge
 -> symbolic interpretation
 -> player-authored reflection when it resonates
```

Neither astrology nor tarot may masquerade as empirical player truth or crowd out more relevant grounded information.

## Phase 27 — Expand real-life domains under pressure

Admit domains only when distinct factual semantics require them:

```text
Finance
World / Atlas
Social / Relationships
richer Inventory
Knowledge / Lore
Home
Transportation
additional domain-specific Requirements
```

Each new domain should expose a semantic admission contract as part of its operational boundary.

## Deferred until earned

Do not prematurely build:

- permanent XP ledger;
- giant stat table;
- persisted Role/Class;
- universal skill taxonomy;
- universal life-events/facts table;
- universal Knowledge database;
- universal persistent candidate backlog;
- raw conversation/archive as the player model;
- generic `misc_facts`, `notes`, `memory`, or `other` canonical tables;
- persistence based only on model confidence;
- vector database merely because Knowledge exists;
- autonomous AI canonical writes;
- astrology/tarot interpretations as facts;
- calendar entries as occurrence evidence;
- incomplete macro logs as zero intake;
- broad frontend forms;
- domain-widget Home dashboard;
- speculative empty schemas.

## Build discipline

For every new slice:

1. Define the smallest useful human question or natural input.
2. Identify the real-world phenomenon.
3. Classify it as recorded reality, deterministic derivation, intelligent inference, or symbolic interpretation.
4. Define recognition separately from resolution and domain admission.
5. Identify exactly one true owner for each canonical claim.
6. If no owner exists, do not persist it as player state.
7. Preserve time, provenance, authority, coverage, uncertainty, freshness, and lineage.
8. Define valid partial reality and which missing details must remain unknown.
9. Define authorization requirements separately from semantic understanding.
10. Define Information Needs from concrete admission/projection gaps, not blank profile fields.
11. Define when Navigator may ask, and why.
12. Define downstream recomputation after successful writes.
13. Define Schedule / Requirement implications where relevant.
14. Define base vs effective capability effects where relevant.
15. Define atomic vs independently admissible semantics for multi-claim user intent.
16. Implement one end-to-end vertical slice.
17. Test ambiguity, irrelevant input, missing authorization, partial truth, conflict, provider outage, stale state, correction, and unknowns as applicable.
18. Observe real use before generalizing further.

> The architecture succeeds when Wayfinder can understand more while the player has to manage less.
