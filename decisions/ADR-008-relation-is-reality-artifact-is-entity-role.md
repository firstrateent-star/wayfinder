# ADR-008 — Relation Is a Reality Primitive; Artifact Is an Entity Role

**Status:** Accepted  
**Date:** 2026-09-14

## Context

Stress tests across ownership, employment, project membership, installed equipment, location, and relationships exposed a missing shared concept: durable factual relationships between continuing things.

At the same time, `Artifact` overlapped heavily with `Entity`. Songs, videos, documents, websites, photos, and proposals all have continuing identity and can be modeled as domain-specific Entity types.

## Decision

Add `Relation` as a canonical Reality primitive.

Remove `Artifact` as a separate root primitive. Treat artifact-like outputs as Entity roles/types owned by their domains.

## Consequences

- Wayfinder can model cross-entity truth without abusing Direction edges or free-form fields.
- Domains remain free to own relation storage and validation.
- The root ontology becomes smaller despite gaining an important missing distinction.
- Created outputs remain addressable and evidence-bearing without a duplicate primitive hierarchy.
