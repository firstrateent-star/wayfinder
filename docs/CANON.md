# Wayfinder Canon

**Foundation version:** 0.6  
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
| Object contracts v0.9 | CANDIDATE-STABLE / GATE PASSED | `03-object-contracts.md` |
| Stateful Module Protocol v0.4 | CANDIDATE-STABLE / GATE PASSED | `04-domain-protocol.md` |
| Intelligence runtime | EXPERIMENTAL | `05-intelligence-runtime.md` |
| Build roadmap | CANDIDATE | `06-build-roadmap.md` |
| Glossary | CANONICAL, update in progress with architecture vocabulary | `07-glossary.md` |
| Recursive validation loop | CANDIDATE | `08-validation-loop.md` |
| First executable vertical slice v0.2 | CANDIDATE-STABLE / GATE PASSED | `09-first-vertical-slice.md` |
| Physical schema v0.5 | CANDIDATE-STABLE / PHYSICAL SCHEMA GATE PASSED | `10-physical-schema.md` |
| Database bootstrap v0.1 | DEPLOYED — NAMESPACE ONLY | `11-database-bootstrap.md` |
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
- material Command hashing uses deterministic canonical serialization;
- version preconditions prevent silent lost updates;
- known TemporalRanges use half-open `[start, end)` semantics;
- coarse occurrence uncertainty ranges do not imply actual event duration;
- `ModuleChange` is change/invalidation infrastructure, not lived Event or automatic event-sourcing ledger;
- core canonical capabilities and life domains share the **Stateful Module** execution abstraction;
- Wayfinder starts as a modular monolith on one Postgres/Supabase database;
- canonical application mutation is command-only;
- transactional outbox couples canonical writes to durable ModuleChange publication;
- epistemic Coverage is source/phenomenon coverage, not mere query completeness;
- Wayfinder may share the existing `vlourish` Supabase physical host while preserving canonical isolation in dedicated `wf_*` schemas.

See ADR-016 through ADR-024.

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

Physical schema:

- `lab/physical-schema-stress-test-v0.1.md`
- `lab/physical-schema-stress-test-v0.2.md`
- `lab/physical-schema-stress-test-v0.3.md`
- `lab/physical-schema-stress-test-v0.4.md`
- `lab/physical-schema-stress-test-v0.5.md`

The final physical-schema confirmation pass required no new table family, stateful module, root ontology primitive, or blocking topology change.

## Supabase state

### Status: **WAYFINDER NAMESPACE BOOTSTRAPPED INSIDE `vlourish`**

The user chose to colocate Wayfinder in the existing `vlourish` Supabase project instead of creating another project.

Deployed top-level schemas:

- `wf_system`
- `wf_direction`
- `wf_practice`
- `wf_evidence`

The bootstrap migration revoked schema privileges from `public`, `anon`, and `authenticated` and created no canonical tables.

Migration source:

`supabase/migrations/20260915044820_bootstrap_wayfinder_namespaces.sql`

See `11-database-bootstrap.md` and ADR-024.

Security/performance advisors were run after bootstrap. No advisor findings concern the empty `wf_*` namespaces; existing notices relate to pre-existing `vl_*` schemas/configuration.

## Current database gate

### Status: **AUTHORIZED TO DESIGN + REVIEW SLICE 1A TABLE MIGRATION — NOT YET AUTHORIZED TO APPLY IT**

Next:

1. write executable SQL for the ten-table first-slice model;
2. recursively review the SQL itself;
3. verify FK/DEFERRABLE constraints and lifecycle triggers;
4. verify auth/RPC/security-definer boundaries and cross-owner isolation;
5. verify command idempotency/concurrency and Evidence resolution;
6. only then apply the first canonical Wayfinder table migration.

Still not authorized:

- speculative future tables;
- Character/XP/skills/calendar/AI infrastructure;
- frontend direct canonical-table mutation;
- hidden dependencies on `vl_*` canonical tables.

After the first table migration is applied, run Supabase security/performance advisors again and convert written invariants into executable database tests.

## Change control

A change to Canon should either:

- update the relevant canonical document and add an ADR, or
- supersede an existing ADR with a new ADR.

Do not silently rewrite foundational reasoning.
