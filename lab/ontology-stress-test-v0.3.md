# Ontology Stress Test — v0.3

**Date:** 2026-09-14  
**Purpose:** Third full recursive pass after promoting v0.3. This pass focuses on boundary collisions, reference history, and implementation economy rather than searching for features.

---

## Pass 1 — Category boundary collisions

Tested ambiguous cases where two primitives could both appear plausible.

### Employment
- person/business relationship: Relation
- employment status: State
- shift worked: Event
- career goal: Direction/Outcome

No collision requires a new primitive. A domain chooses the canonical representation it owns and avoids unnecessary duplication.

### Creative project
- project: Entity
- project active/paused: State
- editing session: Event
- exported film: Entity
- finish film: Outcome/Commitment depending on context

Fits.

### Relationship experience
- person-to-person tie: Relation
- conversation: Event
- “I felt dismissed”: Observation or Reflection depending on user intent
- “they are avoiding me”: Hypothesis/Interpretation

Fits without treating subjective meaning as fact.

### Finance
- account: Entity
- bank balance: Observation
- posted transaction: domain factual Event/record
- bill due: factual obligation State + optional Commitment for navigation
- net worth: Metric/Projection

Fits.

### Health
- person: Entity
- measurement: Observation
- medication intake: Event
- ongoing condition/status: State
- clinician statement: sourced factual/observational domain record
- AI causal theory: Hypothesis

Fits.

### World/context
- place: Entity
- weather/tide reading: Observation
- vessel at place: State/Relation
- forecast: sourced prediction/Interpretation, never current factual State merely because it is likely

Fits.

**Result:** no root primitive change.

---

## Pass 2 — Direction vs Evidence graph boundary

### Failure found in contracts, not ontology

`DirectionEdge` currently accepts generic `RecordRef` endpoints. That permits a Reality Event to connect directly to an Outcome with `SUPPORTS`, which would blur Direction structure with Evidence.

### Resolution

Direction edges should connect Direction nodes only.

Reality/Observation/Projection -> Direction support belongs in `EvidenceLink` (or another explicit cross-layer relationship), not in the Direction graph.

Introduce a conceptual `DirectionNodeRef` or equivalent type constraint in contracts.

**Ontology remains unchanged.**

---

## Pass 3 — Historical reference integrity

### Pressure
A derived conclusion references Observation A. Later Observation A is corrected.

If `RecordRef` resolves only to the newest mutable version, old explanations become impossible even though correction lineage nominally exists.

### Required invariant

> Any RecordRef used in evidence/provenance lineage must remain resolvable to the historical record/version that the derivation actually consumed.

Implementation may satisfy this using immutable corrected records, version-addressable revisions, audit storage, or another explicit mechanism. The ontology does not mandate event sourcing.

**No new primitive required.**

---

## Pass 4 — Negative/absence reasoning

Tested:

- no purchases this week
- no workout yesterday
- no sleep sample from tracker
- no messages from a person
- no medication intake recorded

The v0.3 bounded-coverage rule successfully distinguishes:

- known zero/absence
- partial evidence
- source unavailable
- tracking not enabled
- true unknown

No new primitive required.

---

## Pass 5 — Evidence ancestry

Tested one underlying Practice Session producing:

- duration metric
- practice streak signal
- weekly pattern
- character-facing growth projection

The ancestry rule correctly prevents four descendants from becoming four independent observations.

Remaining implementation requirement: lineage traversal/deduplication must be efficient enough for read-time derivations or supported by cached ancestry fingerprints later.

No ontology change required.

---

## Pass 6 — Direction lifecycle

Tested:

- changing a goal title
- materially changing an Outcome target
- abandoning a Quest
- replacing one Plan with another
- completing an Action
- breaking/releasing a Commitment

No new ontology primitive required, but exact lifecycle/status vocabularies should remain per-kind contracts rather than one premature universal enum.

Material semantic changes must eventually preserve enough revision history for old evidence/explanations to retain meaning.

---

## Pass 7 — Domain plug-in simulation

Pretended to add three structurally different domains without changing core ontology.

### Practice domain
Needs Entity, Event, Observation, Direction, Evidence, Projection.

### Finance domain
Needs Entity, Event/State, Relation, Observation, Commitment, Metric, coverage.

### Relationships domain
Needs Entity, Relation, Event, Observation, Reflection, Hypothesis/Interpretation.

All three fit without new root primitives or editing unrelated domain semantics.

---

## Pass 8 — Implementation economy

Asked whether v0.3 forces unnecessary first-build complexity.

### Not required for first slice
- global Relation table
- universal Entity table
- identity-resolution engine
- full event sourcing
- Skill system
- Character math
- Calendar engine
- AI proposal engine
- counterfactual Scenario storage

### Required early
- stable record references
- provenance
- Direction nodes/edges
- evidence links
- one domain-owned Event model
- correction semantics
- bounded coverage on reads that claim zero/absence
- one reconstructable Projection

The ontology remains small enough to implement as a vertical slice.

---

## Result

**No new root category.**  
**No new root Reality primitive.**  
**No new root Direction primitive.**  
**No new root Epistemic primitive.**  
**No new root Derived primitive.**

One contract boundary needs tightening (`DirectionEdge` endpoints), and historical reference resolvability needs to become an explicit invariant.

The ontology itself survives this pass unchanged.

This is the strongest stability signal so far.
