# ADR-025 — Operational changes can reference unversioned records

**Status:** Accepted as Object Contract amendment  
**Scope:** CommandReceipt and ModuleChange operational contracts

## Context

The first executable database intentionally keeps `Practice` as an unversioned Entity because its name/description are display metadata and are not permitted to participate in durable evidence lineage in Slice 1A.

When designing the first command API, this exposed a mismatch: `CommandReceipt.affectedRefs` and `ModuleChange.affected[].ref` were typed only as `RecordVersionRef`. A command that creates an intentionally unversioned Practice still needs a durable retry result and a ModuleChange notification, but fabricating a fake version would incorrectly imply historical version-addressability.

## Decision

Operational result/change references use `RecordRef` as the minimum contract.

When the affected record is versioned, the producer SHOULD include the exact `RecordVersionRef` (the same object plus `version`). When a record is intentionally unversioned, the logical `RecordRef` is valid.

Conceptually:

```ts
interface CommandReceipt {
  commandId: string;
  status: "APPLIED" | "REJECTED" | "NOOP";
  processedAt: string;
  affectedRefs?: RecordRef[];
  errorCode?: string;
}

interface ModuleChange {
  // ...
  affected: Array<{
    operation: "CREATED" | "SUPERSEDED" | "RETRACTED";
    ref: RecordRef; // may additionally carry `version`
  }>;
}
```

## Boundary preserved

This amendment does **not** weaken evidence or provenance lineage.

Anything used as durable evidence, derivation ancestry, or historical explanation still requires an exact resolvable `RecordVersionRef` unless the record is immutable by definition.

`ModuleChange` is operational invalidation/change infrastructure, not evidence.

## Consequences

- Practice creation can return and publish its real logical reference without inventing a version.
- Versioned DirectionNode and PracticeSession changes still publish exact version ids.
- Consumers must not assume every ModuleChange affected ref is historically version-addressed.
- If Practice metadata later becomes evidence-bearing, Practice must be versioned through a deliberate migration rather than relying on this operational reference rule.
