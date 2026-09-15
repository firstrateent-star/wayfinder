# Wayfinder Object Contracts

**Version:** 0.9  
**Status:** CANDIDATE-STABLE

These are conceptual contracts. They are intentionally not yet production TypeScript or SQL. `CANDIDATE-STABLE` means they have survived repeated semantic and operational pressure well enough to let the next architecture layer depend on them provisionally.

## RecordRef

```ts
interface RecordRef {
  namespace: string;
  type: string;
  id: string;
}
```

A `RecordRef` addresses one logical Wayfinder record. It does not imply universal storage or ownership.

`namespace` and `type` are stable machine identifiers, not display labels. Record ids should be globally collision-resistant; authorization still scopes whether the caller may resolve them.

## RecordVersionRef

```ts
interface RecordVersionRef extends RecordRef {
  version: string;
}
```

A `RecordVersionRef` addresses the exact historical representation consumed by evidence, provenance, or derivation. `version` is opaque.

- `RecordRef` = which logical record?
- `RecordVersionRef` = which exact version of that record?

## Reference resolution

```ts
type ReferenceResolutionStatus =
  | "RESOLVED"
  | "REDACTED"
  | "DELETED"
  | "UNAVAILABLE"
  | "MISSING";

interface ReferenceResolution<T = unknown> {
  ref: RecordVersionRef;
  status: ReferenceResolutionStatus;
  value?: T;
  reason?: string;
}
```

Historical explainability does not require indefinite content retention. Privacy policy may cause an old reference to resolve to an explicit redaction/deletion state.

`MISSING` means an unexpected unresolved/corrupt reference and must be detectable rather than treated as ordinary absence.

## EntityRef

```ts
interface EntityRef extends RecordRef {}
```

Use `EntityRef` only when the target has continuing identity.

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

These dimensions are orthogonal. Source/channel belongs in Provenance. Numeric confidence requires an explicit scale/meaning or is omitted.

## LineageSpec

```ts
interface LineageSpec {
  directRefs?: RecordVersionRef[];
  manifestRef?: RecordVersionRef;
}
```

Lineage must identify the exact historical input set used by a derivation.

For small derivations, `directRefs` is sufficient. For large derivations, `manifestRef` may point to an immutable versioned lineage manifest that preserves the exact input set without embedding huge reference sets in every projection.

A query description alone is not historical lineage because its results can change later.

At least one lineage form is required when a record claims `DERIVED` or `INFERRED` status from other Wayfinder records.

## Provenance

```ts
interface Provenance {
  source: SourceRef;
  recordedAt: string;
  actorRef?: RecordRef;
  epistemic?: EpistemicState;
  lineage?: LineageSpec;
  ruleVersion?: string;
  modelVersion?: string;
}
```

Provenance must not explain an old derivation by resolving whatever input happens to be current today.

## Record lifecycle and envelope

```ts
type RecordLifecycleStatus =
  | "ACTIVE"
  | "SUPERSEDED"
  | "RETRACTED";

interface RecordLifecycle {
  status: RecordLifecycleStatus;
  supersededBy?: RecordVersionRef[];
  reason?: string;
}

interface RecordEnvelope {
  ref: RecordRef;
  version: string;
  ownerRef: EntityRef;
  lifecycle: RecordLifecycle;
  provenance: Provenance;
}
```

This is a logical contract, not a universal table requirement.

`ownerRef` identifies the Wayfinder person/workspace/entity whose authority scope owns the record. Owner is not the same as subject.

Record-version payload is immutable once addressable as a `RecordVersionRef`; lifecycle metadata may later mark that version superseded/retracted without rewriting the historical payload.

A correction may reuse the same logical id with a new version or replace it with another logical record. Split/merge corrections remain possible.

`WITHDRAWN` Direction intent and `RETRACTED` record lifecycle are different: the former means an intention is no longer held; the latter means the record itself is no longer accepted as the current canonical representation.

## Temporal contracts

```ts
type TemporalPrecision =
  | "INSTANT"
  | "MINUTE"
  | "HOUR"
  | "DAY"
  | "MONTH"
  | "YEAR";

interface TemporalPoint {
  value: string;
  precision: TemporalPrecision;
  zoneId?: string;
}

type TemporalBoundary =
  | { kind: "KNOWN"; point: TemporalPoint }
  | { kind: "OPEN" }
  | { kind: "UNKNOWN" };

interface TemporalRange {
  start: TemporalBoundary;
  end: TemporalBoundary;
}

interface TemporalScope {
  occurrence?: TemporalPoint | TemporalRange;
  validity?: TemporalRange;
  planned?: TemporalPoint | TemporalRange;
}
```

`OPEN` means the record intentionally asserts no closed endpoint at present, such as a currently ongoing State. `UNKNOWN` means Wayfinder does not know the endpoint. Those are not synonyms.

Whenever a `TemporalRange` has two known boundaries, Wayfinder uses **half-open interval semantics `[start, end)`**: the start is included and the end is excluded. This prevents adjacent ranges from double-counting a shared boundary and gives one consistent rule for date/day/month normalization, overlap, aggregation, and filtering.

Approximate historical time should normally be represented as a bounded range rather than fabricated timestamp precision. A coarse uncertainty window does not necessarily describe the actual duration of the event.

Therefore a record may validly say, for example, “30 minutes sometime Saturday”: the occurrence range can cover the whole Saturday window while `durationSeconds = 1800`. Duration must only be required to equal `end - start` when the boundaries are explicitly representing the actual exact event interval.

`Provenance.recordedAt` is system record/ingestion time and remains distinct from lived/intended time axes.

## Bounded coverage

```ts
interface CoverageScope {
  namespace: string;
  type?: string;
  subjectRef?: RecordRef;
  time?: TemporalRange;
  sourceRefs?: SourceRef[];
}

interface Coverage {
  scope: CoverageScope;
  completeness: "COMPLETE" | "PARTIAL" | "UNKNOWN";
  evaluatedAt: string;
  reason?: string;
}
```

`COMPLETE` applies only to the exact declared scope. A missing record plus `UNKNOWN`, `PARTIAL`, or mismatched coverage must not yield a zero/none conclusion.

Coverage is initially a read/query contract, not necessarily canonical persisted state.

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

type IntentState = "ACTIVE" | "PAUSED" | "WITHDRAWN";

interface DirectionNode {
  meta: RecordEnvelope;
  kind: DirectionKind;
  title: string;
  description?: string;
  intentState: IntentState;
}
```

Intent state describes whether the authored intention is currently held. It does **not** assert that an Action occurred, Quest succeeded, Commitment was discharged, or Outcome was achieved.

## DirectionNodeRef

```ts
interface DirectionNodeRef extends RecordRef {
  namespace: "direction";
  type: DirectionKind;
}
```

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
  meta: RecordEnvelope;
  from: DirectionNodeRef;
  to: DirectionNodeRef;
  relation: DirectionRelation;
}
```

Direction edges describe structural/intended relationships inside Direction. Reality/Observation/Projection bearing on whether something is true, progressing, fulfilled, or otherwise evidenced belongs in EvidenceLink.

`PART_OF` and `DEPENDS_ON` should normally be acyclic.

## RelationRecord

```ts
interface RelationRecord {
  meta: RecordEnvelope;
  relationType: string;
  from: EntityRef;
  to: EntityRef;
  temporal?: Pick<TemporalScope, "validity">;
}
```

This is a shared semantic shape, not a central-relations-table requirement.

## EvidenceLink

```ts
type EvidenceRelation =
  | "SUPPORTS"
  | "WEAKENS"
  | "CONTRADICTS"
  | "QUALIFIES";

interface EvidenceTarget {
  ref: RecordVersionRef;
  aspect?: string;
}

interface EvidenceLink {
  meta: RecordEnvelope;
  source: RecordVersionRef;
  target: EvidenceTarget;
  relation: EvidenceRelation;
  reason?: string;
  epistemic?: EpistemicState;
}
```

`aspect` is a stable machine key clarifying what feature of a target the evidence bears on when the record itself is not sufficiently specific. Example families include `fulfillment`, `progress`, `validity`, or `quality`; each owning feature/module defines its allowed semantics.

EvidenceLink expresses bearing, not proof. Mere association is not evidence.

Rules:

- a record must not count as independent evidence for itself;
- derived lineage must not become circular;
- contradictory evidence may coexist;
- superseded/retracted sources trigger dependent re-evaluation;
- descendants of the same source lineage must not be naively counted as independent evidence;
- source and target are version-addressed so old reasoning remains explainable.

## Projection

```ts
interface Projection<TPayload = unknown> {
  meta: RecordEnvelope;
  projectionType: string;
  subject: RecordRef;
  asOf?: TemporalPoint;
  computedAt: string;
  payload: TPayload;
  coverage?: Coverage[];
}
```

A Projection is reconstructable. Its exact input set and derivation identity live in `meta.provenance.lineage`, `ruleVersion`, and/or `modelVersion` rather than duplicated projection fields.

Persisted projection rows are caches/read models, not irreplaceable lived history.

If an input becomes superseded, retracted, redacted, deleted, unavailable, or unexpectedly missing, a persisted projection must not remain silently current. It must be recomputed, invalidated, or surfaced as unsupported/stale according to projection-runtime policy.

## Reflection

```ts
interface Reflection {
  meta: RecordEnvelope;
  subject?: RecordRef;
  body: string;
  authoredAt: string;
  authorRef: RecordRef;
}
```

Reflection preserves human authorship and is not silently converted into factual observation.

## Interpretation

```ts
interface Interpretation {
  meta: RecordEnvelope;
  subject: RecordRef;
  body: string;
  interpretationType: "hypothesis" | "interpretation";
  evidenceRefs: RecordVersionRef[];
  epistemic: EpistemicState;
  authorRef?: RecordRef;
  createdAt: string;
}
```

Model/rule identity belongs in provenance rather than a second interpretation-specific field.

## AuthorizationContext

```ts
type AuthorizationMode =
  | "EXPLICIT_USER"
  | "PREAUTHORIZED"
  | "SYSTEM_INTERNAL";

interface AuthorizationContext {
  mode: AuthorizationMode;
  authorizedBy: RecordRef;
  grantRef?: RecordRef;
}
```

AuthorizationContext is evidence presented to the owning module, not a bypass token. Permission/grant validity must be checked at execution time. An AI/model cannot self-authorize canonical mutation.

## VersionPrecondition

```ts
interface VersionPrecondition {
  ref: RecordRef;
  expectedVersion: string;
}
```

Use version preconditions for non-commutative updates where stale writes could destroy newer state.

## Command

```ts
interface Command<TPayload = unknown> {
  id: string;
  type: string;
  module: string;
  ownerRef: EntityRef;
  payload: TPayload;
  requestedBy: RecordRef;
  requestedAt: string;
  authorization: AuthorizationContext;
  preconditions?: VersionPrecondition[];
  correlationId?: string;
}
```

`Command.id` is the retry/idempotency identity. A true retry reuses the same command id.

Same command id + materially different command content is a conflict and must be rejected. Semantic duplicate detection across different command ids remains the owning module's responsibility.

Commands request change. They are not facts. The owning module validates authorization, payload, preconditions, ownership scope, and module semantics.

For transport-independent retry hashing, the material command content must be normalized with deterministic canonical serialization before hashing. Raw JSON text, object-key order, whitespace, or client-specific serialization must not change retry identity semantics.

## CommandReceipt

```ts
type CommandReceiptStatus = "APPLIED" | "REJECTED" | "NOOP";

interface CommandReceipt {
  commandId: string;
  status: CommandReceiptStatus;
  processedAt: string;
  affectedRefs?: RecordVersionRef[];
  errorCode?: string;
}
```

A true retry returns the same logical result and does not duplicate effects.

## ModuleChange

```ts
type ChangeOperation = "CREATED" | "SUPERSEDED" | "RETRACTED";

interface ModuleChange {
  id: string;
  module: string;
  ownerRef: EntityRef;
  type: string;
  commandId?: string;
  committedAt: string;
  affected: Array<{
    operation: ChangeOperation;
    ref: RecordVersionRef;
  }>;
  correlationId?: string;
}
```

A ModuleChange is an infrastructure notification that canonical state changed inside an owning stateful module. It is **not** automatically a lived-reality Event and must not be treated as life evidence merely because it exists.

Publication reliability, transaction coupling, delivery semantics, and consumer idempotency belong to the Stateful Module Protocol/System Architecture.

## PracticeSession — pilot life-domain example

```ts
interface PracticeSession {
  meta: RecordEnvelope;
  practiceRef: EntityRef;
  occurrence: TemporalPoint | TemporalRange;
  durationSeconds?: number;
  focus?: string;
}
```

Measurements and reflections remain separate records. Free-form notes are excluded to avoid mixing reflection, observation, and factual session data.

If exact start/end timing and explicit duration are all present and those bounds represent the actual event interval, the Practice module validates consistency. If the occurrence range is a coarse uncertainty window, a known duration may be shorter than the range and must not be rejected merely because it differs from range width.

## Contract design rules

1. Do not add fields only because they may be useful someday.
2. Prefer explicit unknown/partial semantics over fake defaults.
3. Stable logical identity and exact historical version identity are distinct.
4. Historical explainability permits explicit redaction/deletion states; it does not require indefinite content retention.
5. Ownership scope is explicit and distinct from record subject.
6. Separate occurrence, validity, planned, and record time; open and unknown endpoints are distinct.
7. Known temporal ranges use half-open `[start, end)` semantics; coarse uncertainty ranges do not imply event duration.
8. Commands request; lived Events record occurrence; ModuleChanges notify canonical state change.
9. `RecordRef` crosses boundaries; persistence ownership does not.
10. `EntityRef` is reserved for continuing identity.
11. Direction edges represent intentional structure; evidence represents epistemic bearing.
12. Derivations preserve exact input ancestry using direct refs or an immutable lineage manifest.
13. Correction lineage must be explainable without mandating full event sourcing.
14. Zero/absence claims require direct evidence or matching bounded coverage.
15. Derived descendants do not automatically create independent evidence mass.
16. Request origin and execution authorization are separate, and authorization is revalidated at execution.
17. Command id is the retry identity; semantic duplicate prevention remains module-specific; request hashing uses deterministic canonical serialization.
18. Direction intent state does not assert factual fulfillment.
19. Stale or invalidated projection inputs must not leave silently current projections.
20. Version preconditions protect non-commutative edits from silent lost updates.
21. Shared operational contracts target **stateful modules**; a life domain is one module kind, not the universal module type.
