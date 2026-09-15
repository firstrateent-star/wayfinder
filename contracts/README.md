# Wayfinder Contracts

This directory will hold machine-readable contracts once the conceptual contracts are stable enough to encode.

Likely early contracts:

- EntityRef
- SourceRef
- Provenance
- Command
- DomainEvent
- DirectionNode
- DirectionEdge
- EvidenceLink
- Reflection
- Interpretation
- DomainModule

Do not generate production types simply because a concept appears in documentation. Promote contracts when the first executable vertical slice proves they are sufficiently stable.

The current conceptual source is `docs/03-object-contracts.md`.