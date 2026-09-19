import type { AdmissionContract, SemanticCandidate } from "./semantic-admission.ts";

export type DirectionNodeKind = "value" | "direction" | "outcome" | "commitment" | "quest" | "plan" | "action";

export interface DirectionNodeCandidatePayload {
  kind: DirectionNodeKind;
  title: string;
  description?: string;
  intentState: "ACTIVE";
}

export const directionAdmissionContract: AdmissionContract = {
  id: "direction.semantic-admission.v0.1",
  owner: "direction",
  claimTypes: ["DIRECTION_NODE"],
  admit(candidate: SemanticCandidate, context) {
    const payload = candidate.payload as DirectionNodeCandidatePayload;
    const title = payload.title?.trim();
    const description = payload.description?.trim() || undefined;
    const kinds = new Set<DirectionNodeKind>(["value","direction","outcome","commitment","quest","plan","action"]);
    if (!title) {
      return {
        contractId: this.id, candidateId: candidate.candidateId, claimType: candidate.claimType, owner: this.owner,
        disposition: "NEEDS_CLARIFICATION",
        informationNeed: {
          concept: "direction.title", purpose: "Give the Direction node an explicit player-grounded title.",
          priorityClass: "P1_HIGH_IMPACT", questionIntent: "What should this direction be called?",
          whyThisMatters: "Direction should preserve the player's intended aim without inventing a label."
        },
        reason: "DIRECTION_TITLE_REQUIRED"
      };
    }
    if (!kinds.has(payload.kind)) {
      return { contractId:this.id,candidateId:candidate.candidateId,claimType:candidate.claimType,owner:this.owner,disposition:"REJECT",reason:"INVALID_DIRECTION_KIND" };
    }
    const normalized: DirectionNodeCandidatePayload = {
      kind: payload.kind, title: title.slice(0, 300),
      ...(description ? { description: description.slice(0, 2000) } : {}),
      intentState: "ACTIVE"
    };
    if (!context.source.authorizesCanonicalWrite || context.source.interactionIntent !== "RECORD") {
      return { contractId:this.id,candidateId:candidate.candidateId,claimType:candidate.claimType,owner:this.owner,disposition:"NEEDS_AUTHORIZATION",normalized,reason:"PLAYER_HAS_NOT_AUTHORIZED_CANONICAL_WRITE" };
    }
    return {
      contractId:this.id,candidateId:candidate.candidateId,claimType:candidate.claimType,owner:this.owner,disposition:"ACCEPT",normalized,
      command:{ module:"direction",commandType:"direction.create_node",args:{
        p_command_id:crypto.randomUUID(),p_kind:normalized.kind,p_title:normalized.title,
        p_description:normalized.description ?? null,p_intent_state:normalized.intentState
      }},
      reason:"DIRECTION_CLAIM_ADMISSIBLE"
    };
  }
};
