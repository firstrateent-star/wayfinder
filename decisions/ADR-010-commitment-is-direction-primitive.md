# ADR-010 — Commitment Is a Direction Primitive

**Status:** Accepted  
**Date:** 2026-09-14

## Context

A life-navigation system must represent more than desired outcomes. People navigate promises, appointments, contractual deadlines, bills, and other accepted obligations that may require action but are not themselves goals.

Treating all of these as Outcomes would collapse desire and obligation. Treating them only as domain facts would prevent Direction from reasoning coherently about them.

## Decision

Add `Commitment` as a canonical Direction primitive.

A Commitment represents an authored, accepted, or otherwise recognized obligation or promise relevant to future action. Externally imposed legal or financial obligations may remain domain-owned factual States while exposing a Commitment when Wayfinder needs to navigate them.

## Consequences

- Direction can reason about both chosen aspirations and accepted obligations.
- Actions may support Commitments as well as Outcomes and Directions.
- Commitment completion does not imply personal growth unless qualifying evidence supports it.
- Future scheduling may reference Commitments without equating schedule with occurrence.
