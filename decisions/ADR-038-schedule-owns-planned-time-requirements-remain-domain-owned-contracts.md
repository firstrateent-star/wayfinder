# ADR-038 — Schedule owns planned time; Requirements remain domain-owned contracts

**Status:** ACCEPTED

## Context

Wayfinder now needs enough temporal structure for Navigator to reason about what is planned, what is due, and which recurring standards remain relevant without corrupting lived reality.

Two tempting shortcuts are architecturally unsafe:

1. treating calendar/schedule entries as evidence that something happened; and
2. creating one universal `requirements` table that owns protein, training frequency, debt payments, creative practice, and every future standard.

Those concepts have different truth semantics.

## Decision

### Schedule is a canonical module for planned temporal allocation

`wf_schedule` owns only the statement that the player/system currently plans or reserves time.

Schedule v0.1 supports:

```text
HARD
SOFT
WINDOWED
FLOATING
```

A Schedule allocation may reference an object owned by another module, but that reference does not transfer ownership.

Examples:

```text
Direction Action: Finish wedding edit
Schedule: Tuesday 14:00-16:00 reserved for that Action
Reality: editing session that actually occurred
```

These are three distinct claims.

A Schedule record MUST NOT be used as occurrence evidence merely because its time window has passed.

### Requirements are a shared evaluation contract, not a universal canonical owner

The owning domain defines the metric and determines whether a Requirement is meaningful.

Examples:

```text
Nutrition owns: protein grams
Training owns: strength-session exposure
Finance owns: minimum payment obligation
```

The shared Requirement runtime evaluates a supplied domain-owned metric against a bounded temporal rule such as:

```text
AT_LEAST
AT_MOST
BETWEEN
EXACT
```

No `wf_requirements` table is created in v0.1.

### Requirement evaluation is coverage-aware

Incomplete observations do not establish absence.

For a daily protein minimum:

```text
110 / 150g while day open                 -> IN_PROGRESS
155 / 150g with partial coverage          -> SATISFIED for monotonic minimum
110 / 150g after close, partial coverage  -> UNKNOWN
110 / 150g after close, complete coverage -> CLOSED_BELOW_TARGET
```

A shared evaluator may establish logically monotonic outcomes early, but it must not manufacture completeness.

## Consequences

Positive:

- calendar plans cannot silently become lived history;
- Navigator can reason about movable vs fixed time without polluting Reality;
- macros, strength frequency, finance, and other recurring standards reuse one temporal grammar;
- domain-specific semantics remain bounded and maintainable;
- unknown/partial coverage remains visible;
- future Requirement algorithms can evolve without rewriting the player's canonical history.

Costs:

- a Requirement cannot be evaluated until a domain supplies the metric/observation and coverage;
- cross-domain guidance requires composition rather than one convenient global table;
- Schedule and Reality must later be reconciled explicitly if the product wants to compare planned vs actual.

## Follow-up

The next proving slice should introduce real Training and Nutrition observations sufficient to evaluate at least:

```text
strength sessions >= N per local week
protein >= target grams per local day
```

Only after those signals are grounded should Position/Navigator surface temporal guidance such as “one strength session remains this week.”
