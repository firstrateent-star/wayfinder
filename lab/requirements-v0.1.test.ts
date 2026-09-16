import { evaluateRequirement, type RequirementSpec } from "../supabase/functions/_shared/intelligence/requirements.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`ASSERTION_FAILED:${message}`);
}

const dailyProtein: RequirementSpec = {
  requirementKey: "nutrition.protein.daily",
  domain: "nutrition",
  metric: "protein",
  unit: "g",
  rule: "AT_LEAST",
  target: 150,
  aggregation: "MONOTONIC_ACCUMULATING",
  scope: {
    startsAt: "2026-09-16T04:00:00.000Z",
    endsAt: "2026-09-17T04:00:00.000Z",
    zoneId: "America/New_York",
    intervalSemantics: "[start,end)",
    recurrenceKey: "2026-09-16"
  }
};

Deno.test("open daily minimum stays in progress when recorded value is below target", () => {
  const result = evaluateRequirement(
    dailyProtein,
    { value: 110, coverage: "PARTIAL", sourceCount: 3 },
    "2026-09-16T20:00:00.000Z"
  );
  assert(result.state === "IN_PROGRESS", `expected IN_PROGRESS, got ${result.state}`);
  assert(result.remainingToMinimum === 40, "expected 40g remaining against recorded intake");
});

Deno.test("monotonic minimum can be proven satisfied before the day closes", () => {
  const result = evaluateRequirement(
    dailyProtein,
    { value: 155, coverage: "PARTIAL", sourceCount: 4 },
    "2026-09-16T22:00:00.000Z"
  );
  assert(result.state === "SATISFIED", `expected SATISFIED, got ${result.state}`);
});

Deno.test("closed day with incomplete coverage preserves unknown instead of inventing failure", () => {
  const result = evaluateRequirement(
    dailyProtein,
    { value: 110, coverage: "PARTIAL", sourceCount: 3 },
    "2026-09-17T05:00:00.000Z"
  );
  assert(result.state === "UNKNOWN", `expected UNKNOWN, got ${result.state}`);
  assert(result.explanationCode === "CLOSED_INCOMPLETE_COVERAGE", "expected incomplete-coverage explanation");
});

Deno.test("closed day can be declared below target only with complete coverage", () => {
  const result = evaluateRequirement(
    dailyProtein,
    { value: 110, coverage: "COMPLETE", sourceCount: 5 },
    "2026-09-17T05:00:00.000Z"
  );
  assert(result.state === "CLOSED_BELOW_TARGET", `expected CLOSED_BELOW_TARGET, got ${result.state}`);
});

Deno.test("at-most accumulation can prove a breach before the period closes", () => {
  const spec: RequirementSpec = {
    requirementKey: "example.maximum",
    domain: "example",
    metric: "value",
    unit: "units",
    rule: "AT_MOST",
    target: 10,
    aggregation: "MONOTONIC_ACCUMULATING",
    scope: {
      startsAt: "2026-09-16T00:00:00.000Z",
      endsAt: "2026-09-17T00:00:00.000Z",
      zoneId: "UTC",
      intervalSemantics: "[start,end)"
    }
  };
  const result = evaluateRequirement(spec, { value: 12, coverage: "PARTIAL" }, "2026-09-16T12:00:00.000Z");
  assert(result.state === "BREACHED", `expected BREACHED, got ${result.state}`);
});
