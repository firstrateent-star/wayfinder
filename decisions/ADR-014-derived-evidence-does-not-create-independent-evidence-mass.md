# ADR-014 — Derived Evidence Does Not Create Independent Evidence Mass

**Status:** Accepted  
**Date:** 2026-09-14

## Context

One underlying event can generate many descendants: metrics, signals, summaries, patterns, and interpretations. If all descendants are counted independently, a single occurrence can appear to provide several independent pieces of evidence for Growth, Mastery, or another conclusion.

## Decision

Derived records preserve ancestry. A derived descendant does not become independent evidence merely because it is a separate record.

Evidence-consuming rules must be able to detect materially overlapping lineage when independence matters and must reject circular self-support.

## Consequences

- Projection and evidence contracts retain source lineage.
- Reasoning rules can use derived summaries without silently multiplying evidence.
- Later scoring systems must distinguish transformed evidence from genuinely independent evidence.
