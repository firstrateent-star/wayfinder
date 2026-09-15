# ADR-024 — Wayfinder is colocated in the Vlourish Supabase project

**Status:** ACCEPTED  
**Decision:** Wayfinder uses the existing `vlourish` Supabase project as its physical Postgres host while remaining isolated in dedicated top-level `wf_*` schemas.

## Context

A separate Supabase project is not required to preserve Wayfinder's architectural boundaries. The user prefers Wayfinder to live within the existing Vlourish project as a separate top-level system.

Postgres does not provide nested databases inside a Supabase project, so the appropriate isolation boundary is dedicated schemas plus privileges/contracts.

## Decision

Wayfinder may share the physical Supabase project with Vlourish, provided:

- all Wayfinder canonical persistence lives under `wf_*` schemas;
- Wayfinder does not depend on `vl_*` payload tables for its canonical truth;
- `vl_*` modules do not directly mutate `wf_*` canonical tables;
- cross-system integration, if introduced later, uses explicit contracts rather than hidden joins/writes;
- normal frontend roles receive no direct schema/table mutation privileges;
- migration names and documentation clearly identify Wayfinder changes.

Initial top-level schemas are:

- `wf_system`
- `wf_direction`
- `wf_practice`
- `wf_evidence`

## Consequences

This reduces project sprawl and cost while preserving logical independence. A future move to a separate database/project remains possible because shared physical hosting is not allowed to become shared canonical ownership.

The Vlourish project is infrastructure hosting for Wayfinder, not Wayfinder's ontology or source of truth.