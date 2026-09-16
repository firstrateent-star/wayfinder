# Wayfinder Knowledge, Inquiry & Acquisition Spine v0.1

**Status:** CANDIDATE-STABLE DESIGN — prerequisite intelligence spine before broad domain expansion

## Purpose

Wayfinder now has a proven canonical substrate (System, Person, Body, Direction, Practice, Evidence), a mature Life RPG architecture, a Knowledge Engine concept, and a relevance-driven Helm. The remaining architectural pressure is how Wayfinder should acquire information without either:

- treating model guesses as truth;
- searching the internet for everything;
- asking the player endless profile questions;
- collecting answers that have no legitimate semantic home;
- dumping every known fact onto the Home surface.

This document defines the minimum intelligence-acquisition spine needed before broad feature work.

The central law is:

> **Every information gap must be resolved through the correct resolver: canonical state, deterministic derivation, reference knowledge, live external context, the player, or preserved uncertainty. Navigator does not guess merely because an answer would be convenient.**

A second law follows:

> **Wayfinder should not proactively ask a question unless it knows why the answer matters and where the answer would go (or that the answer is intentionally session-only).**

---

## 1. Architecture position

The mature architecture is best understood as several planes rather than one growing feature graph.

```text
                         TIME
                          |
                          v
+----------------------------------------------------------+
| CANONICAL PLAYER PLANE                                  |
| System / Person / Direction / Body / Practice / ...     |
| What is recorded about this player?                     |
+----------------------------------------------------------+
                          |
                          v
+----------------------------------------------------------+
| KNOWLEDGE PLANE                                         |
| deterministic / reference data / guidance / live        |
| What does Wayfinder know about the domain/world?        |
+----------------------------------------------------------+
                          |
                          v
+----------------------------------------------------------+
| ACQUISITION + INQUIRY PLANE                             |
| information needs / resolver routing / question planner |
| What is missing, and how should it be resolved?         |
+----------------------------------------------------------+
                          |
                          v
+----------------------------------------------------------+
| INTELLIGENCE + GUIDANCE PLANE                           |
| Discovery / context / Position / requirements / planning|
| What does the combined information mean right now?      |
+----------------------------------------------------------+
                          |
                          v
+----------------------------------------------------------+
| GAME / PROJECTION PLANE                                 |
| Character / Skills / Role / XP / Stats / Stamina / etc. |
+----------------------------------------------------------+
                          |
                          v
+----------------------------------------------------------+
| EXPERIENCE PLANE                                        |
| Helm / Navigator / Character / Quests / Calendar / Atlas|
+----------------------------------------------------------+
```

Cross-cutting through all planes:

```text
Time
Provenance
Authority
Coverage
Uncertainty
Permissions
Freshness
Lineage
```

No plane may silently promote its output into a higher-authority plane.

---

## 2. Data placement law

Before Wayfinder stores or surfaces any datum, it should be classifiable.

```text
ABOUT THE PLAYER + factual/authored?
  -> canonical owning module

ABOUT THE WORLD / DOMAIN + reusable?
  -> Knowledge

ABOUT THE OUTSIDE WORLD RIGHT NOW?
  -> Live external context

MISSING ABOUT THE PLAYER?
  -> Information Need

DERIVED FROM EVIDENCE?
  -> projection / inference

SYMBOLIC / narrative?
  -> interpretation

NONE OF THE ABOVE?
  -> do not invent a permanent home merely to retain it
```

This prevents a universal miscellaneous-data layer from emerging.

### Question admission corollary

A proactive question should declare one of:

1. **canonical destination** — e.g. an answer may become a proposed Body/Direction/Inventory record through an authorized command;
2. **derived-model use** — answer is evidence used to improve an inference/projection;
3. **session-only use** — answer is needed only to complete the current task and is not expected to become durable player state.

If none is known, Wayfinder should normally not ask the question yet.

---

## 3. Information Resolution Router

Knowledge Engine and Question Planner are complementary resolvers. They should sit behind one conceptual routing decision.

```text
INFORMATION NEED
      |
      v
Can canonical state answer it?
  YES -> use authorized module read
  NO
      |
Can it be deterministically derived?
  YES -> deterministic resolver
  NO
      |
Can trusted reference knowledge answer it?
  YES -> reference resolver
  NO
      |
Does current external context matter and have a provider?
  YES -> live resolver
  NO
      |
Is this information appropriately answerable by the player?
  YES -> Question Planner
  NO
      |
PRESERVE UNKNOWN
```

The router may choose a different order for a particular capability when domain semantics justify it, but it must never silently fall through to model improvisation.

### Resolver result states

All resolution paths should conceptually support:

```text
RESOLVED
PARTIAL
AMBIGUOUS
CONFLICTING
STALE
UNAVAILABLE
UNKNOWN
NOT_APPLICABLE
```

An ambiguous result is not the same as no result. An unavailable provider is not evidence that the requested fact is absent.

---

## 4. Knowledge Query contract

The first executable Knowledge Engine should be capability-driven rather than a universal search box.

Conceptually:

```ts
interface KnowledgeQuery<TInput = unknown> {
  capability: string;
  domain?: string;
  input: TInput;
  asOf?: string;
  locale?: string;
  purpose?: string;
}

type KnowledgeStatus =
  | "RESOLVED"
  | "PARTIAL"
  | "AMBIGUOUS"
  | "CONFLICTING"
  | "STALE"
  | "UNAVAILABLE"
  | "UNKNOWN"
  | "NOT_APPLICABLE";

interface KnowledgeResolution<T = unknown> {
  status: KnowledgeStatus;
  capability: string;
  value?: T;
  candidates?: T[];
  sourceClass:
    | "DETERMINISTIC"
    | "REFERENCE_DATA"
    | "GUIDANCE"
    | "LIVE_EXTERNAL";
  sourceId?: string;
  sourceVersion?: string;
  effectiveAt?: string;
  retrievedAt?: string;
  authority?: "PRIMARY" | "HIGH" | "SUPPORTING" | "INTERPRETIVE";
  confidence?: number;
  coverage?: unknown;
  lineage?: unknown;
  limitation?: string;
}
```

The exact machine types may evolve after the first vertical slice, but these semantics should survive.

### Provider rule

Providers should be registered by capability, not hard-coded throughout Navigator.

Examples:

```text
geo.resolve_place
geo.resolve_timezone
astro.ephemeris
nutrition.resolve_food
training.resolve_exercise
inventory.resolve_product
weather.current
```

Provider implementation is replaceable. Capability semantics are the stable seam.

---

## 5. Knowledge provider classes

### Deterministic providers

Examples:

- unit conversion;
- local-day bounds;
- arithmetic/geometry;
- ephemeris calculations;
- deterministic metric formulas.

They must expose algorithm/rule versions when reproducibility matters.

### Reference-data providers

Examples:

- place/geographic resolution;
- historical timezone mapping;
- food composition;
- exercise/movement definitions;
- equipment specifications;
- domain taxonomies.

### Guidance providers

Examples:

- training programming guidance;
- nutrition guidance;
- recovery models;
- domain best practices.

Guidance must retain source/context/effective version and must not masquerade as deterministic fact.

### Live external providers

Examples:

- current weather;
- business hours;
- traffic;
- prices;
- market state;
- changing regulations/availability.

Live retrieval should be demand-driven rather than the default knowledge strategy.

---

## 6. Information Need contract

Navigator should not begin with natural-language questions. It should begin with a structured **Information Need**.

Conceptually:

```ts
type InformationNeedKind =
  | "MISSING"
  | "AMBIGUOUS"
  | "CONFLICTING"
  | "STALE"
  | "LOW_COVERAGE";

type NeedPriorityClass =
  | "P0_BLOCKING"
  | "P1_HIGH_IMPACT"
  | "P2_HIGH_LEVERAGE"
  | "P3_CALIBRATION"
  | "P4_OPTIONAL";

interface InformationNeed {
  concept: string;
  kind: InformationNeedKind;
  purpose: string;
  consumers: string[];
  priorityClass: NeedPriorityClass;
  resolutionOptions: string[];
  canonicalDestination?: {
    module: string;
    commandType?: string;
  };
  expectedLifetime?: "SESSION" | "TEMPORAL" | "STABLE";
  sensitivity?: "LOW" | "MODERATE" | "HIGH";
  answerability?: "HIGH" | "MEDIUM" | "LOW";
  expiresAt?: string;
  evidence?: unknown;
}
```

Do not persist every transient Information Need merely because the model noticed it. Durable storage is earned only when deferred/async/reconciliation workflows prove the need.

---

## 7. Question priority model

Question priority is contextual. Avoid freezing one permanent scalar score as truth.

Ranking may consider:

```text
+ decision-blocking value
+ uncertainty reduction
+ current relevance
+ consequence / decision impact
+ cross-domain leverage
+ future reuse
+ freshness/staleness resolution
+ conflict resolution value
+ requirement / deadline impact
+ answerability
+ natural timing opportunity

- user burden
- sensitivity
- interruption cost
- redundancy
- recent repetition
- low confidence that answer will be useful
```

### Priority classes

#### P0 — BLOCKING

Required to responsibly or usefully complete the current task.

Ask immediately when necessary.

#### P1 — HIGH IMPACT

Likely to materially change current guidance or an important decision.

Ask at the current natural opportunity if burden is reasonable.

#### P2 — HIGH LEVERAGE

Not required now, but one answer would substantially improve the long-term player model or several domains.

Queue for a contextually relevant moment or an opt-in Discovery Session.

#### P3 — CALIBRATION

Improves confidence, refreshes stale information, or fine-tunes personalization.

Ask sparingly.

#### P4 — OPTIONAL

Interesting but low practical value.

Normally do not interrupt the player.

Conflict/reconciliation generally outranks curiosity/enrichment.

---

## 8. Question Opportunity contract

An Information Need becomes a player-facing question only after timing/burden/privacy checks.

The semantic question and the literal wording should remain separate.

```ts
interface QuestionOpportunity {
  informationNeed: InformationNeed;
  mode: "TASK_DRIVEN" | "AMBIENT" | "DISCOVERY_SESSION";
  questionIntent: string;
  expectedAnswerShape?: string;
  whyThisMatters: string;
  mayPersistAnswer: boolean;
  requiresExplicitAuthorizationForWrite: boolean;
}
```

The language model may phrase the question conversationally. It may not change the underlying information target or silently broaden scope.

### Askability law

Do not ask merely because a field is blank.

Ask because the missing information currently has sufficient value.

---

## 9. Question budget and interaction modes

### Normal Navigator mode

The default should be low interruption.

```text
0 or 1 proactive question at a natural moment
```

No questionnaire queue should spill onto Helm.

### Task-driven mode

If the player asks a question that cannot be answered well without one missing fact, Navigator may ask the smallest useful clarifier.

Navigator should answer any supportable portion first when possible.

### Discovery Session

An optional mode where the player explicitly invites Wayfinder to learn more.

```text
ask highest-value question
 -> answer
 -> Discovery / resolution
 -> recompute model coverage
 -> reprioritize
 -> ask next question
```

This is adaptive, not a static onboarding form.

### Dismissal/cooldown

If a player ignores or declines a question, Navigator should not repeatedly ask it without a meaningful change in context/priority.

---

## 10. Model Coverage is not profile completion

Wayfinder may internally reason about coverage such as:

```text
Training access        UNKNOWN
Current Direction      PARTIAL
Body measurements      CURRENT ENOUGH FOR TASK
Nutrition intake       LOW COVERAGE TODAY
Music skill evidence   STRONG
Finance context        NOT REQUESTED
```

Do not collapse this into a gamified "73% profile complete" score.

Coverage is capability/task-relative.

The relevant question is:

> **Do we know enough to answer or guide this particular thing?**

not:

> **How many fields have been filled?**

---

## 11. Answer processing

A player answer is a source, not automatic canonical truth in every domain.

```text
QUESTION
  -> PLAYER ANSWER
  -> source/provenance
  -> Discovery / structured interpretation
  -> candidate destination
  -> proposal / authorization when needed
  -> owning domain command
  -> canonical record
```

For a structured explicit selection (for example choosing one of two birthplace candidates), the interpretation step may be trivial, but domain ownership and authorization still remain explicit.

Read-only answers or session-only clarifications may never require canonical mutation.

---

## 12. First proving vertical slice: birth context

Birthplace resolution is the ideal first combined Knowledge + Inquiry slice because it exercises the full architecture with small scope.

### Inputs already live

```text
Person.birth_date
Person.birth_time_local?
Person.birth_time_accuracy?
Person.birth_place_label?
```

### Knowledge path

```text
birth_place_label
 -> geo.resolve_place
 -> resolved place identity / coordinates OR ambiguity

coordinates + birth local datetime
 -> geo.resolve_timezone
 -> IANA timezone / historical offset context

resolved time/place
 -> natal readiness
```

### Question path

If the place resolver returns ambiguity:

```text
AMBIGUOUS KnowledgeResolution
 -> InformationNeed
    concept: person.birth_place_disambiguation
    priority: P0/P1 only when precise natal calculation is requested/needed
 -> QuestionOpportunity
 -> player selects/clarifies place
 -> Person correction or explicit structured resolution
 -> retry Knowledge resolution
```

If birth time is unknown:

- do not nag merely because the field is empty;
- ask when the player requests chart features that materially require time (Ascendant/houses) or in an opt-in Discovery Session;
- preserve unknown if the player does not know it.

### Natal readiness projection

The first slice should expose a read/projection roughly like:

```text
READY
MISSING_BIRTH_DATE
MISSING_BIRTH_TIME
MISSING_BIRTH_PLACE
AMBIGUOUS_BIRTH_PLACE
PLACE_RESOLUTION_UNAVAILABLE
TIMEZONE_RESOLUTION_UNAVAILABLE
READY_FOR_TIME_INDEPENDENT_CHART_ONLY
```

Do not calculate unsupported chart components.

This vertical slice proves Knowledge and Question Planner before Nutrition/Training make the problem much larger.

---

## 13. Full-project fit matrix

| Area | Canonical player owner | Knowledge needed | Typical player questions | Major projections |
|---|---|---|---|---|
| Character origin | Person / Body | geography, timezone, ephemeris | birth ambiguity/time when relevant | natal geometry, archetype |
| Direction / Quests | Direction | optional domain guidance | priorities, deadlines, meaning | quest readiness, bearing |
| Schedule | Schedule | calendar/time rules, travel context | flexibility/preferences when needed | next window, pressure |
| Requirements | owning domain | metric/rule knowledge | target intent/constraints | satisfied/at-risk/unknown |
| Training | Training | exercise ontology, programming guidance | equipment access, goal, recovery gaps | strength, stamina, skill growth |
| Nutrition | Nutrition | food composition, nutrition guidance | portions, foods, preferences when material | macros, requirement state, growth context |
| Inventory / Gear | Inventory | product/equipment capabilities | ownership/access/condition | loadouts, effective capability |
| Finance | Finance | finance/tax/rule knowledge | user-specific context only when needed | resources, constraints |
| World / Atlas | World | geography, hours, weather, routes | home/current place/travel intent | reachable/discovered areas |
| Social | Social | minimal reference/domain context | relationship roles/context when useful | allies, party, reputation |
| Skills / Role | evidence + derived layer | skill ontology | experience gaps only when high leverage | mastery, role/class |
| Reviews | projection | domain guidance | reflection prompts | daily/weekly review |
| Astrology | Person + Knowledge | ephemeris + symbolic reference | missing precise birth inputs | chart, transits, symbolic guidance |

This matrix is not permission to create every module now. It shows that the same acquisition spine can support the full project without each area inventing its own information strategy.

---

## 14. Helm integration

Information Needs do not automatically appear on Home.

```text
Information Need
 -> Question Opportunity
 -> Guidance/Relevance Router
 -> Helm/Navigator only if it deserves attention now
```

Helm must never become:

```text
"Wayfinder has 37 questions for you"
```

A P0/P1 question may surface because it blocks something that matters now. P2/P3 needs should normally remain invisible until a natural context or opt-in Discovery Session.

---

## 15. What should be persisted now vs later

### Build now

- capability-driven Knowledge interfaces/registry;
- Information Need / Question Opportunity contracts;
- resolver routing behavior;
- first birthplace/timezone provider adapter(s);
- natal-readiness projection;
- explicit epistemic/status outputs;
- tests for ambiguity/unavailable/missing inputs.

### Keep transient initially

- most Information Needs;
- most question ranking calculations;
- question wording;
- generic Discovery candidates;
- general model-coverage map;
- provider search traces not needed for reproducibility.

### Persist only when earned

- deferred question queue if cross-session workflows need it;
- durable Discovery inbox if async/conflict review proves necessary;
- cached Knowledge resolutions if latency/cost/reproducibility requires them;
- global reference datasets if local ownership is operationally justified.

Do not create a `wf_questions`, `wf_knowledge`, or `wf_profile_fields` canonical schema merely because these concepts exist.

---

## 16. Minimum implementation spine before broad feature work

The project does **not** need Training, Nutrition, Finance, Inventory, World, Schedule, or full Navigator to begin implementing the intelligence spine.

It needs these seams first:

```text
1. KnowledgeQuery / KnowledgeResolution
2. Knowledge provider registry + readiness
3. InformationNeed
4. QuestionOpportunity / priority class
5. Information Resolution Router
6. Source/answer provenance handoff
7. Bounded context contract
8. Relevance handoff to Helm
```

Then prove them with one vertical slice.

The first slice is birth context.

The second high-value proving slice should later be one non-astrology case (likely Training or Nutrition) to prove the Knowledge architecture generalizes beyond geography/ephemeris.

---

## 17. Stress-test laws

Before promotion, prove:

1. a missing player fact does not cause model hallucination;
2. reference knowledge never becomes player canonical state by accident;
3. a Knowledge provider can be swapped without rewriting player truth;
4. ambiguous place resolution asks rather than guesses;
5. unavailable Knowledge preserves uncertainty;
6. Question Planner does not ask when another resolver can answer reliably;
7. a question cannot silently broaden into unrelated personal data collection;
8. a question with no legitimate destination/session purpose is rejected/deferred;
9. ignored questions do not nag indefinitely;
10. sensitive questions require greater demonstrated value;
11. user answers route through provenance + owning-domain authority;
12. no question backlog becomes a Home dashboard;
13. the model/vendor can change without changing historical canonical truth;
14. low-value P4 curiosity does not interrupt normal play;
15. deterministic outputs retain rule/provider versions when required for reproducibility.

---

## 18. Build order from current state

Current live substrate:

```text
System / command runtime              LIVE
Person                                LIVE
Temporal Kernel                       LIVE
Body                                  LIVE
Atomic Character Initialization       LIVE
Direction / Practice / Evidence       PROVEN
Quiet Helm                            LIVE
Knowledge/Home design                 CANDIDATE-STABLE
```

Recommended immediate sequence:

```text
A. Freeze Knowledge + Inquiry contracts
B. Implement provider registry / resolution status types
C. Implement geo.resolve_place adapter
D. Implement geo.resolve_timezone adapter
E. Implement natal-readiness projection
F. Implement ambiguity -> InformationNeed -> QuestionOpportunity
G. Stress test missing/ambiguous/unavailable paths
H. Implement deterministic ephemeris/natal geometry
I. Expose Character Creation only after this seam is coherent
J. Then proceed to Schedule + Requirements + generalized Discovery/Navigator
```

This is enough foundation to start building without first implementing the entire Life RPG.

---

## Closing principle

> **Wayfinder should become knowledgeable without pretending knowledge is the player, curious without becoming intrusive, and intelligent without filling gaps with invention.**

The acquisition spine is what allows the rest of the Life RPG to grow while keeping both the backend and the player experience coherent.