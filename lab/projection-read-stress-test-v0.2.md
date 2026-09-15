# Projection Read Stress Test — v0.2

**Input:** live PostgreSQL PASS for Action Fulfillment v0.1, Bearing v0.1, Helm v0.1  
**Result:** topology holds; two explainability/current-direction refinements required

The first executable pass proved no-evidence, current-evidence, stale-evidence, owner-isolation, and Helm composition behavior. A second Flower pass then attacked the *meaning* of the successful output rather than whether SQL executed correctly.

## 1. Bearing claims movement but did not expose exact supporting lineage

`wf_action_fulfillment_v0` already returns exact qualifying EvidenceLink and PracticeSession version refs.

`wf_bearing_v0` initially reduced that to counts. That makes its aggregate state explainable only by re-running hidden query logic, which is weaker than Wayfinder's accepted lineage invariant.

**Refinement:** each Bearing action entry with current qualifying evidence must expose exact qualifying lineage refs. Bearing remains ephemeral, but a user/Navigator can inspect why it said recorded evidence of movement.

No projection table or lineage manifest is needed at this scale.

## 2. Structural SUPPORTS targets must distinguish current intention from merely current record

A Direction target may have an ACTIVE record lifecycle while its `intent_state` is PAUSED or WITHDRAWN.

Bearing is defined around *current intentions*, so presenting a paused/withdrawn target as a current movement target can mislead even though the graph edge is historically/structurally valid.

**Refinement:** Bearing v0 `supports_targets` includes only targets whose current version is lifecycle ACTIVE **and** `intent_state=ACTIVE`. The raw Direction graph continues to expose the structural edge independently.

## 3. State names survive another pass

- `NO_ACTIVE_ACTIONS`
- `RECORDED_EVIDENCE_OF_MOVEMENT`
- `NO_RECORDED_EVIDENCE_OF_MOVEMENT`

These remain preferable to a score or progress percentage because they describe the evidence state without pretending to quantify the person's life progress.

## 4. Stale evidence behavior survives

A corrected PracticeSession causes prior exact Evidence to stop counting as current movement while remaining historically explainable. This is the desired behavior.

## 5. Helm composition survives

Helm should preserve nested coverage and lineage rather than synthesize a false universal certainty flag. No new Helm persistence is justified.

## Required change

Revise Bearing v0 to:

1. include exact qualifying EvidenceLink + PracticeSession version lineage per active Action;
2. filter displayed SUPPORTS targets to current versions whose intent state is ACTIVE;
3. rerun the projection integration test.

If that pass succeeds without a new structural finding, Projection Read Gate may pass.
