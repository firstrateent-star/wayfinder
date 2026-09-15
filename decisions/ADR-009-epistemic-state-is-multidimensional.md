# ADR-009 — Epistemic State Is Multidimensional

**Status:** Accepted  
**Date:** 2026-09-14

## Context

Ontology v0.1 used one `Certainty` ladder containing `KNOWN`, `PARTIAL`, `UNKNOWN`, `INFERRED`, and `DISPUTED`.

Stress testing showed these values describe different dimensions. A record may be complete and inferred, partial and disputed, or directly observed but low-confidence. One enum cannot represent those combinations honestly.

## Decision

Replace monolithic `Certainty` with `EpistemicState` composed from orthogonal dimensions:

- completeness: `COMPLETE | PARTIAL | UNKNOWN`
- basis: `OBSERVED | REPORTED | DERIVED | INFERRED`
- dispute: `UNDISPUTED | DISPUTED`
- optional confidence where useful

Detailed provenance remains the stronger source of explanation.

## Consequences

- Unknown remains a first-class state without conflating it with disagreement or inference.
- Wayfinder can preserve conflicting records without forcing false resolution.
- AI/system confidence can never substitute for provenance or truth.
- Exact enums may evolve before implementation, but the dimensional separation is canonical.
