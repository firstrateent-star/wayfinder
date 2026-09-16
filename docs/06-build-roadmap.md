# Wayfinder Build Roadmap

**Version:** 0.5  
**Status:** CANDIDATE — Person/Temporal/Body live; Character Creation orchestration next

The roadmap prioritizes architectural leverage, complete vertical slices, real evidence, and low player burden over feature count or screen count.

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

## Phase 5 — Mature Life RPG architectural freeze

**Status: CANDIDATE-STABLE target / recursively active**

Reference: `docs/18-mature-life-rpg-architecture-v0.2.md`.

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
- Navigator questions are information-need driven;
- astrology = canonical birth facts + deterministic calculation + symbolic interpretation;
- Owner, Person, Body, and Character are distinct concepts;
- no universal life/facts table.

ADR-030 through ADR-032 capture the strongest durable decisions.

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

The temporal kernel now proves local-day scope across DST instead of assuming every day is 24 elapsed hours.

Live rollback testing proved retry safety, semantic NOOP, exact correction lineage, stale-version rejection, private-schema denial, and deferred-head integrity.

Reference: `docs/19-person-temporal-body-v0.1.md`.

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

Proven:

```text
measurement
 -> source quantity/unit
 -> observed time
 -> exact version/correction lineage
 -> deterministic unit normalization
 -> latest-recorded Body read
 -> explicit epistemic limits
```

Height/weight are temporal Body facts, not Person columns.

Reference: `lab/person-temporal-body-live-test-v0.1.md`.

## Phase 8 — Character Creation orchestration

**Status: ← CURRENT DESIGN / BUILD TARGET**

The player should experience Character Creation as a simple RPG-like beginning while the backend preserves distinct owners:

```text
Name / birth facts -> Person
Height / weight    -> Body
Home Base          -> World only after World exists; otherwise defer
```

No Role, XP, Level, Skill, Path, or stat inputs.

### Gate before UI exposure

The next Flower must resolve transaction truth.

If the player experiences initial creation as one indivisible save, then a Person write plus required initial Body measurements cannot be several unrelated client commits that may leave a misleading half-created Character.

Choose and prove one of two semantics:

```text
A. ATOMIC INITIAL CAPTURE
   one authoritative orchestration boundary commits the required cross-module state together

B. EXPLICITLY RESUMABLE CAPTURE
   partial completion is first-class, visible, safe to retry, and never presented as complete
```

Do not let frontend convenience choose this implicitly.

Only after this boundary passes stress testing should the player-facing Character Creation screen be exposed.

## Phase 9 — Deterministic natal calculation

**Status: candidate after Character Creation contract**

Once birth facts exist, prove:

```text
birth date/time/place
 -> resolved geographic coordinates/timezone where required
 -> ephemeris/version
 -> planetary positions
 -> houses/aspects where inputs allow
 -> reconstructable natal geometry
```

No symbolic interpretation is required to pass this phase.

The calculator must expose missing-input limitations rather than fabricating Ascendant/houses when birth time or location resolution is insufficient.

## Phase 10 — Schedule slice

**Status: candidate**

Prove one scheduled allocation and preserve planned != occurred.

Support the conceptual planning modes:

```text
HARD
SOFT
WINDOWED
FLOATING
```

A Schedule allocation may reference another record but does not own the referenced Action/Quest/activity and does not prove it happened.

## Phase 11 — Requirement / Standard contract

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

## Phase 12 — Discovery contract

**Status: candidate**

Prove:

```text
source/conversation
 -> candidate
 -> provenance
 -> reconciliation
 -> authorization
 -> owning module command
```

Prefer transient candidates until real asynchronous/conflict/review pressure proves durable candidate persistence is necessary.

## Phase 13 — Navigator information-need loop

**Status: candidate**

Navigator should prove:
- bounded context assembly;
- KNOWN / INFERRED / CONFLICTING / UNKNOWN / MISSING-BUT-IMPORTANT separation;
- supported answer first;
- one high-value question only when useful;
- source-aware interpretation of the answer;
- proposal separate from command;
- authorization before consequential canonical mutation;
- lineage explanation.

## Phase 14 — Position v0

Compose the first useful read-only Position answer to “Where am I?” from the smallest proven set of sources:

- Person;
- current Direction;
- Schedule pressure;
- Requirement state;
- Body/current capacity where known;
- recent Activity;
- important unknowns.

Do not make Position a canonical table.

## Phase 15 — Inventory + effective capability

**Status: candidate**

Prove one real item and one explainable modifier:

```text
item ownership/access
 -> capability metadata
 -> available/equipped/in-use relation
 -> loadout/context
 -> effective capability change
```

Support explainable modifier semantics such as BOOST, GATE, UNLOCK, REDUCER, CONSTRAINT, and SYNERGY.

Ownership alone must not create permanent Skill/Mastery growth.

## Phase 16 — Skill + Role projections

Infer one narrow skill family from evidence, then one higher-order Role pattern.

Prove:
- evidence lineage;
- uncertainty;
- recency/frequency/depth effects;
- explainability;
- separation of base capability from equipment/context;
- no user-entered levels required.

## Phase 17 — Training + Nutrition

Add Training and Nutrition as distinct factual modules once their semantics are needed.

Training proves exercise/workout structure. Nutrition proves meals/intake/quantity and estimated-vs-measured nutrient semantics.

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

## Phase 18 — Daily / Weekly Review + temporal guidance

Reviews remain projections by default.

Prove:
- what happened;
- requirement state;
- schedule pressure;
- quest movement;
- current unknowns;
- what matters next.

System Review != user-authored Reflection.

## Phase 19 — Symbolic astrology guidance

Once natal calculation and grounded life context are stable, add clearly labeled symbolic interpretation and transit guidance.

Navigator may combine practical guidance with the astrology lens while preserving the authority distinction.

## Phase 20 — Expand domains under pressure

Admit new modules only when distinct factual semantics demand them:
- Finance;
- World / Atlas;
- Social / Relationships;
- richer Inventory;
- richer Knowledge/Lore;
- additional domain-specific Requirements;
- other real-life areas proven through use.

## Deferred until architecture earns them

- permanent XP ledger;
- universal skill taxonomy;
- persisted Role/Class;
- giant stat table;
- autonomous canonical AI writes;
- arbitrary gear-score persistence;
- universal life-events/facts table;
- astrology interpretations stored as facts;
- broad frontend forms;
- universal Journey event table;
- giant persistent Discovery inbox without real reconciliation pressure;
- speculative empty schemas.

## Build discipline

For every expansion:

1. define the smallest useful human question;
2. identify the real-world phenomenon;
3. classify it as recorded reality, deterministic derivation, intelligent inference, or symbolic interpretation;
4. decide whether a new canonical owner is actually required;
5. prefer reconstructable projections over duplicated state;
6. preserve time/provenance/coverage/uncertainty;
7. define Discovery recognition;
8. define Schedule/Requirement semantics if relevant;
9. define base vs effective capability effects;
10. define what Navigator may say/ask/propose;
11. define atomic vs resumable semantics for any multi-module user intent;
12. implement one end-to-end slice;
13. stress invariants and complements;
14. observe real use;
15. promote, adapt, or reject assumptions.

The measure of progress is how much real life Wayfinder can correctly model, discover, evaluate, explain, and guide while asking less of the player — not the number of screens, tables, integrations, or RPG mechanics.
