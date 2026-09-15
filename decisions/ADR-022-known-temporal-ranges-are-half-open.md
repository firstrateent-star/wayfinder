# ADR-022 — Known Temporal Ranges Are Half-Open

**Status:** Accepted  
**Date:** 2026-09-15

## Context

Wayfinder must represent exact intervals, coarse historical windows, day/month normalization, validity ranges, and query windows without double-counting shared boundaries. A closed interval convention makes adjacent ranges overlap at the boundary; inconsistent conventions make aggregation and filtering unreliable.

## Decision

Whenever both boundaries of a TemporalRange are known, Wayfinder uses **half-open interval semantics `[start, end)`**:

- start is inclusive;
- end is exclusive.

If a persisted bounded occurrence has both timestamps, `end > start` must hold. Point-like occurrence uses a single point rather than a fabricated zero-width range.

A coarse uncertainty window does not necessarily equal event duration. A known duration may be shorter than the uncertainty window when the bounds represent uncertainty rather than the actual exact event interval.

## Consequences

- adjacent day/month/year windows do not overlap at their shared boundary;
- overlap and aggregation semantics are consistent;
- DST/local-date normalization remains explicit through zone context;
- duration validation must be precision-aware rather than blindly equating range width with duration.

## Evidence

Discovered during repeated physical-schema stress testing, especially `lab/physical-schema-stress-test-v0.3.md` and applied in Object Contracts v0.9 / Physical Schema v0.5.
