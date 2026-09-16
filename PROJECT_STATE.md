# Wayfinder — Project State / Chat Recovery

**Repository:** `firstrateent-star/wayfinder`  
**Current milestone:** proven Slice 1A substrate + mature Life RPG architecture + live Person/Temporal/Body v0.1  
**Current phase:** Flower Character Creation orchestration, then deterministic natal-chart seam  
**Canon:** `docs/CANON.md` + later addenda/ADRs  
**Mature architecture:** `docs/18-mature-life-rpg-architecture-v0.2.md`  
**Live expansion:** `docs/19-person-temporal-body-v0.1.md`  
**Latest ADR:** `decisions/ADR-032-person-and-body-have-distinct-canonical-ownership.md`  
**Latest live test:** `lab/person-temporal-body-live-test-v0.1.md`

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
- **Owner/auth identity, Person identity, Body observations, and Character projection remain distinct**.

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

### Reality Engine
Canonical domain-owned facts, events, observations, ownership, access, and relationships.

### Direction Engine
Values, directions, outcomes, commitments, quests, plans, actions.

### Source Engine
Authorized conversation, calendars, health sources, finance sources, files, devices, manual statements, and other inputs.

### Discovery Engine
Candidates, hypotheses, classifications, relationships, and missing-information signals. Discovery does not own canonical truth.

### Guidance Engine
Position, schedule, requirements, current capacity, constraints, quest relevance, capability, uncertainty, review, and planning.

### Game Engine
Character, stats, skills, mastery, role/class, XP, levels, stamina, buffs/debuffs, achievements, rewards, loadout capability, world exploration, and other RPG representation.

## Four epistemic layers

```text
1. RECORDED REALITY
2. DETERMINISTIC DERIVATION
3. INTELLIGENT INFERENCE
4. SYMBOLIC INTERPRETATION
```

A lower-authority layer must not masquerade as a higher-authority layer.

Examples:

- weight observation: Recorded Reality;
- weight-unit normalization / natal geometry: Deterministic Derivation;
- recovery estimate / skill level / role: Intelligent Inference;
- astrology/archetype/RPG narrative: Symbolic Interpretation.

## Current deployed backend

Supabase project ref: `ngakauhlcmvwnmimtsca`.

Private Wayfinder schemas now live:

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

Still valid and deployed:

- owner identity and bootstrap;
- private module schemas;
- command envelope/idempotency;
- canonical request hashing and conflicting command-id rejection;
- atomic authoritative command boundaries;
- exact-version Evidence lineage;
- versioned correction;
- result coverage vs epistemic coverage;
- projection/read seam;
- occurred vs recorded time;
- transactional ModuleChange outbox;
- frontend direct-table boundary guard;
- deferred version-head integrity triggers with SECURITY DEFINER where required.

Existing Direction / Practice / Evidence / Helm / Journey work remains architectural evidence. Do not delete it merely because Player Mode is quiet.

## Person v0.1 — LIVE

Person is distinct from owner/auth identity.

```text
Owner  -> authorization/account scope
Person -> modeled human subject
```

Canonical Person v0.1 owns:

```text
preferred/display name
birth date?
birth local time?
birth-time accuracy?  EXACT | APPROXIMATE
birth-place label?
```

It does **not** own Body measurements, Role, Skill, XP, finances, current location, or Direction.

Birth facts are stable in reality but their records are versioned/correctable because recorded knowledge can be wrong.

Public RPCs:

```text
wf_person_create(...)
wf_person_update_profile(...)
wf_person_current_v0()
```

Live rollback testing proved:

- create + exact current read;
- same-command retry;
- semantic duplicate NOOP;
- v1 -> v2 correction lineage;
- stale-version rejection;
- future-birth-date rejection;
- deferred-head integrity;
- authenticated direct-table denial.

No synthetic Person data remains after rollback.

## Temporal Kernel v0.1 — LIVE

Private helper:

```text
wf_system.local_day_bounds(local_date, zone_id)
```

Resolves a declared local calendar day to the real half-open UTC interval `[start,end)`.

Live `America/New_York` checks:

```text
2026-03-08 -> 23 hours
2026-09-15 -> 24 hours
2026-11-01 -> 25 hours
```

This is the foundation for later Schedule and recurring Requirement semantics such as `protein >= target / local day`.

## Body v0.1 — LIVE

Body is the first new asymmetric reality domain after the mature architecture freeze.

Canonical v0.1 metrics:

```text
height
weight
```

They are temporal measurements, not Person profile columns.

Stable measurement identity:

```text
id
owner_id
metric
current_version_id
```

Versioned payload:

```text
value
unit
observed_at
observed_zone_id?
provenance
recorded_at
```

Supported canonical units:

```text
height: cm | m | in
weight: kg | lb
```

Reported quantity remains source reality. Normalized quantity is deterministic derivation.

Public RPCs:

```text
wf_body_record_measurement(...)
wf_body_correct_measurement(...)
wf_body_current_v0()
```

Live rollback testing proved:

- height/weight capture;
- common unit alias normalization;
- deterministic unit conversion;
- true command retry;
- metric/unit mismatch rejection;
- exact v1 -> v2 correction lineage;
- stale-version rejection;
- latest-recorded current read;
- authenticated direct-table denial;
- deferred-head integrity.

No synthetic Body data remains after rollback.

`wf_body_current_v0()` deliberately means **latest recorded observation**, not perfect current physical truth. Missing metrics remain unknown rather than zero.

## Character ownership law

ADR-032 now fixes:

```text
Owner     -> System/auth scope
Person    -> modeled identity + stable/correctable origin facts
Body      -> temporal physical observations
Character -> composed projection over Person + Body + future domains
```

A future Character Creation screen may *look* like one profile flow while routing each fact to its correct canonical owner.

## Time / Schedule / Requirement laws

Time is cross-cutting rather than a life domain.

Preserve:

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

Schedule owns planned temporal allocations and may reference records owned elsewhere.

```text
Action: Finish edit             -> Direction
Allocation Tue 12–3             -> Schedule
Actual edit activity            -> Practice/Activity
```

Requirement/Standard is distinct from Goal and Schedule.

Examples:

```text
Protein >= 150 g / local day
Strength training >= 3 sessions / week
Debt payment >= $500 by Sep 30
```

Use a shared Requirement contract while the domain that understands the metric owns/evaluates its semantics.

Requirement evaluation remains coverage-aware. Partial logging must not be treated as zero unrecorded intake or automatic failure.

Candidate states:

```text
IN_PROGRESS
SATISFIED
AT_RISK
CLOSED_BELOW_TARGET
UNKNOWN
```

## RPG architecture

Usually canonical/factual owners:

```text
Person
Direction
Evidence
Body
Practice / Activity
Training
Nutrition
Finance
Inventory
World
Social
Schedule
```

Usually derived/reconstructable:

```text
Stats / Attributes
Skill level / Mastery
Role / Class
XP / Level
Stamina
Buffs / Debuffs
Achievements when reconstructable
Titles
Character Path
Reputation
Gear score / Loadout capability
Character summary
Position
Reviews
```

## Inventory / gear / capability law

Inventory is functional, not decorative.

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

Gear may create BOOST, MULTIPLIER, GATE, UNLOCK, REDUCER, CONSTRAINT, or SYNERGY effects.

Gear alone does not permanently increase learned Skill/Mastery. Real use produces evidence that may change permanent growth projections.

## Discovery architecture

```text
Source Item
 -> Discovery Candidate
 -> Reconciliation / Validation
 -> Owning Domain Command
 -> Canonical Record
```

Discovery is not a second life database and does not directly author canonical truth.

Prefer transient structured candidates until real async reconciliation/conflict/review workflows prove durable candidate storage is needed.

## Navigator

Navigator separates:

```text
KNOWN
INFERRED
CONFLICTING
UNKNOWN
MISSING-BUT-IMPORTANT
```

It should answer what is supportable first and ask at most the smallest high-value question needed.

Question value is approximately:

```text
uncertainty reduction × relevance × decision impact × future reuse / user burden
```

Navigator may use replies as sourced input for Discovery, but consequential canonical mutation still routes through authorized commands.

## Astrology

Keep three layers distinct:

```text
Birth Data (canonical Person facts)
 -> deterministic ephemeris/chart calculation
 -> natal geometry / planetary positions / houses / aspects
 -> symbolic interpretation
```

Current planetary state/transits are deterministic calculations from current time + ephemeris/version rules. Interpretations remain symbolic guidance.

Navigator may combine grounded life guidance and astrology while labeling the distinction.

## Strength / macros / recurring minimums

Strength/muscle growth is cross-domain:

```text
Training
+ Nutrition
+ Body
+ Recovery
+ Time
+ Equipment context
 -> Growth analysis
```

Nutrition estimates preserve uncertainty. Incomplete intake coverage must not imply unrecorded food was zero.

Requirements such as daily protein or weekly strength exposure should be evaluated over explicit local temporal scopes.

## Current player UI

`/helm` remains intentionally quiet and read-only.

No normal player-facing Practice, Direction, Evidence, Person, Body, or correction forms are exposed yet.

Journey remains backend/product research but is hidden from the normal player shell.

Principle:

> Build the model/intelligence first. Add player UI only when Wayfinder has something genuinely useful to show or ask.

## Security posture / advisor context

Supabase's generic metadata advisor reports RLS disabled on private `wf_person` / `wf_body` tables. This has **not** been blindly auto-remediated.

Wayfinder's current primary client isolation is:

```text
private schema/table privilege denial
+
owner-scoped public SECURITY DEFINER RPCs
```

Live tests explicitly proved `authenticated` direct access to both new schemas is denied. Enabling RLS without policies would change/block the designed boundary and requires an intentional defense-in-depth decision.

Supabase also warns that authenticated users can execute the Wayfinder SECURITY DEFINER RPCs. This is expected because those RPCs are the deliberate privilege boundary; every new RPC still requires fixed search path, owner derivation, explicit authorization, and cross-owner testing.

`Leaked Password Protection Disabled` remains a real production-hardening item unrelated to the Person/Body architecture.

## Mature build sequence

```text
0. Preserve proven Slice 1A substrate                  ✅
1. Person + shared temporal contracts                  ✅ LIVE / GATE PASSED
2. Body vertical slice                                 ✅ LIVE / GATE PASSED
3. Character Creation orchestration                    ← NEXT DESIGN/BUILD TARGET
4. Deterministic natal chart calculation
5. Schedule contract / one allocation
6. Requirement contract / one recurring requirement
7. Discovery contract
8. Navigator information-need loop
9. Position v0
10. Inventory + effective capability
11. Skill + Role projections
12. Training + Nutrition
13. Cross-domain Growth + macro/training requirements
14. Daily/Weekly Review + temporal guidance
15. Symbolic astrology guidance/transits
16. Expand Finance / World / Social / richer domains under real pressure
```

### Immediate next question

A Character Creation experience may collect Person + Body in what feels like one save.

Before exposing it, decide its transaction truth:

```text
A. one indivisible creation intent
   -> Person + initial Body measurements must commit as one authoritative orchestration boundary

or

B. explicitly resumable creation
   -> partial state is first-class, visible, and safely retryable
```

Do not accidentally implement a one-screen save as several unrelated commits that can leave a misleading half-created character.

## Anti-patterns

Do not build:

- universal `life_events` / `facts` table;
- one table per RPG mechanic;
- permanent XP ledger before rules stabilize;
- direct AI canonical writes;
- arbitrary gear bonuses without capability rationale;
- astrology interpretations as facts;
- calendar entries as proof an event occurred;
- incomplete macro logs as zero unrecorded intake;
- Navigator questionnaires merely to fill blanks;
- frontend-owned stat math;
- duplicated current-state stores that can drift;
- giant fixed domain enum;
- full-life context dumps into every model call;
- speculative empty schemas.

## Recovery prompt

> Open `PROJECT_STATE.md`, then read `docs/18-mature-life-rpg-architecture-v0.2.md`, `docs/19-person-temporal-body-v0.1.md`, `decisions/ADR-032-person-and-body-have-distinct-canonical-ownership.md`, `decisions/ADR-031-time-schedule-and-requirements-are-distinct-from-reality.md`, ADR-030, `docs/CANON.md`, `docs/04-domain-protocol.md`, and `docs/05-intelligence-runtime.md`. Person + Temporal Kernel + Body v0.1 are live and rollback-stress-tested. Preserve the quiet Player shell. Next Flower Character Creation orchestration/atomicity before exposing a multi-module player save; then add deterministic natal-chart calculation.
