# ADR-026 — Result completeness is not epistemic coverage

**Status:** Accepted  
**Date:** 2026-09-15

## Context

The first live read test proved the query behavior was correct but exposed a semantic ambiguity. A result limit can make an API response incomplete relative to matching database rows, while Wayfinder's knowledge of the underlying lived phenomenon may independently be unknown or partial.

Using one `coverage.completeness` field for both questions risks turning transport/query truncation into an epistemic claim.

## Decision

Wayfinder read surfaces distinguish:

1. **result completeness** — whether the response contains all matching stored rows for the declared query scope;
2. **epistemic coverage** — how completely the available sources cover the underlying phenomenon in lived reality.

For Slice 1A:

- `result_coverage.completeness` may be `COMPLETE` or `PARTIAL`, with `RESULT_LIMIT` as a truncation reason;
- manually stored PracticeSession and EvidenceLink records do **not** prove complete capture of lived practice/evidence, so their `epistemic_coverage.completeness` is `UNKNOWN` unless a future source contract can justify something stronger;
- internal canonical reads may truthfully report complete coverage of a narrowly named stored phenomenon, such as `current_wayfinder_direction_records`, while explicitly refusing to generalize that to the person's entire lived intentions.

## Consequences

- An empty complete query result may truthfully mean “no matching Wayfinder records are stored.”
- It must not silently become “the lived event did not occur.”
- A truncated result can be query-PARTIAL while lived-reality coverage remains independently UNKNOWN.
- Future connectors/sensors may establish stronger bounded epistemic coverage without changing result pagination semantics.

## Evidence

Established by the two-pass live read test in:

- `lab/read-api-live-test-v0.1.md`
- `lab/read-api-live-test-v0.2-confirmation.md`
