# Wayfinder Build Roadmap

**Version:** 0.1  
**Status:** CANDIDATE

The roadmap prioritizes a working vertical slice early, while preserving room for expansion.

## Phase 0 — Foundation

Status: in progress

Deliverables:

- Constitution
- ontology
- system architecture
- object contracts
- domain protocol
- intelligence runtime draft
- architectural invariants
- ADRs

Exit condition: foundational language is clear enough to implement one domain without guessing core semantics.

## Phase 1 — Executable kernel

Build only what the first vertical slice requires:

- identity/profile
- source/provenance model
- EntityRef
- command envelope
- direction graph
- evidence links
- reflection/interpretation storage
- domain registration seam

Do not pre-build every future subsystem.

## Phase 2 — Practice domain vertical slice

Implement one small real domain:

- create a Practice identity
- record a Practice Session
- preserve occurrence time vs record time
- optionally record a measurement
- attach a reflection
- connect session evidence to Direction

Exit condition: real lived activity can move through the architecture without violating invariants.

## Phase 3 — First read projections

Add minimal reconstructable projections:

- recent activity
- simple practice signal
- basic Journey timeline
- basic Bearing toward a selected Direction

No elaborate Character system yet.

## Phase 4 — First product surface

Build a minimal Helm:

- current Direction
- current Quest
- today's intended Actions
- recent evidence
- one or two derived signals
- Navigator entry point

Wayfinder should now be genuinely usable, even if narrow.

## Phase 5 — Navigator read/propose loop

Support:

- ask about current state
- ask why a projection exists
- propose an Action/Quest
- propose logging a Practice Session
- explicit authorization before canonical write

Prove read/propose/execute separation.

## Phase 6 — Architecture stress test

Before adding many domains, deliberately test:

- missing data
- conflicting observations
- stale context
- corrections
- duplicate commands
- domain outage
- projection rebuild
- changed derivation rule
- AI model replacement
- one Action supporting multiple Directions

Use failures as architectural evidence.

## Phase 7 — Second and third domains

Choose domains with different truth shapes, likely:

- Training or Body
- Money/Finance or Relationships

The goal is not feature count. The goal is proving the domain protocol under asymmetry.

## Deferred until architecture earns them

- advanced Character trees
- archetype engine
- astrology engine
- Atlas/world simulation
- autonomous agents
- universal skill taxonomy
- inventory graph
- broad health record modeling
- complex scheduling engine
- large connector ecosystem

## Build discipline

For every phase:

1. define the smallest useful outcome
2. identify which canonical concepts it exercises
3. implement end-to-end
4. test invariants
5. observe real use
6. promote, adapt, or reject assumptions

The measure of progress is not lines of code or number of screens. It is how much real life Wayfinder can model correctly, explainably, and usefully.