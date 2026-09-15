# ADR-001: Reality is domain-owned

**Status:** Accepted  
**Date:** 2026-09-14  
**Supersedes:** none  
**Superseded by:** none

## Context

Wayfinder must model many kinds of lived reality. A universal persistence schema would simplify cross-domain storage at first, but would erase important semantic differences among training, finance, relationships, creative work, health, and other domains.

## Decision

Each domain owns its canonical factual persistence and validation rules. The Wayfinder core provides shared contracts, provenance, references, evidence, direction, and composition seams.

## Why

Different domains have different truth models. Forcing all of them into one generic fact/entity table would trade short-term schema uniformity for long-term ambiguity and weak validation.

## Alternatives considered

- one universal `entities` table
- one universal `facts` table
- broad EAV/knowledge-graph persistence for all canonical state

## Consequences

- domains may use different schemas
- cross-domain composition requires explicit references/contracts
- domain boundaries remain meaningful
- some duplication of structural patterns is acceptable when semantics differ

## Validation plan

The Practice pilot and at least two asymmetric future domains must integrate without modifying existing domain persistence.

## Revisit triggers

Reconsider if repeated cross-domain needs reveal a genuinely shared primitive that cannot be expressed cleanly through current contracts.