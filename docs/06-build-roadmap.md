# Wayfinder Build Roadmap

**Version:** 0.6  
**Status:** CANDIDATE — Person/Temporal/Body + Character Initialization live; Knowledge/Inquiry spine is current build target

The roadmap prioritizes architectural leverage, complete vertical slices, real evidence, low player burden, and clear information ownership over feature count or screen count.

## Phase 0 — Foundation

**Status: stable enough / recursive**

Constitution, ontology, architecture, object contracts, domain protocol, validation loop, physical schema, ADR process, and recovery documentation exist and have survived repeated pressure tests.

## Phase 1 — Executable kernel

**Status: passed for Slice 1A**

Proven:
- owner identity;
- command envelope + idempotency;
- private module boundaries;
- Direction graph;
- exact Evidence links;
- versioned correction lineage;
- read/projection seam;
- result coverage vs epistemic coverage;
- atomic user-intent command boundaries;
- occurred vs recorded time;
- frontend private-table boundary guard.

## Phase 2 — Practice proving slice

**Status: backend proven**

Practice remains architectural evidence, not the shape of the final product.

Proven:
- Practice identity;
- atomic PracticeSession capture;
- occurrence time vs record time;
- correction;
- exact Evidence to Action;
- current/stale evidence behavior;
- Practice catalog;
- browser command boundary.

## Phase 3 — Projection proving slices

**Status: backend proven / player surface intentionally reduced**

Implemented:
- Action Fulfillment;
- Bearing;
- Helm projection;
- Journey projection.

These prove reconstructable projections can remain separate from canonical state.

## Phase 4 — Quiet player shell

**Status: live**

Normal player mode is intentionally quiet/read-only.

> Build the model/intelligence first. Add UI only when Wayfinder has something genuinely useful to show or ask.

No manual Practice/Direction/Evidence/correction inputs are part of normal player mode.

## Phase 5 — Mature Life RPG architectural grammar

**Status: CANDIDATE-STABLE / recursively active**

References:
- `docs/18-mature-life-rpg-architecture-v0.2.md`
- `docs/20-knowledge-and-home-surface-v0.1.md`
- `docs/21-knowledge-inquiry-and-acquisition-spine-v0.1.md`

Current high-leverage laws:

- canonical reality remains small and domain-owned;
- four epistemic layers remain explicit;
- Time is cross-cutting rather than a life domain;
- Schedule owns planned temporal allocation, not occurrence;
- Requirements/Standards are distinct from goals and schedules;
- recurring requirement evaluation is timezone- and coverage-aware;
- RPG mechanics are projections by default;
- inventory modifies effective capability, not permanent base mastery;
- Discovery routes candidate facts through owning modules;
- Reference Knowledge is separate from Player Reality;
- Navigator questions are derived from structured Information Needs;
- an Information Need should use the correct resolver before bothering the player;
- questions require a legitimate destination, derived use, or explicit session-only purpose;
- astrology = canonical birth facts + deterministic calculation + symbolic interpretation;
- Owner, Person, Body, and Character are distinct concepts;
- Home/Helm is a relevance projection, not a widget dashboard;
- no universal life/facts/profile table.

ADR-030 through ADR-035 capture the strongest durable decisions.

## Phase 6 — Person + shared temporal contracts

**Status: ✅ LIVE / DATABASE GATE PASSED**

Deployed:

```text
wf_person.persons
wf_person.person_versions
wf_system.local_day_bounds(local_date, zone_id)
```

Public Person RPCs:

```text
wf_person_create
wf_person_update_profile
wf_person_current_v0
```

Person owns only preferred identity and stable/correctable birth/origin facts.

The temporal kernel proves local-day scope across DST instead of assuming every day is 24 elapsed hours.

## Phase 7 — Body asymmetric slice

**Status: ✅ LIVE / DATABASE GATE PASSED**

Deployed:

```text
wf_body.measurements
wf_body.measurement_versions
```

Admitted metrics:

```text
height
weight
```

Public RPCs:

```text
wf_body_record_measurement
wf_body_correct_measurement
wf_body_current_v0
```

Height/weight are temporal Body facts, not Person columns.

## Phase 8 — Character Creation backend orchestration

**Status: ✅ LIVE / ATOMICITY GATE PASSED**

Public orchestration RPC:

```text
wf_character_initialize_v0
```

One player-facing Character Creation intent can atomically route:

```text
Name / birth facts -> Person
Height / weight    -> Body
```

without creating a canonical Character table or collapsing module ownership.

Live rollback testing proved all-or-nothing initialization, retry safety, no duplicate creation, and correlated module changes.

**Player-facing UI remains intentionally deferred.** Home Base remains deferred until World earns a canonical owner.

## Phase 9 — Knowledge + Inquiry acquisition spine

**Status: ← CURRENT BUILD TARGET**

Reference: `docs/21-knowledge-inquiry-and-acquisition-spine-v0.1.md` and ADR-035.

Build the minimum cross-domain intelligence contracts before broad domain expansion:

```text
KnowledgeQuery / KnowledgeResolution
Knowledge provider registry + readiness
InformationNeed
QuestionOpportunity
Question priority classes
Information Resolution Router
source/answer provenance handoff
bounded context handoff
relevance handoff to Helm/Navigator
```

Resolution law:

```text
canonical player read
 -> deterministic derivation
 -> trusted reference knowledge
 -> live external context when materially needed
 -> player question when appropriate
 -> preserve unknown
```

No model-improvised fallback.

Do not create a universal `wf_knowledge`, `wf_questions`, or profile-completion schema yet.

## Phase 10 — Birth-context Knowledge proving slice

**Status: candidate immediately after Phase 9 contracts**

Use astrology readiness as the first executable Knowledge + Question Planner slice.

Prove:

```text
Person.birth_place_label
 -> geo.resolve_place
 -> resolved coordinates/place OR ambiguity

resolved coordinates + local birth datetime
 -> geo.resolve_timezone
 -> IANA timezone / historical temporal context

resolved context
 -> natal readiness
```

Ambiguity should become an Information Need and only become a player question when precise natal computation materially requires resolution.

Missing birth time remains unknown unless chart features requiring it are requested or the player enters an opt-in Discovery Session.

## Phase 11 — Deterministic natal calculation

**Status: candidate**

Once birth context is resolved, prove:

```text
birth date/time/place
 -> resolved geographic/time context
 -> ephemeris implementation + version
 -> planetary positions
 -> houses/aspects where inputs allow
 -> reconstructable natal geometry
```

No symbolic interpretation is required to pass this phase.

The calculator must expose missing-input limitations rather than fabricate Ascendant/houses when birth time or location resolution is insufficient.

## Phase 12 — Character Creation player experience

**Status: candidate after Knowledge/natal readiness seam**

Expose a simple RPG-like beginning that uses the already-proven atomic backend and can intelligently handle birth-context ambiguity.

Do not ask for Role, XP, Level, Skill, Path, stat self-ratings, or broad profile questionnaires.

Character Creation establishes the person. Later life evidence and selective Navigator inquiry reveal the character.

## Phase 13 — Schedule slice

**Status: candidate**

Prove one scheduled allocation and preserve planned != occurred.

Support:

```text
HARD
SOFT
WINDOWED
FLOATING
```

A Schedule allocation may reference another record but does not own the referenced Action/Quest/activity and does not prove it happened.

## Phase 14 — Requirement / Standard contract

**Status: candidate**

Prove one recurring or bounded requirement with explicit temporal scope and coverage-aware evaluation.

Examples:

```text
practice >= 30 min / day
training >= 3 sessions / week
protein >= target / local day   (after Nutrition exists)
```

Candidate evaluation states:

```text
IN_PROGRESS
SATISFIED
AT_RISK
CLOSED_BELOW_TARGET
UNKNOWN
```

Do not create a universal requirements truth store merely for convenience; let domains own/evaluate their metrics through a shared contract.

## Phase 15 — Generalized Discovery / source interpretation

**Status: candidate**

Generalize the first structured answer/source path into:

```text
source/conversation/connector
 -> candidate
 -> provenance
 -> reconciliation
 -> authorization
 -> owning module command
```

Prefer transient candidates until real asynchronous/conflict/review pressure proves durable candidate persistence is necessary.

## Phase 16 — Navigator information-need loop

**Status: candidate**

Prove full generalized behavior:
- bounded context assembly;
- KNOWN / INFERRED / CONFLICTING / UNKNOWN / MISSING-BUT-IMPORTANT separation;
- resolver selection before player questioning;
- supported answer first;
- one high-value question only when useful;
- P0/P1/P2/P3/P4 priority behavior;
- source-aware interpretation of the answer;
- question destination/purpose validation;
- proposal separate from command;
- authorization before consequential canonical mutation;
- lineage explanation;
- question cooldown / non-nagging behavior;
- opt-in adaptive Discovery Session.

## Phase 17 — Position v0 + Helm relevance router

Compose the first useful read-only Position answer to “Where am I?” from the smallest proven set of sources.

Candidate inputs:
- Person;
- current Direction;
- Schedule pressure;
- Requirement state;
- Body/current capacity where known;
- recent Activity;
- important unknowns;
- one materially relevant Navigator question if warranted.

Do not make Position a canonical table.

Helm remains sparse:

```text
POSITION
ATTENTION
NEXT WINDOW / MOVE
NAVIGATOR
```

Any section may be absent.

## Phase 18 — Inventory + effective capability

**Status: candidate**

Prove one real item and one explainable modifier:

```text
item ownership/access
 -> reference capability resolution
 -> available/equipped/in-use relation
 -> loadout/context
 -> effective capability change
```

Support explainable modifier semantics such as BOOST, GATE, UNLOCK, REDUCER, CONSTRAINT, and SYNERGY.

Ownership alone must not create permanent Skill/Mastery growth.

## Phase 19 — Skill + Role projections

Infer one narrow skill family from evidence, then one higher-order Role pattern.

Prove:
- evidence lineage;
- uncertainty;
- recency/frequency/depth effects;
- reference skill knowledge without rigid universal taxonomy;
- explainability;
- separation of base capability from equipment/context;
- no user-entered levels required.

## Phase 20 — Training + Nutrition

Add Training and Nutrition as distinct factual modules once their semantics are needed.

Knowledge Engine responsibilities include:

```text
Training -> exercise/movement/equipment reference knowledge + versioned guidance
Nutrition -> food/nutrient reference data + versioned guidance
```

Player canonical state remains the actual workouts/meals/intake.

Then prove one cross-domain growth question:

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

## Phase 21 — Daily / Weekly Review + temporal guidance

Reviews remain projections by default.

Prove:
- what happened;
- requirement state;
- schedule pressure;
- quest movement;
- current unknowns;
- what matters next;
- selective question opportunities rather than review questionnaires.

System Review != user-authored Reflection.

## Phase 22 — Symbolic astrology guidance

Once natal calculation and grounded life context are stable, add clearly labeled symbolic interpretation and transit guidance.

Navigator may combine practical guidance with the astrology lens while preserving the authority distinction.

## Phase 23 — Expand domains under pressure

Admit new modules only when distinct factual semantics demand them:
- Finance;
- World / Atlas;
- Social / Relationships;
- richer Inventory;
- richer Knowledge/Lore;
- additional domain-specific Requirements;
- other real-life areas proven through use.

Every new domain should reuse the same Knowledge/Inquiry/Discovery/Guidance seams rather than inventing its own AI behavior.

## Deferred until architecture earns them

- permanent XP ledger;
- universal skill taxonomy;
- persisted Role/Class;
- giant stat table;
- autonomous canonical AI writes;
- arbitrary gear-score persistence;
- universal life-events/facts table;
- universal profile/preferences blob;
- profile-completeness percentage;
- astrology interpretations stored as facts;
- broad frontend forms;
- universal Journey event table;
- giant persistent Discovery inbox without real reconciliation pressure;
- giant persistent Question queue without real cross-session pressure;
- universal Knowledge database before provider-specific needs prove it;
- vector database as a default solution for structured reference facts;
- speculative empty schemas.

## Build discipline

For every expansion:

1. define the smallest useful human question;
2. identify the real-world phenomenon;
3. classify it as recorded reality, deterministic derivation, intelligent inference, or symbolic interpretation;
4. decide whether a new canonical owner is actually required;
5. identify whether missing information belongs to Player Reality, Knowledge, Live Context, or preserved uncertainty;
6. choose the correct resolver before considering a player question;
7. if asking, define the answer destination/derived use/session-only purpose;
8. prefer reconstructable projections over duplicated state;
9. preserve time/provenance/coverage/uncertainty;
10. define Discovery recognition;
11. define Schedule/Requirement semantics if relevant;
12. define base vs effective capability effects;
13. define what Navigator may say/ask/propose;
14. define atomic vs resumable semantics for any multi-module user intent;
15. define Helm relevance/expiry rather than adding a permanent widget;
16. implement one end-to-end slice;
17. stress invariants, complements, ambiguity, provider failure, and missing data;
18. observe real use;
19. promote, adapt, or reject assumptions.

The measure of progress is how much real life Wayfinder can correctly model, resolve, discover, evaluate, explain, and guide while asking less of the player — not the number of screens, tables, integrations, questions, knowledge entries, or RPG mechanics.
