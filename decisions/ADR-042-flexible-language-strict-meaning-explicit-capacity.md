# ADR-042 — Flexible language at the edge; strict meaning and explicit capacity at the core

**Status:** ACCEPTED  
**Date:** 2026-09-17

## Context

Navigator is intended to be the primary interface between lived human experience and Wayfinder. Players will use incomplete, colloquial, contextual, approximate, corrective and multi-domain language. Requiring them to speak domain vocabulary would defeat the product. Conversely, allowing a language model to write directly into player reality would make confidence masquerade as authority and would create fabricated precision.

Wayfinder also needs to understand concepts before every possible canonical domain exists. For example, it can understand that a player reported running, an expense, or stress before canonical Running, Finance, or Emotional State persistence is live.

## Decision

1. Introduce a transient `CandidateLifeGraph` between language recognition and domain admission.
2. Candidate meaning explicitly carries subject, reality mode, field-level resolution/precision/certainty, temporal meaning, relationships, unresolved references, and alternate interpretations.
3. Introduce a machine-readable Wayfinder Capacity Registry with facets `RECOGNIZE`, `RESOLVE`, `REPRESENT`, `PERSIST`, `ANALYZE`, `PROJECT`, `GUIDE`, and `SURFACE`.
4. Understanding and persistence are separate capabilities. A concept may be recognized/represented while having no canonical persistence owner.
5. Navigator may reason broadly over transient meaning but canonical writes still require exactly one legitimate owning domain and that domain's Semantic Admission contract.
6. The language model proposes semantic hypotheses. Deterministic/runtime components remain responsible for known-concept lookup, entity/time resolution where possible, ownership, authority and canonical commands.
7. Unknown specific concepts may fall back to defensible parent concepts without inventing unsupported specificity.
8. The semantic compiler must preserve negation, hypothetical/planned/question modes, third-party subjects, correction semantics and unresolved ambiguity.
9. The compiler may request bounded context but should not require the player's entire life history for each turn.
10. New domains expand Navigator through declared capability rather than bespoke conversation code.

## Consequences

- Natural language can remain flexible while canonical state stays strict.
- Navigator can say, in effect, "I understand this, but Wayfinder cannot safely store it yet."
- Semantic capacity gaps become evidence for which future domains have actually been earned by reality pressure.
- The current narrow Training recognizer remains a valid proving slice but is no longer the target architecture for general understanding.
- Live model evaluation can be swapped or improved without changing canonical domain truth.

## First proof

`semantic-compiler-v0.1.test.ts` uses a deterministic fixture reasoner to prove the graph grammar, capacity boundary, compiler routing and lowering seam into the existing Semantic Admission graph before any model or production write is introduced.
