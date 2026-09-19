# Navigator Canonical Context v0.1

**Status:** IMPLEMENTED / DETERMINISTIC GATE PASSED  
**Date:** 2026-09-19

## Purpose

Navigator v0.2 can already carry semantic meaning across turns, but semantic continuity alone is not enough for Wayfinder.

The next requirement is grounded access to canonical player state without turning the model into an unrestricted life-database browser.

Canonical Context v0.1 gives the Semantic Episode runtime a bounded, owner-scoped read adapter over existing Wayfinder projections.

> **The model asks for a kind of context. Wayfinder decides what canonical projection may satisfy it.**

## Supported context kinds

```text
KNOWN_ENTITIES
  -> canonical Person identity only in v0.1

PERSONAL_ALIASES
  -> canonical Person display-name alias

ACTIVE_DIRECTION
  -> current ACTIVE Direction nodes only

SCHEDULE
  -> current PLANNED Schedule allocations
  -> explicitly marked planned_not_occurred
  -> never exposed as occurred evidence

RECENT_EVENTS
  -> recent Training sessions
  -> recent Practice sessions
  -> semantic concept filtering required

DOMAIN_READ
  -> requires explicit semantic concepts
  -> broad domain dumping is disabled

LIFE_GRAPH
  -> bounded to Person + active Direction in v0.1
  -> does not widen silently into Schedule, Training, or Practice
```

## Authority path

```text
Semantic Reasoner
    |
    | ContextRequest
    v
SemanticContextProviderRegistry
    |
    v
NavigatorCanonicalContextProvider
    |
    | authenticated player JWT
    v
existing public owner-scoped read RPC
    |
    v
private canonical Wayfinder schema
    |
    v
compact typed SemanticContextItem
    |
    v
second semantic reasoning pass
```

The provider creates no new canonical storage.

## Context is selective

Canonical state is not injected into every prompt.

The semantic loop first produces or infers a typed context request. Only then can a provider resolve that request.

Examples:

```text
"same as yesterday"
 -> deterministic RECENT_EVENTS request
 -> semantic concept filter
 -> recent matching canonical event(s)
 -> second semantic pass

"what's on my schedule?"
 -> SCHEDULE request
 -> current planned allocations only

"what am I working toward?"
 -> ACTIVE_DIRECTION request
 -> active Direction only
```

This protects both token budget and epistemic boundaries.

## Repeat-language proof

The deterministic context-needs layer already recognizes:

```text
again
same as
same thing
yesterday
last time
like before
as before
```

The new integration regression proves:

```text
"I did basically the same thing as yesterday."
  ↓
RECENT_EVENTS(ACTIVITY)
  ↓
canonical Practice read
  ↓
Running practice event
  ↓
second reasoner pass
  ↓
RUNNING
  ↓
resolvedRef = exact canonical Practice session version
```

No model-only memory is required for this retrieval.

## Safety invariants

```text
planned != occurred
paused direction != active direction
cancelled schedule != current plan
broad domain read != allowed
context read != write authorization
context item != new canonical fact
model request != unrestricted database access
```

The provider uses the player's existing authenticated RPC seam and preserves canonical version refs in semantic provenance.

## Deterministic gate

```text
lab/navigator-canonical-context-v0.1.test.ts
```

The gate covers:

- paused Direction exclusion;
- cancelled Schedule exclusion;
- Schedule never exposing `occurredAt`;
- RUNNING retrieval selecting matching Practice reality rather than strength Training;
- strength Training preserving recorded load/reps without fabrication;
- broad `DOMAIN_READ` failing closed;
- `LIFE_GRAPH` remaining bounded;
- repeat-language context retrieval causing a second semantic pass with the exact canonical Practice ref.

## Next frontier

Canonical reads give Navigator grounded memory-like access to Wayfinder reality, but the write side is still domain-specific.

The next architectural frontier is the **Admission Planner**:

```text
Candidate Life Graph
  -> split into independently governed claims
  -> identify canonical owner for each claim
  -> preserve unowned meaning as transient
  -> request clarification only where materially blocking
  -> create 0..N domain admission proposals
  -> require explicit authorization where persistence is possible
  -> execute owning-domain commands
  -> trigger downstream recomputation
```

That is the seam that lets one natural utterance affect multiple Wayfinder domains without creating a universal facts table or giving the model direct write authority.
