# Wayfinder Architecture Invariants

**Version:** 0.2

These begin as written constraints and should progressively become executable tests.

## Truth and uncertainty

- [ ] Unknown must never silently become zero.
- [ ] Missing evidence must not silently become evidence of absence.
- [ ] A scheduled or planned record must not become factual solely because time passes.
- [ ] An interpretation must not silently become an observation or fact.
- [ ] A reflection must preserve authorship.
- [ ] Conflicting observations may coexist without forced resolution.
- [ ] Epistemic completeness, inference/basis, dispute, and confidence must not be collapsed into one certainty flag.
- [ ] Corrections must not erase provenance without an explicit retention/privacy policy.

## Domain boundaries

- [ ] A domain cannot directly mutate another domain's factual persistence.
- [ ] A domain can be unavailable without making unrelated domain truth unavailable.
- [ ] New domains integrate through registration/contracts rather than edits scattered across the core.
- [ ] Domain-specific asymmetry is allowed; domains are not forced to expose identical metrics or rewards.
- [ ] Shared references do not imply shared persistence ownership.

## References and relations

- [ ] `RecordRef` may address any Wayfinder record; `EntityRef` is reserved for continuing identity.
- [ ] A dangling cross-domain reference must be detectable.
- [ ] A factual Relation must not be silently treated as a Direction edge.
- [ ] A created output may be an Entity without requiring a separate Artifact root primitive.

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
- [ ] A record must not count as independent evidence for itself.
- [ ] Derived evidence/lineage must not contain circular self-support.
- [ ] Superseding or retracting an evidence source must trigger re-evaluation of dependent derived state.

## Direction

- [ ] One Action may support multiple Direction nodes.
- [ ] An Action is valid even when it has no goal ancestor.
- [ ] Completing an Action and achieving an Outcome remain distinct.
- [ ] Creating a Quest does not itself create evidence of growth.
- [ ] Commitment and Outcome remain distinct concepts.
- [ ] `PART_OF` and `DEPENDS_ON` cycles must be rejected or explicitly justified by the relation contract.

## Time

- [ ] Occurrence time and record time are distinct when both matter.
- [ ] Validity time and occurrence time are distinct when both matter.
- [ ] Planned time and occurred time are never treated as interchangeable.
- [ ] Approximate historical time must not be silently presented as exact.

## Corrections and lifecycle

- [ ] A corrected record may cease to be current without silently disappearing from required lineage.
- [ ] Full event sourcing is not required as long as correction/supersession lineage is preserved.
- [ ] Privacy/deletion policy may override retention only through an explicit rule.

## System humility

- [ ] The system can represent incomplete, disputed, stale, corrected, or contradictory understanding.
- [ ] Character and other RPG representations are projections, not identity truth.

## Test promotion rule

Whenever an invariant can be mechanically tested, add an automated test and reference that test here. Written-only invariants are a temporary bootstrap state, not the desired endpoint.
