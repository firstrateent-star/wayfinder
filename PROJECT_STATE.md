# Wayfinder — Project State / Chat Recovery

**Repository:** `firstrateent-star/wayfinder`  
**Current milestone:** Initial Position + first governed Discovery Session live  
**Current phase:** observe the new Helm/Discovery seam; next broad domain target is minimum Training + Nutrition requirement proof  
**Current roadmap:** `docs/06-build-roadmap.md` v0.9  
**Mature architecture:** `docs/18-mature-life-rpg-architecture-v0.2.md`  
**Knowledge/Home:** `docs/20-knowledge-and-home-surface-v0.1.md`  
**Knowledge/Inquiry spine:** `docs/21-knowledge-inquiry-and-acquisition-spine-v0.1.md`  
**Birth context:** `docs/22-birth-context-knowledge-slice-v0.1.md`  
**Natal geometry:** `docs/23-natal-geometry-v0.1.md`  
**Character/Schedule/Requirements:** `docs/24-character-schedule-requirements-v0.1.md`  
**Initial Position/Discovery:** `docs/25-initial-position-discovery-v0.1.md`  
**Latest ADR:** `decisions/ADR-039-initial-position-is-derived-discovery-writes-through-domain-commands.md`

## Non-negotiable direction

Wayfinder is being rebuilt from the ground up using the newer Vlourish / Flower architecture. Old Wayfinder code is research evidence only; do not merge/migrate it into this architecture.

Wayfinder is a personal Life OS expressed as a Life RPG. The RPG represents evidence-backed lived reality; it is not the source of truth.

Core laws:

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
- Requirement/Standard is distinct from Goal and Schedule;
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
- a player declining to add information does not automatically establish canonical absence;
- no model-improvised fallback when a resolver cannot establish an answer.

## Mature architecture

```text
TIME
 |
 +--> CANONICAL PLAYER PLANE
 |      System / Person / Body / Direction / Practice / Schedule / ...
 |
 +--> KNOWLEDGE PLANE
 |      deterministic / reference / guidance / live external
 |
 +--> ACQUISITION + INQUIRY
 |      InformationNeed / resolver routing / QuestionPlanner
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

Four epistemic layers:

```text
1. RECORDED REALITY
2. DETERMINISTIC DERIVATION
3. INTELLIGENT INFERENCE
4. SYMBOLIC INTERPRETATION
```

A lower-authority layer must never masquerade as a higher-authority layer.

## Current deployed canonical backend

Supabase project ref: `ngakauhlcmvwnmimtsca`.

Private Wayfinder schemas:

```text
wf_system
wf_person
wf_direction
wf_practice
wf_evidence
wf_body
wf_schedule
```

Canonical tables:

```text
wf_system
├── owners
├── command_receipts
└── module_change_outbox

wf_person
├── persons
└── person_versions

wf_direction
├── nodes
├── node_versions
└── edges

wf_practice
├── practices
├── sessions
└── session_versions

wf_evidence
└── links

wf_body
├── measurements
└── measurement_versions

wf_schedule
├── allocations
└── allocation_versions
```

Authenticated clients use narrow public typed RPCs; private canonical schemas remain inaccessible directly to `anon` / `authenticated`.

## Proven substrate

Still valid:

- owner bootstrap and auth scope;
- idempotent command runtime;
- private module boundaries;
- exact-version lineage;
- correction/supersession with stale-write rejection;
- transactional ModuleChange outbox;
- result coverage vs epistemic coverage;
- occurred vs recorded vs planned time separation;
- public read/projection seam;
- frontend private-table guard;
- deferred version-head integrity.

Direction / Practice / Evidence / prior Helm / Journey remain proof infrastructure.

## Person + Temporal Kernel — ✅ LIVE

Person is distinct from owner/auth scope.

Canonical Person owns:

```text
display/preferred name
birth date?
birth local time?
birth-time accuracy?  EXACT | APPROXIMATE
birth-place label?
```

Person does not own Body, Role, Skill, XP, finances, current location, astrology interpretation, coordinates, or timezone reference data.

Public Person RPCs:

```text
wf_person_create
wf_person_update_profile
wf_person_current_v0
```

Temporal helper:

```text
wf_system.local_day_bounds(local_date, zone_id)
```

DST proof for `America/New_York`:

```text
2026-03-08 -> 23h
2026-09-15 -> 24h
2026-11-01 -> 25h
```

## Body v0.1 — ✅ LIVE

Canonical metrics:

```text
height
weight
```

Height/weight are temporal Body observations, not Person profile columns.

Public RPCs:

```text
wf_body_record_measurement
wf_body_correct_measurement
wf_body_current_v0
```

Unit normalization is deterministic derivation; latest recorded observation != perfect current physical truth.

## Character Creation — ✅ BACKEND + PLAYER FLOW

Atomic backend:

```text
wf_character_initialize_v0
```

Routes one indivisible player intent:

```text
name / birth facts -> Person
height             -> Body optional
weight             -> Body optional
```

All required child writes commit or roll back together. Character is still not a canonical table.

Frontend gate:

```text
Person missing -> /create-character
Person exists  -> /helm
```

Character Creation collects only grounded starting facts. Birth time/place and Body observations may remain unknown/optional. No Role, Skill, XP, Level, Path or attribute self-rating is collected.

## Knowledge + Inquiry Acquisition Spine — ✅ EXECUTABLE / CI PASSED

Shared runtime:

```text
supabase/functions/_shared/intelligence/
├── contracts.ts
├── knowledge-registry.ts
├── knowledge-router.ts
├── acquisition-router.ts
├── question-planner.ts
├── geo-open-meteo.ts
├── local-time-resolver.ts
├── birth-context-service.ts
├── natal-geometry.ts
├── natal-geometry-service.ts
├── requirements.ts
└── initial-position-service.ts
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

There is no LLM-guess fallback.

Question Planner uses structured Information Needs, not blank profile fields.

Priority classes:

```text
P0_BLOCKING
P1_HIGH_IMPACT
P2_HIGH_LEVERAGE
P3_CALIBRATION
P4_OPTIONAL
```

Normal mode has a low question budget. Discovery Session may ask broader/high-leverage questions adaptively.

Do not persist a universal question backlog merely because the runtime can create Information Needs.

## Birth Context — ✅ LIVE / CI PASSED

Live JWT-protected Edge Function:

```text
birth-context
```

```text
Person birth facts
 -> geo.resolve_place
 -> RESOLVED | AMBIGUOUS | UNAVAILABLE
 -> Question Planner when clarification is appropriate
 -> geo.resolve_timezone
 -> time.resolve_local_instant
 -> natal readiness
```

Current place provider is Open-Meteo behind replaceable capability `geo.resolve_place`.

Current local-time provider uses runtime `Intl` timezone rules and preserves DST gaps/folds instead of guessing.

Known limitation: pin/version a timezone-rule dataset before treating persisted natal snapshots as perfectly replayable solely from original wall-clock input.

## Deterministic natal geometry — ✅ LIVE / CI PASSED

Live JWT-protected Edge Function:

```text
natal-geometry
```

Pinned provider:

```text
Astronomy Engine 2.1.19
```

Current deterministic output includes:

```text
Sun through Pluto
geocentric tropical true-ecliptic-of-date longitude/latitude
zodiac sign + degree
approximate DIRECT / RETROGRADE / STATIONARY motion
Ascendant / MC / Descendant / IC
Equal houses
Whole Sign houses
pairwise angular separations
nearest major aspect angle + geometric orb
```

Natal geometry does NOT decide whether an aspect is symbolically active and does not store interpretation as fact.

## Schedule v0.1 — ✅ LIVE / DATABASE GATE PASSED

Private canonical tables:

```text
wf_schedule.allocations
wf_schedule.allocation_versions
```

Kinds:

```text
HARD
SOFT
WINDOWED
FLOATING
```

State:

```text
PLANNED
CANCELLED
```

Public RPCs:

```text
wf_schedule_create_allocation
wf_schedule_revise_allocation
wf_schedule_current_v0
```

Schedule may reference another module's object, but it owns only the planned time allocation. A passed Schedule interval never proves activity occurred.

Frontend client seam:

```text
apps/web/src/lib/schedule-types.ts
apps/web/src/lib/schedule-rpc.ts
```

## Requirement contract v0.1 — ✅ EXECUTABLE / CI PASSED

There is intentionally no universal `wf_requirements` canonical table.

Shared evaluator:

```text
supabase/functions/_shared/intelligence/requirements.ts
```

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

Evaluation states:

```text
SATISFIED
IN_PROGRESS
CLOSED_BELOW_TARGET
BREACHED
UNKNOWN
```

Coverage law example for `protein >= 150g / local day`:

```text
110g, day open, partial     -> IN_PROGRESS
155g, day open, partial     -> SATISFIED
110g, day closed, partial   -> UNKNOWN
110g, day closed, complete  -> CLOSED_BELOW_TARGET
```

The evaluator does not decide whether the requirement itself is appropriate. Nutrition/Training/etc. own metric semantics and provide observations/coverage.

## Initial Position + Discovery v0.1 — ✅ LIVE / CI PASSED

Reference: `docs/25-initial-position-discovery-v0.1.md`, ADR-039.

Live JWT-protected Edge Function:

```text
initial-position
version: 1
verify_jwt: true
status: ACTIVE
```

Initial Position is reconstructable, not canonical. Current composition:

```text
Person
+ Body baseline presence
+ bounded Schedule
+ Question Planner
 -> initial_position_v0.1
```

The projection explicitly does **not** assert:

```text
unscheduled time is free
planned allocation occurred
all real commitments are known
missing Body observations are zero/absent
```

Helm now greets the player by name and surfaces only:

```text
starting character foundation
Body baseline state
next local day's known planned-time state
Navigator discovery entry point
```

It remains intentionally sparse and is not a domain dashboard.

First Discovery Information Need:

```text
schedule.next_day.coverage
```

Behavior:

```text
TASK_DRIVEN
 -> no proactive P2 schedule question

DISCOVERY_SESSION
 -> one bounded question
 -> asks whether anything fixed exists next local day
```

If player says yes:

```text
label + start/end
 -> explicit authorization
 -> wf_schedule_create_allocation(kind=HARD)
 -> refresh Initial Position
```

If player says nothing to add:

```text
no canonical absence record
unknown remains unknown
```

The first Discovery experience is deliberately structured. General LLM extraction is deferred until generalized Discovery proves candidate/provenance/reconciliation/authorization across more domains.

Automated test:

```text
lab/initial-position-discovery-v0.1.test.ts
```

Intelligence CI passed. Web CI caught unsupported Button variants during implementation; those were corrected and the final Web CI passed. Vercel reports successful deployment for the corrected frontend build.

## Database health

A performance-advisor pass found unindexed composite foreign keys across newer Person, Body and Schedule schemas. They were covered in:

```text
20260916030500_index_wayfinder_person_body_schedule_foreign_keys.sql
```

A second performance-advisor pass no longer reports `unindexed_foreign_keys` for these modules. Newly created indexes may appear unused until traffic exercises them.

Security advisor context remains intentional:

```text
authenticated browser
 -> public owner-scoped SECURITY DEFINER RPC
 -> private canonical schema
```

The advisor warns that authenticated users can execute those RPCs because this is the designed API boundary. Direct private-schema access has been tested denied.

`Leaked Password Protection Disabled` remains a production-hardening item.

## Helm / Home law

Helm is a relevance projection, not a dashboard.

```text
HELM
├── Position
├── Attention
├── Next window / move
└── Navigator
```

Any section may be absent. Silence is valid.

No domain receives permanent Home real estate merely because it exists.

A surfaced item should answer:

```text
Why now?
What kind of claim is this?
What supports it?
What can I do?
When does it stop mattering?
```

## Character / RPG ownership

```text
Owner     -> auth/system scope
Person    -> identity + stable/correctable origin facts
Body      -> temporal physical observations
Character -> composed projection
```

Future Character composes Identity, Origin, Body, Skills, Roles, Attributes, Inventory/Gear, Effective State, Archetypes, Path and Achievements from their true owners and projections.

No canonical Character aggregate solely for UI convenience.

## Time / Schedule / Requirement relationship

```text
DIRECTION
why it matters

REQUIREMENT
what bounded condition should be satisfied

SCHEDULE
when time is allocated

REALITY
what actually happened
```

These may reference one another but remain distinct claims.

## Training / Nutrition next broad-domain law

Training and Nutrition remain the strongest next bounded-domain proving slice because Schedule and Requirement grammar now need real domain-owned observations.

Training should eventually own factual workout semantics such as:

```text
workout/session
exercise
sets/reps/load
training exposure
```

Nutrition should own factual intake semantics such as:

```text
meal/intake
food resolution
measured vs estimated nutrients
protein / calories / macros
coverage
```

Reference Knowledge supplies reusable exercise/food facts rather than relying on unstructured LLM memory.

First real requirements to prove:

```text
strength sessions >= N / local week
protein >= target grams / local day
```

Incomplete logs remain incomplete; unrecorded intake/activity is not zero.

Strength/growth later becomes cross-domain:

```text
Training
+ Nutrition
+ Body
+ Recovery
+ Time
+ Equipment
 -> Growth analysis
```

## Symbolic guidance later

Astrology:

```text
Birth facts                 -> canonical Person
Resolved place/time context -> Knowledge + deterministic derivation
Natal geometry              -> deterministic derivation
Astrology meanings          -> symbolic Knowledge
Personal interpretation     -> symbolic/reflective guidance
```

Tarot fits the same broad symbolic/reflection family later:

```text
recorded draw
+ deck/card/spread reference knowledge
 -> contextual symbolic interpretation
 -> player reflection
```

Tarot cards do not directly establish canonical player facts or stat growth.

## Current Player UI

Character Creation is the deliberate initial input exception.

`/helm` now hosts Initial Position + the opt-in first Discovery Session.

Do not add permanent Schedule, macro, workout, money, astrology, inventory or XP cards merely because those subsystems exist.

The user is actively evaluating the real Helm experience. Prefer iterating from observed use rather than prematurely expanding Home.

## Next build

Immediate product step: **have the player refresh/use the new Helm + Discovery Session and observe the experience.**

Next broad architectural slice after that remains **minimum Training + Nutrition requirement proof**:

```text
Training reality
 -> weekly strength-exposure metric
 -> requirement evaluation

Nutrition reality
 -> protein aggregation + coverage
 -> daily protein requirement evaluation
```

Flower before schema admission:

- determine minimum Training entities that preserve workout/exercise/set semantics without overbuilding;
- determine minimum Nutrition entities that preserve food/intake/nutrient estimate provenance;
- separate measured nutrient data from AI-estimated food resolution;
- define exercise/food Knowledge capability seams;
- derive local-day/local-week scopes from Temporal Kernel;
- keep domain requirements outside a universal requirement table;
- ensure Navigator can explain exactly why a requirement signal is known, incomplete, or unknown.

After real Training/Nutrition requirements survive tests, grow Position from the current seed using Direction + Schedule + Requirements + Information Need rather than turning Helm into a dashboard.

## Recovery prompt

> Open `PROJECT_STATE.md`, then read `docs/06-build-roadmap.md`, `docs/25-initial-position-discovery-v0.1.md`, `docs/24-character-schedule-requirements-v0.1.md`, `docs/23-natal-geometry-v0.1.md`, `docs/22-birth-context-knowledge-slice-v0.1.md`, `docs/21-knowledge-inquiry-and-acquisition-spine-v0.1.md`, `docs/20-knowledge-and-home-surface-v0.1.md`, `docs/18-mature-life-rpg-architecture-v0.2.md`, ADR-039 back through ADR-030, `docs/CANON.md`, `docs/04-domain-protocol.md`, and `docs/05-intelligence-runtime.md`. Person/Body/Character Creation are live; birth context and deterministic natal geometry are live; Schedule v0.1 and the Requirement evaluator are live; Initial Position + the first governed Discovery Session are live through the JWT-protected `initial-position` Edge Function. Helm stays relevance-driven. First observe the new player flow, then build the minimum Training + Nutrition reality/Knowledge seams needed to prove weekly strength and daily protein requirements.
