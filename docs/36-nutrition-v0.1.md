# Nutrition v0.1 — Canonical Intake Domain

Nutrition v0.1 gives Wayfinder a canonical owner for **consumed food and drink**.

## Boundary

Nutrition owns:

- player-consumed `MEAL` and `FOOD_INTAKE` occurrences;
- explicit food/item detail;
- explicitly supplied calories, protein, carbohydrates, and fat;
- precision attached to supplied quantities and nutrition totals.

Nutrition does **not** own:

- food acquisition by itself;
- a purchase/order/pickup that does not establish consumption;
- inferred calories or macros from general food knowledge;
- planned/future meals as occurred intake;
- third-party intake as player reality;
- skipped/negated meals as consumed intake.

Core rule:

```text
FOOD_ACQUISITION != FOOD_INTAKE
unknown nutrition != zero
unstated nutrition != estimated nutrition
```

## Canonical storage

Private schema:

```text
wf_nutrition
  intakes
  intake_versions
  intake_items
```

Intake versions are immutable historical payloads with a current-version head, following the same Wayfinder version/head architecture used by other canonical domains.

Nutrition totals are nullable. A numeric total is stored only with a precision:

```text
EXACT
APPROXIMATE
UNKNOWN
```

`UNKNOWN` precision means a supplied numeric value exists but its precision was not safely established. It does not authorize Wayfinder to calculate missing nutrition.

## Public contracts

Write:

```text
wf_nutrition_capture_intake
```

Read:

```text
wf_nutrition_recent_v0
```

The read distinguishes result coverage from lived-reality epistemic coverage. Stored intake history never means Wayfinder knows everything the player ate.

## Semantic path

```text
PLAYER_TEXT
  -> Semantic Reasoner
  -> CandidateLifeGraph
  -> semantic safety normalization
  -> Capacity
  -> Admission Planner
  -> Nutrition Fulfillment
  -> expiring opaque proposal
  -> explicit player confirmation
  -> Nutrition AdmissionContract
  -> wf_nutrition_capture_intake
  -> canonical intake
  -> nutrition.intake_captured ModuleChange
```

`MEAL` inherits the `FOOD_INTAKE` persistence route. `FOOD_ACQUISITION` deliberately has no Nutrition persistence route.

## Navigator context

`wf_nutrition_recent_v0` is available through the bounded Navigator canonical context provider for matching food/intake concepts. Missing history remains epistemically unknown.

This supports repeat language such as “my usual breakfast” without exposing a universal life dump.

## Gates

Deterministic gates cover:

- consumed meal -> Nutrition;
- food acquisition -> no Nutrition persistence;
- skipped meal -> no player intake proposal;
- third-party meal -> no player intake proposal;
- partial meal with unknown item detail;
- missing occurrence -> clarification;
- explicit nutrition precision preservation;
- no macro estimation;
- staged authorization reruns the owning AdmissionContract;
- canonical Nutrition context reads remain bounded.

Live-model gates cover:

- explicit consumption routes to Nutrition;
- acquisition alone does not route to Nutrition;
- acquisition plus explicit eating remains consumptive;
- adversarial skipped/acquisition cases cannot reach canonical Nutrition.
