# ADR-043 — Live semantic reasoning is provider-neutral, context-bounded, and read-only before admission

**Status:** ACCEPTED  
**Date:** 2026-09-17

## Context

Wayfinder needs Navigator to understand imperfect, contextual human language without requiring the player to speak the system ontology. A live language model is useful for broad recognition, but allowing a model to decide truth, ownership, persistence, or Character growth would collapse the authority boundaries already established by Semantic Admission.

Natural expressions such as “same as yesterday,” “the usual breakfast,” or “Greg called again about that install” also cannot be interpreted reliably from the current utterance alone. Relevant player context must be retrieved selectively rather than dumping the full life record into a model prompt.

## Decision

1. The semantic model provider is behind a provider-neutral `SemanticModelProvider` interface.
2. A `LiveSemanticReasoner` converts structured model output into the existing transient `CandidateLifeGraph`; the model does not receive database write authority.
3. The first concrete provider adapter uses the OpenAI Responses API with strict structured output, but provider choice is not part of Wayfinder's semantic contract.
4. Context acquisition uses a bounded Context Assembler loop. The model may request focused context, Wayfinder resolves those requests through registered read providers, and the reasoner may receive at most a small fixed number of passes and context items.
5. The read-only semantic loop rejects any `SourceEnvelope` that authorizes canonical writes.
6. Live semantic evaluation stops at Candidate Life Graph + capacity/routing assessment. It does not call Semantic Admission or any typed domain command.
7. Context items retain refs so model-supported resolutions can expose lineage to canonical or derived context.
8. Missing context, unresolved meaning, and unsupported Wayfinder capacity remain valid outcomes; the model is never rewarded for fabricating specificity.
9. Deterministic compiler/runtime tests remain separate from live-model evaluation. A live-model failure can therefore be distinguished from a graph/routing architecture failure.

## Consequences

- Navigator can gain broad natural-language understanding without making the model the source of truth.
- Relevant context is retrieved selectively and under explicit budgets.
- The semantic layer stays replaceable across model providers.
- Live model changes can be evaluated against hard invariants before they are ever allowed near canonical persistence.
- Future entity, time, unit, alias, and domain resolvers can be inserted around the same contract without changing domain schemas.

## First proof

The first live evaluator uses non-authorizing conversational sources and checks difficult semantic cases including occurrence, negation, third-party subject, plan-vs-action, approximate spending, contextual repetition, multi-domain statements, colloquial ambiguity, and personal-pattern references.

The evaluator classifies semantic failures as `LOSS`, `DISTORTION`, or `FABRICATION`; fabrication is the highest-severity failure and fails the live evaluation process.
