# Wayfinder Canon

**Foundation version:** 0.3  
**Status:** Active bootstrap canon  
**Purpose:** Define what Wayfinder currently depends on being true.

Wayfinder is an evidence-grounded personal life navigation operating system. It models a person's relationship with lived reality, chosen direction, commitments, action, evidence, interpretation, and growth over time.

The RPG is a representation layer. It is not the source of truth.

## Canon status vocabulary

- **CANONICAL** — architecture may depend on this.
- **CANDIDATE** — defined enough to test, but not yet foundational.
- **EXPERIMENTAL** — intentionally open for exploration.
- **SUPERSEDED** — retained for reasoning history but no longer authoritative.

## Current registry

| Area | Status | Canon source |
|---|---|---|
| Constitution | CANONICAL | `00-constitution.md` |
| Root ontology v0.3 | CANONICAL / STABILITY GATE PASSED | `01-ontology.md` |
| System architecture v0.2 | CANDIDATE | `02-system-architecture.md` |
| Object contracts v0.4 | CANDIDATE | `03-object-contracts.md` |
| Domain protocol | CANDIDATE | `04-domain-protocol.md` |
| Intelligence runtime | EXPERIMENTAL | `05-intelligence-runtime.md` |
| Build roadmap | CANDIDATE | `06-build-roadmap.md` |
| Glossary v0.3 | CANONICAL | `07-glossary.md` |
| Recursive validation loop | CANDIDATE | `08-validation-loop.md` |
| Character system | EXPERIMENTAL | Lab until evidence supports promotion |
| Archetypes | EXPERIMENTAL | Lab |
| Skills/mastery model | EXPERIMENTAL | Lab |
| Astrology | EXPERIMENTAL / domain candidate | Lab |
| Atlas/world model | EXPERIMENTAL | Lab |
| Agent autonomy | EXPERIMENTAL | Lab |

## Promotion path

Ideas move through:

`LAB → CANDIDATE → CANON`

Promotion requires a written rationale, explicit trade-offs, no violation of accepted architectural invariants, and sufficient recursive validation for the scope of the change.

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
9. Domains own their reality.
10. The system models the person; it is not the person.

## v0.2 ontology decisions

Stress testing of v0.1 promoted:

- `RecordRef` as the universal cross-record address, with narrower `EntityRef` semantics;
- `Relation` as a Reality primitive;
- artifact-like outputs as Entity types rather than a separate root primitive;
- `Commitment` as a Direction primitive;
- multidimensional epistemic state;
- correction lineage without universal event sourcing.

See ADR-007 through ADR-011.

## v0.3 ontology decisions

The second recursive pass further established:

- the Derived root is `Projection`, `Metric`, `Signal`, and `Pattern`; specific systems such as Growth, Momentum, Bearing, Mastery, and Character are projection families;
- canonical factual records are model representations, not metaphysical certainty;
- provenance/source is distinct from derivation mode;
- zero/absence claims require direct evidence or bounded coverage;
- derived descendants do not automatically become independent evidence;
- RecordRef namespace/type identifiers are stable machine keys rather than display labels.

See ADR-012 through ADR-015.

## Ontology stability evidence

The recursive stress-test trail is preserved in:

- `lab/ontology-stress-test-v0.1.md`
- `lab/ontology-stress-test-v0.2.md`
- `lab/ontology-stress-test-v0.3.md`
- `lab/ontology-stress-test-v0.3b.md`

The latest pass produced no root category change, no root primitive change, and no required ontology wording change.

**Ontology stability gate is satisfied for the first executable vertical slice.**

This is an authorization to continue designing, not a declaration that ontology can never change.

## Database readiness gate

The database is **not yet authorized**.

Ontology is stable enough to proceed, but Object Contracts remain Candidate. Before persistence design, the current contract set must receive the same adversarial/recursive treatment, especially:

- temporal representation;
- historical RecordRef resolution;
- correction lifecycle;
- Direction-node lifecycle;
- bounded coverage;
- command idempotency/authorization;
- projection/evidence lineage.

After that contract pass, we can decide whether the first minimal schema is justified.

See `08-validation-loop.md`.

## Change control

A change to Canon should either:

- update the relevant canonical document and add an ADR, or
- supersede an existing ADR with a new ADR.

Do not silently rewrite foundational reasoning.
