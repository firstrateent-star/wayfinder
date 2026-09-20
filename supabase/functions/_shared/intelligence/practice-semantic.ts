import type {
  AdmissionContract,
  SemanticCandidate
} from "./semantic-admission.ts";

export interface PracticeSessionCandidatePayload {
  practiceName: string;
  occurredFrom: string;
  occurredTo: string;
  fromPrecision: "INSTANT" | "MINUTE" | "HOUR";
  toPrecision: "INSTANT" | "MINUTE" | "HOUR";
  zoneId: string;
  durationSeconds: number;
  focus?: string;
}

function validInstant(value: string) {
  return Number.isFinite(Date.parse(value));
}

export const practiceAdmissionContract: AdmissionContract = {
  id: "practice.semantic-admission.v0.1",
  owner: "practice",
  claimTypes: ["PRACTICE_SESSION"],
  admit(candidate: SemanticCandidate, context) {
    const payload = candidate.payload as PracticeSessionCandidatePayload;
    const practiceName = payload.practiceName?.trim();
    const focus = payload.focus?.trim() || undefined;

    if (!practiceName || practiceName.length > 300) {
      return {
        contractId: this.id,
        candidateId: candidate.candidateId,
        claimType: candidate.claimType,
        owner: this.owner,
        disposition: "NEEDS_CLARIFICATION",
        informationNeed: {
          concept: "practice.identity",
          purpose: "Preserve the player-grounded Practice identity without inventing a label.",
          priorityClass: "P1_HIGH_IMPACT",
          questionIntent: "What practice or activity should this session be recorded under?",
          whyThisMatters: "Practice identity is canonical player reality; the model cannot invent or merge it."
        },
        reason: "PRACTICE_NAME_REQUIRED"
      };
    }

    if (
      !validInstant(payload.occurredFrom) ||
      !validInstant(payload.occurredTo) ||
      Date.parse(payload.occurredTo) <= Date.parse(payload.occurredFrom)
    ) {
      return {
        contractId: this.id,
        candidateId: candidate.candidateId,
        claimType: candidate.claimType,
        owner: this.owner,
        disposition: "NEEDS_CLARIFICATION",
        reason: "PRACTICE_EXACT_INTERVAL_REQUIRED"
      };
    }

    if (
      !["INSTANT", "MINUTE", "HOUR"].includes(payload.fromPrecision) ||
      !["INSTANT", "MINUTE", "HOUR"].includes(payload.toPrecision)
    ) {
      return {
        contractId: this.id,
        candidateId: candidate.candidateId,
        claimType: candidate.claimType,
        owner: this.owner,
        disposition: "REJECT",
        reason: "INVALID_PRACTICE_TEMPORAL_PRECISION"
      };
    }

    if (
      !Number.isInteger(payload.durationSeconds) ||
      payload.durationSeconds <= 0 ||
      Math.abs(
        (Date.parse(payload.occurredTo) - Date.parse(payload.occurredFrom)) / 1000 -
          payload.durationSeconds
      ) > 1
    ) {
      return {
        contractId: this.id,
        candidateId: candidate.candidateId,
        claimType: candidate.claimType,
        owner: this.owner,
        disposition: "NEEDS_CLARIFICATION",
        reason: "PRACTICE_DURATION_INTERVAL_MISMATCH"
      };
    }

    const normalized: PracticeSessionCandidatePayload = {
      practiceName: practiceName.slice(0, 300),
      occurredFrom: payload.occurredFrom,
      occurredTo: payload.occurredTo,
      fromPrecision: payload.fromPrecision,
      toPrecision: payload.toPrecision,
      zoneId: payload.zoneId?.trim() || context.source.zoneId || "UTC",
      durationSeconds: payload.durationSeconds,
      ...(focus ? { focus: focus.slice(0, 1000) } : {})
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
        module: "practice",
        commandType: "practice.capture_session",
        args: {
          p_command_id: crypto.randomUUID(),
          p_practice_id: null,
          p_new_practice_name: normalized.practiceName,
          p_new_practice_description: null,
          p_occurred_from: normalized.occurredFrom,
          p_occurred_to: normalized.occurredTo,
          p_from_precision: normalized.fromPrecision,
          p_to_precision: normalized.toPrecision,
          p_zone_id: normalized.zoneId,
          p_duration_seconds: normalized.durationSeconds,
          p_focus: normalized.focus ?? null
        }
      },
      reason: "PRACTICE_SESSION_ADMISSIBLE"
    };
  }
};
