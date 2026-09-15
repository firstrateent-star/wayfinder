# Projection Read Stress Test — v0.1

**Targets:** Action Fulfillment v0, Bearing v0, Helm v0  
**Result:** stable enough to implement as on-demand read projections; no new table or ontology primitive required

## Flower center

Can Wayfinder answer “what evidence do I currently have that I moved toward an intended action, and what direction does that movement structurally support?” without turning absence of records into absence of life activity, or turning evidence into proof?

## Action Fulfillment v0

Action Fulfillment remains a **Projection**, never a canonical field such as `completed=true`.

The projection resolves the owner's current exact Action version and active EvidenceLinks whose target aspect is `fulfillment`.

For Slice 1A, only SUPPORTS links from exact PracticeSession versions qualify as positive fulfillment evidence.

Three useful states survive pressure:

- `CURRENT_EVIDENCE_PRESENT` — at least one active fulfillment link points from the current ACTIVE version of its PracticeSession to the current Action version;
- `STALE_RECORDED_EVIDENCE_ONLY` — fulfillment links exist historically for the current Action version, but none currently qualify because their source versions are stale/non-current;
- `NO_RECORDED_EVIDENCE` — no active stored fulfillment EvidenceLink exists for the current Action version.

None of these states means “the action definitely happened” or “the action definitely did not happen.”

The projection must expose qualifying and stale counts plus explicit epistemic coverage `UNKNOWN` for complete lived-reality fulfillment evidence.

## Bearing v0

Do **not** create a progress score or percentage. A ratio of evidenced actions to active actions would be easy to misread as percentage of life progress.

Bearing v0 is an explainable directional projection over current ACTIVE Action intentions:

- `NO_ACTIVE_ACTIONS` — no current Action has `intent_state=ACTIVE`;
- `RECORDED_EVIDENCE_OF_MOVEMENT` — at least one current active Action has current qualifying fulfillment evidence;
- `NO_RECORDED_EVIDENCE_OF_MOVEMENT` — active Actions exist, but none have current qualifying fulfillment evidence.

The last state must not be interpreted as “no movement occurred.”

For each evidenced Action, Bearing may expose current active Direction `SUPPORTS` targets. An evidenced Action with no graph target is still valid and is not penalized; actions are allowed to exist without ancestors.

Bearing therefore reports:

- active action count;
- evidenced active action count;
- stale-evidence-only action count;
- evidenced actions and their structural SUPPORTS targets;
- epistemic coverage UNKNOWN for complete lived movement.

## Helm v0

Helm is a **composed read**, not a new truth store.

For an explicit half-open time window supplied by the caller, Helm v0 composes:

- current Direction graph;
- Bearing v0;
- recent current PracticeSessions for the supplied range;
- lightweight active Action focus derived from Bearing.

It must preserve each component's coverage semantics rather than flatten them into one false “complete” status.

No Helm table, Bearing table, Fulfillment table, cache, background worker, or XP mutation is justified for Slice 1A.

## Attacks

1. **No Action exists** → Bearing says NO_ACTIVE_ACTIONS, not failure.
2. **Action exists, no EvidenceLink** → Fulfillment says NO_RECORDED_EVIDENCE; Bearing says NO_RECORDED_EVIDENCE_OF_MOVEMENT.
3. **Current Evidence exists** → Fulfillment says CURRENT_EVIDENCE_PRESENT; Bearing reports recorded evidence of movement.
4. **Source session corrected** → link remains historical, Fulfillment becomes STALE_RECORDED_EVIDENCE_ONLY, Bearing no longer counts it as current movement.
5. **Action has no Direction parent** → evidence still counts for the Action; no structural target is simply reported.
6. **Other owner supplies Action id** → ACTION_NOT_FOUND; no cross-owner inference.
7. **Practice read is truncated** → Helm preserves result PARTIAL separately from epistemic UNKNOWN.
8. **Empty Practice window** → Helm may say no stored sessions in the window but never says the person did not practice.
9. **Projection rule changes later** → no canonical history rewrite because all three are computed on demand.
10. **Frontend disappears** → projection logic still exists server-side and canonical facts remain intact.

## Gate

Implement these as authenticated read RPCs only, then rerun current/stale/no-evidence/owner-isolation/Helm-composition tests against live Postgres before promoting the projection read gate.
