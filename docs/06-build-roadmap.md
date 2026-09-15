# Wayfinder Build Roadmap

**Version:** 0.2  
**Status:** CANDIDATE — updated from live use

The roadmap prioritizes complete vertical slices and real evidence over feature count.

## Phase 0 — Foundation

**Status: stable enough / recursive**

Constitution, ontology, architecture, object contracts, domain protocol, validation loop, physical schema, ADR process, and recovery documentation exist and have survived multiple recursive passes.

Foundation is not considered eternally finished; later evidence may revise it.

## Phase 1 — Executable kernel

**Status: passed for Slice 1A**

Proven:

- owner identity;
- command envelope + idempotency;
- private module boundaries;
- Direction graph;
- exact Evidence links;
- versioned correction lineage;
- read/projection seam;
- result coverage vs epistemic coverage.

## Phase 2 — Practice vertical slice

**Status: live backbone proven**

Implemented:

- Practice identity;
- atomic PracticeSession capture;
- occurrence time vs record time;
- PracticeSession correction;
- exact Evidence to Action;
- current/stale evidence behavior;
- Practice catalog;
- browser capture flows.

Reflection remains intentionally unimplemented as a canonical slice.

## Phase 3 — First projections

**Status: active / mostly built**

Implemented:

- recent Practice;
- Action Fulfillment v0;
- Bearing v0;
- Helm v0.2;
- **Journey v0.1**.

Journey is the first temporal experience projection. It reconstructs selected history without a canonical Journey table and preserves `OCCURRED` vs `RECORDED` time semantics.

Current gate: browser-live Journey validation.

## Phase 4 — First product surfaces

**Status: active**

Live:

```text
/login
/helm
/journey
```

Helm answers “Where am I?”

Journey begins to answer “How did the record arrive here?”

The next product surface should be chosen from live evidence rather than roadmap inertia.

## Phase 5 — Meaning / Reflection seam

**Status: candidate, not authorized yet**

Journey v0.1 is intentionally pre-interpretive. Live use may show that the next missing layer is a canonical/user-authored Reflection seam.

Candidate capabilities:

- attach a user-authored Reflection to exact records or a declared time scope;
- keep Reflection distinct from Observation and Evidence;
- preserve authorship and provenance;
- allow later AI Interpretation to reference, but not overwrite, human meaning.

Do not build until Journey use demonstrates the need.

## Phase 6 — Character projection

**Status: deferred / experimental**

Character should initially be a projection over evidence-supported patterns, not a canonical XP ledger.

Questions to prove first:

- what change can Wayfinder actually support with evidence?
- what is interpretation vs durable reality?
- how do Fire/Earth/Water/Air represent without becoming fabricated truth?
- when is a skill/mastery construct justified?

## Phase 7 — Navigator read/propose loop

**Status: deferred until current product surfaces stabilize**

Future Navigator should:

- read approved projections/context;
- explain lineage;
- propose Actions/Quests/records;
- require explicit authorization before canonical mutation;
- use the same command API as the UI.

## Phase 8 — Architecture stress with asymmetric domains

Before broad expansion, add domains with different truth shapes, likely one of:

- Body / Training;
- Money / Finance;
- Relationships / People.

The goal is to test the domain protocol under asymmetry, not accumulate modules.

## Deferred until architecture earns them

- canonical Character/XP persistence;
- universal skill taxonomy;
- archetype engine;
- astrology engine;
- Atlas/world simulation;
- autonomous agents;
- inventory graph;
- broad health record modeling;
- complex scheduling engine;
- large connector ecosystem;
- a universal Journey event table.

## Build discipline

For every expansion:

1. define the smallest useful human question;
2. identify existing canonical records that can answer it;
3. avoid persistence if a reconstructable projection is sufficient;
4. preserve time/provenance/epistemic distinctions;
5. implement end-to-end;
6. stress invariants and complements;
7. observe real use;
8. promote, adapt, or reject assumptions.

The measure of progress is how much real life Wayfinder can model and explain correctly — not lines of code, number of screens, or amount of gamification.
