# Wayfinder Life RPG + Discovery Architecture v0.1

**Status:** CANDIDATE — Flowered design, not yet authorized for physical schema expansion

## Root proposition

Wayfinder should model lived reality with small, strongly owned canonical modules, then derive a richer RPG experience through discovery, evidence, projections, and symbolic lenses.

The player should not have to manually model their life. Wayfinder should progressively discover useful structure from authorized sources and conversation, preserve the distinction between fact and inference, ask targeted questions when missing information materially matters, and allow RPG mechanics to emerge from evidence.

## Core efficiency law

> **Complexity grows outward through bounded modules and reconstructable projections, not inward through a universal life table.**

The system should remain a modular monolith on one Postgres/Supabase host until evidence justifies otherwise.

## Four epistemic layers

Wayfinder distinguishes four kinds of claims:

1. **Recorded Reality** — canonical records from authorized sources or person-approved commands.
2. **Deterministic Derivation** — reproducible calculations over recorded reality.
3. **Intelligent Inference** — evidence-backed hypotheses, classifications, skill/role estimates, recovery/capacity estimates, recommendations.
4. **Symbolic Interpretation** — astrology, archetypes, RPG metaphors, narrative themes.

No lower-confidence layer may silently masquerade as a higher-authority layer.

## Root architecture

```text
PERSON
  |
  +--> SOURCES / CONVERSATION
  |          |
  |          v
  |      DISCOVERY
  |          |
  |   +------+-------+
  |   |              |
  | FACT CANDIDATES  HYPOTHESES
  |   |              |
  |   v              v
  | DOMAIN COMMANDS  INFERENCE STORE / PROJECTION INPUT
  |   |
  |   v
  | CANONICAL DOMAINS
  |   |
  |   +--> EVIDENCE / RELATIONSHIPS
  |   |
  |   v
  | PROJECTIONS
  |   +--> Position
  |   +--> Character
  |   +--> Skills / Mastery
  |   +--> Roles
  |   +--> XP / Level
  |   +--> Stamina / Conditions
  |   +--> Achievements / Rewards
  |   +--> Loadout Capability
  |   +--> Journey / Bearing
  |   |
  |   v
  +-- NAVIGATOR
         |
         +--> answers
         +--> proposes
         +--> asks high-value questions
         +--> never invents canonical truth
```

## Canonical module families

Do not create one module per visible game mechanic. Prefer a small set of factual owners.

### System
Identity, permissions, command receipts, outbox, provenance contracts.

### Person
Stable subject identity and origin facts that describe the person rather than an activity/domain.

Candidate canonical facts:
- display/preferred name;
- birth date;
- birth time when known;
- birth place when known.

These facts are stable in reality but their records remain correctable because recorded information can be wrong.

### Direction
Values, directions, outcomes, commitments, quests, plans, actions.

### Evidence
Exact cross-record evidence relationships and lineage.

### Body
Physical observations and body state facts such as height baseline, weight observations, body measurements, sleep/recovery observations where admitted later.

### Practice / Activity
Existing Practice remains a useful first activity slice. It may later coexist with more specific activity domains rather than becoming a universal event table.

### Training
Exercise/workout-specific factual semantics when needed: workouts, exercises, sets, reps, load, duration, training context.

### Nutrition
Food/meal/intake facts when needed: foods, meals, quantity, nutrition resolutions.

### Resources
Economic and physical resources should remain separated internally when semantics justify it.

Candidate subdomains:
- Finance: accounts, transactions, income, expense, asset, liability.
- Inventory: owned/available items, quantity, condition, location, acquisition/disposal.

### World
Places, home/base relationships, current location when explicitly known, routes, visited areas, discoverable places, movement/access.

### Social
People, relationships, interactions, groups/communities when admitted.

### Knowledge / Skill Evidence
Specific learned capability evidence may deserve a canonical activity/evidence seam later, but **Skill level, Mastery, Role, XP, and Character stats remain projections until evidence proves a stronger storage need.**

## RPG mechanics are projections

The following are normally derived, reconstructable representations rather than canonical truth stores:

- stats / attributes;
- stamina;
- buffs / debuffs;
- skill level;
- mastery;
- role/class;
- XP;
- level;
- achievements when they can be reconstructed from evidence;
- titles;
- character path;
- archetype;
- reputation;
- gear score;
- loadout power/capability;
- momentum;
- character summary.

A durable canonical achievement record is justified only when the achievement itself is a meaningful authored or externally-issued event that cannot be safely reconstructed.

## Inventory and equipment

Inventory is not a passive catalog. Items participate in effective player capability.

Canonical Inventory facts may include:
- item identity;
- item type/category;
- ownership/access state;
- quantity;
- condition;
- location;
- acquisition/disposal history;
- externally verifiable specifications/capabilities when sourced.

Equipment relationships may distinguish:

```text
OWNED
AVAILABLE
EQUIPPED
IN_USE
```

### Loadouts

A Loadout is usually a relationship/projection over items plus purpose/context:

```text
LOADOUT
  purpose
  context
  items[]
  combined capabilities
  constraints
  synergies
```

Examples: Wedding Production, Music Studio, Boat/Marine, Gym, Travel, Daily Carry.

### Base vs effective capability

Items may modify effective capability without rewriting underlying learned character capability.

```text
Effective Capability
= Base Character Capability
+ Equipment Modifiers
+ Context Modifiers
+ Temporary Conditions
```

If gear disappears, the gear bonus disappears. Learned skill remains.

Gear can indirectly accelerate permanent growth by unlocking harder activities, reducing friction, or increasing practice quality. Real use then produces evidence that may change Skill/Mastery projections.

## Discovery architecture

Discovery is an intelligence/application layer, not a universal truth owner.

The generic path is:

```text
Source Item
   -> Discovery Candidate
   -> Reconciliation / Validation
   -> Owning Domain Command
   -> Canonical Record
```

A Discovery Candidate should minimally preserve:
- candidate type;
- proposed owning module;
- structured value;
- temporal context;
- provenance/source refs;
- derivation mode (`DIRECT_EXTRACTION`, `DETERMINISTIC_DERIVATION`, `INFERRED`);
- confidence when meaningful;
- status (`PROPOSED`, `ACCEPTED`, `REJECTED`, `SUPERSEDED` or similar);
- evidence refs.

Discovery must not become a second canonical life database.

### Authority examples

- Bank connector reports a transaction: source may authoritatively provide transaction facts within its scope.
- Person says, “I weigh 152 lb”: AI may extract a high-confidence candidate; authority comes from the person's statement, not the model.
- AI concludes “video editing skill is high”: inference only; remains derived unless another contract explicitly promotes a narrower factual statement.

## Domain registry

Prefer a lightweight registry/configuration contract before a database-heavy plugin system.

Each admitted module advertises:
- module id/version;
- canonical record types;
- commands;
- reads;
- change types;
- discovery candidate types it accepts;
- reference resolvers;
- readiness/dependency state;
- projection contributions.

Navigator and Discovery route through this registry rather than hard-coded branching across every future life feature.

## Navigator information-need loop

Navigator may ask questions when important information is missing.

It must not ask merely because a field is blank.

Question selection should optimize something conceptually like:

```text
Question Value
= Expected Uncertainty Reduction
  x Relevance
  x Decision Impact
  x Future Reuse
  / User Burden
```

Loop:

```text
User question / navigation task
  -> Assemble bounded context
  -> Separate KNOWN / INFERRED / CONFLICTING / UNKNOWN
  -> Can answer responsibly?
       yes -> answer with appropriate uncertainty
       partial -> answer what is supported, then optionally ask
       no -> identify highest-value missing information
  -> Ask the smallest useful question
  -> Treat answer as sourced input
  -> Discovery / command proposal
  -> Improve model
```

Navigator questions are therefore active learning, not onboarding bureaucracy.

## Astrology architecture

Astrology is a symbolic interpretation layer built on deterministic astronomical calculation.

Keep three layers separate:

```text
Birth Data (canonical Person facts)
   -> Ephemeris / deterministic chart calculation
   -> Natal chart geometry / planetary positions / houses / aspects
   -> Astrological interpretation
```

Current planetary positions/transits can be computed from current time and compared with natal geometry.

The deterministic chart calculation may be cached if useful, but it is reconstructable from birth facts + ephemeris version.

Astrological interpretations remain symbolic guidance, not empirical evidence about guaranteed traits, outcomes, health, finances, or future events.

Navigator may combine grounded life context with the astrology lens while labeling the distinction.

## Character composition

Character should be a composed projection, not a monolithic canonical row.

```text
CHARACTER
  Identity         <- Person
  Origin           <- birth facts + natal chart
  Body             <- Body reads
  Skills           <- evidence-backed skill projections
  Roles            <- higher-order skill/activity clusters
  Attributes       <- broad evidence-backed patterns
  Inventory/Gear   <- Resource/Inventory reads
  Effective State  <- base + equipment + conditions + context
  Archetypes       <- symbolic interpretation
  Path             <- long-horizon becoming projection
```

At initial character creation, unknown Role/Skill/Level/Path values should remain unknown rather than being fabricated.

## Position composition

Position is a projection answering “Where am I?” and should not become a canonical table.

Candidate inputs:
- current Direction;
- recent Reality/activity;
- open commitments;
- Body/capacity signals;
- Resources;
- World/location/access;
- Social context where relevant;
- Inventory/loadout capability;
- important unknowns;
- optional astrology symbolic context.

Position should surface the smallest useful grounded summary, not a dashboard of every available metric.

## Growth loop

```text
Reality
 -> Evidence
 -> Skill / pattern inference
 -> Growth projection
 -> RPG representation
      XP
      Level
      Stats
      Mastery
      Achievements
      Role
 -> Navigator
 -> new action / quest
 -> Reality
```

Permanent character growth must trace back to evidence. Equipment/context modifiers may change effective state without becoming permanent growth.

## World / exploration loop

World should support a future Atlas without requiring a giant world schema now.

```text
Places known
+ places visited
+ available transportation
+ gear/access constraints
+ quests/interests
 -> reachable / discoverable areas
 -> exploration
 -> new place evidence
 -> Atlas expands
```

“Undiscovered” means not yet known to Wayfinder/player within a declared model scope, not literally nonexistent.

## Build order

### Phase A — Freeze the architectural laws

Promote only the following design laws before adding tables:
- four epistemic layers;
- game mechanics as projections;
- inventory modifies effective state, not base mastery;
- discovery routes through owning modules;
- Navigator questions are information-need driven;
- astrology is symbolic interpretation over deterministic chart calculation.

### Phase B — Person + Character Creation vertical slice

Add the smallest Person module and one player-facing character creation flow.

Candidate first inputs:
- preferred/display name;
- birth date;
- birth time optional;
- birth place optional.

Height/weight should route into Body, not Person, once Body exists. Until then they may be omitted rather than temporarily stored in the wrong module.

No Role, XP, Level, or Skill inputs.

### Phase C — Discovery contract, no broad AI writes

Implement structured candidate/proposal contracts and provenance. Do not yet build a universal candidate table unless multiple sources prove persistence is required.

### Phase D — Body as first asymmetric discovery domain

Prove:

```text
“I weigh 152 lb”
 -> extracted candidate
 -> authorized Body command
 -> versioned/temporal weight observation
 -> current Body projection
```

Then prove correction, provenance, duplicate handling, and uncertainty.

### Phase E — Inventory / effective-state slice

Prove one real item and one loadout:

```text
item ownership
 -> capability metadata
 -> equipped/available relationship
 -> effective capability modifier
 -> Character/Position contribution
```

Do not create permanent Skill growth merely from ownership.

### Phase F — Skill discovery projection

Use existing Practice plus new Body/Inventory/activity evidence to infer one narrow Skill family. Preserve evidence lineage and uncertainty.

### Phase G — Navigator read/question loop

Prove Navigator can:
- answer from bounded context;
- identify an important unknown;
- ask one useful question;
- convert the answer into a sourced proposal;
- require authorization for canonical mutation.

### Phase H — Astrology lens

Add deterministic natal-chart calculation after Person birth facts exist. Keep interpretation separately versioned/reconstructable and clearly symbolic.

### Phase I — Expand domains only by pressure

Admit Training, Nutrition, Finance, World, Social, and other modules when real use demonstrates distinct semantics and ownership requirements.

## Anti-patterns

Do not build:
- one universal `life_events` or `facts` table;
- one table for every player-facing RPG concept;
- a permanent XP ledger before XP rules stabilize;
- direct AI writes into private canonical tables;
- a giant fixed domain enum that requires rewiring the core for every new life area;
- arbitrary item bonuses with no capability/evidence rationale;
- astrology interpretations stored as facts;
- Navigator questionnaires that fill empty fields for their own sake;
- frontend-owned character math;
- duplicated “current state” stores that can drift from canonical source modules.

## Primary architectural test

A future feature should be addable by answering:

1. What factual reality, if any, needs a canonical owner?
2. Can the feature be reconstructed as a projection instead?
3. What source/evidence supports it?
4. What module owns mutations?
5. What does Discovery need to recognize?
6. What can Navigator ask only if information is materially missing?
7. What happens if the feature is removed or its AI model changes?
8. Can all durable truth remain intact?

If those questions have clean answers, the architecture is scaling correctly.
