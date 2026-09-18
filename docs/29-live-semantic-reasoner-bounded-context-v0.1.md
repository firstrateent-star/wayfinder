# Live Semantic Reasoner + Bounded Context Loop v0.1

**Status:** LAB / read-only intelligence proving slice  
**Date:** 2026-09-17

## Purpose

This slice moves the Semantic Compiler from deterministic fixture meanings toward live model interpretation while preserving the central Wayfinder boundary:

> **The model proposes meaning. Wayfinder resolves, governs, and eventually persists meaning.**

No canonical writes occur in this slice.

## Runtime

```text
player expression
  -> SourceEnvelope(authorizesCanonicalWrite=false)
  -> LiveSemanticReasoner
  -> CandidateLifeGraph + focused ContextRequests
  -> bounded Context Assembler
  -> registered read providers
  -> second semantic pass when useful
  -> CandidateLifeGraph
  -> Wayfinder Capacity assessment
  -> ROUTE_TO_DOMAIN | CLARIFY | SESSION_ONLY | DROP
  -> STOP
```

Even if a final routing result says `ROUTE_TO_DOMAIN`, this lab does not invoke Semantic Admission and cannot execute a domain command.

## Provider neutrality

`SemanticModelProvider` owns only structured model generation. `LiveSemanticReasoner` knows the semantic contract but not provider-specific HTTP details.

The first adapter is `OpenAIResponsesProvider`, which uses strict structured output from the Responses API. The default lab model is configurable with `WAYFINDER_SEMANTIC_MODEL`; the live GitHub evaluator currently defaults to `gpt-5.6-luna` for low-cost repeated semantic testing.

A future provider can implement the same interface without changing the Candidate Life Graph, Context Assembler, capacity model, or domain admission contracts.

## Bounded Context Assembler

Default budgets:

```text
reasoner passes        2
context requests/pass  3
context items total    24
items/request           8
personal aliases       12
```

The model can ask for context; it cannot search indefinitely. Repeated requests are deduplicated, context items are deduplicated by ref, and broad model requests are clamped to system limits.

> Navigator should know a lot about the player without showing the model everything about the player.

## Live evaluation

The real-model lab covers occurrence, negation, third-party subject, plan-vs-action, approximate spending, contextual repetition, multi-domain statements, colloquial ambiguity, and personal-pattern references.

The evaluator reports `LOSS`, `DISTORTION`, and `FABRICATION`. Any fabrication exits non-zero.

Configuration:

```text
OPENAI_API_KEY
WAYFINDER_SEMANTIC_MODEL (optional)
```

If no model credential is configured, the live evaluator reports `SKIPPED` rather than pretending a real-model run occurred. Deterministic compiler and runtime tests continue in normal Intelligence CI.

## What remains

- deterministic entity resolver;
- relative-time normalization;
- unit normalization;
- personal alias evidence + promotion rules;
- contradiction/conflict detection;
- semantic episode graph across Navigator turns;
- Admission Planner for multi-claim utterances;
- larger adversarial corpus;
- model complexity routing.

Only after these semantics are stable should live reasoning be wired into canonical admission.
