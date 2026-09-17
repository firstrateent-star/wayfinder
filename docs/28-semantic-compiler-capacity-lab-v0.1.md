# Semantic Compiler + Wayfinder Capacity Lab v0.1

**Status:** LAB / architecture proving slice  
**Scope:** natural-language understanding before canonical persistence

## Root proposition

> Navigator accepts imperfect human expression and progressively resolves it into the smallest defensible model of lived reality without requiring the player to speak Wayfinder's ontology.

Core law:

> **Flexible language at the edge. Strict meaning at the core.**

The semantic compiler is not a memory table and not a canonical domain. It creates a transient semantic representation that can be resolved, clarified, routed, or dropped before any owning domain is allowed to mutate player reality.

## Pipeline

```text
human expression
  -> SourceEnvelope
  -> SemanticReasoner
  -> CandidateLifeGraph
  -> context / concept / entity / time resolution
  -> Wayfinder Capacity assessment
  -> compiler routing
  -> domain Semantic Admission
  -> typed domain command only when justified
```

The compiler may understand more than current Wayfinder domains can persist.

## Candidate Life Graph

The v0.1 contract can represent:

- nodes: entity, event, state, observation, quantity, intention, plan, reflection, reference, claim;
- reality modes: occurred, current state, intended, planned, expected, possible, hypothetical, question, reflection, reported about other, negated, correction;
- field-level resolution, precision and certainty;
- human temporal meaning;
- semantic relationships such as before/after/about/repeats/corrects/negates/compares-to;
- unresolved references and ambiguities;
- alternate interpretations;
- structured semantic trace.

Candidate graphs are transient by default.

## Why field-level uncertainty matters

```text
"I think I spent like 40 bucks on gas."

expense occurred          -> strong
category fuel             -> strong
amount 40                 -> approximate
merchant                  -> unknown
payment account           -> unknown
```

Uncertainty in one field must not force false certainty in another.

## Wayfinder Capacity Map

Wayfinder capacity is now explicit enough for Navigator to ask what it can actually do with understood meaning.

Capacity facets:

```text
RECOGNIZE
RESOLVE
REPRESENT
PERSIST
ANALYZE
PROJECT
GUIDE
SURFACE
```

These are facets, not a claim that every concept must support every later facet.

Current proving examples:

```text
RUNNING
  semantic-core: RECOGNIZE + REPRESENT
  canonical persistence: not yet live

STRENGTH_TRAINING
  semantic-core/training: recognize, resolve, represent
  training: PERSIST
  navigator: current proving surface exists

MEAL / EXPENSE / EMOTIONAL_STATE
  semantic understanding can exist
  canonical domain capacity is not yet live
```

Therefore:

> **Understanding something does not require Wayfinder to currently have canonical capacity for it.**

## Compiler routing

v0.1 compiler routing does not execute writes.

It emits one of:

```text
ROUTE_TO_DOMAIN
CLARIFY
SESSION_ONLY
DROP
```

`ROUTE_TO_DOMAIN` means only that exactly one declared persistence owner exists and the candidate is eligible to enter domain admission. The owning domain still decides whether the claim is admissible.

## Concept Registry

A small concept graph now separates concept identity from domain ownership.

Examples:

```text
ACTIVITY
  -> PHYSICAL_ACTIVITY
      -> STRENGTH_TRAINING
      -> RUNNING
      -> WALKING
```

An unknown leaf can still inherit broad parent capacity. Wayfinder can therefore understand `WING_FOILING` as physical activity without pretending it already has a specific canonical model for wing foiling.

## Semantic Compiler Lab

The first lab is deliberately deterministic. A fixture reasoner supplies candidate meanings so the architecture beneath model recognition can be regression-tested independently of model variability.

The lab exercises cases including:

- occurred vs possible vs negated;
- third-party subject;
- supported strength Training vs understood-but-unsupported running;
- mixed plan + non-occurrence + state + substitute activity;
- unresolved entity references;
- personal-pattern context requests;
- approximate quantities;
- corrections;
- ambiguous colloquial language;
- relative time/quantity language;
- multi-domain utterances;
- unknown leaf concepts;
- compiler-to-existing-Semantic-Admission lowering;
- invalid graph detection.

This is **not yet a claim that an LLM can solve the language problem**. It proves the intermediate grammar and capacity boundary that a live reasoner must satisfy.

## Failure classes

Semantic evaluation should distinguish:

```text
LOSS
available meaning was missed

DISTORTION
meaning was changed incorrectly

FABRICATION
unsupported meaning or precision was created
```

For Wayfinder, fabrication is the highest-severity semantic failure.

## What comes next

1. Expand the lab toward ~30 deep semantic scenarios rather than hundreds of shallow strings.
2. Add a provider-neutral live `SemanticReasoner` adapter.
3. Add bounded Context Assembler contracts and deterministic entity/time resolvers.
4. Evaluate live model output against hard graph invariants and semantic scenarios.
5. Add Admission Planner support for multiple independent claims in one utterance.
6. Only after the semantic gate is stable, wire it into Navigator and then resume new canonical domains.

## Durable laws

> The player never has to speak the ontology.

> The model proposes meaning; Wayfinder resolves and governs meaning.

> Ambiguity is preserved until resolving it is worthwhile.

> Canonical reality stores the smallest defensible truth.

> Navigator understands as broadly as possible; Wayfinder persists only as specifically as proven capacity allows.

> Domains teach the compiler what reality they can own; Navigator does not receive a separate hard-coded conversation flow for every domain.
