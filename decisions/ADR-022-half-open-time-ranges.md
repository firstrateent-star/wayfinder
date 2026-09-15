# ADR-022 — Wayfinder time ranges are half-open

**Status:** ACCEPTED  
**Decision:** Known bounded time ranges use `[start, end)` semantics: start inclusive, end exclusive.

## Context

Coarse time such as a calendar day must normalize without overlap at adjacent boundaries. Closed intervals would double-count exact boundary instants and create inconsistent duration/query behavior.

## Decision

Whenever both boundaries are known, Wayfinder interprets a bounded range as `[start, end)`.

Examples:

- a local calendar day spans local midnight inclusive to the next local midnight exclusive;
- adjacent ranges meet but do not overlap;
- duration is computed as `end - start`;
- a coarse uncertainty window may still contain a separately known duration, so duration need not equal the full uncertainty-window width unless the bounds represent the actual exact session interval.

`OPEN` and `UNKNOWN` temporal boundaries remain separate concepts.

## Consequences

- range queries and normalization gain one shared boundary convention;
- DST-aware local-day conversion remains required;
- presentation must preserve coarse precision rather than imply an exact instant;
- object contracts and physical schema tests must enforce this convention consistently.