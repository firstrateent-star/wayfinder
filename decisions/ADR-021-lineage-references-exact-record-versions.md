# ADR-021 — Durable Lineage References Exact Record Versions

**Status:** Accepted

## Context

A stable RecordRef identifies a logical record, but corrections can change that record over time. If an old projection or interpretation only remembers the stable RecordRef, resolving it later could show a newer version that was not actually used by the original reasoning.

## Decision

Use two reference levels:

- `RecordRef` for stable logical identity;
- `RecordVersionRef` for exact historical representation.

Durable evidence, provenance lineage, and evidence-bearing derivations reference exact versions.

For large derivations, an immutable versioned lineage manifest may represent the exact input set instead of embedding every version ref inline.

Historical resolution may explicitly return redacted/deleted tombstones under privacy policy; exact lineage does not require indefinite content retention.

## Consequences

Old reasoning remains explainable after correction.

Evidence does not silently migrate to corrected source/target versions; re-evaluation is explicit.

Full event sourcing is still not required.