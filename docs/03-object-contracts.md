# Wayfinder Object Contracts

**Version:** 0.1  
**Status:** CANDIDATE

These are conceptual contracts. They are intentionally not yet production TypeScript or SQL.

## EntityRef

```ts
interface EntityRef {
  domain: string;
  type: string;
  id: string;
}
```

Purpose: stable cross-domain reference without universal ownership.

## SourceRef

```ts
interface SourceRef {
  sourceType: string;
  sourceId?: string;
  externalRecordId?: string;
}
```

## Provenance

```ts
interface Provenance {
  source: SourceRef;
  recordedAt: string;
  actorRef?: EntityRef;
  certainty?: "KNOWN" | "PARTIAL" | "UNKNOWN" | "INFERRED" | "DISPUTED";
  revision?: number;
  derivedFrom?: EntityRef[];
  ruleVersion?: string;
}
```

## DirectionNode

```ts
type DirectionKind =
  | "value"
  | "direction"
  | "outcome"
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
  from: EntityRef;
  to: EntityRef;
  relation: DirectionRelation;
  createdAt: string;
  provenance: Provenance;
}
```

## EvidenceLink

```ts
interface EvidenceLink {
  id: string;
  source: EntityRef;
  target: EntityRef;
  relation: "SUPPORTS" | "WEAKENS" | "CONTRADICTS" | "QUALIFIES" | "RELATES_TO";
  confidence?: number;
  reason?: string;
  createdAt: string;
  provenance: Provenance;
}
```

EvidenceLink expresses bearing, not absolute proof.

## Reflection

```ts
interface Reflection {
  id: string;
  subject?: EntityRef;
  body: string;
  authoredAt: string;
  authorRef: EntityRef;
  provenance: Provenance;
}
```

## Interpretation

```ts
interface Interpretation {
  id: string;
  subject: EntityRef;
  body: string;
  interpretationType: "hypothesis" | "interpretation";
  evidenceRefs: EntityRef[];
  certainty: "PARTIAL" | "INFERRED" | "DISPUTED";
  confidence?: number;
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
  requestedBy: EntityRef;
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
  subject: EntityRef;
  occurredAt: string;
  recordedAt: string;
  payload: TPayload;
  provenance: Provenance;
}
```

A DomainEvent represents something accepted by the owning domain as having occurred.

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
2. Prefer explicit null/unknown semantics over fake defaults.
3. Separate occurrence time from record time.
4. Preserve provenance at canonical boundaries.
5. Commands request; domain events assert accepted occurrence.
6. References cross domains; persistence ownership does not.