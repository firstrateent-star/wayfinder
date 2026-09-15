# Wayfinder Object Contracts

**Version:** 0.3  
**Status:** CANDIDATE

These are conceptual contracts. They are intentionally not yet production TypeScript or SQL.

## RecordRef

```ts
interface RecordRef {
  namespace: string;
  type: string;
  id: string;
}
```

Purpose: universal address for any Wayfinder-addressable record without implying universal storage or ownership.

`namespace` and `type` are stable machine identifiers, not display labels.

## EntityRef

```ts
interface EntityRef extends RecordRef {}
```

Semantic rule: use `EntityRef` only when the target has continuing identity. Exact compile-time narrowing may evolve before implementation.

## SourceRef

```ts
interface SourceRef {
  sourceType: string;
  sourceId?: string;
  externalRecordId?: string;
}
```

## EpistemicState

```ts
interface EpistemicState {
  completeness?: "COMPLETE" | "PARTIAL" | "UNKNOWN";
  derivation?: "DIRECT" | "DERIVED" | "INFERRED";
  dispute?: "UNDISPUTED" | "DISPUTED";
  confidence?: number;
}
```

These dimensions are intentionally orthogonal. Source/channel information belongs in Provenance.

If numeric confidence is used, its scale and meaning must be explicit. Omit it rather than manufacture false precision.

## Provenance

```ts
interface Provenance {
  source: SourceRef;
  recordedAt: string;
  actorRef?: RecordRef;
  epistemic?: EpistemicState;
  revision?: number;
  derivedFrom?: RecordRef[];
  ruleVersion?: string;
  modelVersion?: string;
}
```

## Temporal semantics

Wayfinder distinguishes four time axes even if individual domain contracts expose only the ones they need:

- occurrence time
- validity time/range
- planned time/range
- recorded/ingested time

Exact `TemporalScope` structures remain Candidate. Domains must not reuse one timestamp field to mean multiple axes.

## Bounded coverage

Reads that can imply absence or zero need bounded completeness metadata.

Conceptually:

```ts
interface Coverage {
  completeness: "COMPLETE" | "PARTIAL" | "UNKNOWN";
  namespace?: string;
  from?: string;
  to?: string;
  sourceRefs?: SourceRef[];
  reason?: string;
}
```

This is a read/query contract, not yet a canonical persisted object.

A missing record plus `UNKNOWN` coverage must not yield a zero/none conclusion.

## DirectionNode

```ts
type DirectionKind =
  | "value"
  | "direction"
  | "outcome"
  | "commitment"
  | "quest"
  | "plan"
  | "action";

interface DirectionNode {
  id: string;
  kind: DirectionKind;
  title: string;
  description?: string;
  status: string;
  createdAt: string;
  archivedAt?: string;
  provenance: Provenance;
}
```

`status` remains intentionally unspecialized until each Direction kind's lifecycle is pressure-tested.

## DirectionEdge

```ts
type DirectionRelation =
  | "SUPPORTS"
  | "PART_OF"
  | "DEPENDS_ON"
  | "BLOCKS"
  | "CONTRADICTS"
  | "SUPERSEDES"
  | "RELATES_TO";

interface DirectionEdge {
  id: string;
  from: RecordRef;
  to: RecordRef;
  relation: DirectionRelation;
  createdAt: string;
  provenance: Provenance;
}
```

Direction relation types may have different graph constraints. `PART_OF` and `DEPENDS_ON` should normally be acyclic.

## RelationRecord

```ts
interface RelationRecord {
  id: string;
  type: string;
  from: EntityRef;
  to: EntityRef;
  validFrom?: string;
  validUntil?: string;
  provenance: Provenance;
}
```

This is a shared semantic shape, not a requirement for one central relations table. Domains may own specialized relation persistence.

## EvidenceLink

```ts
interface EvidenceLink {
  id: string;
  source: RecordRef;
  target: RecordRef;
  relation: "SUPPORTS" | "WEAKENS" | "CONTRADICTS" | "QUALIFIES" | "RELATES_TO";
  confidence?: number;
  reason?: string;
  createdAt: string;
  provenance: Provenance;
}
```

EvidenceLink expresses bearing, not absolute proof.

Rules:

- a record must not count as independent evidence for itself;
- derived evidence lineage must not become circular;
- contradictory evidence may coexist;
- dependent derivations must be re-evaluated when a source is superseded or retracted;
- multiple descendants of the same source lineage must not be naively counted as independent evidence.

## Projection

```ts
interface Projection<TPayload = unknown> {
  id: string;
  type: string;
  subject: RecordRef;
  asOf: string;
  payload: TPayload;
  sourceRefs: RecordRef[];
  ruleVersion: string;
  coverage?: Coverage;
  epistemic?: EpistemicState;
}
```

A Projection is reconstructable. Persisted projection rows, if any, are caches/read models rather than irreplaceable lived history.

## Reflection

```ts
interface Reflection {
  id: string;
  subject?: RecordRef;
  body: string;
  authoredAt: string;
  authorRef: RecordRef;
  provenance: Provenance;
}
```

## Interpretation

```ts
interface Interpretation {
  id: string;
  subject: RecordRef;
  body: string;
  interpretationType: "hypothesis" | "interpretation";
  evidenceRefs: RecordRef[];
  epistemic: EpistemicState;
  authorRef?: RecordRef;
  modelOrRuleVersion?: string;
  createdAt: string;
  provenance: Provenance;
}
```

## Command

```ts
interface Command<TPayload = unknown> {
  id: string;
  type: string;
  domain: string;
  payload: TPayload;
  requestedBy: RecordRef;
  requestedAt: string;
  authorization: string;
  idempotencyKey?: string;
}
```

Commands request change. They are not facts.

## DomainEvent

```ts
interface DomainEvent<TPayload = unknown> {
  id: string;
  domain: string;
  type: string;
  subject: RecordRef;
  occurredAt: string;
  recordedAt: string;
  payload: TPayload;
  provenance: Provenance;
}
```

A DomainEvent represents something accepted by the owning domain as having occurred. Canonical acceptance does not imply metaphysical certainty.

## Correction lineage

Exact persistence remains Candidate, but an evidence-bearing record must be able to express whether it is current, superseded, or retracted and what replaced it.

Conceptually:

```ts
interface RecordLifecycle {
  status: "ACTIVE" | "SUPERSEDED" | "RETRACTED";
  supersededBy?: RecordRef;
  reason?: string;
}
```

This contract does not require full event sourcing.

## PracticeSession — pilot domain example

```ts
interface PracticeSession {
  id: string;
  practiceRef: EntityRef;
  startedAt: string;
  endedAt?: string;
  durationSeconds?: number;
  focus?: string;
  notes?: string;
  provenance: Provenance;
}
```

This is intentionally small. Measurements and reflections may be separate records rather than packed into the session.

## Contract design rules

1. Do not add fields only because they may be useful someday.
2. Prefer explicit unknown/partial semantics over fake defaults.
3. Separate occurrence, validity, planned, and record time when they differ.
4. Preserve provenance at canonical boundaries.
5. Commands request; domain events assert accepted occurrence.
6. `RecordRef` crosses boundaries; persistence ownership does not.
7. `EntityRef` is reserved for continuing identity.
8. Correction lineage must be explainable without mandating full event sourcing.
9. Graph relations may have relation-specific structural constraints.
10. Zero/absence claims require direct evidence or bounded coverage.
11. Derived descendants do not automatically create independent evidence mass.
