export type RequirementRule = "AT_LEAST" | "AT_MOST" | "BETWEEN" | "EXACT";
export type RequirementCoverage = "COMPLETE" | "PARTIAL" | "UNKNOWN";
export type RequirementAggregation = "MONOTONIC_ACCUMULATING" | "SNAPSHOT";

export interface RequirementScope {
  startsAt: string;
  endsAt: string;
  zoneId: string;
  intervalSemantics: "[start,end)";
  recurrenceKey?: string;
}

export interface RequirementSpec {
  requirementKey: string;
  domain: string;
  metric: string;
  unit: string;
  rule: RequirementRule;
  target?: number;
  minimum?: number;
  maximum?: number;
  aggregation: RequirementAggregation;
  scope: RequirementScope;
  directionRef?: {
    namespace: string;
    type: string;
    id: string;
    version?: string;
  };
}

export interface RequirementObservation {
  value: number | null;
  coverage: RequirementCoverage;
  sourceCount?: number;
  observedThrough?: string;
}

export type RequirementEvaluationState =
  | "SATISFIED"
  | "IN_PROGRESS"
  | "CLOSED_BELOW_TARGET"
  | "BREACHED"
  | "UNKNOWN";

export interface RequirementEvaluation {
  requirementKey: string;
  state: RequirementEvaluationState;
  evaluatedAt: string;
  scopeClosed: boolean;
  observedValue: number | null;
  coverage: RequirementCoverage;
  remainingToMinimum: number | null;
  remainingToMaximum: number | null;
  explanationCode:
    | "OBSERVED_MINIMUM_MET"
    | "OBSERVED_MAXIMUM_EXCEEDED"
    | "OPEN_SCOPE"
    | "CLOSED_COMPLETE_MINIMUM_MISSED"
    | "CLOSED_COMPLETE_SATISFIED"
    | "CLOSED_INCOMPLETE_COVERAGE"
    | "OBSERVATION_UNKNOWN";
  doesNotAssert: string[];
}

function parseInstant(value: string, label: string) {
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) throw new Error(`INVALID_REQUIREMENT_${label.toUpperCase()}`);
  return ms;
}

function validateSpec(spec: RequirementSpec) {
  if (!spec.requirementKey.trim()) throw new Error("REQUIREMENT_KEY_REQUIRED");
  if (!spec.domain.trim()) throw new Error("REQUIREMENT_DOMAIN_REQUIRED");
  if (!spec.metric.trim()) throw new Error("REQUIREMENT_METRIC_REQUIRED");
  if (!spec.unit.trim()) throw new Error("REQUIREMENT_UNIT_REQUIRED");

  const start = parseInstant(spec.scope.startsAt, "scope_start");
  const end = parseInstant(spec.scope.endsAt, "scope_end");
  if (end <= start) throw new Error("INVALID_REQUIREMENT_SCOPE");

  if ((spec.rule === "AT_LEAST" || spec.rule === "AT_MOST" || spec.rule === "EXACT") && !Number.isFinite(spec.target)) {
    throw new Error("REQUIREMENT_TARGET_REQUIRED");
  }
  if (spec.rule === "BETWEEN") {
    if (!Number.isFinite(spec.minimum) || !Number.isFinite(spec.maximum)) {
      throw new Error("REQUIREMENT_RANGE_REQUIRED");
    }
    if ((spec.minimum as number) > (spec.maximum as number)) throw new Error("INVALID_REQUIREMENT_RANGE");
  }
}

function bounds(spec: RequirementSpec) {
  switch (spec.rule) {
    case "AT_LEAST":
      return { minimum: spec.target as number, maximum: null };
    case "AT_MOST":
      return { minimum: null, maximum: spec.target as number };
    case "EXACT":
      return { minimum: spec.target as number, maximum: spec.target as number };
    case "BETWEEN":
      return { minimum: spec.minimum as number, maximum: spec.maximum as number };
  }
}

export function evaluateRequirement(
  spec: RequirementSpec,
  observation: RequirementObservation,
  evaluatedAt: string
): RequirementEvaluation {
  validateSpec(spec);
  const now = parseInstant(evaluatedAt, "evaluated_at");
  const scopeEnd = parseInstant(spec.scope.endsAt, "scope_end");
  const scopeClosed = now >= scopeEnd;
  const value = observation.value;
  const { minimum, maximum } = bounds(spec);

  const base = {
    requirementKey: spec.requirementKey,
    evaluatedAt,
    scopeClosed,
    observedValue: value,
    coverage: observation.coverage,
    remainingToMinimum:
      value == null || minimum == null ? null : Math.max(0, minimum - value),
    remainingToMaximum:
      value == null || maximum == null ? null : Math.max(0, maximum - value),
    doesNotAssert: [
      "that unrecorded activity or intake is zero",
      "that satisfying the requirement proves the underlying goal will be achieved",
      "that the requirement is medically or normatively correct outside its owning domain"
    ]
  } satisfies Omit<RequirementEvaluation, "state" | "explanationCode">;

  if (value == null || !Number.isFinite(value)) {
    return { ...base, state: "UNKNOWN", explanationCode: "OBSERVATION_UNKNOWN" };
  }

  // Monotonic accumulation can prove certain outcomes early even with incomplete coverage:
  // once a minimum is reached it cannot become unreached; once a maximum is exceeded it
  // cannot become un-exceeded by discovering more positive accumulation.
  if (spec.aggregation === "MONOTONIC_ACCUMULATING") {
    if (minimum != null && maximum == null && value >= minimum) {
      return { ...base, state: "SATISFIED", explanationCode: "OBSERVED_MINIMUM_MET" };
    }
    if (maximum != null && value > maximum) {
      return { ...base, state: "BREACHED", explanationCode: "OBSERVED_MAXIMUM_EXCEEDED" };
    }
  }

  if (!scopeClosed) {
    return { ...base, state: "IN_PROGRESS", explanationCode: "OPEN_SCOPE" };
  }

  if (observation.coverage !== "COMPLETE") {
    return { ...base, state: "UNKNOWN", explanationCode: "CLOSED_INCOMPLETE_COVERAGE" };
  }

  const meetsMinimum = minimum == null || value >= minimum;
  const meetsMaximum = maximum == null || value <= maximum;

  if (meetsMinimum && meetsMaximum) {
    return { ...base, state: "SATISFIED", explanationCode: "CLOSED_COMPLETE_SATISFIED" };
  }
  if (!meetsMinimum) {
    return { ...base, state: "CLOSED_BELOW_TARGET", explanationCode: "CLOSED_COMPLETE_MINIMUM_MISSED" };
  }
  return { ...base, state: "BREACHED", explanationCode: "OBSERVED_MAXIMUM_EXCEEDED" };
}
