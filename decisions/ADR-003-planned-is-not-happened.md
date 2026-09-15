# ADR-003: Planned is not happened

**Status:** Accepted  
**Date:** 2026-09-14  
**Supersedes:** none  
**Superseded by:** none

## Context

Wayfinder will eventually model calendars, plans, actions, quests, and real-world events. Conflating scheduled intent with completed reality would corrupt evidence, progression, Journey, and Character.

## Decision

Planned actions and scheduled events remain intentional records until explicit evidence establishes occurrence. Time passing does not convert intent into fact.

## Why

Intent and reality are different ontological categories. Preserving that distinction keeps the system honest and makes completion/correction auditable.

## Consequences

- `planned_for` and `occurred_at` remain distinct
- calendar entries are not accomplishments
- completed activity must come from user confirmation, trusted source, import, or other accepted domain evidence
- projections cannot assume completion merely because a due time passed

## Validation plan

Tests must show that overdue/scheduled records do not appear in factual Journey, evidence, or growth unless a domain accepts occurrence.

## Revisit triggers

A domain may support trusted automatic occurrence evidence, but that must be an explicit source/command path rather than passage-of-time inference.