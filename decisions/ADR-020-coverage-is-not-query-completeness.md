# ADR-020 — Epistemic Coverage Is Not Query Completeness

**Status:** Accepted

## Context

A database query can successfully return every stored record for a period while Wayfinder still lacks complete knowledge of what occurred in lived reality. Manual self-logging is the clearest example: zero stored PracticeSessions does not prove zero practice occurred.

Confusing operational query completeness with epistemic source coverage would reintroduce the exact unknown→zero error the ontology is designed to prevent.

## Decision

`Coverage` describes how completely the declared sources cover the target phenomenon/scope being inferred.

Operational query success/completeness belongs to read readiness/error handling, not epistemic Coverage.

Therefore Wayfinder may say:

- “No PracticeSessions are logged for this period.”

but may not infer solely from the database:

- “You did not practice this period.”

unless direct evidence or sufficiently complete source coverage supports that lived-reality claim.

## Consequences

Product copy, metrics, absence logic, and future connectors must preserve source scope.

Manual logging is usually `UNKNOWN` or `PARTIAL` coverage of lived reality unless explicitly established otherwise.