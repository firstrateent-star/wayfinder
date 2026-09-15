# ADR-031 — Time, Schedule, and Requirements Remain Distinct from Reality

**Status:** CANDIDATE-STABLE  
**Date:** 2026-09-15

## Context

Wayfinder is expanding toward calendar-aware guidance, recurring minimums such as macro targets and training frequency, daily/weekly review, and schedule-aware Navigator recommendations.

These concepts can easily collapse into one ambiguous planning model:

- a calendar entry can be mistaken for an occurred event;
- a goal can be mistaken for a recurring requirement;
- a recurring requirement can be mistaken for a fixed schedule;
- missing observations can be mistaken for failure;
- local-day requirements can be incorrectly evaluated as rolling 24-hour windows.

The existing architecture already requires `planned != happened` and preserves multiple temporal meanings such as occurred vs recorded time.

## Decision

### 1. Time is cross-cutting

Time is not a life-domain module. Shared temporal contracts must preserve distinct meanings including occurred, recorded, planned, scheduled, due, valid, recurring, bounded/windowed, local temporal scope, timezone, and precision/uncertainty.

### 2. Schedule owns planned temporal allocation

Schedule is distinct from Direction and from actual Reality.

A scheduled allocation may reference a Quest, Action, appointment, workout intention, or other subject, but it does not own that subject and does not prove the referenced activity occurred.

Example:

```text
Action: edit wedding film            -> Direction
Allocation: Tuesday 12:00-15:00      -> Schedule
Actual editing session               -> Practice/Activity
```

### 3. Requirement is distinct from Goal and Schedule

A requirement/standard expresses a bounded expectation such as:

- protein >= 150 g per local day;
- strength training >= 3 sessions per week;
- payment >= $500 by a deadline.

A requirement may support a Direction, and Schedule may allocate time toward satisfying it, but neither relationship changes the semantic identity of the records.

### 4. Requirements are domain-owned or domain-evaluated

Do not create a universal requirements truth store merely for convenience. Use a shared Requirement contract while allowing the domain that understands the metric to own/evaluate its semantics.

### 5. Requirement evaluation is coverage-aware

A recurring minimum must not report failure merely because observed data is incomplete.

Evaluation states should distinguish at least:

- `IN_PROGRESS`
- `SATISFIED`
- `AT_RISK`
- `CLOSED_BELOW_TARGET`
- `UNKNOWN`

A confident closed-below-target conclusion requires enough coverage for the relevant claim.

### 6. Recurring scopes are timezone-aware

“Per day” and “per week” are evaluated in declared local temporal scopes, not naive rolling durations, unless the requirement explicitly defines a rolling interval.

### 7. Reviews are projections by default

Daily/weekly/monthly reviews summarize canonical state, requirement evaluation, schedule, and evidence. They are reconstructable system projections unless the person authors a Reflection/Meaning record.

## Consequences

Benefits:

- preserves planned vs occurred truth;
- supports realistic calendar integration;
- avoids false macro/training failures from partial logging;
- allows recurring standards to apply across heterogeneous domains;
- lets Navigator reason about what should happen without rewriting what did happen;
- supports historical schedule/requirement reconstruction.

Costs:

- more explicit temporal contracts;
- schedule, requirements, and actual activity cannot be collapsed into one generic event table;
- guidance composition must reconcile several related but distinct records.

These costs are accepted because the distinctions protect the core truth model and prevent later redesign.
