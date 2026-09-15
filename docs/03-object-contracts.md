# Wayfinder Object Contracts

**Version:** 0.5  
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

Purpose: stable address for a logical Wayfinder record without implying universal storage or ownership.

`namespace` and `type` are stable machine identifiers, not display labels.

## RecordVersionRef

```ts
interface RecordVersionRef extends RecordRef {
  version: string;
}
```

A `RecordVersionRef` addresses the exact immutable version consumed by evidence, provenance, or a derivation. `version` is an opaque token; implementations must not assume it is a simple counter.

A stable `RecordRef` answers “which logical record?” A `RecordVersionRef` answers “which exact historical representation?”

## EntityRef

```ts
interface EntityRef extends RecordRef {}
```

Semantic rule: use `EntityRef` only when the target has continuing identity.

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

These dimensions are intentionally orthogonal. Source/channel information belongs in Provenance. Numeric confidence must have an explicit scale and meaning or be omitted.

## Provenance

```ts
interface Provenance {
  source: SourceRef;
  recordedAt: string;
  actorRef?: RecordRef;
  epistemic?: EpistemicState;
  derivedFrom?: RecordVersionRef[];
  ruleVersion?: string;
  modelVersion?: string;
}
```

`derivedFrom` uses exact historical versions. Provenance must not rely on “current record” resolution for explaining an old derivation.

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
  lifecycle: RecordLifecycle;
  provenance: Provenance;
}
```

This is a logical contract, not a requirement for one universal table or one physical column layout.

A correction may reuse the same logical record id with a new version or replace it with another logical record. Split/merge corrections are therefore possible.

Privacy deletion may intentionally make historical content unavailable. In that case the lineage must resolve explicitly as deleted/redacted rather than silently dangling.

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

interface TemporalRange {
  from?: TemporalPoint;
  to?: TemporalPoint;
}

interface TemporalScope {
  occurrence?: TemporalPoint | TemporalRange;
  validity?: TemporalRange;
  planned?: TemporalPoint | TemporalRange;
}
```

Approximate historical time should normally be represented as a bounded range rather than fabricated timestamp precision. Unknown axes are omitted rather than invented.

`Provenance.recordedAt` is the system record/ingestion time and remains distinct from these lived/intended time axes.

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

`COMPLETE` is meaningful only for the exact declared scope. Coverage is initially a read/query contract, not necessarily a canonical persisted record.

A missing record plus `UNKNOWN` or mismatched coverage must not yield a zero/none conclusion.

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

`intentState` describes whether the authored intention is currently being held. It does **not** assert that an Action occurred, a Quest succeeded, a Commitment was discharged, or an Outcome was achieved. Those require factual evidence/evaluation.

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

Direction edges describe relationships inside Direction. Reality/Observation/Projection support of Direction belongs in EvidenceLink.

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

This is a shared semantic shape, not a requirement for one central relations table.

## EvidenceLink

```ts
type EvidenceRelation =
  | "SUPPORTS"
  | "WEAKENS"
  | "CONTRADICTS"
  | "QUALIFIES";

interface EvidenceLink {
  meta: RecordEnvelope;
  source: RecordVersionRef;
  target: RecordVersionRef;
  relation: EvidenceRelation;
  reason?: string;
  epistemic?: EpistemicState;
}
```

EvidenceLink expresses bearing, not absolute proof. `RELATES_TO` is intentionally excluded because mere association is not evidence.

Rules:

- a record must not count as independent evidence for itself;
- derived evidence lineage must not become circular;
- contradictory evidence may coexist;
- dependent derivations must be re-evaluated when a source is superseded or retracted;
- multiple descendants of the same source lineage must not be naively counted as independent evidence;
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
  inputRefs: RecordVersionRef[];
  coverage?: Coverage[];
  ruleVersion?: string;
  modelVersion?: string;
  epistemic?: EpistemicState;
}
```

A Projection is reconstructable. Persisted projection rows are caches/read models rather than irreplaceable lived history. `inputRefs` must identify the exact versions consumed.

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
  modelOrRuleVersion?: string;
  createdAt: string;
}
```

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

Requester and authorizer are different concepts. An AI/model may request or propose a command but cannot self-authorize canonical mutation.

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
  domain: string;
  payload: TPayload;
  requestedBy: RecordRef;
  requestedAt: string;
  authorization: AuthorizationContext;
  idempotencyKey: string;
  preconditions?: VersionPrecondition[];
  correlationId?: string;
}
```

Commands request change. They are not facts. The owning domain validates authorization, payload, preconditions, and domain semantics.

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

A retry with the same idempotency key must return the same logical result rather than create duplicate canonical effects.

## DomainChange

```ts
type ChangeOperation = "CREATED" | "SUPERSEDED" | "RETRACTED";

interface DomainChange {
  id: string;
  domain: string;
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

A DomainChange is an infrastructure notification that canonical domain state changed. It is **not** automatically a lived-reality Event and must not be treated as life evidence merely because it exists.

## PracticeSession — pilot domain example

```ts
interface PracticeSession {
  meta: RecordEnvelope;
  practiceRef: EntityRef;
  occurrence: TemporalPoint | TemporalRange;
  durationSeconds?: number;
  focus?: string;
}
```

Measurements and reflections remain separate records. Free-form `notes` are intentionally excluded here because mixing reflection, observation, and factual session data would weaken semantic boundaries.

## Contract design rules

1. Do not add fields only because they may be useful someday.
2. Prefer explicit unknown/partial semantics over fake defaults.
3. Stable logical identity and immutable historical version identity are distinct.
4. Separate occurrence, validity, planned, and record time when they differ.
5. Preserve provenance at canonical boundaries.
6. Commands request; lived Events record occurrence; DomainChanges notify that canonical state changed.
7. `RecordRef` crosses boundaries; persistence ownership does not.
8. `EntityRef` is reserved for continuing identity.
9. Direction edges connect Direction nodes; cross-layer support uses Evidence.
10. Evidence/provenance/derivation inputs use version-addressable lineage.
11. Correction lineage must be explainable without mandating full event sourcing.
12. Zero/absence claims require direct evidence or matching bounded coverage.
13. Derived descendants do not automatically create independent evidence mass.
14. Request origin and execution authorization are separate.
15. Retry safety is a command-level concern, not a UI convention.
16. Direction intent state does not assert factual fulfillment.
