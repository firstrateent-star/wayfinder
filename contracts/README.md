# Wayfinder Contracts

This directory is reserved for stable cross-runtime contract artifacts when they need a repository-level representation independent of a specific runtime.

Current conceptual source remains `docs/03-object-contracts.md` plus later architecture documents/ADRs.

The first executable intelligence-acquisition contracts are currently implemented code-first in:

```text
supabase/functions/_shared/intelligence/contracts.ts
```

Those contracts include:

- `KnowledgeQuery`
- `KnowledgeResolution`
- `InformationNeed`
- `QuestionSpec`
- `QuestionOpportunity`
- canonical/acquisition resolver contracts

They live with the server intelligence runtime for v0.1 so we do not create a second duplicated schema representation before the first real vertical slice stabilizes them.

Future repository-level contracts may include:

- EntityRef / RecordRef / RecordVersionRef
- SourceRef
- Provenance
- Command
- ModuleChange
- DirectionNode / DirectionEdge
- EvidenceLink
- Reflection / Interpretation
- StatefulModule
- Knowledge / Inquiry contracts once provider interoperability proves a need for language-neutral schemas

Do not generate additional contract formats merely because a concept appears in documentation. Promote or duplicate a contract only when another runtime, integration, or compatibility boundary actually needs that representation.
