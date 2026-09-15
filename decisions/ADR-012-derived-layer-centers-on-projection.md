# ADR-012 — The Derived Layer Centers on Projection

**Status:** Accepted  
**Date:** 2026-09-14

## Context

Early ontology versions listed Growth, Momentum, Bearing, Mastery, and Character as root Derived primitives. Stress testing showed this mixed foundational ontology with product-specific projections whose models are still evolving.

## Decision

The canonical Derived vocabulary is:

- Projection
- Metric
- Signal
- Pattern

Growth, Momentum, Bearing, Mastery, Character, Balance, and similar concepts are named projection families with independent maturity states rather than root primitives.

## Consequences

- The root ontology becomes smaller and more stable.
- RPG and coaching concepts can evolve without changing foundational ontology.
- Projection contracts must preserve source lineage and rule version so they remain reconstructable.
