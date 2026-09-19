import type { AdmissionContract, SemanticCandidate } from "./semantic-admission.ts";

export type ScheduleAllocationKind = "HARD" | "SOFT" | "WINDOWED" | "FLOATING";

export interface ScheduleAllocationCandidatePayload {
  label: string;
  allocationKind: ScheduleAllocationKind;
  startsAt?: string;
  endsAt?: string;
  windowStartsAt?: string;
  windowEndsAt?: string;
  dueAt?: string;
  expectedDurationSeconds?: number;
  zoneId: string;
}

function validInstant(value?: string) { return !value || Number.isFinite(Date.parse(value)); }

export const scheduleAdmissionContract: AdmissionContract = {
  id: "schedule.semantic-admission.v0.1",
  owner: "schedule",
  claimTypes: ["SCHEDULE_ALLOCATION"],
  admit(candidate: SemanticCandidate, context) {
    const payload = candidate.payload as ScheduleAllocationCandidatePayload;
    const label = payload.label?.trim();
    if (!label) {
      return { contractId:this.id,candidateId:candidate.candidateId,claimType:candidate.claimType,owner:this.owner,disposition:"NEEDS_CLARIFICATION",
        informationNeed:{ concept:"schedule.label",purpose:"Preserve what the player actually intends to allocate time for.",priorityClass:"P1_HIGH_IMPACT",questionIntent:"What should this scheduled item be called?",whyThisMatters:"Schedule cannot invent the activity being allocated." },
        reason:"SCHEDULE_LABEL_REQUIRED" };
    }
    if (!["HARD","SOFT","WINDOWED","FLOATING"].includes(payload.allocationKind)) {
      return { contractId:this.id,candidateId:candidate.candidateId,claimType:candidate.claimType,owner:this.owner,disposition:"REJECT",reason:"INVALID_SCHEDULE_KIND" };
    }
    if (![payload.startsAt,payload.endsAt,payload.windowStartsAt,payload.windowEndsAt,payload.dueAt].every(validInstant)) {
      return { contractId:this.id,candidateId:candidate.candidateId,claimType:candidate.claimType,owner:this.owner,disposition:"NEEDS_CLARIFICATION",reason:"INVALID_SCHEDULE_TIME" };
    }
    if (payload.expectedDurationSeconds != null && (!Number.isInteger(payload.expectedDurationSeconds) || payload.expectedDurationSeconds <= 0)) {
      return { contractId:this.id,candidateId:candidate.candidateId,claimType:candidate.claimType,owner:this.owner,disposition:"NEEDS_CLARIFICATION",reason:"INVALID_SCHEDULE_DURATION" };
    }
    const fixed = payload.allocationKind === "HARD" || payload.allocationKind === "SOFT";
    const windowed = payload.allocationKind === "WINDOWED";
    const floating = payload.allocationKind === "FLOATING";
    if (fixed && (!payload.startsAt || !payload.endsAt || Date.parse(payload.endsAt) <= Date.parse(payload.startsAt))) {
      return { contractId:this.id,candidateId:candidate.candidateId,claimType:candidate.claimType,owner:this.owner,disposition:"NEEDS_CLARIFICATION",reason:"SCHEDULE_FIXED_INTERVAL_REQUIRED" };
    }
    if (windowed && (!payload.windowStartsAt || !payload.windowEndsAt || Date.parse(payload.windowEndsAt) <= Date.parse(payload.windowStartsAt))) {
      return { contractId:this.id,candidateId:candidate.candidateId,claimType:candidate.claimType,owner:this.owner,disposition:"NEEDS_CLARIFICATION",reason:"SCHEDULE_WINDOW_REQUIRED" };
    }
    if (floating && (payload.startsAt || payload.endsAt || payload.windowStartsAt || payload.windowEndsAt)) {
      return { contractId:this.id,candidateId:candidate.candidateId,claimType:candidate.claimType,owner:this.owner,disposition:"REJECT",reason:"FLOATING_SCHEDULE_HAS_INTERVAL" };
    }
    const normalized: ScheduleAllocationCandidatePayload = {
      label: label.slice(0,300), allocationKind: payload.allocationKind,
      ...(payload.startsAt ? { startsAt:payload.startsAt } : {}), ...(payload.endsAt ? { endsAt:payload.endsAt } : {}),
      ...(payload.windowStartsAt ? { windowStartsAt:payload.windowStartsAt } : {}), ...(payload.windowEndsAt ? { windowEndsAt:payload.windowEndsAt } : {}),
      ...(payload.dueAt ? { dueAt:payload.dueAt } : {}), ...(payload.expectedDurationSeconds ? { expectedDurationSeconds:payload.expectedDurationSeconds } : {}),
      zoneId:payload.zoneId
    };
    if (!context.source.authorizesCanonicalWrite || context.source.interactionIntent !== "RECORD") {
      return { contractId:this.id,candidateId:candidate.candidateId,claimType:candidate.claimType,owner:this.owner,disposition:"NEEDS_AUTHORIZATION",normalized,reason:"PLAYER_HAS_NOT_AUTHORIZED_CANONICAL_WRITE" };
    }
    return {
      contractId:this.id,candidateId:candidate.candidateId,claimType:candidate.claimType,owner:this.owner,disposition:"ACCEPT",normalized,
      command:{ module:"schedule",commandType:"schedule.create_allocation",args:{
        p_command_id:crypto.randomUUID(),p_label:normalized.label,p_allocation_kind:normalized.allocationKind,
        p_starts_at:normalized.startsAt ?? null,p_ends_at:normalized.endsAt ?? null,
        p_window_starts_at:normalized.windowStartsAt ?? null,p_window_ends_at:normalized.windowEndsAt ?? null,
        p_due_at:normalized.dueAt ?? null,p_expected_duration_seconds:normalized.expectedDurationSeconds ?? null,
        p_zone_id:normalized.zoneId,p_target_namespace:null,p_target_type:null,p_target_record_id:null,p_target_version_id:null
      }},
      reason:"SCHEDULE_CLAIM_ADMISSIBLE"
    };
  }
};
