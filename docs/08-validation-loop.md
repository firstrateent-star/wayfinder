# Wayfinder Validation Loop

**Version:** 0.1  
**Status:** CANDIDATE

Wayfinder does not treat architecture review as a one-time phase. Every meaningful ontology or contract change re-enters a recursive validation loop before implementation depends on it.

## Recursive validation cycle

1. **Semantic minimality** — does every shared primitive represent a real distinction, or is it redundant?
2. **Scenario pressure** — apply the ontology to very different lived-life cases.
3. **Epistemic pressure** — test unknown, partial, conflicting, inferred, and corrected information.
4. **Temporal pressure** — test planned, occurred, recorded, valid, approximate, and corrected time.
5. **Graph pressure** — test cycles, contradictory links, stale references, many-to-many relationships, and lineage.
6. **Authority pressure** — confirm AI, UI, imports, and automations cannot bypass ownership/authorization rules.
7. **Expansion pressure** — test likely future domains without designing them prematurely.
8. **Implementation economy** — ask whether the ontology can be implemented simply enough to get a working vertical slice early.
9. **Re-run** — repeat after accepted changes rather than assuming the changes solved the problem.

## Flower framing

Each cycle may be framed as:

`CENTER ↔ BOUNDARY ↔ CONTEXT ↔ UNKNOWN ↔ DIRECTION ↔ PRACTICE ↔ EVIDENCE ↔ REFLECTION ↔ EXPANSION`

The runtime is recursive, not a mandatory linear checklist. A contradiction discovered in Evidence may reopen Context, Boundary, or the Center itself.

## Promotion gate

A Candidate ontology/contract change should not become implementation dependency until:

- it survives heterogeneous scenario testing;
- it does not violate canonical invariants;
- simpler existing concepts cannot represent it accurately;
- its cross-domain value is demonstrated;
- its implementation cost is proportionate to its value.

## Database gate

Before first database design, require:

1. two consecutive full ontology passes with no new root category required;
2. no unresolved semantic contradiction in the first vertical slice;
3. universal references, time semantics, provenance, and correction semantics defined well enough to implement;
4. the first domain can be added without modifying unrelated ontology;
5. the command/write authority boundary is unambiguous.

This gate does not mean the ontology is finished. It means it is stable enough to learn from executable reality.

## Post-build recurrence

Re-run the same validation loop:

- after the first executable kernel;
- after the first complete vertical slice;
- before adding each materially different domain;
- after a domain exposes a new architectural contradiction;
- before promoting a major Candidate into Canon;
- before large schema migrations.

The goal is not to freeze Wayfinder. The goal is to keep expansion from silently eroding the architecture.
