# Wayfinder — Project State / Chat Recovery

**Repository:** `firstrateent-star/wayfinder`  
**Current milestone:** proven Slice 1A substrate + quiet read-only player shell + mature Life RPG architecture v0.2  
**Current phase:** architectural freeze before the first new Person/Body/Time slices  
**Canon:** `docs/CANON.md` + later addenda/ADRs  
**Latest architecture:** `docs/18-mature-life-rpg-architecture-v0.2.md`  
**Prior architecture:** `docs/17-life-rpg-discovery-architecture-v0.1.md`  
**Latest ADR:** `decisions/ADR-031-time-schedule-and-requirements-are-distinct-from-reality.md`

## Non-negotiable direction

Wayfinder is being rebuilt from the ground up using the newer Vlourish / Flower architecture. Old Wayfinder code is research evidence only; do not merge or migrate it into this architecture.

Wayfinder is a personal Life OS expressed as a Life RPG. The RPG is a representation of evidence-backed lived reality, not the source of truth.

Core laws now include:

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
- **Requirements/standards are distinct from goals and schedules and must be coverage-aware**.

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

- weight observation: recorded reality;
- weight trend / natal planetary geometry: deterministic derivation;
- recovery estimate / skill level / role: intelligent inference;
- astrology/archetype/RPG narrative: symbolic interpretation.

## Canonical module families

Create only when distinct factual semantics earn ownership.

Current/proven:

```text
System
Direction
Practice
Evidence
```

Next/future candidates:

```text
Person
Schedule
Body
Training
Nutrition
Finance
Inventory
World
Social
```

Do not create these schemas speculatively. Add each with its first complete vertical slice.

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
Action: Finish edit           -> Direction
Allocation Tue 12–3           -> Schedule
Actual edit activity          -> Practice/Activity
```

These are related but not interchangeable.

Requirement/Standard is distinct from Goal and Schedule.

Examples:

```text
Protein >= 150 g / local day
Strength training >= 3 sessions / week
Debt payment >= $500 by Sep 30
```

Use a shared Requirement contract, while the domain that understands the metric owns/evaluates the semantics.

Requirement evaluation is coverage-aware. Partial logging must not be treated as zero unrecorded intake or automatic failure.

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

## Character

Character is a composed projection, not one canonical row.

```text
Identity          <- Person
Origin            <- birth facts + natal chart
Body              <- Body
Skills            <- evidence-backed skill projections
Roles             <- skill/activity clusters
Attributes        <- broad evidence-backed tendencies
Inventory/Gear    <- Inventory
Effective State   <- base + gear + context + conditions
Archetypes        <- symbolic interpretation
Path              <- long-horizon becoming
Achievements      <- evidence-backed milestones
```

Character Creation does not ask the player to enter Role, XP, Level, Skill, or Path.

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

## Reviews

Daily/weekly/monthly Reviews are projections first.

System Review != user-authored Reflection.

A Review may summarize:

```text
what happened
requirement state
schedule pressure
quest movement
body/recovery
resource changes
skill/growth evidence
unknowns
what matters next
```

If the user authors meaning, that belongs to a future Reflection/Meaning seam.

## Current deployed backend

Supabase project ref: `ngakauhlcmvwnmimtsca`.

Private schemas:

```text
wf_system
wf_direction
wf_practice
wf_evidence
```

Current canonical tables:

```text
wf_system: owners, command_receipts, module_change_outbox
wf_direction: nodes, node_versions, edges
wf_practice: practices, sessions, session_versions
wf_evidence: links
```

Authenticated clients use public typed RPCs; private canonical tables remain inaccessible directly.

Existing Slice 1A remains proof infrastructure. Do not delete it merely because the player UI is quiet.

## Current player UI

`/helm` is intentionally quiet and read-only.

No normal player-facing Practice, Direction, Evidence, or correction forms are shown.

Journey remains backend/product research but is hidden from the normal player shell.

Principle:

> Build the model/intelligence first. Add player UI only when Wayfinder has something genuinely useful to show or ask.

## Mature build sequence

```text
0. Preserve proven Slice 1A substrate
1. Person + shared temporal contracts
2. Body vertical slice
3. Character Creation experience
4. Deterministic natal chart calculation
5. Schedule contract / one allocation
6. Requirement contract / one recurring requirement
7. Discovery contract
8. Navigator information-need loop
9. Position v0
10. Inventory + effective capability
11. Skill + Role projections
12. Training + Nutrition
13. Daily/Weekly Review + temporal guidance
14. Symbolic astrology guidance
15. Expand Finance / World / Social / richer domains under real pressure
```

Do not build broad UI, XP ledgers, universal skill taxonomies, or speculative domain schemas ahead of these seams.

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

> Open `PROJECT_STATE.md`, then read `docs/18-mature-life-rpg-architecture-v0.2.md`, `decisions/ADR-031-time-schedule-and-requirements-are-distinct-from-reality.md`, `docs/17-life-rpg-discovery-architecture-v0.1.md`, ADR-030, `docs/CANON.md`, `docs/04-domain-protocol.md`, and `docs/05-intelligence-runtime.md`. Preserve the proven Slice 1A substrate and quiet player shell. Continue with the smallest Person + temporal contracts and then the Body vertical slice before broadening UI or domains.
