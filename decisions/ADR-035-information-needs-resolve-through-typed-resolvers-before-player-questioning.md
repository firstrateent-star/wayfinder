# ADR-035 — Information needs resolve through typed resolvers before player questioning

**Status:** Accepted for current architecture

## Context

Wayfinder needs to acquire information from several fundamentally different places:

- canonical player state;
- deterministic derivation;
- reusable reference/domain knowledge;
- current external/live context;
- direct player answers;
- preserved uncertainty when nothing can responsibly resolve the need.

Without an explicit resolution order, Navigator could drift into undesirable behavior:

- asking the player for information Wayfinder could retrieve itself;
- searching the web for stable reference facts on every request;
- treating model memory as authoritative knowledge;
- collecting personal information without a legitimate destination;
- inventing a value when a source is unavailable or ambiguous.

The growing Life RPG also needs question prioritization so Navigator does not turn into a profile-completion questionnaire.

## Decision

Wayfinder will represent missing information as a structured **Information Need** and resolve it through typed resolvers before deciding to ask the player.

Conceptual resolution path:

```text
Information Need
 -> canonical player read
 -> deterministic derivation
 -> versioned reference knowledge
 -> live external context when materially required
 -> player question when appropriate
 -> preserve unknown
```

The exact order may be capability-specific, but model improvisation is not a valid fallback.

### Questions are derived from needs

Navigator does not begin with arbitrary natural-language questions. A structured Information Need is transformed into a Question Opportunity only after relevance, burden, sensitivity, timing, answerability, and available alternative resolvers are considered.

Priority classes:

```text
P0_BLOCKING
P1_HIGH_IMPACT
P2_HIGH_LEVERAGE
P3_CALIBRATION
P4_OPTIONAL
```

These classes are contextual guidance, not permanent factual scores.

### Question admission

A proactive question must declare at least one legitimate purpose for the answer:

- a canonical destination through an owning module;
- evidence for a derived model/projection;
- explicitly session-only use.

Wayfinder should not proactively collect information merely because a profile field could theoretically exist.

### Answers remain sourced inputs

A player answer is a high-authority user statement, but it does not grant Navigator direct canonical-write authority. Durable changes still route through Discovery/structured interpretation where needed, explicit authorization, and the owning module command.

### Knowledge and player reality remain distinct

Reference/global knowledge is not copied into the player's canonical life record merely because it was used to interpret that player.

## Consequences

### Positive

- Navigator asks fewer, more useful questions.
- Stable/world knowledge is resolved without burdening the player.
- Player data collection has explicit purpose and ownership.
- Ambiguity and provider outages preserve uncertainty rather than creating invented facts.
- Knowledge providers can evolve independently of canonical player history.
- The same acquisition architecture can support astrology, Training, Nutrition, Inventory, World, Finance, Schedule, and future domains.
- Helm can remain relevance-driven instead of exposing a question backlog.

### Costs

- Intelligence requests require more structured contracts than a simple LLM prompt.
- Provider readiness/authority/versioning must be modeled.
- Some useful questions may be deferred until a legitimate destination or interpretation seam exists.
- Durable cross-session question queues may require future persistence if real usage proves the need.

## First proving slice

Birth-context resolution will be the first vertical slice:

```text
Person birth-place label
 -> place Knowledge resolver
 -> timezone resolver
 -> natal readiness
 -> ambiguity becomes Information Need
 -> Question Opportunity only if clarification materially matters
```

This proves Knowledge and Question Planner together before broad Nutrition/Training implementation.

## Non-decisions

This ADR does not yet require:

- a `wf_questions` schema;
- a `wf_knowledge` canonical schema;
- a durable generic Discovery inbox;
- a universal profile-completeness score;
- one numeric question-priority formula;
- any specific third-party geocoding or ephemeris vendor.

Those choices remain implementation details or future decisions earned by evidence.
