# Wayfinder Object Contracts

**Version:** 0.6  
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

A `RecordVersionRef` addresses the exact immutable version consumed by evidence, provenance, or a derivation. `version` is opaque.

A stable `RecordRef` answers “which logical record?” A `RecordVersionRef` answers “which exact historical representation?”

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

Historical explainability does not require indefinite content retention. Privacy policy may cause an old reference to resolve to an explicit redaction/deletion state rather than content.

`MISSING` represents an unexpected unresolved/corrupt reference and must be detectable rather than treated as ordinary absence.

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

The dimensions are orthogonal. Source/channel belongs in Provenance. Numeric confidence requires an explicit scale/meaning or should be omitted.

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

`derivedFrom` uses exact historical versions. Provenance must not resolve old derivations against whatever is current today.

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

This is a logical contract, not a universal table requirement.

A correction may reuse the same logical id with a new version or replace it with another logical record. Split/merge corrections remain possible.

`WITHDRAWN` Direction intent and `RETRACTED` record lifecycle are different: the former means the person no longer holds an intention; the latter means the record itself is no longer accepted as current canonical representation.

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

Approximate historical time should normally be represented as a bounded range rather than fabricated precision. Unknown axes are omitted.

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

`aspect` is a stable machine key that clarifies what feature of the target the evidence bears on when the record itself is not sufficiently specific. Examples may include `fulfillment`, `progress`, `validity`, or `quality`. Domain/feature contracts own allowed aspect semantics; do not invent arbitrary display strings as machine meaning.

EvidenceLink expresses bearing, not proof. Mere association is not evidence and therefore has no `RELATES_TO` relation.

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
  inputRefs: RecordVersionRef[];
  coverage?: Coverage[];
  ruleVersion?: string;
  modelVersion?: string;
  epistemic?: EpistemicState;
}
```

A Projection is reconstructable. Persisted projection rows are caches/read models, not irreplaceable lived history.

If any input becomes superseded, retracted, redacted, deleted, or unexpectedly missing, a persisted projection must not remain silently current. It must be recomputed, invalidated, or surfaced as unsupported/stale according to projection-runtime policy.

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

AuthorizationContext is a claim presented to the owning domain, not a bypass token. Permission/grant validity must be checked at execution time. An AI/model cannot self-authorize canonical mutation.

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

Commands request change. They are not facts.

Idempotency rule: the same key represents the same logical mutation attempt. Reuse of a key with materially different command content must be rejected as a conflict rather than treated as an update.

The owning domain validates authorization, payload, preconditions, and domain semantics.

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

A true retry of the same idempotent command returns the same logical result and does not duplicate effects.

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

Publication reliability, transaction coupling, delivery semantics, and consumer idempotency belong to the Domain Protocol/System Architecture.

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

Measurements and reflections remain separate records. Free-form notes are excluded to avoid mixing reflection, observation, and factual session data.

If exact start/end timing and explicit duration are both present, the Practice domain must validate consistency or explicitly mark one representation as estimated/derived.

## Contract design rules

1. Do not add fields only because they may be useful someday.
2. Prefer explicit unknown/partial semantics over fake defaults.
3. Stable logical identity and immutable historical version identity are distinct.
4. Historical explainability permits explicit redaction/deletion states; it does not require indefinite content retention.
5. Separate occurrence, validity, planned, and record time when they differ.
6. Commands request; lived Events record occurrence; DomainChanges notify canonical state change.
7. `RecordRef` crosses boundaries; persistence ownership does not.
8. `EntityRef` is reserved for continuing identity.
9. Direction edges represent intentional structure; evidence represents epistemic bearing.
10. Evidence/provenance/derivation inputs use version-addressable lineage.
11. Correction lineage must be explainable without mandating full event sourcing.
12. Zero/absence claims require direct evidence or matching bounded coverage.
13. Derived descendants do not automatically create independent evidence mass.
14. Request origin and execution authorization are separate, and authorization is revalidated at execution.
15. Retry safety is a command-level concern; conflicting key reuse is rejected.
16. Direction intent state does not assert factual fulfillment.
17. Stale or invalidated projection inputs must not leave silently current projections.
