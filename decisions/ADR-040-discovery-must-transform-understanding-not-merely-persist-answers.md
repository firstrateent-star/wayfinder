# ADR-040 — Discovery must transform understanding, not merely persist answers

**Status:** ACCEPTED

## Context

The first live Discovery slice correctly routed a player answer into the owning Schedule domain, but real use exposed a product/architecture failure: after multiple answers, Helm mostly displayed the saved record and a count. Discovery could therefore become a polite form system even while preserving excellent canonical boundaries.

Persistence is necessary, but persistence alone is not intelligence.

## Decision

A successful Discovery step must change the system's useful model of the player's world, not merely add a record.

The required loop is:

```text
information need
   ↓
player/source answer
   ↓
authorized owning-domain command
   ↓
canonical state changes
   ↓
recompute affected projections
   ↓
derive supported relationships / constraints / uncertainty
   ↓
re-evaluate information needs
   ↓
choose the next materially different high-value question or stay quiet
```

Discovery therefore has two gates:

1. **Write gate** — does this answer have a legitimate canonical owner and authorized command?
2. **Understanding gate** — after the write, what new supported structure can Wayfinder derive or what uncertainty can it retire?

If the second answer is “nothing,” the discovery step is incomplete as a product capability even if the database write succeeded.

## Consequences

### 1. Repetition requires justification

The system should not repeatedly ask the same category merely because epistemic coverage remains incomplete.

A repeated question is justified only when the unresolved ambiguity/conflict/coverage materially blocks a current decision and the expected information gain remains high.

Otherwise the planner should move to another Information Need or stay quiet.

### 2. Deterministic synthesis counts as intelligence

An LLM is not required for every useful transformation.

Examples from Schedule:

```text
recorded commitments
 -> ordering
 -> occupied hard-planned duration
 -> overlap detection
 -> between-commitment gaps
 -> bounded candidate planning windows
```

These are deterministic derivations from canonical records and must remain labeled as such.

### 3. Derived gaps are not free time

A space between known Schedule records is a **recorded gap**, not proof of availability.

Wayfinder may use it as a candidate planning window while explicitly preserving incomplete schedule coverage.

### 4. Discovery should cross domains through projections, not ownership leakage

Example:

```text
Schedule constraints
+ explicit current Direction
 -> Position insight:
    a recorded between-commitment window could potentially support that Direction
```

Schedule still owns planned time. Direction still owns the explicit current Direction. Position composes them without creating a new canonical cross-domain fact.

### 5. Questions should become progressively more consequential

A healthy sequence can look like:

```text
What is fixed tomorrow?
   ↓
record Schedule constraint
   ↓
What are you actively trying to move forward?
   ↓
record Direction
   ↓
combine Direction + Schedule
   ↓
propose a useful planning move / seek the next missing constraint
```

The exact sequence remains relevance-driven; this is not a mandatory onboarding script.

## Non-goals

This ADR does not authorize:

- LLM inference as canonical truth;
- a universal player-facts table;
- assuming unrecorded time is free;
- turning every answer into a permanent Home widget;
- asking endlessly to maximize profile completeness;
- cross-domain writes without the owning domain command boundary.

## Implementation checkpoint

`initial_position_v0.2` is the first proving implementation:

- returns all recorded planned allocations in scope;
- derives merged hard-planned duration;
- detects overlaps;
- derives the largest between-commitment recorded gap;
- reads the current explicit Direction;
- can compose Schedule + Direction into a `FOCUS_WINDOW` Position insight;
- suppresses repeated Schedule discovery after enough recorded constraints and promotes the current-Direction Information Need;
- keeps normal Helm non-interruptive.

This is still a narrow deterministic proving slice. General AI Discovery remains later, but it must obey this same recursive understanding law.
