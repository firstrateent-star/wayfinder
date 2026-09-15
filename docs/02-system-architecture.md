# Wayfinder System Architecture

**Version:** 0.1  
**Status:** CANDIDATE

Wayfinder is layered so that reality, intention, evidence, reasoning, and experience remain separable.

## Layers

1. **Identity / System Kernel**
   - person identity
   - permissions
   - source registry
   - stable IDs
   - versioning and time conventions

2. **Reality Kernel**
   - shared contracts for events, observations, state, artifacts, provenance, and references
   - no giant universal fact table

3. **Life Domains**
   - domain-owned persistence and validation
   - examples: Practice, Training, Finance, Relationships, Creative, Home, Inner Life

4. **Direction**
   - values, directions, outcomes, quests, plans, actions
   - graph relationships rather than forced hierarchy

5. **Evidence & Meaning**
   - evidence links
   - reflections
   - hypotheses
   - interpretations
   - certainty and lineage

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

- EntityRef
- domain events
- evidence links
- query/read contracts
- authorized commands

A domain must not directly mutate another domain's factual tables.

## Authority boundary

Reasoning is separate from authority.

`AI → proposal → authorization → command → domain validation → canonical write`

Low-risk pre-authorized commands may be introduced later, but must still pass through the same domain command contract.

## Projection rule

Anything reconstructable from deeper records is a projection, not truth. Projections may be cached for performance, but cache loss must not destroy lived history.

## Expansion rule

A new domain should be addable without changing the core ontology or rewriting existing domains. If repeated core edits are required, treat that as architectural evidence and review the boundary rather than patching around it.