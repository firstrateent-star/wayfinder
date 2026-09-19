import {
  evaluateRequirement,
  type RequirementEvaluation,
  type RequirementObservation,
  type RequirementSpec
} from "./requirements.ts";

export interface CanonicalProjectionRef {
  namespace: string;
  type: string;
  id: string;
  version?: string;
}

export interface RequirementInputRead {
  standard: CanonicalProjectionRef | null;
  spec: RequirementSpec | null;
  observation: (RequirementObservation & { recordedIntakeCount?: number }) | null;
  lineage: CanonicalProjectionRef[];
  does_not_assert?: string[];
}

export interface RequirementProjectionItem {
  requirementKey: string;
  domain: string;
  metric: string;
  unit: string;
  standard: CanonicalProjectionRef;
  spec: RequirementSpec;
  observation: RequirementInputRead["observation"];
  evaluation: RequirementEvaluation;
  lineage: CanonicalProjectionRef[];
  doesNotAssert: string[];
}

export interface RequirementGuidanceSignal {
  signalId: string;
  kind: "RECORDED_REQUIREMENT_GAP";
  requirementKey: string;
  domain: string;
  priorityClass: "TEMPORAL_STANDARD";
  summary: string;
  coverage: RequirementEvaluation["coverage"];
  scopeEndsAt: string;
  lineage: CanonicalProjectionRef[];
  doesNotAssert: string[];
}

export interface RequirementsProjection {
  projection_type: "requirements";
  rule_version: "requirements_projection_v0.1";
  computed_at: string;
  configured_requirement_count: number;
  evaluations: RequirementProjectionItem[];
  guidance_candidates: RequirementGuidanceSignal[];
  unconfigured_domains: string[];
  does_not_assert: string[];
}

function guidanceFor(item: RequirementProjectionItem): RequirementGuidanceSignal | null {
  const evaluation = item.evaluation;
  if (evaluation.state !== "IN_PROGRESS") return null;
  if (evaluation.remainingToMinimum == null || evaluation.remainingToMinimum <= 0) return null;
  if (evaluation.observedValue == null) return null;

  const amount = evaluation.remainingToMinimum;
  const recorded = evaluation.observedValue;
  const target = item.spec.target;
  const scopeName = item.spec.scope.recurrenceKey ?? "current scope";
  const coverageClause = evaluation.coverage === "COMPLETE"
    ? "Recorded coverage is complete for this scope."
    : "Lived-reality coverage is incomplete, so this is a recorded-evidence gap rather than proof of what remains.";

  return {
    signalId: "requirement-gap:" + item.requirementKey + ":" + scopeName,
    kind: "RECORDED_REQUIREMENT_GAP",
    requirementKey: item.requirementKey,
    domain: item.domain,
    priorityClass: "TEMPORAL_STANDARD",
    summary: recorded + " " + item.unit + " is recorded against a " + target + " " + item.unit + " standard; the recorded gap is " + amount + " " + item.unit + ". " + coverageClause,
    coverage: evaluation.coverage,
    scopeEndsAt: item.spec.scope.endsAt,
    lineage: [item.standard, ...item.lineage],
    doesNotAssert: [
      "that the recorded gap equals the true lived gap",
      "that the standard is medically or normatively correct outside its owning domain",
      "that satisfying the standard guarantees the underlying Direction"
    ]
  };
}

export function buildRequirementsProjection(
  inputs: Array<{ domain: string; read: RequirementInputRead }>,
  evaluatedAt: string
): RequirementsProjection {
  const evaluations: RequirementProjectionItem[] = [];
  const unconfiguredDomains: string[] = [];

  for (const { domain, read } of inputs) {
    if (!read.standard || !read.spec || !read.observation) {
      unconfiguredDomains.push(domain);
      continue;
    }

    const evaluation = evaluateRequirement(read.spec, read.observation, evaluatedAt);
    evaluations.push({
      requirementKey: read.spec.requirementKey,
      domain: read.spec.domain,
      metric: read.spec.metric,
      unit: read.spec.unit,
      standard: read.standard,
      spec: read.spec,
      observation: read.observation,
      evaluation,
      lineage: read.lineage ?? [],
      doesNotAssert: [
        ...(read.does_not_assert ?? []),
        ...evaluation.doesNotAssert
      ]
    });
  }

  const guidanceCandidates = evaluations
    .map(guidanceFor)
    .filter((value): value is RequirementGuidanceSignal => Boolean(value));

  return {
    projection_type: "requirements",
    rule_version: "requirements_projection_v0.1",
    computed_at: evaluatedAt,
    configured_requirement_count: evaluations.length,
    evaluations,
    guidance_candidates: guidanceCandidates,
    unconfigured_domains: [...new Set(unconfiguredDomains)].sort(),
    does_not_assert: [
      "that an unconfigured domain has no useful standards",
      "that missing observations are zero",
      "that a closed scope was missed unless observation coverage is complete",
      "that requirement satisfaction is Character growth"
    ]
  };
}
