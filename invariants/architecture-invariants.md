# Wayfinder Architecture Invariants

**Version:** 0.1

These begin as written constraints and should progressively become executable tests.

## Truth and uncertainty

- [ ] Unknown must never silently become zero.
- [ ] Missing evidence must not silently become evidence of absence.
- [ ] A scheduled or planned record must not become factual solely because time passes.
- [ ] An interpretation must not silently become an observation or fact.
- [ ] A reflection must preserve authorship.
- [ ] Corrections must not erase provenance without an explicit retention policy.

## Domain boundaries

- [ ] A domain cannot directly mutate another domain's factual persistence.
- [ ] A domain can be unavailable without making unrelated domain truth unavailable.
- [ ] New domains integrate through registration/contracts rather than edits scattered across the core.
- [ ] Domain-specific asymmetry is allowed; domains are not forced to expose identical metrics or rewards.

## Commands and authority

- [ ] AI cannot directly establish canonical reality.
- [ ] Canonical mutation must pass through an authorized command and owning-domain validation.
- [ ] Retried commands with an idempotency key must not create duplicate facts.
- [ ] Read-only reasoning paths must not create writes.

## Evidence and derivation

- [ ] Permanent growth requires qualifying evidence.
- [ ] Important derived claims can expose supporting evidence lineage.
- [ ] A projection can be rebuilt without deleting lived history.
- [ ] Changing a projection rule must not silently rewrite canonical history.
- [ ] Confidence must not be presented as objective truth.

## Direction

- [ ] One Action may support multiple Direction nodes.
- [ ] An Action is valid even when it has no goal ancestor.
- [ ] Completing an Action and achieving an Outcome remain distinct.
- [ ] Creating a Quest does not itself create evidence of growth.

## Time

- [ ] Occurrence time and record time are distinct when both matter.
- [ ] Planned time and occurred time are never treated as interchangeable.

## System humility

- [ ] The system can represent incomplete, disputed, stale, or corrected understanding.
- [ ] Character and other RPG representations are projections, not identity truth.

## Test promotion rule

Whenever an invariant can be mechanically tested, add an automated test and reference that test here. Written-only invariants are a temporary bootstrap state, not the desired endpoint.