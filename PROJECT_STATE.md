# Wayfinder — Project State / Chat Recovery

**Repository:** `firstrateent-star/wayfinder`  
**Current milestone:** proven Slice 1A backend + quiet read-only player shell + Life RPG discovery architecture v0.1  
**Current phase:** freeze the next architectural laws before adding new physical domains  
**Canon:** `docs/CANON.md` + later addenda/ADRs  
**Latest architecture:** `docs/17-life-rpg-discovery-architecture-v0.1.md`  
**Latest ADR:** `decisions/ADR-030-rpg-mechanics-derived-from-canonical-reality.md`

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
- one indivisible user save should use one authoritative transaction when partial commit would violate intent;
- occurred time and recorded time remain distinct;
- **complex underneath, quiet on the player surface**;
- **the player should not have to manually model their life**;
- **RPG mechanics are projections by default**;
- **equipment modifies effective state, not permanent base mastery**;
- **Navigator asks questions only when missing information materially matters**;
- **astrology is symbolic guidance over deterministic chart calculation, not canonical empirical truth**.

## Current conceptual architecture

```text
SYSTEM
  identity · permission · command receipts · provenance · outbox

PERSON
  stable/correctable identity + birth/origin facts

SOURCES / CONVERSATION
          |
          v
      DISCOVERY
      /       \
 candidates   hypotheses
      |           |
      v           v
DOMAIN COMMANDS   INFERENCE
      |
      v
CANONICAL MODULES
  Direction · Evidence · Practice
  future: Body · Training · Nutrition · Finance · Inventory · World · Social ...
      |
      v
PROJECTIONS
  Position · Character · Skills · Role · XP · Level · Stamina · Achievements
  Loadout Capability · Journey · Bearing
      |
      v
NAVIGATOR
  answers · explains · proposes · asks high-value questions
```

## Four epistemic layers

```text
1. RECORDED REALITY
   canonical sourced/authorized facts and events

2. DETERMINISTIC DERIVATION
   reproducible math/calculation over reality

3. INTELLIGENT INFERENCE
   evidence-backed hypotheses/projections

4. SYMBOLIC INTERPRETATION
   astrology · archetypes · RPG metaphor · narrative themes
```

A lower-authority layer must not masquerade as a higher-authority layer.

## RPG architecture

Do not create one canonical module/table per visible game mechanic.

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
```

### Inventory / gear law

Inventory is functional, not decorative.

```text
Effective Capability
= Base Character Capability
+ Equipment Modifiers
+ Context Modifiers
+ Temporary Conditions
```

Owned/equipped gear may unlock actions, areas, quests, efficiency, income potential, training access, crafting, recovery support, or context-specific stat/skill modifiers.

Gear alone does **not** permanently increase learned Skill/Mastery. Real use produces evidence that may increase permanent growth projections.

## Discovery architecture

Generic path:

```text
Source Item
 -> Discovery Candidate
 -> Reconciliation / Validation
 -> Owning Domain Command
 -> Canonical Record
```

Discovery is not a second life database and does not directly author canonical truth.

Candidates preserve type, proposed owner, structured value, temporal context, provenance, derivation mode, confidence when meaningful, status, and evidence refs.

## Navigator information-need behavior

Navigator may identify:

```text
KNOWN
INFERRED
CONFLICTING
UNKNOWN
MISSING-BUT-IMPORTANT
```

It should ask a question only when the answer has sufficient value:

```text
Question Value
≈ uncertainty reduction × relevance × decision impact × future reuse / user burden
```

It should answer what is supported first, then ask the smallest useful question if needed.

## Astrology

Keep three layers distinct:

```text
Birth Data (canonical Person facts)
 -> Ephemeris / deterministic chart calculation
 -> Natal geometry / planetary positions / houses / aspects
 -> Astrological interpretation (symbolic)
```

Current planetary positions/transits can be deterministically computed and compared to natal geometry. Navigator may use this as a clearly labeled reflection/guidance lens alongside grounded life context.

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

Existing backend Slice 1A remains valuable proof infrastructure. Do not delete it merely because the player UI has been simplified.

## Current player UI

The player shell was intentionally rolled back.

Current `/helm` is read-only and quiet. It contains no Practice/Direction/Evidence/correction inputs and does not expose the prior database-like controls.

Journey still exists in code/backend research but is hidden from the normal player shell.

Principle:

> Build the intelligence/model first. Add player UI only when the system has something genuinely useful to show or ask.

## Proven backend architecture

Still valid:

- owner identity;
- private module schemas;
- command envelope/idempotency;
- atomic authoritative command boundaries;
- exact-version evidence lineage;
- versioned correction;
- result coverage vs epistemic coverage;
- projection/read seam;
- occurred vs recorded time;
- frontend direct-table boundary guard.

## Next build sequence

Do **not** jump into macros/workouts/XP/UI screens yet.

Preferred sequence:

```text
A. Freeze new architecture laws
   - four epistemic layers
   - RPG mechanics derived by default
   - inventory modifies effective state
   - discovery routes through owning modules
   - Navigator information-need questions
   - astrology symbolic/deterministic separation

B. Person / Character Creation vertical slice
   - preferred/display name
   - birth date
   - birth time optional
   - birth place optional
   - no Role/XP/Level/Skill inputs

C. Discovery contract
   - structured candidates/proposals
   - provenance and authorization
   - do not persist a universal candidate table until multiple sources prove the need

D. Body asymmetric slice
   - prove a statement like “I weigh 152 lb” can become a sourced proposal -> authorized Body observation -> projection

E. Inventory/effective-state slice
   - one real item
   - availability/equipped relationship
   - one context/loadout
   - one explainable modifier

F. Skill discovery projection
   - infer one narrow skill family from real evidence
   - preserve lineage and uncertainty

G. Navigator read/question loop
   - bounded context
   - answer what is known
   - ask one high-value missing question
   - proposal -> authorized canonical command

H. Astrology lens
   - deterministic natal calculation
   - symbolic interpretation kept separate

I. Expand domains under real pressure
   - Training
   - Nutrition
   - Finance
   - World
   - Social
   - etc.
```

## Anti-patterns

Do not build:

- universal `life_events` / `facts` table;
- one table per RPG mechanic;
- permanent XP ledger before rules stabilize;
- direct AI canonical writes;
- arbitrary gear bonuses without capability rationale;
- astrology interpretations as facts;
- Navigator questionnaires merely to fill blanks;
- frontend-owned stat math;
- duplicated current-state stores that can drift;
- giant fixed domain enum that makes every future feature a core rewrite.

## Recovery prompt

> Open `PROJECT_STATE.md`, then read `docs/17-life-rpg-discovery-architecture-v0.1.md`, `decisions/ADR-030-rpg-mechanics-derived-from-canonical-reality.md`, `docs/CANON.md`, `docs/04-domain-protocol.md`, and `docs/05-intelligence-runtime.md`. Preserve the proven Slice 1A backend as architectural evidence, keep the player shell quiet/read-only, and continue by designing the smallest Person/Character Creation vertical slice before adding broader domains or RPG persistence.
