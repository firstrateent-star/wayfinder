# Wayfinder Ontology

**Version:** 0.1  
**Status:** CANONICAL

The ontology defines the smallest shared vocabulary Wayfinder needs to model lived reality, intention, evidence, meaning, and derived personal state without forcing all life domains into one schema.

## Root categories

### SYSTEM
Shared infrastructure and identity.

- Identity
- Source
- Provenance
- Time
- Permission
- EntityRef

### REALITY
Things that exist, happen, are observed, persist, or are created.

- Entity
- Event
- Observation
- State
- Artifact

### DIRECTION
Authored orientation toward a desired future or intentional course.

- Value
- Direction
- Outcome
- Quest
- Plan
- Action

### EPISTEMIC
How Wayfinder represents support, uncertainty, explanation, and meaning.

- Evidence
- Hypothesis
- Interpretation
- Reflection
- Certainty

### DERIVED
Reconstructable representations computed from deeper records.

- Signal
- Pattern
- Metric
- Growth
- Momentum
- Bearing
- Mastery
- Character

## Fundamental distinctions

These are not synonyms:

- Observation != Interpretation
- Action != Event
- Plan != Event
- Quest != Outcome
- Evidence != Meaning
- Reflection != Interpretation
- Hypothesis != Fact
- Projection != Fact
- Absence != Zero
- Scheduled != Occurred
- Source != Subject
- Confidence != Truth

## System primitives

### Identity
Stable identity for the person and other system-level actors.

### Source
Where a record or claim came from, such as user entry, connector, import, API, sensor, deterministic derivation, or AI proposal.

### Provenance
Information required to trace origin and transformation. May include source record identity, ingestion time, author/actor, version, original value, and transformation lineage.

### Time
Time is multidimensional. Common fields may include:

- `occurred_at`
- `started_at`
- `ended_at`
- `recorded_at`
- `valid_from`
- `valid_until`
- `planned_for`

These must not be treated as interchangeable.

### Permission
Describes what an actor or subsystem may read, propose, or execute.

### EntityRef
A stable cross-domain pointer, conceptually:

```ts
interface EntityRef {
  domain: string;
  type: string;
  id: string;
}
```

An EntityRef does not create universal ownership. It only provides a shared reference seam.

## Reality primitives

### Entity
Something with continuing identity.

Examples: person, boat, business, place, project, skill, piece of equipment.

### Event
Something that occurred.

Examples: workout completed, invoice paid, conversation occurred, song recorded, meal eaten.

### Observation
Something measured, noticed, reported, or captured about reality.

Examples: energy 6/10, weight 152 lb, wind 18 knots, mood description.

### State
A condition that remains valid over an interval or until changed.

Examples: project active, boat anchored at a location, residence, employment state.

### Artifact
A persistent output created or captured through activity.

Examples: song, video, document, photo, proposal, website.

## Direction primitives

### Value
Something important that does not have a completion state.

### Direction
An authored orientation describing where the person intends to move.

### Outcome
A desired future condition that can be evaluated.

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

One Action may support multiple Outcomes or Directions. A maintenance Action may support no explicit goal and still be valid.

## Epistemic primitives

### Evidence
A typed relationship describing how one record supports, weakens, contradicts, qualifies, or otherwise bears on another claim, direction, or projection.

Evidence is not automatically proof.

### Hypothesis
A tentative explanation or proposition requiring further evidence.

### Interpretation
A system- or AI-generated reading of evidence. It must preserve authorship, confidence, and evidence lineage.

### Reflection
Meaning or perspective authored by the person. Reflection is not converted into objective fact merely because it is sincere or important.

### Certainty
Initial qualitative states:

- KNOWN
- PARTIAL
- UNKNOWN
- INFERRED
- DISPUTED

Numeric confidence may be added when useful but must not create false precision.

## Derived primitives

### Signal
A bounded derived indicator over domain facts or observations.

### Pattern
A recurring or structured relationship inferred from evidence over time.

### Metric
A defined quantitative readout with clear source and calculation.

### Growth
Evidence-backed accumulated development. Growth is distinct from recent activity.

### Momentum
A recent continuity/movement projection. It must not erase permanent growth and must not shame rest.

### Bearing
A projection of how current actions relate to authored direction.

### Mastery
A derived representation of demonstrated depth, reliability, or complexity within a capability. Detailed semantics remain experimental.

### Character
The RPG-facing projection of accumulated evidence, development, identity expression, and related derived state. Character is never canonical truth.

## Domain ownership

The ontology defines shared meaning, not universal storage.

A domain owns its factual persistence and validation. For example, Training may store sessions, sets, and measurements, while Finance stores accounts and transactions.

The core composes across domains using references, commands, events, evidence, and read contracts.

## Primitive admission gate

Before adding a new shared primitive, ask:

1. Can an existing concept represent it accurately?
2. Would combining it with an existing concept destroy an important distinction?
3. Will multiple future domains depend on the distinction?

If the third answer is no, prefer a domain-specific concept.