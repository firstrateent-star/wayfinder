# ADR-013 — Absence Requires Bounded Coverage

**Status:** Accepted  
**Date:** 2026-09-14

## Context

The rule `unknown != zero` is not enforceable if Wayfinder treats an empty result set as proof that nothing happened.

Examples include no spending, no workout, no messages, or no medication events. A missing record may mean true absence, incomplete sync, disabled tracking, source failure, or unmodeled activity.

## Decision

A zero/none/absence conclusion requires either:

1. direct evidence of absence, or
2. sufficiently complete bounded coverage over the relevant source/domain/time scope.

Coverage is currently a contract/read concern rather than a new root ontology primitive.

## Consequences

- Query/read contracts must be able to expose completeness for a defined scope.
- Empty data under partial or unknown coverage must remain unknown rather than zero.
- Domain imports and connectors must report enough sync/coverage state to support truthful aggregates.
