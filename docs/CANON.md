# Wayfinder Canon

**Foundation version:** 0.4  
**Status:** Active bootstrap canon  
**Purpose:** Define what Wayfinder currently depends on being true.

Wayfinder is an evidence-grounded personal life navigation operating system. It models a person's relationship with lived reality, chosen direction, commitments, action, evidence, interpretation, and growth over time.

The RPG is a representation layer. It is not the source of truth.

## Canon status vocabulary

- **CANONICAL** — architecture may depend on this.
- **CANDIDATE-STABLE** — repeatedly stress-tested and safe for the next layer to depend on provisionally, but still awaiting executable evidence before full Canon promotion.
- **CANDIDATE** — defined enough to test, but not yet stable.
- **EXPERIMENTAL** — intentionally open for exploration.
- **SUPERSEDED** — retained for reasoning history but no longer authoritative.

## Current registry

| Area | Status | Canon source |
|---|---|---|
| Constitution | CANONICAL | `00-constitution.md` |
| Root ontology v0.3 | CANONICAL / STABILITY GATE PASSED | `01-ontology.md` |
| System architecture v0.4 | CANDIDATE-STABLE / GATE PASSED | `02-system-architecture.md` |
| Object contracts v0.8 | CANDIDATE-STABLE / GATE PASSED | `03-object-contracts.md` |
| Stateful Module Protocol v0.4 | CANDIDATE-STABLE / GATE PASSED | `04-domain-protocol.md` |
| Intelligence runtime | EXPERIMENTAL | `05-intelligence-runtime.md` |
| Build roadmap | CANDIDATE | `06-build-roadmap.md` |
| Glossary | CANONICAL, update in progress with architecture vocabulary | `07-glossary.md` |
| Recursive validation loop | CANDIDATE | `08-validation-loop.md` |
| First executable vertical slice v0.2 | CANDIDATE-STABLE / GATE PASSED | `09-first-vertical-slice.md` |
| Character system | EXPERIMENTAL | Lab until evidence supports promotion |
| Archetypes | EXPERIMENTAL | Lab |
| Skills/mastery model | EXPERIMENTAL | Lab |
| Astrology | EXPERIMENTAL / domain candidate | Lab |
| Atlas/world model | EXPERIMENTAL | Lab |
| Agent autonomy | EXPERIMENTAL | Lab |

## Promotion path

Ideas move through:

`LAB → CANDIDATE → CANDIDATE-STABLE → CANON`

Promotion requires a written rationale, explicit trade-offs, no violation of accepted architectural invariants, and sufficient recursive validation for the scope of the change.

Executable evidence is preferred before promoting operational contracts from Candidate-Stable to Canon.

## Root definition

> Wayfinder turns lived reality into understandable state, intentional direction, meaningful action, evidence of change, and accumulated personal growth.

## Root laws

1. Reality comes before interpretation.
2. Unknown is not zero.
3. Planned is not happened.
4. AI is not authoritative over canonical reality.
5. Permanent growth requires evidence.
6. Derived state is disposable and reconstructable.
7. Meaning authored by the person is distinct from system interpretation.
8. Important derived conclusions must expose lineage.
9. Stateful modules own their canonical records; life domains own their factual reality.
10. The system models the person; it is not the person.

## Ontology decisions through v0.3

Stress testing established:

- `RecordRef` as universal logical address, with narrower `EntityRef` semantics;
- `Relation` as a Reality primitive;
- artifact-like outputs as Entity types rather than a separate root primitive;
- `Commitment` as a Direction primitive;
- multidimensional epistemic state;
- correction lineage without universal event sourcing;
- the Derived root centered on Projection, Metric, Signal, and Pattern;
- Growth, Momentum, Bearing, Mastery, Character, and Fulfillment as projection families rather than root truth;
- canonical records as model representations, not metaphysical certainty;
- provenance/source distinct from derivation mode;
- zero/absence claims requiring direct evidence or bounded source coverage;
- derived descendants not automatically becoming independent evidence.

See ADR-007 through ADR-015.

## Contract and architecture decisions after ontology stability

Recursive contract/system pressure further established:

- exact historical lineage uses `RecordVersionRef`, while `RecordRef` remains stable logical identity;
- owner scope is explicit and distinct from subject;
- commands separate requester from authorization and revalidate permission at execution;
- Command id is the retry/idempotency identity;
- version preconditions prevent silent lost updates;
- `ModuleChange` is change/invalidation infrastructure, not lived Event or automatic event-sourcing ledger;
- core canonical capabilities and life domains share the **Stateful Module** execution abstraction;
- Wayfinder starts as a modular monolith on one Postgres/Supabase database;
- canonical application mutation is command-only;
- transactional outbox couples canonical writes to durable ModuleChange publication;
- epistemic Coverage is source/phenomenon coverage, not mere query completeness.

See ADR-016 through ADR-021.

## Recursive validation evidence

Ontology:

- `lab/ontology-stress-test-v0.1.md`
- `lab/ontology-stress-test-v0.2.md`
- `lab/ontology-stress-test-v0.3.md`
- `lab/ontology-stress-test-v0.3b.md`

Object contracts:

- `lab/object-contract-stress-test-v0.4.md`
- `lab/object-contract-stress-test-v0.5.md`
- `lab/object-contract-stress-test-v0.6.md`
- `lab/object-contract-stress-test-v0.7.md`

Stateful Module Protocol:

- `lab/domain-protocol-stress-test-v0.1.md`
- `lab/domain-protocol-stress-test-v0.2.md`
- `lab/domain-protocol-stress-test-v0.3.md`

System architecture:

- `lab/system-architecture-stress-test-v0.2.md`
- `lab/system-architecture-stress-test-v0.3.md`
- `lab/system-architecture-stress-test-v0.4.md`

First executable vertical slice:

- `lab/first-vertical-slice-stress-test-v0.1.md`
- `lab/first-vertical-slice-stress-test-v0.2.md`

Repeated later passes stopped requiring new root ontology primitives and then stopped requiring blocking operational contract changes for Slice 1A.

## Current database readiness gate

### Status: **AUTHORIZED FOR PHYSICAL SCHEMA DESIGN — NOT YET FOR PRODUCTION CREATION**

The conceptual database gate is now satisfied for designing the first schema:

1. multiple ontology passes produced no new root category/primitive;
2. RecordRef/version/time/provenance/correction semantics are implementable enough to map;
3. command/write authority is unambiguous;
4. the first Practice life domain fits without changing unrelated ontology;
5. the first vertical slice has no unresolved semantic blocker.

The next step is to design the **minimal physical Postgres/Supabase schema**, Flower/stress-test that schema repeatedly, and only then create the new Wayfinder database/project.

Schema design is not permission to pre-build future tables.

## Change control

A change to Canon should either:

- update the relevant canonical document and add an ADR, or
- supersede an existing ADR with a new ADR.

Do not silently rewrite foundational reasoning.