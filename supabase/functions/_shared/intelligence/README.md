# Wayfinder Intelligence Acquisition Framework v0.1

This folder contains the first executable framework for the Knowledge Engine + Information Need + Question Planner architecture defined in `docs/21-knowledge-inquiry-and-acquisition-spine-v0.1.md`.

It is intentionally small and does **not** persist Knowledge, Information Needs, or question queues.

## Laws preserved

- Canonical player state, reference knowledge, live context, inference, and symbolic interpretation remain distinct.
- Unknown is a valid result.
- A provider outage is not evidence that the requested fact is absent.
- Ambiguity and conflict survive routing rather than being flattened into a guess.
- Providers register by stable capability id rather than Navigator hard-coding implementations.
- Player questions are a resolver of last resort after appropriate canonical/knowledge paths have been attempted.
- Question priority is contextual and ephemeral, not a permanent fact about the player.
- Normal Navigator mode has a small question budget; optional discovery can be broader only when the player opts in.
- High-sensitivity questions are excluded unless the caller explicitly allows them.
- Question wording is separate from the semantic information need.

## Files

```text
contracts.ts
  KnowledgeQuery / KnowledgeResolution
  InformationNeed
  QuestionOpportunity
  canonical/acquisition resolver contracts

knowledge-registry.ts
  capability-driven provider registration and readiness

knowledge-router.ts
  ordered provider resolution, failover, ambiguity preservation,
  and degraded-result handling

acquisition-router.ts
  canonical -> deterministic -> reference -> live -> player -> unknown routing

question-planner.ts
  P0-P4 prioritization, burden/sensitivity/repetition signals,
  question budgets, cooldowns, and Discovery Session behavior

index.ts
  public exports
```

## Provider capabilities

Provider implementations should advertise stable capability ids such as:

```text
geo.resolve_place
geo.resolve_timezone
astro.ephemeris
nutrition.resolve_food
training.resolve_exercise
inventory.resolve_product
weather.current
```

Implementations are replaceable. Capability semantics are the stable seam.

## Question planning

The planner does not generate prose. A domain/intelligence contributor registers a `QuestionSpec` describing the semantic intent and expected answer shape. A model may later phrase that intent conversationally without changing its scope.

`planningScore` is intentionally an ephemeral ordering aid only. It must not be persisted as truth or exposed as a player score.

## Next proving slice

The first real provider set should implement:

```text
Person.birth_place_label
  -> geo.resolve_place
  -> ambiguity or resolved coordinates
  -> geo.resolve_timezone / historical offset
  -> natal readiness
```

Ambiguity should create an Information Need and, only when useful, a Question Opportunity for the player.
