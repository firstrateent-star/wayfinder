import type { CandidateGraph, SemanticCandidate, SourceEnvelope } from "./semantic-admission.ts";
import type { ConceptRegistry } from "./concept-registry.ts";
import type { CapacityAssessment, WayfinderCapacityRegistry } from "./wayfinder-capacity.ts";

export type RealityMode =
  | "OCCURRED"
  | "CURRENT_STATE"
  | "INTENDED"
  | "PLANNED"
  | "EXPECTED"
  | "POSSIBLE"
  | "HYPOTHETICAL"
  | "QUESTION"
  | "REFLECTION"
  | "REPORTED_ABOUT_OTHER"
  | "NEGATED"
  | "CORRECTION";

export type SemanticNodeType =
  | "ENTITY"
  | "EVENT"
  | "STATE"
  | "OBSERVATION"
  | "QUANTITY"
  | "INTENTION"
  | "PLAN"
  | "REFLECTION"
  | "REFERENCE"
  | "CLAIM";

export type SemanticSubjectKind = "SELF" | "KNOWN_OTHER" | "UNKNOWN_OTHER" | "GENERAL";
export type SemanticCertainty = "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";
export type SemanticPrecision = "EXACT" | "APPROXIMATE" | "RANGE" | "RELATIVE" | "UNKNOWN";
export type SemanticResolutionState =
  | "RESOLVED"
  | "PARTIAL"
  | "UNRESOLVED"
  | "PLAYER_DECLINED"
  | "NOT_OBSERVED"
  | "NOT_APPLICABLE";

export interface SemanticSubject {
  kind: SemanticSubjectKind;
  entityRef?: string;
  label?: string;
}

export interface SemanticField<T = unknown> {
  value?: T;
  state: SemanticResolutionState;
  precision?: SemanticPrecision;
  certainty?: SemanticCertainty;
  sourceSpans?: string[];
  contextRefs?: string[];
}

export interface SemanticTemporalMeaning {
  instant?: string;
  interval?: { from?: string; to?: string };
  localDate?: string;
  daypart?: "MORNING" | "AFTERNOON" | "EVENING" | "NIGHT";
  relativeText?: string;
  relationToNodeId?: string;
  relation?: "BEFORE" | "AFTER" | "DURING" | "AROUND";
  precision: SemanticPrecision;
  certainty: SemanticCertainty;
}

export interface CandidateUnresolved {
  code: string;
  description: string;
  blocking: boolean;
  field?: string;
}

export interface CandidateLifeNode {
  candidateId: string;
  nodeType: SemanticNodeType;
  concept: string;
  claimType?: string;
  subject: SemanticSubject;
  realityMode: RealityMode;
  attributes: Record<string, SemanticField>;
  temporal?: SemanticTemporalMeaning;
  certainty: SemanticCertainty;
  sourceSpans?: string[];
  proposedOwners?: string[];
  unresolved?: CandidateUnresolved[];
  parentConcepts?: string[];
}

export type CandidateLifeRelation =
  | "INVOLVES"
  | "ABOUT"
  | "BEFORE"
  | "AFTER"
  | "DURING"
  | "AT"
  | "HAS_VALUE"
  | "COMPARES_TO"
  | "REPEATS"
  | "CORRECTS"
  | "NEGATES"
  | "CONTRASTS_WITH"
  | "RELATED_TO"
  | "PLAYER_ATTRIBUTES_EFFECT";

export interface CandidateLifeEdge {
  edgeId: string;
  fromCandidateId: string;
  relation: CandidateLifeRelation;
  toCandidateId: string;
  certainty: SemanticCertainty;
  sourceSpans?: string[];
  contextRefs?: string[];
}

export interface CandidateReference {
  referenceId: string;
  phrase: string;
  candidateRefs: string[];
  status: SemanticResolutionState;
  resolvedRef?: string;
  certainty: SemanticCertainty;
}

export interface AlternateInterpretation {
  interpretationId: string;
  summary: string;
  affectedCandidateIds: string[];
  certainty: SemanticCertainty;
}

export interface SemanticTraceEntry {
  traceId: string;
  stage:
    | "RECOGNITION"
    | "CONTEXT_REQUEST"
    | "CONCEPT_RESOLUTION"
    | "ENTITY_RESOLUTION"
    | "TEMPORAL_RESOLUTION"
    | "RELATION_RESOLUTION"
    | "CAPACITY_ASSESSMENT"
    | "ROUTING";
  candidateId?: string;
  claim?: string;
  support?: string[];
  contextRefs?: string[];
  result: string;
}

export interface CandidateLifeGraph {
  sourceId: string;
  nodes: CandidateLifeNode[];
  edges: CandidateLifeEdge[];
  references: CandidateReference[];
  alternateInterpretations: AlternateInterpretation[];
  trace: SemanticTraceEntry[];
}

export type ContextRequestKind =
  | "RECENT_EVENTS"
  | "KNOWN_ENTITIES"
  | "PERSONAL_ALIASES"
  | "ACTIVE_DIRECTION"
  | "SCHEDULE"
  | "DOMAIN_READ"
  | "LIFE_GRAPH";

export interface ContextRequest {
  requestId: string;
  kind: ContextRequestKind;
  concepts?: string[];
  query?: string;
  from?: string;
  to?: string;
  limit?: number;
  purpose: string;
}

export interface SemanticContextItem {
  ref: string;
  kind: string;
  summary: string;
  concepts?: string[];
  occurredAt?: string;
  attributes?: Record<string, unknown>;
}

export interface SemanticContextBundle {
  asOf: string;
  items: SemanticContextItem[];
  personalAliases?: Array<{
    phrase: string;
    targetRef: string;
    contextHint?: string;
    strength?: SemanticCertainty;
  }>;
}

export interface SemanticReasonerInput {
  source: SourceEnvelope;
  context: SemanticContextBundle;
  concepts: ConceptRegistry;
}

export interface SemanticReasonerOutput {
  graph: CandidateLifeGraph;
  contextRequests?: ContextRequest[];
}

export interface SemanticReasoner {
  id: string;
  version: string;
  propose(input: SemanticReasonerInput): SemanticReasonerOutput | Promise<SemanticReasonerOutput>;
}

export type CompilerRoute = "ROUTE_TO_DOMAIN" | "CLARIFY" | "SESSION_ONLY" | "DROP";

export interface CompilerRoutingDecision {
  candidateId: string;
  route: CompilerRoute;
  owner?: string;
  reason: string;
  capacity: CapacityAssessment;
}

export interface SemanticCompilation {
  source: SourceEnvelope;
  graph: CandidateLifeGraph;
  contextRequests: ContextRequest[];
  capacity: CapacityAssessment[];
  routing: CompilerRoutingDecision[];
  validationErrors: string[];
}

export interface CompileLifeExpressionInput {
  source: SourceEnvelope;
  context: SemanticContextBundle;
  reasoner: SemanticReasoner;
  concepts: ConceptRegistry;
  capacity: WayfinderCapacityRegistry;
}

const SESSION_ONLY_REALITY_MODES = new Set<RealityMode>(["QUESTION", "HYPOTHETICAL", "POSSIBLE"]);

export function validateCandidateLifeGraph(graph: CandidateLifeGraph): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();

  for (const node of graph.nodes) {
    if (!node.candidateId.trim()) errors.push("NODE_ID_REQUIRED");
    if (ids.has(node.candidateId)) errors.push(`DUPLICATE_NODE_ID:${node.candidateId}`);
    ids.add(node.candidateId);
    if (!node.concept.trim()) errors.push(`CONCEPT_REQUIRED:${node.candidateId}`);
    if (!node.subject?.kind) errors.push(`SUBJECT_REQUIRED:${node.candidateId}`);
    if (!node.realityMode) errors.push(`REALITY_MODE_REQUIRED:${node.candidateId}`);
  }

  for (const edge of graph.edges) {
    if (!ids.has(edge.fromCandidateId)) errors.push(`EDGE_SOURCE_MISSING:${edge.edgeId}:${edge.fromCandidateId}`);
    if (!ids.has(edge.toCandidateId)) errors.push(`EDGE_TARGET_MISSING:${edge.edgeId}:${edge.toCandidateId}`);
  }

  for (const reference of graph.references) {
    if (reference.status === "RESOLVED" && !reference.resolvedRef) {
      errors.push(`RESOLVED_REFERENCE_TARGET_REQUIRED:${reference.referenceId}`);
    }
  }

  return errors;
}

export function routeCandidate(node: CandidateLifeNode, assessment: CapacityAssessment): CompilerRoutingDecision {
  const blocking = node.unresolved?.find((item) => item.blocking);
  if (blocking) {
    return {
      candidateId: node.candidateId,
      route: "CLARIFY",
      reason: `BLOCKING_UNRESOLVED:${blocking.code}`,
      capacity: assessment
    };
  }

  if (SESSION_ONLY_REALITY_MODES.has(node.realityMode)) {
    return {
      candidateId: node.candidateId,
      route: "SESSION_ONLY",
      reason: `REALITY_MODE_NOT_CANONICAL_OCCURRENCE:${node.realityMode}`,
      capacity: assessment
    };
  }

  if (assessment.persistOwners.length === 1 && node.claimType) {
    return {
      candidateId: node.candidateId,
      route: "ROUTE_TO_DOMAIN",
      owner: assessment.persistOwners[0],
      reason: "EXPLICIT_PERSIST_CAPACITY",
      capacity: assessment
    };
  }

  if (assessment.persistOwners.length > 1) {
    return {
      candidateId: node.candidateId,
      route: "CLARIFY",
      reason: `MULTIPLE_PERSIST_OWNERS:${assessment.persistOwners.join(",")}`,
      capacity: assessment
    };
  }

  if (assessment.supportedFacets.length > 0) {
    return {
      candidateId: node.candidateId,
      route: "SESSION_ONLY",
      reason: "UNDERSTOOD_BEYOND_CURRENT_PERSISTENCE_CAPACITY",
      capacity: assessment
    };
  }

  return {
    candidateId: node.candidateId,
    route: "DROP",
    reason: "NO_DECLARED_WAYFINDER_CAPACITY",
    capacity: assessment
  };
}

export async function compileLifeExpression(input: CompileLifeExpressionInput): Promise<SemanticCompilation> {
  const proposed = await input.reasoner.propose({
    source: input.source,
    context: input.context,
    concepts: input.concepts
  });

  const validationErrors = validateCandidateLifeGraph(proposed.graph);
  const capacity = proposed.graph.nodes.map((node) => input.capacity.assessNode(node));
  const routing = proposed.graph.nodes.map((node, index) => routeCandidate(node, capacity[index]));

  return {
    source: input.source,
    graph: proposed.graph,
    contextRequests: proposed.contextRequests ?? [],
    capacity,
    routing,
    validationErrors
  };
}

export function toAdmissionCandidateGraph(graph: CandidateLifeGraph): CandidateGraph {
  const candidates: SemanticCandidate[] = graph.nodes
    .filter((node) => Boolean(node.claimType))
    .map((node) => ({
      candidateId: node.candidateId,
      claimType: node.claimType!,
      proposedOwner: node.proposedOwners?.length === 1 ? node.proposedOwners[0] : undefined,
      payload: {
        concept: node.concept,
        subject: node.subject,
        realityMode: node.realityMode,
        attributes: node.attributes,
        temporal: node.temporal,
        certainty: node.certainty,
        sourceSpans: node.sourceSpans
      },
      sourceId: graph.sourceId,
      ambiguities: node.unresolved?.map((item) => ({
        code: item.code,
        description: item.description,
        blocking: item.blocking
      }))
    }));

  const admittedIds = new Set(candidates.map((candidate) => candidate.candidateId));
  const relations = graph.edges
    .filter((edge) => admittedIds.has(edge.fromCandidateId) && admittedIds.has(edge.toCandidateId))
    .map((edge) => ({
      fromCandidateId: edge.fromCandidateId,
      relation: edge.relation,
      toCandidateId: edge.toCandidateId
    }));

  return { sourceId: graph.sourceId, candidates, relations };
}
