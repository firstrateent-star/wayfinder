# Wayfinder Ontology

**Version:** 0.3  
**Status:** CANONICAL

The ontology defines the smallest shared vocabulary Wayfinder needs to model lived reality, intention, evidence, meaning, and derived personal state without forcing all life domains into one schema.

Ontology v0.3 incorporates the second recursive stress test. It further simplifies the Derived layer, separates provenance from reasoning mode, and makes bounded coverage and evidence ancestry explicit constraints.

## Model humility

The category named `REALITY` contains Wayfinder's factual records *about* lived reality. These records are not reality itself and are not metaphysical proof.

`canonical` means the current authoritative representation inside Wayfinder, subject to provenance, correction, dispute, and incomplete knowledge.

## Root categories

### SYSTEM
Shared infrastructure, authority, identity, and addressability.

- Identity
- Source
- Provenance
- Time
- Permission
- RecordRef
- EntityRef

### REALITY
Wayfinder's factual records of things that exist, happen, are observed, persist, or relate.

- Entity
- Event
- Observation
- State
- Relation

### DIRECTION
Authored or accepted orientation toward desired futures, commitments, intentional challenges, plans, and acts.

- Value
- Direction
- Outcome
- Commitment
- Quest
- Plan
- Action

### EPISTEMIC
How Wayfinder represents support, uncertainty, explanation, and meaning.

- Evidence
- Hypothesis
- Interpretation
- Reflection
- EpistemicState

### DERIVED
Reconstructable representations computed from deeper records.

- Projection
- Metric
- Signal
- Pattern

## Fundamental distinctions

These are not synonyms:

- Observation != Interpretation
- Action != Event
- Plan != Event
- Commitment != Outcome
- Quest != Outcome
- Relation != DirectionEdge
- Evidence != Meaning
- Reflection != Interpretation
- Hypothesis != Fact
- Projection != Fact
- Absence != Zero
- Missing != Absent
- Scheduled != Occurred
- Source != Subject
- Provenance != Inference
- Confidence != Truth
- RecordRef != EntityRef
- Canonical != Certain

## System primitives

### Identity
Stable identity for the person and other system-level actors.

### Source
Where a record or claim came from, such as user entry, connector, import, API, sensor, deterministic derivation, or AI proposal.

### Provenance
Information required to trace origin and transformation. May include source record identity, ingestion time, author/actor, version, original value, transformation lineage, and rule/model version.

Provenance describes where information came from and how it moved through Wayfinder. It is distinct from whether a conclusion was direct, derived, or inferred.

### Time
Time is multidimensional. Wayfinder must preserve the semantic difference among:

- **occurrence time** — when something happened;
- **validity time** — when a State or Relation was true;
- **planned time** — when something was intended or scheduled;
- **recorded time** — when Wayfinder learned or stored it.

Approximate or uncertain historical time is valid. Exact representation remains a contract concern, but the ontology must never assume all recorded time is exact.

### Permission
Describes what an actor or subsystem may read, propose, or execute.

### RecordRef
A stable pointer to any Wayfinder-addressable record, regardless of whether it is an Entity, Event, Observation, Direction node, interpretation, projection, or another addressable record.

Conceptually:

```ts
interface RecordRef {
  namespace: string;
  type: string;
  id: string;
}
```

`namespace` and `type` are stable machine identifiers, not display labels. A UI rename must not silently break references.

A universal reference does not create universal storage or ownership.

### EntityRef
A narrower semantic reference to something with continuing identity.

EntityRef is used when the target is specifically an Entity rather than simply any addressable record.

## Reality primitives

### Entity
Something with continuing identity.

Examples: person, boat, business, place, project, skill, piece of equipment, song, video, document.

Created outputs such as songs, videos, documents, photos, proposals, and websites may be modeled as Entity types. `Artifact` is therefore not a separate root primitive.

### Event
A canonical factual record that something occurred.

Examples: workout completed, invoice paid, conversation occurred, song recorded, meal eaten.

An Event may be reported after the fact and may have uncertain timing. Provenance and epistemic state describe how it is known.

### Observation
Something measured, noticed, reported, or captured about reality.

Examples: energy 6/10, weight 152 lb, wind 18 knots, mood description, tracker-estimated sleep.

Multiple conflicting Observations may coexist. Wayfinder must not silently collapse disagreement into one false certainty.

### State
A condition that remains valid over an interval or until changed.

Examples: project active, boat anchored at a location, residence, employment state, account pending.

A factual State is distinct from a derived read-model or UI state.

### Relation
A factual or domain-accepted relationship between continuing entities, potentially valid over an interval.

Examples: person owns boat, person works for business, project belongs to business, equipment installed at venue.

A Relation is not a Direction graph edge. Domains may own their own relation persistence and semantics.

## Direction primitives

### Value
Something important that does not have a completion state.

### Direction
An authored orientation describing where the person intends to move.

### Outcome
A desired future condition that can be evaluated.

### Commitment
An authored, accepted, or otherwise recognized obligation or promise that may require future action but is not necessarily a desired Outcome.

Examples: client deadline, appointment attendance, promise to a friend, bill to pay.

Externally imposed legal or financial obligations may remain domain-owned factual States while exposing a Commitment when Wayfinder needs to navigate them.

### Quest
A bounded intentional challenge, intervention, or experiment in service of direction.

### Plan
An organized approach linking intended steps, dependencies, sequencing, or resources.

### Action
A concrete intended act. Creating or scheduling an Action does not prove it happened.

## Direction graph

Direction is a graph, not a mandatory hierarchy. Nodes may be connected by typed edges such as:

- SUPPORTS
- PART_OF
- DEPENDS_ON
- BLOCKS
- CONTRADICTS
- SUPERSEDES
- RELATES_TO

One Action may support multiple Outcomes, Commitments, or Directions. A maintenance Action may support no explicit goal and still be valid.

Graph relation types may have different structural constraints. For example, `PART_OF` and `DEPENDS_ON` cycles are normally invalid even though other relationship types may form more complex graphs.

## Epistemic primitives

### Evidence
A typed relationship describing how one record supports, weakens, contradicts, qualifies, or otherwise bears on another claim, direction, interpretation, or projection.

Evidence is not automatically proof. Contradictory evidence is valid and should remain representable.

Derived records do not become independent evidence merely because they are new records. Evidence-consuming rules must preserve ancestry strongly enough to avoid circular self-support and material double-counting of the same underlying evidence.

### Hypothesis
A tentative explanation or proposition requiring further evidence.

A Hypothesis may be authored by the person, a deterministic rule, or an AI system; authorship and provenance must remain explicit.

### Interpretation
A reading of evidence that assigns meaning, explanation, or significance beyond the underlying observations. It must preserve authorship, epistemic state, and evidence lineage.

Interpretation is not inherently an AI concept; AI is one possible author/source.

### Reflection
Meaning or perspective authored by the person. Reflection is not converted into objective fact merely because it is sincere or important.

### EpistemicState
A single certainty ladder is insufficient because completeness, derivation mode, disagreement, and confidence are different dimensions.

Initial dimensions are:

- **completeness:** `COMPLETE | PARTIAL | UNKNOWN`
- **derivation:** `DIRECT | DERIVED | INFERRED`
- **dispute:** `UNDISPUTED | DISPUTED`
- **confidence:** optional numeric or bounded qualitative confidence when useful

Source/channel information such as user report, sensor, bank connector, API, or import belongs in Provenance rather than the derivation axis.

Not every record must populate every dimension. No combination of epistemic metadata should be presented as metaphysical certainty.

## Bounded coverage and absence

Missing records do not establish absence.

A statement such as “zero transactions occurred” or “no workout happened” requires either:

1. direct evidence of absence, or
2. a sufficiently complete bounded source/domain/time scope from which absence can validly be derived.

Exact coverage contracts remain Candidate, but the semantic requirement is canonical.

## Derived primitives

### Projection
A reconstructable representation computed from deeper records for understanding, decision support, or experience.

A Projection may be cached, but deleting the cache must not destroy the underlying lived record.

### Metric
A defined quantitative readout with clear source, scope, calculation, and coverage semantics.

### Signal
A bounded derived indicator over domain facts or observations.

### Pattern
A recurring or structured relationship inferred from evidence over time.

## Named projection families

The following are useful Wayfinder projection families, but they are not separate root ontology primitives:

- **Growth** — evidence-backed accumulated development.
- **Momentum** — recent continuity/movement.
- **Bearing** — relationship between current action and authored direction/commitments.
- **Mastery** — demonstrated depth/reliability/complexity within a capability.
- **Character** — RPG-facing representation of accumulated evidence and development.

Their exact models have independent maturity states in Canon and may evolve without changing the root ontology.

## Correction and supersession semantics

Wayfinder must support corrected, superseded, disputed, and retracted understanding without requiring every domain to implement full event sourcing.

Canonical rule:

> Corrections may change which record is current, but must not silently destroy the lineage required to explain prior evidence or derived conclusions.

Exact storage strategy remains Candidate until implementation.

When evidence or a projection depends on a record that becomes superseded or retracted, dependent derived state must be re-evaluated rather than left silently stale.

## Cross-domain same-world occurrences

A single real-world occurrence may matter to multiple domains. Wayfinder does not require a universal Event table to represent this.

One domain may own the canonical occurrence while others reference it, or domains may own distinct records that preserve shared source/equivalence lineage. Identity resolution remains a Candidate capability.

## Domain ownership

The ontology defines shared meaning, not universal storage.

A domain owns its factual persistence and validation. For example, Training may store sessions, sets, and measurements, while Finance stores accounts and transactions.

The core composes across domains using references, commands, events, evidence, relations, and read contracts.

## Primitive admission gate

Before adding a new shared primitive, ask:

1. Can an existing concept represent it accurately?
2. Would combining it with an existing concept destroy an important distinction?
3. Will multiple future domains depend on the distinction?

If the third answer is no, prefer a domain-specific concept.

## Deferred candidates

The following ideas are intentionally not promoted yet:

- Inquiry / durable open question
- Criterion / shared evaluation specification
- Coverage / explicit bounded dataset completeness object
- Scenario / counterfactual world
- Equivalence / same-world identity resolution
- universal Skill or Capability primitive
- universal Schedule primitive

They remain candidates until executable slices demonstrate cross-domain necessity.
