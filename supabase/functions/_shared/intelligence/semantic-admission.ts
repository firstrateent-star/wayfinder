export type SourceType =
  | "PLAYER_TEXT"
  | "PLAYER_VOICE"
  | "CALENDAR"
  | "WEARABLE"
  | "BANK"
  | "FILE"
  | "EXTERNAL_CONNECTOR";

export type InteractionIntent = "RECORD" | "CONVERSATION" | "ASK" | "REFLECT" | "UNKNOWN";

export interface SourceEnvelope {
  sourceId: string;
  sourceType: SourceType;
  content: string;
  receivedAt: string;
  occurredAt?: string;
  interactionIntent: InteractionIntent;
  authorizesCanonicalWrite: boolean;
  zoneId?: string;
}

export interface CandidateAmbiguity {
  code: string;
  description: string;
  blocking: boolean;
}

export interface SemanticCandidate<TPayload = unknown> {
  candidateId: string;
  claimType: string;
  proposedOwner?: string;
  payload: TPayload;
  sourceId: string;
  extractionConfidence?: number;
  ambiguities?: CandidateAmbiguity[];
  dependencies?: string[];
}

export interface CandidateGraph {
  sourceId: string;
  candidates: SemanticCandidate[];
  relations: Array<{
    fromCandidateId: string;
    relation: string;
    toCandidateId: string;
  }>;
}

export type AdmissionDisposition =
  | "ACCEPT"
  | "ACCEPT_PARTIAL"
  | "NEEDS_CLARIFICATION"
  | "NEEDS_AUTHORIZATION"
  | "SESSION_ONLY"
  | "REFLECTION"
  | "REJECT";

export interface CommandProposal {
  module: string;
  commandType: string;
  args: Record<string, unknown>;
}

export interface AdmissionInformationNeed {
  concept: string;
  purpose: string;
  priorityClass: "P0_BLOCKING" | "P1_HIGH_IMPACT" | "P2_HIGH_LEVERAGE" | "P3_CALIBRATION" | "P4_OPTIONAL";
  questionIntent: string;
  whyThisMatters: string;
}

export interface AdmissionDecision<TNormalized = unknown> {
  contractId: string;
  candidateId: string;
  claimType: string;
  owner?: string;
  disposition: AdmissionDisposition;
  normalized?: TNormalized;
  command?: CommandProposal;
  informationNeed?: AdmissionInformationNeed;
  reason?: string;
}

export interface AdmissionContext {
  now: string;
  source: SourceEnvelope;
}

export interface AdmissionContract {
  id: string;
  owner: string;
  claimTypes: readonly string[];
  admit(candidate: SemanticCandidate, context: AdmissionContext): AdmissionDecision | Promise<AdmissionDecision>;
}

export class AdmissionRegistry {
  private readonly contracts: AdmissionContract[] = [];

  register(contract: AdmissionContract) {
    if (this.contracts.some((item) => item.id === contract.id)) {
      throw new Error(`DUPLICATE_ADMISSION_CONTRACT:${contract.id}`);
    }
    this.contracts.push(contract);
    return this;
  }

  matching(candidate: SemanticCandidate) {
    return this.contracts.filter((contract) => contract.claimTypes.includes(candidate.claimType));
  }
}

export interface AdmissionRunResult {
  graph: CandidateGraph;
  decisions: AdmissionDecision[];
  unclaimedCandidateIds: string[];
}

export async function runSemanticAdmission(
  graph: CandidateGraph,
  registry: AdmissionRegistry,
  context: AdmissionContext
): Promise<AdmissionRunResult> {
  const decisions: AdmissionDecision[] = [];
  const unclaimedCandidateIds: string[] = [];

  for (const candidate of graph.candidates) {
    const matches = registry.matching(candidate);
    if (matches.length === 0) {
      unclaimedCandidateIds.push(candidate.candidateId);
      continue;
    }

    // v0 requires exactly one semantic owner. Multiple claimants are an architecture error,
    // not a reason to silently choose whichever contract happened to register first.
    if (matches.length > 1) {
      decisions.push({
        contractId: "semantic-admission-router.v0.1",
        candidateId: candidate.candidateId,
        claimType: candidate.claimType,
        disposition: "REJECT",
        reason: `MULTIPLE_CANONICAL_OWNERS:${matches.map((item) => item.owner).join(",")}`
      });
      continue;
    }

    decisions.push(await matches[0].admit(candidate, context));
  }

  return { graph, decisions, unclaimedCandidateIds };
}

export function accepted(decision: AdmissionDecision) {
  return decision.disposition === "ACCEPT" || decision.disposition === "ACCEPT_PARTIAL";
}
