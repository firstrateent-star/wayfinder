import type { AdmissionContract, SemanticCandidate } from "./semantic-admission.ts";

export interface TrainingStrengthStandardPayload {
  targetSessions: number;
  zoneId: string;
}

export interface NutritionProteinStandardPayload {
  targetGrams: number;
  zoneId: string;
}

export const trainingStrengthStandardAdmissionContract: AdmissionContract = {
  id: "training.strength-standard.semantic-admission.v0.1",
  owner: "training",
  claimTypes: ["TRAINING_STRENGTH_STANDARD"],
  admit(candidate: SemanticCandidate, context) {
    const payload = candidate.payload as TrainingStrengthStandardPayload;
    if (!Number.isInteger(payload.targetSessions) || payload.targetSessions < 1 || payload.targetSessions > 21) {
      return {
        contractId: this.id,
        candidateId: candidate.candidateId,
        claimType: candidate.claimType,
        owner: this.owner,
        disposition: "NEEDS_CLARIFICATION",
        informationNeed: {
          concept: "training.strength_standard.target_sessions",
          purpose: "Establish the player-stated weekly strength-session minimum without guessing.",
          priorityClass: "P1_HIGH_IMPACT",
          questionIntent: "How many strength sessions per week do you want as your standard?",
          whyThisMatters: "Wayfinder must not invent a recurring training target."
        },
        reason: "STRENGTH_STANDARD_TARGET_REQUIRED"
      };
    }
    const normalized: TrainingStrengthStandardPayload = {
      targetSessions: payload.targetSessions,
      zoneId: payload.zoneId?.trim() || context.source.zoneId || "UTC"
    };
    if (!context.source.authorizesCanonicalWrite || context.source.interactionIntent !== "RECORD") {
      return {
        contractId: this.id,
        candidateId: candidate.candidateId,
        claimType: candidate.claimType,
        owner: this.owner,
        disposition: "NEEDS_AUTHORIZATION",
        normalized,
        reason: "PLAYER_HAS_NOT_AUTHORIZED_CANONICAL_WRITE"
      };
    }
    return {
      contractId: this.id,
      candidateId: candidate.candidateId,
      claimType: candidate.claimType,
      owner: this.owner,
      disposition: "ACCEPT",
      normalized,
      command: {
        module: "training",
        commandType: "training.set_strength_standard",
        args: {
          p_command_id: crypto.randomUUID(),
          p_target_sessions: normalized.targetSessions,
          p_zone_id: normalized.zoneId,
          p_provenance_source_id: context.source.sourceId
        }
      },
      reason: "TRAINING_STRENGTH_STANDARD_ADMISSIBLE"
    };
  }
};

export const nutritionProteinStandardAdmissionContract: AdmissionContract = {
  id: "nutrition.protein-standard.semantic-admission.v0.1",
  owner: "nutrition",
  claimTypes: ["NUTRITION_PROTEIN_STANDARD"],
  admit(candidate: SemanticCandidate, context) {
    const payload = candidate.payload as NutritionProteinStandardPayload;
    if (!Number.isFinite(payload.targetGrams) || payload.targetGrams <= 0 || payload.targetGrams > 1000) {
      return {
        contractId: this.id,
        candidateId: candidate.candidateId,
        claimType: candidate.claimType,
        owner: this.owner,
        disposition: "NEEDS_CLARIFICATION",
        informationNeed: {
          concept: "nutrition.protein_standard.target_grams",
          purpose: "Establish the player-stated daily protein minimum without inferring a recommendation.",
          priorityClass: "P1_HIGH_IMPACT",
          questionIntent: "What daily protein target in grams do you want Wayfinder to use?",
          whyThisMatters: "Wayfinder must not invent nutrition targets."
        },
        reason: "PROTEIN_STANDARD_TARGET_REQUIRED"
      };
    }
    const normalized: NutritionProteinStandardPayload = {
      targetGrams: payload.targetGrams,
      zoneId: payload.zoneId?.trim() || context.source.zoneId || "UTC"
    };
    if (!context.source.authorizesCanonicalWrite || context.source.interactionIntent !== "RECORD") {
      return {
        contractId: this.id,
        candidateId: candidate.candidateId,
        claimType: candidate.claimType,
        owner: this.owner,
        disposition: "NEEDS_AUTHORIZATION",
        normalized,
        reason: "PLAYER_HAS_NOT_AUTHORIZED_CANONICAL_WRITE"
      };
    }
    return {
      contractId: this.id,
      candidateId: candidate.candidateId,
      claimType: candidate.claimType,
      owner: this.owner,
      disposition: "ACCEPT",
      normalized,
      command: {
        module: "nutrition",
        commandType: "nutrition.set_protein_standard",
        args: {
          p_command_id: crypto.randomUUID(),
          p_target_grams: normalized.targetGrams,
          p_zone_id: normalized.zoneId,
          p_provenance_source_id: context.source.sourceId
        }
      },
      reason: "NUTRITION_PROTEIN_STANDARD_ADMISSIBLE"
    };
  }
};
