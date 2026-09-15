# ADR-015 — Provenance and Derivation Mode Are Orthogonal

**Status:** Accepted  
**Date:** 2026-09-14

## Context

The first multidimensional epistemic model still mixed source/channel concepts such as `REPORTED` with reasoning concepts such as `INFERRED`.

A person can report an inference. A sensor observation can arrive through an external connector. Origin and reasoning mode therefore cannot share one exclusive enum.

## Decision

Source/channel/origin belongs in Provenance.

Epistemic derivation mode describes how the current conclusion relates to supporting records:

- `DIRECT`
- `DERIVED`
- `INFERRED`

Completeness, dispute, and optional confidence remain separate dimensions.

## Consequences

- Epistemic state remains composable.
- Provenance can become richer without changing inference semantics.
- ADR-009 remains valid for multidimensional epistemic state; this ADR refines its derivation axis.
