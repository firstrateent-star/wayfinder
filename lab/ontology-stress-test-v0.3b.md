# Ontology Stress Test — v0.3b

**Date:** 2026-09-14  
**Purpose:** Fourth recursive pass after tightening object contracts. This pass is a stability/adversarial pass: try to force a root ontology change or expose a blocking contract contradiction.

---

## Adversarial set 1 — spontaneous reality

### Case
A person spontaneously goes for a walk without any prior Action, Plan, Quest, or goal.

### Expected
- walk occurred: Event
- route/distance: Observations
- later relation to Direction: optional Evidence
- no requirement to invent a prior Action

### Result
Pass. Direction is not required to legitimize reality.

---

## Adversarial set 2 — planned but never happened

### Case
A calendar says “dentist 2 PM.” No attendance confirmation exists.

### Expected
- appointment: Commitment/Plan with planned time
- no Event created by clock passage
- after the fact, status remains unknown unless user/source provides evidence

### Result
Pass. `planned != occurred` and bounded coverage remain intact.

---

## Adversarial set 3 — explicit non-occurrence

### Case
User explicitly says “I did not take the medication today.”

### Expected
- this may be stored as a direct Observation/assertion of non-occurrence with user provenance
- it is different from merely having no medication Event row

### Result
Pass. No new negative-event primitive required.

---

## Adversarial set 4 — conflicting sources

### Case
Sleep tracker estimates 5h 40m. User reports about 7h.

### Expected
- both Observations persist
- provenance identifies tracker vs user
- dispute may be represented without forcing one value
- a Projection may explain which source/rule it used

### Result
Pass.

---

## Adversarial set 5 — correction after derivation

### Case
A Practice Session was logged as 90 minutes, a weekly Metric used it, then the session was corrected to 60 minutes.

### Expected
- old lineage remains historically resolvable
- current Metric is recomputed
- prior cached projection may be invalidated/superseded
- no silent rewrite of historical explanation

### Result
Pass at semantic/contract level. Implementation must prove this with tests later.

---

## Adversarial set 6 — duplicated evidence descendants

### Case
One workout produces an Event, volume Metric, weekly Signal, and Pattern.

### Expected
A Growth/Character projection may consume useful derived summaries but cannot count the descendants as four independent pieces of lived evidence.

### Result
Pass by ancestry invariant.

---

## Adversarial set 7 — cross-domain graph misuse

### Case
A completed Practice Session is claimed to `SUPPORT` an Outcome.

### Expected
- Practice Session -> Outcome uses EvidenceLink
- Action -> Outcome may use DirectionEdge(SUPPORTS)
- Reality record must not enter Direction graph directly

### Result
Pass after `DirectionNodeRef` contract tightening.

---

## Adversarial set 8 — multi-domain failure isolation

### Case
Finance connector is unavailable while Practice and Relationships remain healthy.

### Expected
- Finance reads may report unknown/partial coverage
- no finance absence/zero claims are fabricated
- Practice and Relationships remain usable
- global Character/Helm projections must expose incomplete source coverage rather than treating Finance as zero

### Result
Pass conceptually. Domain readiness/fault isolation belongs to implementation architecture, not a new ontology primitive.

---

## Adversarial set 9 — privacy deletion vs lineage

### Case
User invokes an explicit privacy policy that requires deletion of a sensitive source record.

### Expected
- deletion policy may override retention
- affected evidence/projections become stale/unknown/recomputed
- Wayfinder does not pretend historical lineage still exists if policy intentionally removed it

### Result
Pass. Existing explicit-policy exception is sufficient.

---

## Adversarial set 10 — counterfactual contamination

### Case
AI simulates “what if I moved to New York?” and produces hypothetical budget, routine, and relationships.

### Expected
- scenario remains reasoning-layer data
- it does not create factual States/Relations/Events
- accepted pieces may later become Direction nodes through explicit action

### Result
Pass. No Scenario primitive required for first slice.

---

## Adversarial set 11 — approximate time

### Case
User says “I practiced guitar sometime Saturday night.”

### Expected
- Event may exist with approximate temporal precision
- UI must not display invented exact timestamp
- recorded_at remains exact even when occurrence time is approximate

### Result
Pass semantically. Exact temporal contract remains Candidate before implementation.

---

## Adversarial set 12 — same-world occurrence across domains

### Case
A wedding shoot is Work activity, Creative practice, and later generates Finance transactions.

### Expected
- no universal Event table is required
- domain records can share source/equivalence lineage or reference a canonical occurrence
- double-counting safeguards apply to evidence descendants

### Result
Pass. Identity resolution can remain Candidate.

---

## Stability result

No root category change.  
No root primitive change.  
No ontology wording change required.  
No blocking contract contradiction discovered.

The current ontology has now survived multiple recursive passes after its last material root-level change.

### Gate assessment

**Ontology stability gate: SATISFIED for first executable vertical slice.**

This does not freeze the ontology. It authorizes moving to the next design layer while preserving the recursive validation rule. Before database creation, exact object/temporal/command contracts should receive the same adversarial treatment, and after the first executable slice the ontology must be re-run against real implementation evidence.
