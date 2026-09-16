# Wayfinder Build Roadmap

**Version:** 0.9  
**Status:** CANDIDATE-STABLE — Initial Position + first governed Discovery Session live

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

## Phase 15 — Initial Position + Discovery Session v0.1

**Status:** ✅ LIVE / EDGE FUNCTION ACTIVE / WEB + INTELLIGENCE CI PASSED

Reference: `docs/25-initial-position-discovery-v0.1.md`, ADR-039.

Helm now composes a sparse player-specific Initial Position from:

```text
Person
+ Body baseline presence
+ bounded Schedule read
+ Question Planner
```

Live Edge Function:

```text
initial-position
verify_jwt = true
```

Discovery v0 proves:

```text
structured Information Need
 -> opt-in one-question Discovery Session
 -> explicit player answer
 -> authorized owning-domain command when persistence is justified
 -> refreshed Position
```

First need:

```text
schedule.next_day.coverage
```

If the player supplies a fixed commitment, it is written as a HARD Schedule allocation. If the player says there is nothing to add, Wayfinder does **not** create canonical proof that the day is empty.

Helm explicitly preserves:

```text
empty schedule != free time
planned != happened
record completeness != life completeness
```

The corrected frontend build passed Web CI and Vercel deployment.

## Phase 16 — Training + Nutrition requirement proving slice

**Status:** ← NEXT BROAD DOMAIN TARGET

Build the smallest factual Training and Nutrition foundations necessary to feed real observations into the Requirement contract.

Training v0 target:

```text
strength session reality
exercise/set/load structure only as needed
weekly strength exposure metric
```

Nutrition v0 target:

```text
intake/meal reality
measured vs estimated nutrients
protein aggregation
intake coverage
```

Reference Knowledge should provide exercise/food interpretation rather than relying on unstructured model memory.

First end-to-end requirements:

```text
strength sessions >= N / local week
protein >= target grams / local day
```

The point is not to build giant fitness trackers. It is to prove that domain-owned reality + Knowledge + temporal Requirements can generate trustworthy signals for Navigator.

## Phase 17 — Generalized Discovery

**Status:** candidate after first real domain observations

Generalize beyond the structured Schedule question:

```text
source
 -> candidate
 -> provenance
 -> reconciliation
 -> authorization
 -> owning domain command
```

Prefer transient candidates until durable queues/conflict workflows earn persistence.

## Phase 18 — Navigator temporal active-learning loop

**Status:** candidate

Combine bounded context from Direction + Schedule + real Requirement evaluations and classify:

```text
KNOWN
INFERRED
CONFLICTING
UNKNOWN
MISSING-BUT-IMPORTANT
```

Navigator should answer the supported portion first, then ask the smallest high-value question when needed.

## Phase 19 — Position + relevance-driven Helm

**Status:** v0 seed live; richer composition candidate

Initial Position is now live. Grow it only as grounded signals earn relevance, for example:

```text
next hard commitment
meaningful open window
one weekly training exposure remaining
recorded protein below target but coverage incomplete
```

Home remains a relevance projection, not a dashboard.

## Phase 20 — Inventory + Effective Capability

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

## Phase 21 — Skill + Role projections

**Status:** candidate

Infer one narrow Skill from evidence and one higher-order Role pattern. Preserve lineage, uncertainty, recency, and base-vs-effective capability separation.

## Phase 22 — Cross-domain strength / growth analysis

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

## Phase 23 — Daily / Weekly Review

**Status:** candidate

Reviews remain projections by default.

System Review != player-authored Reflection.

## Phase 24 — Symbolic guidance

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

## Phase 25 — Expand real-life domains under pressure

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

## Deferred until earned

Do not prematurely build:

- permanent XP ledger;
- giant stat table;
- persisted Role/Class;
- universal skill taxonomy;
- universal life-events/facts table;
- universal Knowledge database;
- persistent question backlog merely because questions exist;
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

1. Define the smallest useful human question.
2. Identify the real-world phenomenon.
3. Classify it as recorded reality, deterministic derivation, intelligent inference, or symbolic interpretation.
4. Identify the true owner of canonical state, if one is needed.
5. Identify Knowledge capabilities needed to resolve/interpret it.
6. Preserve time, provenance, authority, coverage, uncertainty, freshness, and lineage.
7. Define Information Needs and the appropriate resolver order.
8. Define when Navigator may ask, and why.
9. Define Schedule / Requirement implications where relevant.
10. Define base vs effective capability effects where relevant.
11. Define atomic vs resumable semantics for cross-module user intent.
12. Implement one end-to-end vertical slice.
13. Test ambiguity, conflict, provider outage, stale state, correction, and unknowns.
14. Observe real use before generalizing further.

> The architecture succeeds when Wayfinder can understand more while the player has to manage less.
