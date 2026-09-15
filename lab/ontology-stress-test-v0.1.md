# Ontology Stress Test — v0.1

**Date:** 2026-09-14  
**Purpose:** Recursively pressure-test Wayfinder Ontology v0.1 before database design.  
**Method:** Repeated Flower passes across semantic minimality, lived-life edge cases, epistemology, time, graph integrity, and expansion pressure.

This document records the reasoning trail. It is not Canon. Accepted outcomes are promoted into canonical docs and ADRs.

## Flower frame

- **CENTER:** a small, durable ontology for modeling lived reality and navigation.
- **BOUNDARY:** no database design yet; no speculative feature architecture; no requirement to preserve the old Wayfinder implementation.
- **CONTEXT:** Wayfinder must work early, remain understandable, and expand across very different life domains.
- **DIRECTION:** minimize primitives while preserving distinctions that matter across domains.
- **EVIDENCE:** scenario failures, ambiguity, contradictory semantics, graph/pathological cases, and implementation pressure.
- **REFLECTION:** change Canon only when a distinction repeatedly survives pressure.
- **EXPANSION:** rerun the same tests after each accepted change.

---

## Pass 1 — Primitive minimality

### Test
Can each root primitive justify its existence across multiple domains without duplicating another primitive?

### Findings

1. **Artifact is not a necessary root primitive.** A song, video, document, website, photo, or proposal has continuing identity and can be represented as an Entity whose domain/type expresses that it is a created output. Treating Artifact as a separate primitive creates overlap with Entity.
2. **Relation is missing.** Many durable truths concern how entities are related: a person owns a boat, a project belongs to a business, equipment is installed at a venue, a person works for a company, an account belongs to a person. These are not Events, Observations, or Direction edges.
3. **Direction needs Commitment.** Goals describe desired futures, but life also contains accepted obligations and promises: attend an appointment, deliver a client film, pay a bill, call someone back, honor a contractual deadline. A Commitment is not necessarily desired and is not the same thing as an Outcome.

### Result
Promote `Relation` and `Commitment`. Demote `Artifact` from root primitive to a common Entity role/type.

---

## Pass 2 — Reference integrity

### Test
Can the current reference contract point accurately to every object the architecture says may be linked?

### Failure
`EntityRef` is currently used as a universal pointer even though Evidence, Direction edges, provenance, reflections, interpretations, events, and projections may point to things that are not Entities.

This creates a semantic lie in the type system before code even exists.

### Result
Introduce two concepts:

- **RecordRef** — universal address for any Wayfinder-addressable record.
- **EntityRef** — narrower reference for something with continuing identity.

Cross-domain edges and provenance use `RecordRef`. Domain relationships between continuing things may use `EntityRef`.

---

## Pass 3 — Epistemic decomposition

### Test
Does the `Certainty` enum represent one coherent dimension?

### Failure
`KNOWN`, `PARTIAL`, `UNKNOWN`, `INFERRED`, and `DISPUTED` mix different questions:

- completeness (`PARTIAL`, `UNKNOWN`)
- derivation mode (`INFERRED`)
- disagreement (`DISPUTED`)
- an overly strong truth-sounding label (`KNOWN`)

A record can be complete and inferred. It can be partial and disputed. These dimensions must not exclude one another.

### Result
Replace monolithic `Certainty` with **EpistemicState** containing orthogonal dimensions:

- completeness: `COMPLETE | PARTIAL | UNKNOWN`
- basis: `OBSERVED | REPORTED | DERIVED | INFERRED`
- dispute: `UNDISPUTED | DISPUTED`
- optional confidence when useful

Not every record must populate every dimension. Provenance remains the stronger source of lineage.

---

## Pass 4 — Lived-life crash tests

The ontology was applied to heterogeneous scenarios.

### Workout
- training session: Event
- weight/reps/heart rate: Observations
- training program: Plan
- strength trend: Projection/Signal
- user notes: Reflection

**Result:** fits.

### Bank transaction
- transaction: domain-owned Event/record
- pending/posted condition: State
- account ownership: Relation
- imported bank record: Source + Provenance

**Result:** fits after Relation addition.

### Friend conversation
- conversation: Event
- relationship between people: domain-owned Relation
- “conversation felt tense”: Observation or Reflection depending on how entered
- “they are angry with me”: Hypothesis/Interpretation, not Fact

**Result:** fits and preserves epistemic humility.

### Tarot reading
- cards drawn: Event + recorded observations
- spread/photo: Entity/output
- symbolic reading: Reflection or Interpretation
- reading never silently mutates factual reality

**Result:** fits.

### Sleep tracker
- tracker estimate: Observation with sensor provenance
- user memory of sleep: separate reported Observation
- disagreement preserved rather than silently merged

**Result:** fits after epistemic decomposition.

### Calendar appointment
- scheduled appointment: Plan/Commitment with planned time
- passage of time alone does not create Event
- attended appointment: separate Event or domain-confirmed occurrence

**Result:** fits after Commitment addition.

### Boat ownership and location
- boat: Entity
- person owns boat: Relation
- boat anchored at location: State or temporal Relation depending on domain model
- GPS fix: Observation

**Result:** fits.

### Creative idea
- captured idea note: Entity/output or authored record
- occurrence of idea capture: Event
- “this could become a song”: Reflection/Direction proposal

**Result:** fits without Artifact primitive.

### Health measurement
- blood pressure/weight/etc.: Observation
- diagnosis from clinician: reported domain record with provenance, not a system inference
- AI suspicion: Hypothesis only

**Result:** fits.

### External obligation
- client deadline: Commitment and/or domain-owned contractual State
- action to deliver: Action
- delivery occurred: Event
- client accepted delivery: separate Event/State

**Result:** fits after Commitment addition.

---

## Pass 5 — Time and correction

### Test
Can the ontology distinguish when something happened, when Wayfinder learned it, when it was true, and when it was merely planned?

### Finding
The semantic axes are correct but flat timestamp lists are easy to misuse. The architecture must preserve at least these meanings:

- occurrence time
- validity interval
- planned time
- recorded/ingested time

Approximate time also exists in real life (“yesterday afternoon”, “sometime last week”). Exact support can remain Candidate, but the ontology must not assume every historical time is precise.

### Correction finding
Corrections must preserve lineage, but full event sourcing is not required. Wayfinder needs a correction/supersession contract, not a mandate that every table become an append-only event store.

### Result
Keep time semantics canonical; make exact temporal structures and revision storage Candidate. Add invariant that evidence depending on superseded/retracted records must be re-evaluated.

---

## Pass 6 — Graph topology and adversarial integrity

### Direction graph
- `PART_OF` and `DEPENDS_ON` cycles are usually semantic failures and should be rejected or explicitly justified.
- `SUPPORTS` can form complex many-to-many structures but should not become self-support.
- an Action may support multiple Direction nodes.

### Evidence graph
- a record must not count as independent evidence for itself.
- derived evidence must not become circular lineage.
- contradictory evidence is valid and must be preserved.
- removing or correcting a source must invalidate/recompute dependent projections rather than erase history.

### Cross-domain references
- references may outlive a current projection or point to a record later superseded.
- dangling references must be detectable; deletion semantics require an explicit retention/privacy policy.

### Result
Add graph-integrity invariants now; defer exact graph algorithms until executable contracts exist.

---

## Pass 7 — Expansion pressure

Tested likely future concepts against the revised primitives.

- Skills/mastery: can remain domain/derived; no new root primitive required.
- Character/archetypes: projections; no root change.
- Astrology: observations/artifacts/data + interpretations; no root change.
- Atlas/place/world context: Entities, Relations, States, Observations; no root change.
- Inventory: Entities + Relations + States; no root change.
- Health: Events, Observations, States, Relations, provenance; no root change.
- Finance: Events, States, Relations, obligations/Commitments; no root change.
- Relationships: Entities, Events, Relations, Reflections, Interpretations; no root change.
- Agent automation: permissions, commands, provenance; no root change.
- Counterfactual scenarios: remain experimental reasoning objects; no root primitive yet.
- Durable open questions/unknowns: `Inquiry` is a plausible future Epistemic primitive but not yet required for the first executable slice.

### Result
No additional root primitive was required after the changes above.

---

## Pass 8 — Re-run after accepted changes

The revised ontology was run through the same scenario set again.

### Remaining pressure points

1. `RecordRef` resolution and lifecycle must be enforceable once code exists.
2. Exact temporal representation should be designed before Calendar or health imports.
3. Commitment evaluation criteria will likely need a shared contract, but `Criterion` is not promoted yet.
4. Evidence invalidation after corrections must be demonstrated in the first executable derivation tests.
5. Privacy and deletion may intentionally override historical retention; policy must remain explicit.

### Important result
No new root category was required in the second full pass.

That is the first sign of ontological stability.

---

## Current recommendation

Promote the accepted changes into Ontology v0.2 and object contracts. Then run the validation protocol again before database design. The database gate should require at least two consecutive full passes that introduce no new root primitive and reveal no unresolved invariant-breaking ambiguity in the first vertical slice.
