# ADR-004: Direction is a graph

**Status:** Accepted  
**Date:** 2026-09-14  
**Supersedes:** none  
**Superseded by:** none

## Context

Human intention does not form a clean tree. One Action may support several Outcomes, a Quest may serve multiple Directions, and maintenance activity may be valid without belonging to a goal hierarchy.

## Decision

Wayfinder represents Direction as typed nodes connected by explicit edges rather than a mandatory parent-child hierarchy.

Initial node kinds:

- value
- direction
- outcome
- quest
- plan
- action

Initial edge kinds:

- SUPPORTS
- PART_OF
- DEPENDS_ON
- BLOCKS
- CONTRADICTS
- SUPERSEDES
- RELATES_TO

## Why

A graph preserves many-to-many meaning without forcing the user to invent false hierarchies.

## Consequences

- Direction queries require graph traversal
- UI may still show simplified trees or paths as projections
- an Action can support multiple authored intentions
- not every Action requires a goal ancestor

## Validation plan

The first vertical slice must support one Action or factual event bearing on more than one Direction node without duplicate canonical records.

## Revisit triggers

Review edge vocabulary if repeated real use exposes ambiguous or redundant relations.