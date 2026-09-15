# ADR-005: Projections are not truth

**Status:** Accepted  
**Date:** 2026-09-14  
**Supersedes:** none  
**Superseded by:** none

## Context

Wayfinder will compute useful representations such as Character, Momentum, Bearing, mastery, trends, and current state. These models will evolve over time.

## Decision

Derived state is a projection over deeper records. It may be cached for performance, but it is not the canonical source of lived history.

## Why

If a scoring or interpretation rule changes, Wayfinder should be able to rebuild the projection without rewriting or losing what actually happened.

## Consequences

- projections require known inputs and versioned derivation rules
- cache loss must not destroy factual history
- UI should avoid presenting projections as infallible facts
- changing Character rules should not rewrite historical events

## Validation plan

Delete/rebuild representative projection data and confirm the same canonical history remains intact and explainable.

## Revisit triggers

None expected for the principle. Individual projections may choose to freeze historical snapshots when reproducibility requires preserving the rule version used at the time.