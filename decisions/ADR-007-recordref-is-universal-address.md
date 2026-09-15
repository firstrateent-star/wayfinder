# ADR-007 — RecordRef Is the Universal Address

**Status:** Accepted  
**Date:** 2026-09-14

## Context

Ontology v0.1 used `EntityRef` as the shared pointer for cross-domain links. Stress testing showed that evidence, provenance, reflections, interpretations, direction edges, and derivations often need to reference records that are not Entities.

Using `EntityRef` universally would make the type system semantically false.

## Decision

Introduce `RecordRef` as the universal address for any Wayfinder-addressable record.

`EntityRef` remains a narrower semantic reference used only when the referenced thing has continuing identity.

Conceptually:

```ts
interface RecordRef {
  namespace: string;
  type: string;
  id: string;
}
```

## Consequences

- Cross-domain references no longer imply universal persistence.
- Evidence and provenance can reference Events, Observations, Direction nodes, projections, and other records honestly.
- Domains remain responsible for resolving records they own.
- Dangling-reference detection becomes an implementation requirement.
