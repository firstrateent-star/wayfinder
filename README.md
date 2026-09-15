# Wayfinder

An evidence-grounded personal life navigation operating system built around reality, direction, growth, and adaptive intelligence.

Wayfinder models a person's relationship with lived reality over time: what exists, what happens, what is observed, what is intended, what evidence supports change, what meaning is authored or inferred, and how growth is represented.

The RPG layer is an experience and projection layer. It is not the source of truth.

## Foundation status

Current foundation: **v0.1**

Wayfinder is being rebuilt from first principles. The previous Wayfinder implementation is reference material only; this repository does not inherit its architecture, schema, compatibility constraints, or migration requirements.

## Root loop

```text
LIVED REALITY
    ↓
OBSERVATION / EVENTS
    ↓
EVIDENCE
    ↓
UNDERSTANDING
    ↓
DIRECTION
    ↓
ACTION
    ↓
OUTCOME / NEW REALITY
    ↓
REFLECTION / GROWTH
    ↺
```

## Canonical principles

- Reality comes before interpretation.
- Unknown is not zero.
- Planned is not happened.
- AI is non-authoritative over canonical reality.
- Permanent growth requires evidence.
- Derived state is reconstructable.
- Meaning authored by the person remains distinct from system interpretation.
- Important conclusions should expose lineage.
- Domains own their reality.
- The system models the person; it is not the person.

See [`docs/CANON.md`](docs/CANON.md) and [`docs/00-constitution.md`](docs/00-constitution.md).

## Repository structure

```text
docs/        Canon, ontology, architecture, contracts, protocol, runtime, roadmap
decisions/   Architecture Decision Records (ADRs)
invariants/  Architectural promises that should become executable tests
lab/         Experimental ideas that are not yet Canon
contracts/   Future machine-readable contracts
```

## Development model

Ideas move through:

```text
LAB → CANDIDATE → CANON
```

Implementation should move through complete vertical slices rather than broad unfinished subsystems.

The first planned proving slice is a small **Practice** domain connected to Direction, Evidence, Journey, Helm, and Navigator reasoning.

## What is intentionally not being built yet

The foundation does not yet assume a final Character system, archetype engine, astrology engine, Atlas/world model, universal skill taxonomy, complex scheduling system, or autonomous agent model.

Those ideas remain available for exploration without becoming accidental architecture.
