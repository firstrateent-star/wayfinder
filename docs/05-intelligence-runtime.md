# Wayfinder Intelligence Runtime

**Version:** 0.1  
**Status:** EXPERIMENTAL

The intelligence layer helps Wayfinder understand, orient, propose, and explain. It does not own canonical truth.

## Navigator is an interface, not the intelligence architecture

Navigator is one conversational surface over Wayfinder intelligence. Future surfaces may include voice, notifications, agents, dashboards, APIs, or wearable interfaces.

## Core responsibilities

The intelligence layer may:

- assemble relevant context
- identify knowns and unknowns
- compare evidence
- detect contradictions
- form hypotheses
- explain derived state
- suggest questions
- propose direction changes
- propose actions or quests
- run Flower reasoning
- summarize lineage

It may not silently create factual reality.

## Authority model

Three distinct permissions:

### READ
Inspect authorized context.

### PROPOSE
Create a structured suggestion or command proposal.

### EXECUTE
Invoke an authorized command through the owning domain.

Consequential default flow:

`AI reasoning → proposal → user authorization → command → domain validation → canonical write`

## Flower runtime

Flower is not a button or a linear wizard. It is a recursive reasoning field that can operate over a person, domain, problem, goal, relationship, project, decision, or question.

Initial runtime vocabulary:

- CENTER — what is being navigated?
- BOUNDARY — what must not be assumed or crossed?
- CONTEXT — what surrounding state matters?
- UNKNOWN — what important information is missing?
- DIRECTION — what intended orientation matters?
- PRACTICE — what intervention/action could be tried?
- EVIDENCE — what supports current understanding and what evidence would change it?
- REFLECTION — what was learned from action/outcome?
- EXPANSION — what new questions, directions, or possibilities emerge?

These are simultaneous reasoning dimensions, not mandatory sequential steps.

## Recursive scope

Flower may nest across:

`Life → Season → Domain → Outcome → Quest → Action`

A child Flower must not silently override the authored direction of its parent scope.

## Context assembly

Context should be relevance-bounded rather than "load everything." A context bundle should identify:

- subject/reference
- requested question or task
- relevant facts
- relevant observations
- authored direction
- current projections if useful
- evidence lineage
- uncertainty/missing context
- permissions
- freshness/staleness

## Epistemic behavior

The runtime must preserve distinctions among:

- fact
- observation
- reflection
- hypothesis
- interpretation
- projection

AI language should express uncertainty consistent with the underlying evidence.

## Replaceable intelligence

Wayfinder's durable value should not depend on one model vendor or one reasoning implementation.

Durable layers:

- identity
- canonical facts
- authored direction
- provenance
- evidence links
- contracts
- historical decisions

Replaceable layers:

- model
- prompt strategy
- retrieval strategy
- ranking
- reasoning implementation
- UI conversation style

## Learning loop

The intended loop is:

`Context ↔ Direction ↔ Practice ↔ Evidence → Reflection → Expansion`

The system should learn from real outcomes rather than only from generated reasoning.

## Promotion criteria

The intelligence runtime remains experimental until we can demonstrate:

1. read-only questions never create writes
2. proposals are structurally separate from commands
3. canonical writes require domain validation
4. important conclusions expose evidence lineage
5. unknown information remains unknown
6. context can be bounded and explained
7. changing the model does not change historical truth