# Wayfinder — Project State / Chat Recovery

**Repository:** `firstrateent-star/wayfinder`  
**Current milestone:** proven Slice 1A + live Person/Temporal/Body + atomic Character Initialization v0.1  
**Current phase:** deterministic natal-chart readiness/context seam; player shell remains quiet  
**Canon:** `docs/CANON.md` + later addenda/ADRs  
**Mature architecture:** `docs/18-mature-life-rpg-architecture-v0.2.md`  
**Live Person/Body:** `docs/19-person-temporal-body-v0.1.md`  
**Latest ADR:** `decisions/ADR-033-indivisible-cross-module-player-intents-use-atomic-orchestration.md`  
**Latest live test:** `lab/character-initialization-atomic-live-test-v0.1.md`

## Non-negotiable direction

Wayfinder is being rebuilt from the ground up using the newer Vlourish / Flower architecture. Old Wayfinder code is research evidence only; do not merge or migrate it into this architecture.

Wayfinder is a personal Life OS expressed as a Life RPG. The RPG is a representation of evidence-backed lived reality, not the source of truth.

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
- one indivisible user save should use one authoritative transaction when partial commit would violate intent;
- **complex underneath, quiet on the player surface**;
- **the player should not have to manually model their life**;
- **RPG mechanics are projections by default**;
- **equipment modifies effective state, not permanent base mastery**;
- **Navigator asks questions only when missing information materially matters**;
- **astrology is symbolic guidance over deterministic chart calculation, not canonical empirical truth**;
- **Schedule owns planned time allocation, not occurrence**;
- **Requirements/standards are distinct from goals and schedules and must be coverage-aware**;
- **Owner/auth identity, Person identity, Body observations, and Character projection remain distinct**;
- **an indivisible cross-module player intent may use System orchestration over module-owned commands in one database transaction; domains still do not directly write each other's canonical tables**.

## Mature conceptual architecture

```text
PERSON
  |
  v
TIME / TEMPORAL KERNEL
  |
  +--> REALITY ENGINE
  +--> DIRECTION ENGINE
  +--> SOURCE ENGINE
            |
            v
       DISCOVERY ENGINE
            |
            v
        GUIDANCE ENGINE
            |
            v
          GAME ENGINE
            |
            v
         NAVIGATOR
            |
            v
          PERSON
```

## Four epistemic layers

```text
1. RECORDED REALITY
2. DETERMINISTIC DERIVATION
3. INTELLIGENT INFERENCE
4. SYMBOLIC INTERPRETATION
```

Examples:

- weight observation: Recorded Reality;
- unit normalization / natal geometry: Deterministic Derivation;
- recovery estimate / skill level / role: Intelligent Inference;
- astrology/archetype/RPG narrative: Symbolic Interpretation.

A lower-authority layer must not masquerade as a higher-authority layer.

## Current deployed backend

Supabase project ref: `ngakauhlcmvwnmimtsca`.

Private Wayfinder schemas:

```text
wf_system
wf_person
wf_direction
wf_practice
wf_evidence
wf_body
```

Current canonical tables:

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

Authenticated clients use typed public RPCs. Private canonical schemas/tables remain inaccessible directly to `anon` / `authenticated`.

## Proven foundation retained from Slice 1A

Still valid:

- owner identity + bootstrap;
- command envelope/idempotency + canonical hashing;
- private module schemas;
- exact-version Evidence lineage;
- versioned correction + stale-write rejection;
- result vs epistemic coverage;
- projection/read seam;
- occurred vs recorded time;
- transactional ModuleChange outbox;
- frontend direct-table guard;
- deferred version-head integrity with SECURITY DEFINER where required.

Existing Direction / Practice / Evidence / Helm / Journey remain architectural evidence even though Player Mode is intentionally sparse.

## Person v0.1 — ✅ LIVE / GATE PASSED

Person is distinct from owner/auth identity.

```text
Owner  -> authorization/account scope
Person -> modeled human subject
```

Canonical Person owns:

```text
display/preferred name
birth date?
birth local time?
birth-time accuracy?  EXACT | APPROXIMATE
birth-place label?
```

It does not own Body, Role, Skill, XP, finances, current location, Direction, or astrology interpretation.

Public RPCs:

```text
wf_person_create
wf_person_update_profile
wf_person_current_v0
```

Live rollback testing passed retry, NOOP, exact correction lineage, stale rejection, future-date validation, private-schema denial, and deferred-head integrity.

## Temporal Kernel v0.1 — ✅ LIVE / GATE PASSED

Private helper:

```text
wf_system.local_day_bounds(local_date, zone_id)
```

Resolves a local calendar day to the real half-open UTC interval `[start,end)`.

`America/New_York` live validation:

```text
2026-03-08 -> 23h
2026-09-15 -> 24h
2026-11-01 -> 25h
```

This is the base for timezone-correct recurring Requirements and Schedule evaluation.

## Body v0.1 — ✅ LIVE / GATE PASSED

Canonical metrics:

```text
height
weight
```

These are temporal Body measurements, not Person profile columns.

Canonical source payload preserves reported quantity/unit + observed time. Cross-unit normalization is deterministic derivation.

Supported canonical units:

```text
height: cm | m | in
weight: kg | lb
```

Public RPCs:

```text
wf_body_record_measurement
wf_body_correct_measurement
wf_body_current_v0
```

Live rollback testing passed capture, alias normalization, deterministic conversion, retry, metric/unit validation, correction lineage, stale rejection, current read, private-schema denial, and deferred-head integrity.

`wf_body_current_v0()` means latest recorded observation, not perfect current physical truth.

## Atomic Character Initialization v0.1 — ✅ LIVE / GATE PASSED

Public orchestration RPC:

```text
wf_character_initialize_v0(...)
```

Character is **not** persisted. The orchestration routes:

```text
name / birth facts -> Person command
height             -> Body command (optional)
weight             -> Body command (optional)
```

The outer player intent is atomic because the current one-screen Character Creation concept is indivisible from the player's perspective.

Implementation law:

```text
outer command receipt
      |
      v
System/application orchestrator
      |
      +--> Person command
      +--> Body height command
      +--> Body weight command
      |
 one Postgres child subtransaction
      |
  all commit
      or
  all rollback
```

Domains retain canonical ownership; the orchestrator does not create a Character table and does not give Person authority over Body.

Child `ModuleChange` rows remain module-owned and receive the outer command id as `correlation_id`.

Live rollback stress test proved:

- deliberately invalid Body child after valid Person child caused full child rollback;
- after rejection, Person read remained null and Body read remained null;
- valid initialization created exactly 1 Person + 2 Body measurements;
- outer response returned 3 affected refs;
- exact outer command retry returned `APPLIED` with `replayed=true` and no duplicate writes;
- a new initialization command after success returned `CHARACTER_ALREADY_INITIALIZED`;
- 3 module-owned changes were correlated to the outer command;
- deferred constraints passed;
- rollback left zero synthetic Person/Body rows.

Reference: `decisions/ADR-033-indivisible-cross-module-player-intents-use-atomic-orchestration.md`.

## Character / RPG ownership

```text
Owner     -> System/auth scope
Person    -> identity + stable/correctable origin facts
Body      -> temporal physical observations
Character -> composed projection
```

Character eventually composes:

```text
Identity          <- Person
Origin            <- birth facts + natal geometry
Body              <- Body
Skills            <- evidence-backed inference
Role              <- skill/activity clusters
Attributes        <- broad evidence-backed patterns
Inventory/Gear    <- Inventory
Effective State   <- base + gear + environment + conditions + access + allies
Archetypes        <- symbolic interpretation
Path              <- long-horizon becoming
Achievements      <- evidence-backed milestones
```

Do not persist a canonical Character aggregate merely to simplify UI.

## Time / Schedule / Requirements

Time remains cross-cutting:

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

Schedule owns planned temporal allocation, not occurrence.

```text
Action: Finish edit             -> Direction
Allocation Tue 12–3             -> Schedule
Actual edit activity            -> Practice/Activity
```

Requirement/Standard remains distinct from Goal and Schedule.

Examples:

```text
Protein >= 150 g / local day
Strength training >= 3 sessions / week
Debt payment >= $500 by Sep 30
```

Requirement evaluation must remain coverage-aware; partial logs do not imply zero unrecorded intake.

## Discovery

```text
Source Item
 -> Discovery Candidate
 -> Reconciliation / Validation
 -> Owning Domain Command
 -> Canonical Record
```

Discovery is not a second life database and does not directly author canonical truth.

Prefer transient candidates until async/conflict/review pressure proves durable candidate persistence is necessary.

## Navigator

Navigator separates:

```text
KNOWN
INFERRED
CONFLICTING
UNKNOWN
MISSING-BUT-IMPORTANT
```

It should answer what is supportable first and ask only the smallest high-value question needed.

```text
Question Value
≈ uncertainty reduction × relevance × decision impact × future reuse / user burden
```

## Astrology / natal calculation — NEXT

Keep three layers distinct:

```text
Birth Data (canonical Person facts)
 -> deterministic ephemeris/chart calculation
 -> natal geometry / planetary positions / houses / aspects
 -> symbolic interpretation
```

Immediate pressure before calculation:

A birthplace **label** such as `Key West, FL` is not yet resolved geographic truth.

A mature deterministic natal engine needs an explicit input contract for:

```text
birth date
birth local time when known
birth-place coordinates / resolved place identity
IANA timezone / offset resolution for the birth instant
ephemeris implementation + version
```

Do not fabricate houses/Ascendant when birth time or geographic resolution is insufficient.

The next build should establish this deterministic readiness/resolution seam before symbolic astrology guidance.

## Inventory / gear / capability law

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

Gear may contribute BOOST, MULTIPLIER, GATE, UNLOCK, REDUCER, CONSTRAINT, or SYNERGY effects. Ownership alone does not permanently raise Skill/Mastery.

## Strength / macros / recurring minimums

Strength/muscle growth is cross-domain:

```text
Training
+ Nutrition
+ Body
+ Recovery
+ Time
+ Equipment
 -> Growth analysis
```

Nutrition estimates preserve uncertainty. Incomplete intake coverage must not imply unrecorded food was zero.

## Current Player UI

`/helm` remains intentionally quiet/read-only.

No normal player-facing Practice, Direction, Evidence, Person, Body, or Character Creation forms are exposed yet.

The backend Character Initialization RPC exists, but **UI exposure is intentionally deferred** until the natal/readiness and presentation seam are clearer.

## Security / advisor context

Supabase's generic metadata advisor reports RLS disabled on private `wf_person` / `wf_body` tables. This was not blindly auto-remediated.

Current primary boundary:

```text
private schema/table privilege denial
+
owner-scoped public SECURITY DEFINER RPCs
```

Live tests explicitly proved authenticated direct access to both new schemas is denied.

Supabase also warns that authenticated users can execute Wayfinder SECURITY DEFINER RPCs; this is expected because those RPCs are the designed narrow privilege boundary and must remain owner-scoped/fixed-search-path/stress-tested.

`Leaked Password Protection Disabled` remains a real production-hardening item.

## Mature build sequence

```text
0. Proven Slice 1A substrate                              ✅
1. Person + shared temporal contracts                    ✅ LIVE
2. Body vertical slice                                   ✅ LIVE
3. Atomic Character Creation backend orchestration       ✅ LIVE
4. Natal readiness + deterministic natal calculation    ← NEXT
5. Player-facing Character Creation experience           after readiness/presentation contract
6. Schedule contract / one allocation
7. Requirement contract / one recurring requirement
8. Discovery contract
9. Navigator information-need loop
10. Position v0
11. Inventory + effective capability
12. Skill + Role projections
13. Training + Nutrition
14. Cross-domain Growth + macro/training requirements
15. Daily/Weekly Review + temporal guidance
16. Symbolic astrology guidance/transits
17. Expand Finance / World / Social / richer domains under real pressure
```

## Anti-patterns

Do not build:

- universal `life_events` / `facts` table;
- one table per RPG mechanic;
- permanent XP ledger before rules stabilize;
- direct AI canonical writes;
- arbitrary gear bonuses without capability rationale;
- astrology interpretations as facts;
- unresolved birthplace text treated as coordinates/timezone truth;
- calendar entries as proof an event occurred;
- incomplete macro logs as zero unrecorded intake;
- Navigator questionnaires merely to fill blanks;
- frontend-owned stat math;
- duplicated current-state stores that can drift;
- giant fixed domain enum;
- full-life context dumps into every model call;
- speculative empty schemas.

## Recovery prompt

> Open `PROJECT_STATE.md`, then read `docs/18-mature-life-rpg-architecture-v0.2.md`, `docs/19-person-temporal-body-v0.1.md`, `decisions/ADR-033-indivisible-cross-module-player-intents-use-atomic-orchestration.md`, `lab/character-initialization-atomic-live-test-v0.1.md`, ADR-032, ADR-031, ADR-030, `docs/CANON.md`, `docs/04-domain-protocol.md`, and `docs/05-intelligence-runtime.md`. Person + Temporal Kernel + Body + atomic Character Initialization v0.1 are live and rollback-stress-tested. Keep the player shell quiet. Next define the resolved birth-context / ephemeris contract and deterministic natal-readiness behavior before adding symbolic astrology or exposing Character Creation UI.
