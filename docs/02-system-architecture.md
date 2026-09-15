# Wayfinder System Architecture

**Version:** 0.2  
**Status:** CANDIDATE

Wayfinder is layered so that reality, intention, evidence, reasoning, and experience remain separable.

## Layers

1. **Identity / System Kernel**
   - person identity
   - permissions
   - source registry
   - universal `RecordRef`
   - entity-specific `EntityRef`
   - versioning and time conventions

2. **Reality Kernel**
   - shared contracts for entities, events, observations, factual states, relations, provenance, and references
   - no giant universal fact table

3. **Life Domains**
   - domain-owned persistence and validation
   - examples: Practice, Training, Finance, Relationships, Creative, Home, Inner Life

4. **Direction**
   - values, directions, outcomes, commitments, quests, plans, actions
   - graph relationships rather than forced hierarchy

5. **Evidence & Meaning**
   - evidence links
   - reflections
   - hypotheses
   - interpretations
   - multidimensional epistemic state and lineage

6. **Derivations / Projections**
   - metrics
   - signals
   - patterns
   - growth
   - momentum
   - bearing
   - mastery
   - character

7. **Intelligence**
   - context assembly
   - Flower runtime
   - reasoning
   - proposal generation
   - explanation and lineage

8. **Experience**
   - Helm
   - Journey
   - Character
   - Direction
   - Atlas
   - Navigator
   - future voice/agent/API surfaces

Beneath all layers is lived life. Wayfinder models it; Wayfinder does not replace it.

## Command side

Canonical state changes use:

`Interface → Command → Owning Domain → Validation → Transaction → Fact/Event → Derivations`

A command may originate from UI, Navigator, voice, import, API, or automation. The owning domain decides whether the write is valid.

## Query side

Read experiences use derived read models rather than coupling UI directly to many persistence tables.

Examples:

- current life state
- today's context
- journey projection
- character projection
- direction projection
- domain health

This keeps the frontend simple while allowing backend complexity to grow responsibly.

## Cross-domain composition

Domains interact through explicit seams:

- `RecordRef`
- `EntityRef` where continuing identity specifically matters
- domain events
- factual relations
- evidence links
- query/read contracts
- authorized commands

A domain must not directly mutate another domain's factual tables.

Shared references do not imply shared persistence ownership.

## Authority boundary

Reasoning is separate from authority.

`AI → proposal → authorization → command → domain validation → canonical write`

Low-risk pre-authorized commands may be introduced later, but must still pass through the same domain command contract.

## Projection rule

Anything reconstructable from deeper records is a projection, not truth. Projections may be cached for performance, but cache loss must not destroy lived history.

If an evidence-bearing source is corrected, superseded, or retracted, dependent projections must be re-evaluated.

## Correction rule

Wayfinder preserves correction/supersession lineage without requiring every domain to become a full event-sourced system.

The implementation mechanism may vary by domain so long as prior explanations remain recoverable and stale derived state can be detected.

## Expansion rule

A new domain should be addable without changing the core ontology or rewriting existing domains. If repeated core edits are required, treat that as architectural evidence and review the boundary rather than patching around it.

## Recursive validation rule

Architecture is not considered settled after one design pass. Ontology and contracts must re-enter the validation loop after material changes and after executable vertical slices expose real implementation evidence.
