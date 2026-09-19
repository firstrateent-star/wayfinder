import type { SourceEnvelope } from "./semantic-admission.ts";
import type {
  CandidateLifeNode,
  CompilerRoutingDecision,
  SemanticCompilation,
  SemanticSubjectKind,
  RealityMode
} from "./semantic-compiler.ts";

export type AdmissionPlanningDisposition =
  | "READY_FOR_DOMAIN_ADMISSION"
  | "NEEDS_AUTHORIZATION"
  | "NEEDS_CLARIFICATION"
  | "SESSION_ONLY"
  | "DROP"
  | "REJECT";

export type AdmissionPolicyDisposition =
  | "ELIGIBLE"
  | "NEEDS_CLARIFICATION"
  | "SESSION_ONLY"
  | "REJECT";

export interface AdmissionPolicyDecision {
  disposition: AdmissionPolicyDisposition;
  reason: string;
}

export interface DomainAdmissionPlanningPolicy {
  id: string;
  version: string;
  owner: string;
  claimTypes: readonly string[];
  assess(node: CandidateLifeNode, route: CompilerRoutingDecision, source: SourceEnvelope): AdmissionPolicyDecision;
}

export class AdmissionPlanningPolicyRegistry {
  private readonly policies: DomainAdmissionPlanningPolicy[] = [];

  register(policy: DomainAdmissionPlanningPolicy) {
    if (this.policies.some((item) => item.id === policy.id)) {
      throw new Error(`DUPLICATE_ADMISSION_PLANNING_POLICY:${policy.id}`);
    }
    this.policies.push(policy);
    return this;
  }

  matching(owner: string, claimType: string) {
    return this.policies.filter((policy) =>
      policy.owner === owner && policy.claimTypes.includes(claimType)
    );
  }
}

export interface DomainAdmissionProposal {
  proposalId: string;
  sourceId: string;
  candidateId: string;
  owner: string;
  claimType: string;
  concept: string;
  subject: CandidateLifeNode["subject"];
  realityMode: RealityMode;
  certainty: CandidateLifeNode["certainty"];
  sourceSpans: string[];
  contextRefs: string[];
  authorization: "PRESENT" | "REQUIRED";
  policyId: string;
  policyVersion: string;
  transient: true;
}

export interface AdmissionPlanItem {
  candidateId: string;
  concept: string;
  route: CompilerRoutingDecision["route"];
  disposition: AdmissionPlanningDisposition;
  owner?: string;
  claimType?: string;
  proposalId?: string;
  reason: string;
  blockingUnresolved?: Array<{
    code: string;
    description: string;
    field?: string;
  }>;
}

export interface AdmissionPlan {
  sourceId: string;
  generatedAt: string;
  proposals: DomainAdmissionProposal[];
  items: AdmissionPlanItem[];
  validationErrors: string[];
  invariants: {
    executesCommands: false;
    persistsCandidates: false;
    modelChoosesOwner: false;
  };
}

function collectContextRefs(compilation: SemanticCompilation, node: CandidateLifeNode) {
  const refs = new Set<string>();

  for (const field of Object.values(node.attributes)) {
    for (const ref of field.contextRefs ?? []) refs.add(ref);
  }

  for (const edge of compilation.graph.edges) {
    if (edge.fromCandidateId !== node.candidateId && edge.toCandidateId !== node.candidateId) continue;
    for (const ref of edge.contextRefs ?? []) refs.add(ref);
  }

  for (const reference of compilation.graph.references) {
    if (!reference.candidateRefs.includes(node.candidateId)) continue;
    if (reference.resolvedRef) refs.add(reference.resolvedRef);
  }

  return [...refs];
}

function authorized(source: SourceEnvelope) {
  return source.interactionIntent === "RECORD" && source.authorizesCanonicalWrite === true;
}

function proposalId(sourceId: string, candidateId: string, owner: string, claimType: string) {
  return `admission:${sourceId}:${candidateId}:${owner}:${claimType}`;
}

export function planSemanticAdmission(
  compilation: SemanticCompilation,
  registry: AdmissionPlanningPolicyRegistry,
  now = compilation.source.receivedAt
): AdmissionPlan {
  const proposals: DomainAdmissionProposal[] = [];
  const items: AdmissionPlanItem[] = [];
  const validationErrors = [...compilation.validationErrors];
  const nodeById = new Map(compilation.graph.nodes.map((node) => [node.candidateId, node]));

  // The semantic graph is the unit of meaning. If its structural validation
  // failed, no subset of its nodes may independently cross into admission.
  if (validationErrors.length > 0) {
    return {
      sourceId: compilation.source.sourceId,
      generatedAt: now,
      proposals: [],
      items: compilation.routing.map((route) => ({
        candidateId: route.candidateId,
        concept: nodeById.get(route.candidateId)?.concept ?? route.capacity.concept,
        route: route.route,
        disposition: "REJECT" as const,
        ...(route.owner ? { owner: route.owner } : {}),
        ...(route.claimType ? { claimType: route.claimType } : {}),
        reason: `INVALID_SEMANTIC_GRAPH:${validationErrors.join("|")}`
      })),
      validationErrors,
      invariants: {
        executesCommands: false,
        persistsCandidates: false,
        modelChoosesOwner: false
      }
    };
  }

  for (const route of compilation.routing) {
    const node = nodeById.get(route.candidateId);
    if (!node) {
      const error = `ROUTING_NODE_MISSING:${route.candidateId}`;
      validationErrors.push(error);
      items.push({
        candidateId: route.candidateId,
        concept: route.capacity.concept,
        route: route.route,
        disposition: "REJECT",
        reason: error
      });
      continue;
    }

    if (route.route === "CLARIFY") {
      items.push({
        candidateId: node.candidateId,
        concept: node.concept,
        route: route.route,
        disposition: "NEEDS_CLARIFICATION",
        reason: route.reason,
        blockingUnresolved: (node.unresolved ?? [])
          .filter((item) => item.blocking)
          .map((item) => ({
            code: item.code,
            description: item.description,
            ...(item.field ? { field: item.field } : {})
          }))
      });
      continue;
    }

    if (route.route === "SESSION_ONLY") {
      items.push({
        candidateId: node.candidateId,
        concept: node.concept,
        route: route.route,
        disposition: "SESSION_ONLY",
        reason: route.reason
      });
      continue;
    }

    if (route.route === "DROP") {
      items.push({
        candidateId: node.candidateId,
        concept: node.concept,
        route: route.route,
        disposition: "DROP",
        reason: route.reason
      });
      continue;
    }

    if (!route.owner || !route.claimType) {
      const error = `ROUTE_TO_DOMAIN_INCOMPLETE:${node.candidateId}`;
      validationErrors.push(error);
      items.push({
        candidateId: node.candidateId,
        concept: node.concept,
        route: route.route,
        disposition: "REJECT",
        reason: error
      });
      continue;
    }

    const matches = registry.matching(route.owner, route.claimType);
    if (matches.length === 0) {
      const error = `NO_ADMISSION_PLANNING_POLICY:${route.owner}:${route.claimType}`;
      validationErrors.push(error);
      items.push({
        candidateId: node.candidateId,
        concept: node.concept,
        route: route.route,
        disposition: "REJECT",
        owner: route.owner,
        claimType: route.claimType,
        reason: error
      });
      continue;
    }

    if (matches.length > 1) {
      const error = `MULTIPLE_ADMISSION_PLANNING_POLICIES:${route.owner}:${route.claimType}`;
      validationErrors.push(error);
      items.push({
        candidateId: node.candidateId,
        concept: node.concept,
        route: route.route,
        disposition: "REJECT",
        owner: route.owner,
        claimType: route.claimType,
        reason: error
      });
      continue;
    }

    const policy = matches[0];
    const policyDecision = policy.assess(node, route, compilation.source);

    if (policyDecision.disposition !== "ELIGIBLE") {
      const disposition: AdmissionPlanningDisposition =
        policyDecision.disposition === "NEEDS_CLARIFICATION"
          ? "NEEDS_CLARIFICATION"
          : policyDecision.disposition === "SESSION_ONLY"
            ? "SESSION_ONLY"
            : "REJECT";

      items.push({
        candidateId: node.candidateId,
        concept: node.concept,
        route: route.route,
        disposition,
        owner: route.owner,
        claimType: route.claimType,
        reason: policyDecision.reason
      });
      continue;
    }

    const id = proposalId(compilation.source.sourceId, node.candidateId, route.owner, route.claimType);
    const hasAuthorization = authorized(compilation.source);
    const proposal: DomainAdmissionProposal = {
      proposalId: id,
      sourceId: compilation.source.sourceId,
      candidateId: node.candidateId,
      owner: route.owner,
      claimType: route.claimType,
      concept: node.concept,
      subject: node.subject,
      realityMode: node.realityMode,
      certainty: node.certainty,
      sourceSpans: [...(node.sourceSpans ?? [])],
      contextRefs: collectContextRefs(compilation, node),
      authorization: hasAuthorization ? "PRESENT" : "REQUIRED",
      policyId: policy.id,
      policyVersion: policy.version,
      transient: true
    };
    proposals.push(proposal);

    items.push({
      candidateId: node.candidateId,
      concept: node.concept,
      route: route.route,
      disposition: hasAuthorization ? "READY_FOR_DOMAIN_ADMISSION" : "NEEDS_AUTHORIZATION",
      owner: route.owner,
      claimType: route.claimType,
      proposalId: id,
      reason: hasAuthorization
        ? "EXPLICIT_WRITE_AUTHORIZATION_PRESENT"
        : "DOMAIN_CLAIM_ELIGIBLE_BUT_WRITE_NOT_AUTHORIZED"
    });
  }

  return {
    sourceId: compilation.source.sourceId,
    generatedAt: now,
    proposals,
    items,
    validationErrors,
    invariants: {
      executesCommands: false,
      persistsCandidates: false,
      modelChoosesOwner: false
    }
  };
}

export interface TrainingAdmissionPlanningPolicyOptions {
  allowedSubjectKinds?: readonly SemanticSubjectKind[];
}

export function createTrainingAdmissionPlanningPolicy(
  options: TrainingAdmissionPlanningPolicyOptions = {}
): DomainAdmissionPlanningPolicy {
  const allowedSubjects = new Set(options.allowedSubjectKinds ?? ["SELF"]);
  return {
    id: "training.admission-planning.v0.1",
    version: "0.1",
    owner: "training",
    claimTypes: ["TRAINING_STRENGTH_SESSION"],
    assess(node) {
      if (!allowedSubjects.has(node.subject.kind)) {
        return {
          disposition: "SESSION_ONLY",
          reason: `TRAINING_SUBJECT_NOT_PLAYER:${node.subject.kind}`
        };
      }
      if (node.nodeType !== "EVENT") {
        return {
          disposition: "SESSION_ONLY",
          reason: `TRAINING_NODE_NOT_EVENT:${node.nodeType}`
        };
      }
      if (node.realityMode !== "OCCURRED") {
        return {
          disposition: "SESSION_ONLY",
          reason: `TRAINING_REALITY_NOT_OCCURRED:${node.realityMode}`
        };
      }
      return { disposition: "ELIGIBLE", reason: "TRAINING_OCCURRENCE_ELIGIBLE_FOR_DOMAIN_ADMISSION" };
    }
  };
}

export function createDirectionAdmissionPlanningPolicy(): DomainAdmissionPlanningPolicy {
  return {
    id: "direction.admission-planning.v0.1",
    version: "0.1",
    owner: "direction",
    claimTypes: ["DIRECTION_NODE"],
    assess(node) {
      if (node.subject.kind !== "SELF") return { disposition: "SESSION_ONLY", reason: `DIRECTION_SUBJECT_NOT_PLAYER:${node.subject.kind}` };
      if (!["INTENTION", "PLAN", "CLAIM", "STATE"].includes(node.nodeType)) return { disposition: "SESSION_ONLY", reason: `DIRECTION_NODE_TYPE_NOT_INTENT:${node.nodeType}` };
      if (!["INTENDED", "CURRENT_STATE"].includes(node.realityMode)) return { disposition: "SESSION_ONLY", reason: `DIRECTION_REALITY_NOT_INTENT:${node.realityMode}` };
      return { disposition: "ELIGIBLE", reason: "DIRECTION_INTENT_ELIGIBLE_FOR_DOMAIN_ADMISSION" };
    }
  };
}

export function createScheduleAdmissionPlanningPolicy(): DomainAdmissionPlanningPolicy {
  return {
    id: "schedule.admission-planning.v0.1",
    version: "0.1",
    owner: "schedule",
    claimTypes: ["SCHEDULE_ALLOCATION"],
    assess(node) {
      if (node.subject.kind !== "SELF") return { disposition: "SESSION_ONLY", reason: `SCHEDULE_SUBJECT_NOT_PLAYER:${node.subject.kind}` };
      if (!["PLAN", "INTENTION", "EVENT"].includes(node.nodeType)) return { disposition: "SESSION_ONLY", reason: `SCHEDULE_NODE_TYPE_NOT_PLAN:${node.nodeType}` };
      if (node.realityMode !== "PLANNED") return { disposition: "SESSION_ONLY", reason: `SCHEDULE_REALITY_NOT_PLANNED:${node.realityMode}` };
      return { disposition: "ELIGIBLE", reason: "PLANNED_ALLOCATION_ELIGIBLE_FOR_SCHEDULE_ADMISSION" };
    }
  };
}
export function createWayfinderAdmissionPlanningRegistryV0() {
  return new AdmissionPlanningPolicyRegistry()
    .register(createTrainingAdmissionPlanningPolicy())
    .register(createDirectionAdmissionPlanningPolicy())
    .register(createScheduleAdmissionPlanningPolicy());
}
