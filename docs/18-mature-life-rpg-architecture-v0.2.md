# Wayfinder Mature Life RPG Architecture v0.2

**Status:** CANDIDATE-STABLE DESIGN — architecture target before new physical domains

## Purpose

This document consolidates the strongest surviving architecture after recursively Flowering the Life RPG, AI discovery, character creation, inventory/equipment, astrology, calendar/time, recurring requirements, macro tracking, strength growth, Navigator questioning, and the existing proven Wayfinder backend.

The goal is not to prebuild every future feature. The goal is to define a small architectural grammar that can absorb those features without redesigning the core.

## Root proposition

> Wayfinder models a person moving through time and reality, discovers useful structure from evidence, preserves uncertainty and provenance, and derives an RPG representation that helps the person navigate what matters next.

The player should not have to manually model their life. The system should progressively learn from authorized sources, direct statements, observed reality, and explicit choices.

## Core efficiency law

> **Canonical reality stays small and domain-owned. Discovery interprets incoming information. Guidance composes time, direction, requirements, capability, and uncertainty. The RPG is a reconstructable representation over that substrate.**

Complexity grows outward through bounded modules and projections, not inward through one universal life table.

## The five-engine architecture

```text
                     PERSON
                       |
                       v
                     TIME
                       |
      +----------------+----------------+
      |                |                |
      v                v                v
 REALITY ENGINE   DIRECTION ENGINE   SOURCE ENGINE
      |                |                |
      +--------+-------+----------------+
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
               ^
               +-------------------------+
```

### Reality Engine
Owns what is actually recorded as happening, existing, being measured, being owned, or being related.

### Direction Engine
Owns authored intention: values, directions, outcomes, commitments, quests, plans, actions.

### Source Engine
Represents authorized inputs such as conversation, calendars, finance connectors, health sources, files, device data, and manual statements. A source is not automatically truth outside the scope of what it actually measured or reported.

### Discovery Engine
Extracts candidates, hypotheses, classifications, relationships, and missing-information signals from sources and canonical state. Discovery does not own canonical life truth.

### Guidance Engine
Combines current position, time, requirements, schedule, capacity, constraints, quest relevance, capability, and uncertainty. It decides what is useful to surface or ask, not what is metaphysically true.

### Game Engine
Maps evidence-backed state into player-facing character concepts: stats, skill levels, XP, levels, roles, achievements, effective capability, buffs/debuffs, world exploration, titles, and rewards.

## Four epistemic layers

Every important conclusion belongs to one of four layers:

```text
1. RECORDED REALITY
   sourced / authorized canonical facts, events, observations, ownership, relationships

2. DETERMINISTIC DERIVATION
   reproducible calculations over recorded reality

3. INTELLIGENT INFERENCE
   evidence-backed hypotheses, classifications, patterns, recommendations, estimates

4. SYMBOLIC INTERPRETATION
   astrology, archetypes, narrative themes, RPG metaphor
```

No lower-authority layer may silently masquerade as a higher-authority layer.

Examples:

- `weight = 152 lb at T` from an authorized source: Recorded Reality.
- `7-day average weight`: Deterministic Derivation.
- `recovery appears reduced`: Intelligent Inference.
- `Saturn transit suggests a restructuring theme`: Symbolic Interpretation.

## Time is a cross-cutting kernel, not a life domain

Time is a coordinate used by every module. Wayfinder should preserve different meanings of time rather than flatten them.

Core temporal concepts:

```text
occurred
recorded
valid
planned
scheduled
due
windowed
recurring
duration
deadline
local-day / local-week scope
timezone
precision / uncertainty
```

Existing laws remain:

- occurred time != recorded time;
- planned != happened;
- absence of a record != proof nothing happened;
- local recurring requirements use declared local temporal scopes, not naive rolling 24-hour windows.

## Canonical module families

Do not create one canonical module per RPG mechanic. Create a module only when the factual semantics and mutation rules are genuinely distinct.

### System

Owns:

- owner identity;
- authorization;
- command receipts;
- idempotency;
- provenance contracts;
- durable change outbox;
- references/version references;
- capability readiness.

### Person

Answers: **Who is the person Wayfinder is modeling?**

Candidate facts:

- preferred/display name;
- birth date;
- birth time when known;
- birth place when known.

These describe stable reality but remain correctable because the recorded information can be wrong.

Do not store current weight, current location, role, skill level, XP, job title, finances, or goals on Person merely because they describe the same human.

### Direction

Owns authored orientation:

```text
Value
Direction
Outcome
Commitment
Quest
Plan
Action
```

Player-facing terms may later include Main Quest, Side Quest, Mission, Objective, or Next Move, but domain semantics remain explicit underneath.

### Evidence

Owns durable exact-version relationships between records and conclusions where lineage matters.

### Practice / Activity

Owns generic activity semantics proven by the existing slice. It is not the universal life-event table. More specialized domains may coexist when their semantics justify it.

### Body

Owns physical observations and states with temporal semantics, such as:

- height baseline/measurement;
- weight observations;
- body measurements;
- sleep/recovery observations where admitted;
- other body-state facts that prove distinct semantics.

### Training

Admit when workout semantics matter:

- workout sessions;
- exercises;
- sets;
- reps;
- load;
- duration;
- training context;
- performance observations.

### Nutrition

Admit when food/intake semantics matter:

- foods;
- meals;
- quantities;
- nutrient resolutions;
- calories/macros/micros as measured or estimated derivations.

### Finance

Owns:

- accounts;
- transactions;
- income;
- expenses;
- assets;
- liabilities;
- balances according to declared source/coverage.

### Inventory

Owns physical/digital things and access:

- item identity;
- item category/type;
- ownership/access;
- quantity;
- condition;
- location;
- acquisition/disposal;
- sourced specifications/capabilities.

### World

Owns place and access semantics:

- home/base relationship;
- places;
- current known location when explicitly sourced;
- routes;
- visited places;
- movement/access facts;
- geography needed by Atlas.

### Social

Owns:

- people;
- relationships;
- interactions;
- groups/communities;
- relationship history where needed.

### Schedule

Schedule earns a canonical boundary because planned temporal allocation has semantics distinct from Direction and Reality.

It owns things such as:

- scheduled allocation;
- recurrence;
- flexibility;
- hard/soft/windowed/floating constraint;
- external-calendar identity/provenance;
- current planning state.

Schedule does **not** own the referenced Action, Quest, appointment subject, workout, or real-world occurrence. It only owns the planned temporal placement.

Example:

```text
Action: Finish wedding edit        -> Direction
Allocation: Tue 12:00-15:00       -> Schedule
Actual editing activity 12:14-14:48 -> Practice / Activity
```

These three records are related but not interchangeable.

## Requirements / Standards are a cross-domain contract

Recurring or bounded minimums reveal a concept distinct from goals and schedules.

Examples:

```text
Protein >= 150 g / local day
Strength training >= 3 sessions / week
Debt payment >= $500 by Sep 30
Practice >= 30 min / day
Social media <= X min / day
```

Do not immediately create one universal requirements database. Instead define a shared **Requirement Contract** that domain owners can implement.

Conceptually:

```ts
interface RequirementEvaluation {
  requirementRef: RecordRef;
  metricId: string;
  operator: "AT_LEAST" | "AT_MOST" | "BETWEEN" | "COUNT" | "DURATION" | "FREQUENCY";
  period: TemporalScope;
  target: unknown;
  observed: unknown;
  state: "IN_PROGRESS" | "SATISFIED" | "AT_RISK" | "CLOSED_BELOW_TARGET" | "UNKNOWN";
  coverage: Coverage;
  lineage: LineageSpec;
}
```

The owning domain defines the metric meaning. Direction may explain **why** the requirement exists.

Example:

```text
Direction: Build muscle
  |
  +--> Nutrition requirement: protein floor
  +--> Training requirement: weekly strength exposure
  +--> Recovery requirement: adequate recovery target
```

Unknown or partial intake coverage must not be converted into false failure.

## Calendar and scheduling law

External calendars are sources and/or synchronized planning surfaces.

```text
External Calendar
   -> Source / Sync
   -> Schedule Allocation
```

A calendar entry is evidence of a plan/commitment, not proof the event occurred.

Schedule constraints should support at least:

```text
HARD      fixed/externally constrained
SOFT      preferred but movable
WINDOWED  must occur within a declared interval
FLOATING  needed but not yet placed
```

Recurring rules should be represented as recurrence rules when possible rather than duplicated future rows.

## Reviews are projections first

Daily/weekly/monthly reviews should initially be reconstructable projections.

Example daily review:

```text
What happened?
What requirements are satisfied / at risk / unknown?
What moved toward Direction?
What changed?
What is unresolved?
What matters next?
```

System-generated Review != user-authored Reflection.

If the player says, “I realized I need to stop taking on so many projects,” that authored meaning belongs to a future Reflection/Meaning seam, not to the system's review projection.

## Discovery architecture

Generic path:

```text
Source Item
  -> Discovery Candidate
  -> Reconciliation / Validation
  -> Owning Domain Command
  -> Canonical Record
```

Discovery is not a second life database.

A candidate should preserve at least:

- candidate type;
- proposed module;
- structured value;
- temporal context;
- provenance/source refs;
- derivation mode;
- confidence when meaningful;
- evidence refs;
- state (`PROPOSED`, `ACCEPTED`, `REJECTED`, `SUPERSEDED` or equivalent).

Do not persist a giant universal candidate table until asynchronous reconciliation, multiple independent sources, conflicts, delayed human review, or other real requirements prove durable candidate state is necessary.

## Domain registry

Prefer a code/config registry before a database-heavy plugin framework.

Each module advertises:

- module id/version;
- record types;
- commands;
- reads;
- change types;
- discovery candidate types accepted;
- reference resolvers;
- requirement metrics it can evaluate;
- projection contributions;
- readiness/dependency state.

Discovery and Navigator route through the registry rather than hard-coded branching across every future feature.

## Navigator as active learning + navigation

Navigator is a surface over Wayfinder intelligence, not the canonical owner of life truth.

For any question/task it assembles bounded context and separates:

```text
KNOWN
INFERRED
CONFLICTING
UNKNOWN
MISSING-BUT-IMPORTANT
```

It should ask only when missing information materially improves a decision or understanding.

Conceptual question value:

```text
Question Value
= Expected Uncertainty Reduction
  x Relevance
  x Decision Impact
  x Future Reuse
  / User Burden
```

Navigator should usually answer what is supportable first, then ask one high-value question if useful.

Example:

> “Your recorded protein intake is below the current target so far, but today's food coverage is incomplete. Did you have another meal or shake that isn't captured?”

Navigator responses can become authorized sources for Discovery. The model is the parser/reasoner; authority comes from the person's statement or authorized external source.

## Position

Position remains a projection answering:

> **Where am I?**

Candidate inputs:

- current Direction;
- recent Reality/activity;
- open commitments;
- Schedule pressure;
- Requirement state;
- Body/capacity;
- Resources;
- Inventory/loadout capability;
- World/location/access;
- relevant Social context;
- important unknowns;
- optional astrology lens.

Position should surface the smallest useful grounded summary, not a dashboard of every metric.

## Character

Character remains a composed projection, not one canonical row.

```text
CHARACTER
  Identity          <- Person
  Origin            <- birth facts + natal chart
  Body              <- Body
  Skills            <- evidence-backed skill projections
  Roles             <- skill/activity clusters
  Attributes        <- broad evidence-backed tendencies
  Inventory/Gear    <- Inventory
  Effective State   <- base capability + gear + context + conditions
  Archetypes        <- symbolic interpretation
  Path              <- long-horizon becoming
  Achievements      <- evidence-backed derived milestones
```

At character creation, unknown Role/Skill/XP/Level/Path values remain unknown.

## Base capability vs effective capability

Permanent growth and current effectiveness must remain separate.

```text
BASE CAPABILITY
= demonstrated skill
+ enduring evidence-backed attributes
+ mastery

EFFECTIVE CAPABILITY
= Base Capability
+ Equipment
+ Environment
+ Current Condition
+ Available Access
+ Relevant Allies
```

If an item disappears, its effective modifier disappears. Learned skill remains.

## Inventory, gear, modifiers, and loadouts

Inventory is functional, not decorative.

Equipment states may include:

```text
OWNED
AVAILABLE
EQUIPPED
IN_USE
```

Items can contribute more than numeric bonuses. Supported modifier semantics should eventually include:

```text
BOOST       increases effective capability
MULTIPLIER  increases efficiency/output
GATE        required for an action
UNLOCK      opens a quest/area/activity
REDUCER     lowers friction/cost
CONSTRAINT  introduces cost/limitation
SYNERGY     gains value with other capabilities/items
```

A Loadout is usually a projection/relationship over items plus purpose/context.

Examples:

- Wedding Production;
- Music Studio;
- Boat/Marine;
- Gym;
- Travel;
- Daily Carry.

Gear alone does not permanently raise Skill/Mastery. Real use creates evidence that may later increase growth projections.

## Quest readiness and possibility

A future quest requirement projection can compare a Quest against Effective Player State.

Quest requirements may include:

- skills;
- gear;
- money;
- access;
- people/allies;
- time;
- location;
- prerequisite quests;
- body/capacity constraints.

Derived states might include:

```text
AVAILABLE
PARTIALLY_READY
LOCKED
BLOCKED
```

These are projections, not canonical quest truth.

## Skill, Role, XP, Level, Stats, Stamina

These remain derived by default.

### Skill
A stable game/knowledge concept used to organize governed practice and evidence. A Skill is not itself a canonical Person fact.

A Skill projection keeps at least four axes separate:

```text
Experience  = governed practice history
Sharpness   = current recency/cadence projection
Capability  = demonstrated ability
Mastery     = depth / reliability / transferability
```

Experience and Sharpness may be reconstructable from governed encounter history. Capability and Mastery require stronger evidence and must not be inferred from encounter count alone.

### Skill Experience
Counts unique governed encounter + Skill identity contributions. Experience does not decay merely because time passes.

### Sharpness
A temporal projection of how current the Skill is relative to evidenced personal practice cadence. Sharpness may cool without erasing Experience or proving capability loss.

### Mastery
Depth/reliability/transferability of a Skill projection. Mastery is not equivalent to accumulated encounter count.

### Role/Class
Higher-order cluster over demonstrated skills and repeated behavior. Not chosen during onboarding by default.

### Voyage XP
RPG representation of governed meaningful participation encounters, not a universal canonical points ledger and not a Character capability claim.

### Character growth
Permanent Character development remains a separate evidence projection. Exposure can follow activity; capability requires demonstrated performance; growth requires comparable longitudinal evidence under an owning provider.

### Level
Thresholded game representation over Voyage XP rules; recomputable if rules evolve. Level does not substitute for Character capability or human worth.

### Stats / Attributes
Broad player-facing synthesis over evidence-backed capabilities and patterns.

### Stamina
Current capacity/recovery projection from Body, Training, workload, sleep/recovery, and context where available.

### Buffs / Debuffs
Temporary player-facing representations of conditions/context; not permanent identity.

## Experience vs Character growth

The mature architecture now keeps two progression axes explicit:

```text
canonical encounter
 -> Voyage Experience / XP

canonical evidence
 -> exposure
 -> capability
 -> longitudinal growth
 -> Character
```

One lived event may contribute to both paths, but the consequences are not interchangeable. Requirement satisfaction and richer logging detail do not automatically create XP, and Voyage XP never mutates permanent Character facets.

A governed encounter may also contribute to a Skill Experience projection when a stable Skill association exists. Skill Experience does not prove Capability, and Sharpness describes temporal recency/cadence rather than permanent ability.

See ADR-044, ADR-045, `docs/40-voyage-progression-v0.1.md`, and `docs/41-skill-experience-sharpness-v0.1.md`.

## Strength growth + nutrition interaction

Strength/muscle growth is cross-domain and must not belong entirely to Training.

```text
Training
+ Nutrition
+ Body
+ Recovery
+ Time
+ Equipment context
   -> Growth analysis
```

Wayfinder may identify correlations and patterns but should avoid unjustified causal certainty.

Macro tracking should preserve precision and coverage:

- exact sourced quantities remain exact within source limits;
- AI-estimated foods/portions remain estimates;
- partial intake coverage does not imply unrecorded intake was zero;
- requirement status must reflect both observed totals and coverage.

## Astrology

Astrology is deeply integrated as an optional symbolic guidance lens without becoming canonical factual authority.

Three layers:

```text
Birth Data                  <- canonical Person facts
  -> Ephemeris Calculation  <- deterministic derivation
  -> Natal Geometry         <- planets / houses / aspects
  -> Interpretation         <- symbolic guidance
```

Current sky/transits:

```text
Current Time
+ Ephemeris Version
  -> Current planetary state
  -> Transit comparison to natal geometry
  -> symbolic current themes
```

The chart may be cached, but it is reconstructable from birth facts + calculation/version rules.

Astrology may influence reflection/guidance language but must not silently become empirical evidence about guaranteed health, finances, personality, or future outcomes.

## Daily guidance categories

Navigator should distinguish at least:

```text
REQUIRED
  hard commitment / deadline / critical requirement

RECOMMENDED
  evidence-based guidance from Direction, state, capacity, and constraints

REFLECTIVE
  symbolic/archetypal/astrological prompts and interpretive observations
```

This prevents reflective guidance from being presented as obligation.

## Context assembly and scalability

Never load the entire life model into every AI call.

```text
Question / task
  -> intent + scope
  -> relevant domain reads
  -> bounded context bundle
  -> reasoning
```

Example: “Should I train today?” may need Body, recent Training, relevant Nutrition/Requirements, Schedule, Equipment, and Direction. It does not automatically need every financial transaction or social interaction.

Context bundles should preserve freshness, lineage, uncertainty, permissions, and readiness.

## Historical reconstruction

Because canonical records preserve time and derived state is reconstructable, Wayfinder should eventually be able to answer:

> “What was my character like six months ago?”

without maintaining one giant `character_history` table.

Historical projections may recompute Character, Position, Skills, Inventory state, Body state, and Direction as of a declared temporal scope.

## Player surface law

> **As backend intelligence grows, the normal player interface should require less manual modeling, not more.**

Mature behavior:

```text
More connected reality
 -> better discovery
 -> richer model
 -> fewer unnecessary questions
 -> more useful guidance
```

The player UI should not expose database mechanics unless the person asks for inspection/debugging.

## Physical topology

Continue with one modular monolith on Supabase/Postgres.

Potential future private schemas are admitted one by one, not created speculatively:

```text
wf_system
wf_person
wf_direction
wf_schedule
wf_evidence
wf_practice
wf_body
wf_training
wf_nutrition
wf_finance
wf_inventory
wf_world
wf_social
```

Do **not** create all of these now. Add the physical schema only with the first complete vertical slice that proves its semantics.

## Mature build sequence

### Stage 0 — Preserve proven substrate

Keep the existing Slice 1A architecture as proof infrastructure:

- owner/auth boundary;
- private schemas;
- command/idempotency runtime;
- exact-version evidence;
- correction lineage;
- projection seam;
- occurred-vs-recorded time;
- frontend private-table guard.

Do not rebuild those fundamentals merely to make the new product direction feel cleaner.

### Stage 1 — Person + Temporal contracts

Add Person contracts and formalize shared temporal types needed by later domains.

Do not add broad UI yet.

### Stage 2 — Body vertical slice

Add the first asymmetric time-varying observation domain.

Prove height/weight semantics, correction, provenance, coverage, and current/historical reads.

### Stage 3 — Character Creation experience

One simple player experience may write to multiple correct owners through an application/orchestration layer:

```text
Name/Birth -> Person
Height/Weight -> Body
Home Base -> World only when World exists; otherwise omit/defer
```

Do not temporarily store facts in the wrong domain merely to finish the UI.

### Stage 4 — Deterministic natal calculation

Add ephemeris-backed chart calculation with algorithm/version provenance. No symbolic interpretation required to pass this stage.

### Stage 5 — Schedule contract

Prove one scheduled allocation with hard/soft/windowed/floating semantics and planned != occurred behavior.

### Stage 6 — Requirement contract

Prove one recurring requirement with a bounded temporal scope and coverage-aware evaluation.

Prefer a simple Body/Practice requirement first if Nutrition is not yet admitted.

### Stage 7 — Discovery contract

Prove conversation/source -> candidate -> authorized command without broad autonomous writes.

### Stage 8 — Navigator information-need loop

Prove bounded context, partial answer, one high-value question, sourced reply, and proposal/authorization.

### Stage 9 — Position v0

Compose Person + Direction + Schedule + Requirement + current Body/Activity + unknowns into a quiet “Where am I?” projection.

### Stage 10 — Inventory + capability

Prove one real item, one availability/equipped relationship, one loadout/context, and one explainable effective modifier.

### Stage 11 — Skill/Role projection

Infer one narrow skill family from real evidence, then one higher-order Role pattern. No user-entered levels.

### Stage 12 — Training + Nutrition

Add Training and Nutrition as distinct modules once their factual semantics are needed.

Prove one cross-domain growth question, such as strength progression under nutrition/recovery coverage.

### Stage 13 — Review + temporal guidance

Add Daily/Weekly Review projections and schedule-aware guidance. Preserve review != reflection.

### Stage 14 — Symbolic astrology guidance

Add interpretation/transit guidance once factual chart calculation and grounded life context are stable.

### Stage 15 — Expand under pressure

Admit Finance, World, Social, richer Atlas, additional Requirements, richer Inventory, and further domains only as distinct factual semantics appear.

## Admission tests

### New canonical module

Create only when:

1. the area owns distinct factual semantics;
2. it requires distinct validation/persistence rules;
3. another module would become less truthful if forced to own it;
4. it can expose a bounded contract;
5. it can fail independently.

### New persistent table

Create only when:

1. the information cannot be reliably reconstructed;
2. history/provenance/identity must persist;
3. a projection/cache is insufficient;
4. mutation ownership is clear.

### New RPG mechanic

Default to a projection. Persist only when the mechanic itself becomes a durable real-world event/award or stable externally referenced identity.

### New Navigator question

Ask only when expected information value materially exceeds interruption burden.

## Anti-patterns

Do not build:

- universal `life_events` / `facts` tables;
- one table per visible RPG mechanic;
- giant fixed domain enum requiring core rewrites;
- direct AI writes to private canonical state;
- AI-authored facts presented as sourced reality;
- astrology interpretation presented as empirical fact;
- permanent XP ledger before XP rules stabilize;
- duplicated current-state tables that drift;
- calendar entries treated as proof of occurrence;
- incomplete nutrition records treated as zero unrecorded intake;
- arbitrary item bonuses without explainable capability semantics;
- frontend-owned stat/progress calculations;
- onboarding questionnaires whose only purpose is filling blanks;
- full-life context dumps into every model invocation;
- speculative empty schemas for future domains.

## Mature architectural test

A future feature should be addable by answering:

1. What real-world phenomenon is being modeled?
2. Is it canonical reality, deterministic derivation, intelligent inference, or symbolic interpretation?
3. Does it need a new factual owner, or can an existing module own it?
4. Can it be reconstructed instead of persisted?
5. What are its time semantics?
6. What source/provenance supports it?
7. What uncertainty/coverage exists?
8. What Discovery type recognizes it?
9. What Requirement or Schedule semantics apply, if any?
10. How does it affect base capability versus effective capability?
11. What may Navigator say, ask, or propose?
12. What happens if the AI model or projection rule changes?
13. Can durable truth survive that change intact?

If those questions have clean answers, the architecture is scaling correctly.

## Final compressed architecture

```text
LIVE
  -> OBSERVE
  -> RECORD REALITY
  -> DISCOVER
  -> UNDERSTAND
  -> EVALUATE REQUIREMENTS
  -> ORIENT IN TIME
  -> NAVIGATE
  -> ACT
  -> GROW
  -> REPRESENT AS RPG
  -> REVIEW
  -> LIVE AGAIN
```

The mature product should feel simple because the architecture underneath is strict about what owns truth, what is derived, what is uncertain, what is planned, what is symbolic, and what the system still needs to learn.
