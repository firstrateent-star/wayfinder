# Wayfinder Canon

**Foundation version:** 0.2  
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
| Root ontology v0.2 | CANONICAL | `01-ontology.md` |
| System architecture v0.2 | CANDIDATE | `02-system-architecture.md` |
| Object contracts v0.2 | CANDIDATE | `03-object-contracts.md` |
| Domain protocol | CANDIDATE | `04-domain-protocol.md` |
| Intelligence runtime | EXPERIMENTAL | `05-intelligence-runtime.md` |
| Build roadmap | CANDIDATE | `06-build-roadmap.md` |
| Glossary v0.2 | CANONICAL | `07-glossary.md` |
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

Stress testing of v0.1 promoted the following into Canon:

- `RecordRef` is the universal cross-record address; `EntityRef` is narrower.
- `Relation` is a Reality primitive.
- artifact-like outputs are Entity types rather than a separate root primitive.
- `Commitment` is a Direction primitive.
- epistemic state is multidimensional rather than a single certainty ladder.
- corrections preserve lineage without forcing universal event sourcing.

See ADR-007 through ADR-011.

## Database readiness gate

Wayfinder is not yet authorized to design persistence merely because the ontology exists.

Before the first database schema, the ontology/contracts should survive at least two consecutive full validation passes without requiring a new root category and without leaving an unresolved contradiction that blocks the first vertical slice.

See `08-validation-loop.md`.

## Change control

A change to Canon should either:

- update the relevant canonical document and add an ADR, or
- supersede an existing ADR with a new ADR.

Do not silently rewrite foundational reasoning.
