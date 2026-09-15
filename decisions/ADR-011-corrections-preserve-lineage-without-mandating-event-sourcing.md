# ADR-011 — Corrections Preserve Lineage Without Mandating Event Sourcing

**Status:** Accepted  
**Date:** 2026-09-14

## Context

Wayfinder must support mistakes, corrected imports, disputed observations, revised interpretations, and retracted information. At the same time, forcing every domain into full event sourcing would add major complexity before the first working slice.

## Decision

Corrections may change which record is considered current, but they must preserve enough revision/supersession lineage to explain prior evidence and derived conclusions.

Wayfinder does **not** require every domain to be an append-only event store.

Implementation may use revisions, superseding records, audit tables, or another domain-appropriate mechanism, provided canonical invariants remain true.

## Consequences

- Early domains can remain simple.
- Historical explanation remains possible.
- Evidence and projections depending on corrected/retracted records must be re-evaluated.
- Privacy/deletion requirements may override retention only through explicit policy rather than accidental loss.
