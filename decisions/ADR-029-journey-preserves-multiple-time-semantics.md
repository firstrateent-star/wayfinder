# ADR-029 — Journey preserves multiple time semantics

**Status:** Accepted

## Context

Journey answers a human question that sounds simple: **How did I get here?**

Wayfinder already stores facts with different relationships to time:

- a PracticeSession has an occurrence time in lived reality;
- an intention is recorded at a time but is not thereby asserted to have happened;
- an EvidenceLink is recorded at a time as a relationship between exact records;
- a correction is recorded later even when the underlying lived occurrence happened earlier.

Flattening all of these into one undifferentiated event clock would make the interface visually simple while erasing an important truth distinction.

## Decision

Journey is a **derived temporal projection**, not a universal Event store.

Each Journey item must carry an explicit `time_basis` and `timeline_at`.

Initial rules:

- `PRACTICE_SESSION` → `time_basis=OCCURRED`, `timeline_at=occurred_from`;
- Direction creation/relationship → `time_basis=RECORDED`, `timeline_at=recorded_at`;
- Evidence creation → `time_basis=RECORDED`, `timeline_at=recorded_at`;
- PracticeSession correction → `time_basis=RECORDED`, `timeline_at=new_version.recorded_at`.

A shared visual timeline may sort these timestamps together for navigation, but the projection and UI must not imply that occurrence time and record time have identical semantics.

The projection must preserve lineage to the records that produced each item.

## Consequences

- Journey can be useful before Wayfinder has a universal lived-event ontology.
- A correction does not become a second lived PracticeSession.
- Intention creation is visible without being mislabeled as something that happened in reality.
- Exact Evidence history remains explainable after source correction.
- Future domains may add other explicit time bases rather than forcing all temporal meaning into `occurred_at` or `recorded_at`.

## Rejected alternatives

### Treat every Journey row as a canonical Event
Rejected because Direction, Evidence, and record correction are not all lived-reality events.

### Sort everything by record time
Rejected because that would move lived Practice activity away from when Wayfinder says it actually occurred.

### Sort everything by occurrence time
Rejected because intentions, evidence relationships, and corrections do not necessarily have a defensible lived occurrence time.

### Persist Journey items
Rejected for v0.1. Journey is reconstructable from canonical records, so persistence would create a second truth store without evidence that caching or durable snapshots are needed.
