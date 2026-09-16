# Wayfinder Build Roadmap

**Version:** 0.7  
**Status:** CANDIDATE-STABLE — Knowledge/Inquiry spine + birth-context proving slice live

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

Normal Helm is intentionally sparse/read-only.

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

Live:

```text
wf_person.persons
wf_person.person_versions
wf_system.local_day_bounds(...)
```

Person owns preferred identity and stable/correctable birth/origin facts only.

## Phase 7 — Body asymmetric slice

**Status:** ✅ LIVE / GATE PASSED

Live canonical metrics:

```text
height
weight
```

Body owns temporal physical observations; unit normalization is deterministic derivation.

## Phase 8 — Atomic Character Creation backend

**Status:** ✅ LIVE / ATOMICITY GATE PASSED

`wf_character_initialize_v0` atomically routes one player intent across Person + Body while preserving module ownership. No canonical Character table exists.

Player-facing Character Creation remains deferred until the next presentation seam is ready.

## Phase 9 — Knowledge + Inquiry Acquisition Spine

**Status:** ✅ EXECUTABLE FRAMEWORK / CI PASSED

Reference: `docs/21-knowledge-inquiry-and-acquisition-spine-v0.1.md`, ADR-035.

Executable runtime:

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

No universal `wf_knowledge`, `wf_questions`, profile completeness table, or generic fact store exists.

## Phase 10 — Birth-context Knowledge proving slice

**Status:** ✅ LIVE / EDGE FUNCTION ACTIVE / CI PASSED

Reference: `docs/22-birth-context-knowledge-slice-v0.1.md`, ADR-036.

Live Edge Function:

```text
birth-context
verify_jwt = true
```

Flow:

```text
Person.birth_place_label
 -> geo.resolve_place
 -> RESOLVED | AMBIGUOUS | UNAVAILABLE
 -> prioritized player question when appropriate
 -> geo.resolve_timezone
 -> time.resolve_local_instant
 -> natal readiness
```

Proven in automated tests:

```text
qualified Key West resolution
historical UTC conversion
place ambiguity preservation
question prioritization
non-nagging missing birth time
Discovery Session questioning
DST fold ambiguity
provider-outage preservation
```

Current external geocoding provider is provisional and replaceable behind the capability contract.

Current local-time resolver uses runtime `Intl` timezone rules; pin/version a timezone dataset before treating persisted natal geometry as perfectly reproducible.

## Phase 11 — Deterministic natal geometry

**Status:** ← NEXT BUILD TARGET

Build a deterministic, versioned ephemeris capability over resolved birth context.

Prove:

```text
UTC birth instant
+ WGS84 coordinates
+ ephemeris implementation/data version
 -> planetary positions
 -> Ascendant / houses when supported
 -> aspects
```

Requirements:

- no symbolic interpretation in this phase;
- explicit algorithm/data version;
- missing/approximate inputs remain visible;
- no noon defaults;
- output is reconstructable derivation, not Person truth.

## Phase 12 — Character Creation UI

**Status:** candidate after natal-readiness + deterministic natal seam

One simple RPG-like flow may collect:

```text
Name
Birth date
Birth time optional/approximate/unknown
Birthplace
Height optional
Weight starting observation optional
```

The frontend may feel unified while backend ownership remains separate.

No Role, XP, Level, Skill, Path, or stat self-rating.

## Phase 13 — Schedule

**Status:** candidate

Prove one planned temporal allocation while preserving planned != occurred.

Modes:

```text
HARD
SOFT
WINDOWED
FLOATING
```

## Phase 14 — Requirements / Standards

**Status:** candidate

Prove one timezone-correct recurring/bounded requirement with coverage-aware evaluation.

Candidate states:

```text
IN_PROGRESS
SATISFIED
AT_RISK
CLOSED_BELOW_TARGET
UNKNOWN
```

Domains own metric semantics; no universal requirement truth store merely for convenience.

## Phase 15 — Generalized Discovery

**Status:** candidate

Prove:

```text
source
 -> candidate
 -> provenance
 -> reconciliation
 -> authorization
 -> owning domain command
```

Prefer transient candidates until durable queues/conflict workflows earn persistence.

## Phase 16 — Navigator active-learning loop

**Status:** candidate

Prove bounded context assembly plus:

```text
KNOWN
INFERRED
CONFLICTING
UNKNOWN
MISSING-BUT-IMPORTANT
```

Navigator should answer the supported portion first, then ask the smallest high-value question when needed.

## Phase 17 — Position + relevance-driven Helm

**Status:** candidate

Compose “Where am I?” from proven domains and only surface information that matters now.

Home remains a relevance projection, not a dashboard.

## Phase 18 — Inventory + Effective Capability

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

## Phase 19 — Skill + Role projections

**Status:** candidate

Infer one narrow Skill from evidence and one higher-order Role pattern. Preserve lineage, uncertainty, recency, and base-vs-effective capability separation.

## Phase 20 — Training + Nutrition

**Status:** candidate

Add distinct factual domains once their semantics are needed.

Training reference knowledge:

```text
exercise
movement family
muscles
variants
equipment requirements
```

Nutrition reference knowledge:

```text
foods
serving units
energy/macros/micros
source quality
measured vs estimated resolution
```

Then prove cross-domain growth:

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

## Phase 21 — Recurring minimums / macros / strength guidance

**Status:** candidate after Training + Nutrition

Prove examples such as:

```text
protein >= target / local day
strength exposure >= target / week
```

Incomplete logging never means unrecorded intake/activity was zero.

## Phase 22 — Daily / Weekly Review

**Status:** candidate

Reviews remain projections by default.

System Review != player-authored Reflection.

## Phase 23 — Symbolic astrology

**Status:** candidate after deterministic chart + grounded life context

```text
canonical birth facts
 -> deterministic natal/transit geometry
 -> versioned symbolic astrology knowledge
 -> clearly labeled interpretation
```

Astrology may enrich Navigator guidance but must never masquerade as empirical personal truth or crowd out more relevant grounded information.

## Phase 24 — Expand real-life domains under pressure

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
- astrology interpretations as facts;
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
