# Ontology Stress Test — v0.2

**Date:** 2026-09-14  
**Purpose:** Re-run the full ontology pressure cycle after the v0.1 findings were promoted.

This is the required recursive pass after change. It deliberately tries to break the revised ontology rather than confirm it.

---

## Pass A — Model humility

### Pressure
The root category is called `REALITY`, but Wayfinder never possesses reality itself. It possesses records, observations, accepted domain assertions, and interpretations about lived reality.

### Risk
Calling a domain-accepted Event or State “reality” can quietly turn canonical storage into metaphysical truth, contradicting the root law that the model is not the person or the world.

### Resolution
Keep `REALITY` as the conceptual category, but make the semantic rule explicit:

> A canonical factual record is Wayfinder's current accepted representation of reality, not reality itself and not proof of certainty.

`canonical` means authoritative *inside the model*, subject to provenance, correction, dispute, and incomplete knowledge.

No new primitive required.

---

## Pass B — Derived-layer minimality

### Pressure
Ontology v0.2 lists `Growth`, `Momentum`, `Bearing`, `Mastery`, and `Character` as root Derived primitives even though some are explicitly Candidate or Experimental elsewhere in Canon.

### Failure
The root ontology should not canonize specific product projections merely because they are currently appealing. It also omits the generic concept `Projection`, even though the architecture relies on it heavily.

### Resolution
Make the canonical Derived vocabulary:

- Projection
- Metric
- Signal
- Pattern

Treat Growth, Momentum, Bearing, Mastery, Character, Balance, and similar concepts as named projection families with independent maturity states.

This reduces ontology surface area while preserving room for the RPG.

No new root category required.

---

## Pass C — Epistemic orthogonality, again

### Pressure
The v0.2 `basis` axis used `OBSERVED | REPORTED | DERIVED | INFERRED`.

### Failure
`REPORTED` describes where a claim came from, while `INFERRED` describes how a conclusion was formed. A user can report an inference. A sensor observation can be imported through a connector. The axis is still mixing provenance and reasoning mode.

### Resolution
Move channel/origin detail entirely into Provenance/Source.

Use epistemic derivation mode:

- `DIRECT`
- `DERIVED`
- `INFERRED`

Keep completeness, dispute, and optional confidence orthogonal.

This is a refinement of ADR-009, not a reversal.

---

## Pass D — Absence and zero

### Pressure
How does Wayfinder truthfully say “no spending happened”, “no workout occurred”, or “zero messages arrived”?

### Failure mode
The absence of records cannot establish zero unless Wayfinder knows the relevant source/time/domain coverage is sufficiently complete.

### Resolution
Introduce a contract-level concept of **bounded coverage** without promoting a new root primitive.

A collection/read may report completeness for a defined scope. Explicit negative/zero claims require either:

1. direct evidence of absence, or
2. sufficiently complete bounded coverage from which absence can be derived.

This makes `unknown != zero` executable later rather than rhetorical.

---

## Pass E — Evidence independence

### Pressure
A workout Event can produce a volume Metric and a training Signal. If all three support Growth, a naive evidence engine may count the same underlying reality three times.

### Failure mode
Derived records can create artificial evidence mass and self-reinforcing conclusions.

### Resolution
Evidence lineage must preserve ancestry. Derivations may summarize or transform source evidence but do not become independent evidence merely by being derived.

A reasoning/projection rule that combines evidence must be able to detect overlapping lineage when independence matters.

No new root primitive required.

---

## Pass F — Stable references

### Pressure
`RecordRef` uses `namespace`, `type`, and `id`.

### Risk
If namespace/type are display labels or freely renamed strings, references are not actually stable.

### Resolution
`namespace` and `type` are stable machine identifiers, not display names. Renaming a UI label must not change a RecordRef. Breaking identifier migrations require explicit mapping/supersession.

No new primitive required.

---

## Pass G — Cross-domain same-world occurrence

### Pressure
A real-world occurrence may matter to several domains. Example: a paid wedding shoot affects Work, Finance, Creative practice, and relationships.

### Failure mode
A universal Event table would over-centralize domains. Blind duplication would lose shared identity and may double-count evidence.

### Resolution
Do not add a universal event store. One domain may own a canonical occurrence while others reference it, or domains may own distinct records that retain shared source/equivalence lineage. Identity resolution remains a Candidate capability.

No new root primitive required.

---

## Pass H — Counterfactuals and AI reasoning

### Pressure
“What if I moved cities?”, “What if I stopped wedding work?”, and simulated plans produce objects that look like future state.

### Resolution
Counterfactual/scenario state must never enter canonical Reality by accident. It remains reasoning-layer or experimental Scenario data until explicitly converted into Direction or commands.

No new primitive required.

---

## Pass I — Re-run scenario suite

Re-tested:

- workout
- meal/nutrition logging
- sleep tracker disagreement
- health measurement
- prescription/medication schedule
- bank transaction
- invoice and contractual deadline
- friend conversation
- family commitment
- wedding film project
- music practice
- song idea
- tarot reading
- boat ownership/location/repair
- weather/tide observations
- calendar appointment
- travel plan
- possession/inventory
- place/world context
- future goal
- recurring maintenance
- AI suggestion
- correction of a previously accepted record

### Result
No new root category and no new Reality or Direction primitive was required.

The remaining changes are simplifications/refinements of Derived and Epistemic semantics plus contract-level coverage/lineage rules.

---

## Stability signal

This is the second consecutive full pass in which no new root category was required.

However, the ontology changed internally enough that one more recursive pass should occur after promotion before the database gate is considered satisfied.
