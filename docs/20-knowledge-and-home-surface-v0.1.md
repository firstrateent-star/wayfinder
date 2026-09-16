# Wayfinder Knowledge Engine + Helm Relevance Surface v0.1

**Status:** CANDIDATE-STABLE DESIGN

## Purpose

Wayfinder needs domain knowledge without mixing global/reference knowledge into the player's canonical life record, and it needs a home surface that stays calm instead of becoming a dashboard of every available metric.

This document defines two linked architectural laws:

1. **Reference Knowledge is separate from Player Reality.**
2. **Helm/Home is a relevance projection, not a data dashboard.**

These laws allow Wayfinder to become richer underneath while becoming simpler on the surface.

---

## 1. Knowledge Engine

### Core distinction

Wayfinder must preserve four different information sources:

```text
PERSONAL REALITY
What is recorded about this player?

REFERENCE KNOWLEDGE
What does Wayfinder know about the domain?

LIVE EXTERNAL CONTEXT
What is true in the outside world now?

AI INFERENCE
What may be concluded from those inputs?
```

These are not interchangeable.

Examples:

- `Bench press, 185 lb x 8` -> Player Training reality.
- `Bench press is a horizontal press involving chest/triceps/anterior deltoid` -> Training reference knowledge.
- `Gym closes at 9 PM tonight` -> Live external context.
- `Horizontal pressing exposure appears high this week` -> Intelligent inference.

### Knowledge is not player truth

Do not insert reference knowledge into canonical player domains merely because it is relevant to the player.

```text
REFERENCE FOOD DATA != MEAL EATEN
EXERCISE DEFINITION != WORKOUT PERFORMED
CAMERA SPECIFICATION != ITEM OWNED
ASTROLOGY MEANING != PERSON FACT
```

The player's domain owns what happened/exists for the player. Knowledge helps resolve and interpret it.

---

## 2. Knowledge source classes

### A. Deterministic built-ins

Stable formal rules/calculations:

- unit conversions;
- temporal arithmetic;
- geometry/math;
- ephemeris calculations;
- deterministic derived metrics.

### B. Versioned reference data

Structured global/domain data:

- food/nutrient catalogs;
- exercise definitions;
- equipment/product specifications;
- geography/place resolution;
- movement patterns;
- skill/domain taxonomies where useful.

### C. Versioned guidance knowledge

Evidence-informed but contextual rules/models:

- training principles;
- nutrition guidelines;
- recovery guidance;
- financial rules;
- domain best practices.

Guidance knowledge is not universal truth and must retain source/version/context.

### D. Live external context

Information whose value depends on current state:

- weather;
- traffic;
- business hours;
- prices;
- laws/regulations;
- market conditions;
- availability;
- other changing external facts.

Navigator should retrieve these only when materially useful.

---

## 3. Knowledge contract

A knowledge resolver should conceptually return:

```ts
interface KnowledgeResolution<T> {
  domain: string;
  knowledgeType: string;
  value: T;
  sourceClass: "DETERMINISTIC" | "REFERENCE_DATA" | "GUIDANCE" | "LIVE_EXTERNAL";
  sourceId?: string;
  sourceVersion?: string;
  effectiveAt?: string;
  retrievedAt?: string;
  authority?: "PRIMARY" | "HIGH" | "SUPPORTING" | "INTERPRETIVE";
  confidence?: number;
  lineage?: unknown;
}
```

Exact physical shape may change, but the semantics must survive.

Knowledge should answer:

```text
What is this?
Where did it come from?
Which version/rule was used?
How current is it?
How authoritative is it?
Is it deterministic, referenced, guidance, or live context?
```

---

## 4. Domain examples

### Nutrition

```text
Player statement / source
    -> meal/food candidate
    -> food resolution
    -> reference nutrient data
    -> intake derivation
    -> Requirement evaluation
```

Branded exact foods may have high-confidence nutrient resolution.
Homemade/ambiguous meals may remain estimated or cause Navigator to ask one useful question.

### Training

Reference knowledge may model:

```text
exercise
├── movement family
├── primary muscles
├── secondary muscles
├── equipment requirements
├── compound/isolation
├── variants
└── relevant constraints
```

Player Training reality remains the actual workout/sets/reps/load performed.

### Inventory

```text
Owned item
    +
reference specifications/capabilities
    ->
effective capability / loadout effects
```

### Astrology

```text
Player birth facts
    +
place/time resolution knowledge
    +
ephemeris algorithms/data
    ->
deterministic natal geometry
    ->
symbolic interpretation
```

Astrology becomes a first proving slice for Knowledge because it cleanly separates personal facts, deterministic reference computation, and interpretation.

---

## 5. Local-first knowledge strategy

Navigator should not search the web for everything.

```text
Can canonical Player state + trusted deterministic/reference knowledge answer this?
  YES -> use it
  NO  -> does current external information materially matter?
           YES -> retrieve live trusted context
           NO  -> preserve uncertainty / ask if useful
```

This improves reproducibility, speed, cost, and consistency.

The language model is the reasoner/interface, not the authoritative encyclopedia.

---

# Helm / Home Surface

## 6. Home is not a dashboard

The Home/Helm surface must not become:

```text
calendar widget
macro widget
workout widget
money widget
astrology widget
quest widget
inventory widget
weather widget
XP widget
...
```

That would expose backend richness as interface clutter.

Instead:

> **Helm answers: What matters now?**

Everything else has a home elsewhere and appears on Helm only when it is relevant enough to deserve the player's attention.

---

## 7. Home Surface Contract

Every candidate item shown on Helm should be able to answer:

```text
WHY NOW?
Why is this relevant at this moment?

WHAT KIND OF THING IS IT?
Fact, requirement, schedule pressure, recommendation, question, reflection, symbolic lens?

WHAT SUPPORTS IT?
What lineage/evidence/source supports the claim?

WHAT CAN I DO?
Is there a useful action, choice, or drill-down?

WHEN DOES IT STOP MATTERING?
What makes this item stale/expired/resolved?
```

If Wayfinder cannot answer these, the item probably should not be on Home.

---

## 8. Relevance router

Helm is produced by Guidance, not by individual domains pushing widgets.

```text
Domains / projections / Knowledge
           |
           v
      Guidance Engine
           |
     relevance router
           |
           v
          HELM
```

No domain gets permanent Home real estate simply because it exists.

A conceptual relevance function may consider:

```text
relevance
= direction alignment
+ urgency / temporal proximity
+ consequence / impact
+ confidence / coverage
+ change / novelty
+ unresolved attention need
+ actionable value
- interruption cost
- repetition / clutter cost
```

This is an ordering/gating model, not necessarily a persisted numeric score.

---

## 9. Preferred Home composition

The surface should remain structurally stable even as underlying domains expand.

Candidate composition:

```text
HELM

1. POSITION
   Small grounded orientation: where am I right now?

2. ATTENTION
   Zero to a few things that genuinely deserve attention now.

3. NEXT WINDOW / NEXT MOVE
   Immediate temporal opportunity or pressure when useful.

4. NAVIGATOR
   One useful guidance statement or high-value question when warranted.
```

There should be no requirement that all four sections always appear.

Silence is allowed.

---

## 10. Examples of what should and should not surface

### Nutrition

Do not show daily macros just because Nutrition exists.

May surface when:

- a minimum requirement is materially at risk;
- the player explicitly asks;
- meal planning affects the next action;
- a meaningful trend/change deserves attention.

Detailed macros belong in Nutrition/Character/Review drill-downs, not permanently on Home.

### Training

Do not show today's workout merely because Training exists.

May surface when:

- a weekly requirement needs a session;
- scheduled training is approaching;
- recovery suggests changing the plan;
- equipment/location creates a useful opportunity;
- the player asks.

### Calendar

Do not render the entire calendar on Home.

May surface:

- next hard commitment;
- meaningful conflict;
- useful open window;
- deadline pressure.

Full scheduling belongs in Calendar/Schedule.

### Inventory

Inventory belongs on Home only if an item/capability materially affects the current situation.

Example:

> Your camera kit is ready for tonight's shoot, but the wireless audio kit is currently unavailable.

### Astrology

Do not make Home a horoscope feed.

Astrology may surface as an optional symbolic lens when:

- the player enables/wants it;
- it is useful to the current reflection/guidance context;
- it is clearly labeled symbolic;
- it does not displace more important grounded information.

### RPG

XP/stat/achievement information should not dominate Home.

A new meaningful level/achievement may surface briefly because it is novel and meaningful, then expire from Home while remaining available on Character/Journey.

---

## 11. Progressive disclosure

Wayfinder should have information depth without visual clutter.

```text
LEVEL 0 — HELM
What matters now?

LEVEL 1 — DOMAIN / PLAYER SURFACE
Character, Quests, Calendar, Inventory, Atlas, etc.

LEVEL 2 — DETAIL
Macro breakdown, workout history, item capability, natal chart, evidence.

LEVEL 3 — LINEAGE / SYSTEM EXPLANATION
Why Wayfinder believes/says this.
```

The player can go deeper intentionally rather than having every layer rendered at once.

---

## 12. UI law

> **Complexity belongs in the model, not on the Home screen.**

And:

> **A domain earns canonical storage through distinct truth semantics; an item earns Home visibility through current relevance.**

Those are different admission tests.

---

## 13. Implication for current build

Do not redesign Helm into a multi-widget dashboard as new domains arrive.

The current quiet Helm is directionally correct.

Next architectural work:

```text
Knowledge Engine contract
  -> birth-place/timezone resolution
  -> deterministic natal readiness

while preserving

Guidance/Relevance contract
  -> future Position
  -> future Navigator
  -> sparse adaptive Helm
```

Nutrition, Training, Inventory, Finance, World, Astrology and future domains should integrate underneath this routing model rather than adding permanent Home widgets.
