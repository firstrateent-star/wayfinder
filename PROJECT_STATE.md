# Wayfinder — Project State / Chat Recovery

**Repository:** `firstrateent-star/wayfinder`  
**Current milestone:** Knowledge/Inquiry spine + birth-context proving slice live  
**Current phase:** deterministic natal geometry next; player shell remains quiet/relevance-driven  
**Current roadmap:** `docs/06-build-roadmap.md` v0.7  
**Mature architecture:** `docs/18-mature-life-rpg-architecture-v0.2.md`  
**Knowledge/Home:** `docs/20-knowledge-and-home-surface-v0.1.md`  
**Knowledge/Inquiry spine:** `docs/21-knowledge-inquiry-and-acquisition-spine-v0.1.md`  
**Birth-context slice:** `docs/22-birth-context-knowledge-slice-v0.1.md`  
**Latest ADR:** `decisions/ADR-036-birth-context-is-derived-through-knowledge-resolution.md`

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
- equipment modifies effective state, not permanent base mastery;
- Navigator asks questions only when missing information materially matters;
- astrology is symbolic guidance over deterministic chart calculation, not canonical empirical truth;
- Schedule owns planned temporal allocation, not occurrence;
- Requirement/Standard is distinct from Goal and Schedule;
- Owner/auth identity, Person identity, Body observations, and Character projection are distinct;
- Reference Knowledge is separate from Player Reality;
- the language model is a reasoner/interface, not the authoritative encyclopedia;
- available information does not automatically deserve Home visibility;
- information gaps resolve through typed resolvers before asking the player;
- no model-improvised fallback when a resolver cannot establish an answer.

## Mature architecture

```text
TIME
 |
 +--> CANONICAL PLAYER PLANE
 |      System / Person / Body / Direction / Practice / ...
 |
 +--> KNOWLEDGE PLANE
 |      deterministic / reference / guidance / live external
 |
 +--> ACQUISITION + INQUIRY
 |      InformationNeed / resolver routing / QuestionPlanner
 |
 +--> INTELLIGENCE + GUIDANCE
 |      Discovery / Position / Schedule / Requirements / Growth
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

Private schemas:

```text
wf_system
wf_person
wf_direction
wf_practice
wf_evidence
wf_body
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
- occurred vs recorded time;
- public read/projection seam;
- frontend private-table guard;
- deferred version-head integrity.

Direction / Practice / Evidence / Helm / Journey remain proof infrastructure even though normal Player Mode is intentionally sparse.

## Person + Temporal Kernel — ✅ LIVE

Person is distinct from owner/auth scope.

Canonical Person currently owns:

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

## Atomic Character Initialization — ✅ LIVE

Public orchestration RPC:

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
└── birth-context-service.ts
```

Core resolution order:

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

Ranking can consider uncertainty reduction, current relevance, decision impact, cross-domain leverage, future reuse, freshness, conflict resolution, deadline/requirement impact, answerability, user burden, sensitivity, interruption cost, redundancy and repetition.

Normal mode has a low question budget. Discovery Session may ask broader/high-leverage questions adaptively.

Do not persist a universal question backlog merely because the runtime can create Information Needs.

## Birth Context Knowledge slice — ✅ LIVE / CI PASSED

Live Supabase Edge Function:

```text
birth-context
version: 1
verify_jwt: true
status: ACTIVE
```

Path:

```text
Person birth facts
 -> geo.resolve_place
 -> RESOLVED | AMBIGUOUS | UNAVAILABLE
 -> Question Planner when player clarification is appropriate
 -> geo.resolve_timezone
 -> time.resolve_local_instant
 -> natal readiness
```

Current capabilities:

```text
geo.resolve_place
geo.resolve_timezone
time.resolve_local_instant
```

Current place provider:

```text
geo.open_meteo
```

This provider is provisional/replaceable behind the capability contract. Open-Meteo geocoding provides WGS84 coordinates and IANA timezone reference data where available.

Current local-time provider:

```text
time.intl_local_instant
```

It preserves DST gaps/folds rather than guessing.

Natal readiness states:

```text
NO_PERSON
MISSING_BIRTH_DATE
MISSING_BIRTH_PLACE
AMBIGUOUS_BIRTH_PLACE
PLACE_RESOLUTION_UNAVAILABLE
TIMEZONE_RESOLUTION_UNAVAILABLE
READY_FOR_TIME_INDEPENDENT_CHART_ONLY
AMBIGUOUS_BIRTH_INSTANT
BIRTH_INSTANT_UNRESOLVABLE
READY
```

Important limitation:

v0.1 local-time conversion uses runtime `Intl` timezone rules. Pin/version a timezone-rule dataset before treating persisted natal geometry as perfectly reproducible across runtimes.

The birth-context Edge Function is read-only. A selected birthplace candidate may resolve the current request but does not silently rewrite Person.

Persisting clarified birthplace remains an authorized Person update/correction.

## Automated intelligence validation — ✅

Workflow:

```text
.github/workflows/intelligence-ci.yml
```

Test:

```text
lab/birth-context-vertical-slice-v0.1.test.ts
```

Passing CI proves:

- qualified Key West resolution;
- historical local birth time -> UTC conversion;
- ambiguous Springfield remains ambiguous;
- ambiguity becomes a prioritized player question;
- missing birth time does not nag in ordinary task-driven readiness;
- Discovery Session may ask for birth time;
- DST fold produces two candidate instants rather than a guess;
- provider outage remains unavailable and does not fabricate a place.

Supabase deployment compilation also succeeded and the Edge Function is ACTIVE.

## Knowledge / Player Reality law

Examples:

```text
Workout performed                    -> Player Training reality
Exercise muscle definition           -> Reference Knowledge
Gym hours tonight                    -> Live external context
Training-balance interpretation      -> Intelligent inference

Birth place label                    -> Person truth
Coordinates / timezone               -> Reference Knowledge
UTC birth instant                    -> deterministic derivation
Natal symbolism                      -> symbolic interpretation
```

Do not mix reference/global knowledge into canonical player schemas merely because it is relevant.

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

A surfaced item should be able to answer:

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

Future Character composes:

```text
Identity          <- Person
Origin            <- birth facts + deterministic natal geometry
Body              <- Body
Skills            <- evidence-backed inference
Roles             <- skill/activity clusters
Attributes        <- broad evidence-backed patterns
Inventory/Gear    <- Inventory
Effective State   <- base + gear + context + conditions + access + allies
Archetypes        <- symbolic interpretation
Path              <- long-horizon becoming
Achievements      <- evidence-backed milestones
```

No canonical Character aggregate solely for UI convenience.

## Inventory / capability law

```text
BASE CAPABILITY
= demonstrated skill + enduring evidence-backed attributes + mastery

EFFECTIVE CAPABILITY
= Base Capability
+ Equipment
+ Environment
+ Current Condition
+ Available Access
+ Relevant Allies
```

Modifier semantics may include BOOST, MULTIPLIER, GATE, UNLOCK, REDUCER, CONSTRAINT, SYNERGY.

Ownership alone does not permanently increase Skill/Mastery.

## Time / Schedule / Requirements

Time is cross-cutting:

```text
occurred
recorded
planned
scheduled
due
valid
recurring
deadline
window
duration
timezone
precision
```

Schedule owns planned allocation, not occurrence.

Requirement/Standard remains distinct from Goal and Schedule.

Requirement evaluation must be coverage-aware; incomplete nutrition/activity logging never implies zero unrecorded reality.

## Training / Nutrition future law

Training and Nutrition will be distinct factual domains when their semantics are needed.

Both reuse Knowledge rather than relying on unstructured model memory:

```text
Training Knowledge
exercise / movement / muscles / variants / equipment / guidance

Nutrition Knowledge
food / serving / calories / macros / micros / source quality / guidance
```

Strength/growth is cross-domain:

```text
Training
+ Nutrition
+ Body
+ Recovery
+ Time
+ Equipment
 -> Growth analysis
```

## Astrology architecture

Keep these layers separate:

```text
Birth facts                 -> canonical Person
Resolved place/time context -> Knowledge + deterministic derivation
Natal geometry              -> deterministic derivation
Astrology meanings          -> symbolic Knowledge
Personal interpretation     -> symbolic/reflective guidance
```

Do not fabricate birth time, houses, Ascendant, or geographic resolution.

## Current Player UI

`/helm` remains intentionally sparse/read-only.

Do not replace it with a hodge-podge dashboard as domains arrive.

Character Creation backend exists, but player-facing Character Creation UI remains deferred until deterministic natal geometry/readiness presentation is stable enough.

## Security context

Private canonical schemas remain protected primarily by schema/table privilege denial plus owner-scoped public `SECURITY DEFINER` RPCs with fixed search paths.

Supabase advisor warnings about authenticated execution of these public SECURITY DEFINER functions are expected for the chosen narrow RPC boundary and must continue to be reviewed carefully.

`Leaked Password Protection Disabled` remains a production-hardening item.

The new `birth-context` Edge Function has JWT verification enabled and performs no canonical writes.

## Next build

**Deterministic natal geometry.**

Build a versioned ephemeris capability over the now-resolved birth context:

```text
UTC birth instant
+ WGS84 coordinates
+ ephemeris implementation/data version
 -> planetary positions
 -> Ascendant / houses when timed inputs support them
 -> aspects
```

Before symbolic astrology interpretation:

- choose/pin the ephemeris implementation/data;
- preserve algorithm/data version in lineage;
- decide house-system handling explicitly;
- preserve approximate-birth-time uncertainty;
- do not persist duplicate Character truth merely to display the chart.

After that, expose the simple Character Creation UI, then continue Schedule -> Requirements -> generalized Discovery -> Navigator -> Position -> Inventory -> Skills/Role -> Training/Nutrition.

## Recovery prompt

> Open `PROJECT_STATE.md`, then read `docs/06-build-roadmap.md`, `docs/22-birth-context-knowledge-slice-v0.1.md`, `docs/21-knowledge-inquiry-and-acquisition-spine-v0.1.md`, `docs/20-knowledge-and-home-surface-v0.1.md`, `docs/18-mature-life-rpg-architecture-v0.2.md`, ADR-036 through ADR-030, `docs/CANON.md`, `docs/04-domain-protocol.md`, and `docs/05-intelligence-runtime.md`. Person + Temporal Kernel + Body + atomic Character Initialization are live. The Knowledge/Inquiry runtime is executable and CI-tested. The JWT-protected `birth-context` Edge Function is live and resolves place -> timezone -> UTC birth instant with ambiguity/question handling. Keep Helm quiet. Next build deterministic, versioned natal geometry before symbolic astrology or broad domain UI.
