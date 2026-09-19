import { supabase } from "@/lib/supabase";

export type NavigatorSuggestion = {
  id: string;
  label: string;
  tone?: "primary" | "secondary" | "quiet";
};

export type NavigatorDraftSet = {
  exerciseKey: string;
  exerciseLabel: string;
  reps?: number;
  loadValue?: number;
  loadUnit?: "LB" | "KG";
  rpe?: number;
};

export type NavigatorTrainingDraft = {
  label: string;
  sets: NavigatorDraftSet[];
  occurrencePrecision: "DAY" | "INSTANT";
  occurredLocalDate: string;
  occurredAt?: string;
  provenanceSourceId: string;
  partial: boolean;
};

export type NavigatorTrainingEpisode = {
  id: string;
  kind: "TRAINING_CAPTURE";
  stage: "TRAINING_SCOPE" | "TRAINING_MODE" | "TRAINING_DETAILS" | "TRAINING_TIME" | "TRAINING_CONFIRM";
  startedAt: string;
  focus?: "LEGS" | "PUSH" | "PULL" | "FULL_BODY" | "OTHER";
  occurredLocalDate: string;
  lastWorkout?: NavigatorTrainingDraft;
  draft?: NavigatorTrainingDraft;
};

export type NavigatorSemanticEpisode = {
  id: string;
  kind: "SEMANTIC";
  semantic: {
    episodeId: string;
    status: "OPEN" | "CLOSED";
    startedAt: string;
    updatedAt: string;
    turns: Array<{
      turnId: string;
      sequence: number;
      sourceId: string;
      receivedAt: string;
      graph: unknown;
      routing: unknown[];
      executedContextRequests: unknown[];
      reasonerPasses: number;
    }>;
  };
};

export type NavigatorEpisode = NavigatorTrainingEpisode | NavigatorSemanticEpisode;

export type NavigatorAdmissionProposal = {
  proposalId: string;
  sourceId: string;
  candidateId: string;
  owner: string;
  claimType: string;
  concept: string;
  subject: {
    kind: "SELF" | "KNOWN_OTHER" | "UNKNOWN_OTHER" | "GENERAL";
    entityRef?: string;
    label?: string;
  };
  realityMode: string;
  certainty: string;
  sourceSpans: string[];
  contextRefs: string[];
  authorization: "PRESENT" | "REQUIRED";
  policyId: string;
  policyVersion: string;
  transient: true;
};

export type NavigatorAdmissionPlanItem = {
  candidateId: string;
  concept: string;
  route: "ROUTE_TO_DOMAIN" | "CLARIFY" | "SESSION_ONLY" | "DROP";
  disposition:
    | "READY_FOR_DOMAIN_ADMISSION"
    | "NEEDS_AUTHORIZATION"
    | "NEEDS_CLARIFICATION"
    | "SESSION_ONLY"
    | "DROP"
    | "REJECT";
  owner?: string;
  claimType?: string;
  proposalId?: string;
  reason: string;
};

export type NavigatorAdmissionPlan = {
  sourceId: string;
  generatedAt: string;
  proposals: NavigatorAdmissionProposal[];
  items: NavigatorAdmissionPlanItem[];
  validationErrors: string[];
  invariants: {
    executesCommands: false;
    persistsCandidates: false;
    modelChoosesOwner: false;
  };
};

export type NavigatorChatResponse = {
  contract: "navigator-chat.v0.3";
  message: string;
  episode: NavigatorEpisode | null;
  suggestions: NavigatorSuggestion[];
  confirmed?: boolean;
  disposition?: string;
  reason?: string;
  proposal?: { domain: string; disposition: string };
  semantic_mode?: "GENERAL_READ_ONLY" | "UNAVAILABLE";
  admission_plan?: NavigatorAdmissionPlan;
  command_result?: unknown;
  retention?: {
    conversation_persisted_server_side: boolean;
    candidate_persistence: string;
    rule: string;
  };
};

export async function navigatorChat(input: {
  text?: string;
  action?: string;
  episode?: NavigatorEpisode | null;
  zoneId?: string;
  sourceId?: string;
}) {
  const { data, error } = await supabase.functions.invoke<NavigatorChatResponse>("navigator-chat", {
    body: input
  });
  if (error) throw error;
  if (!data) throw new Error("Navigator returned no response.");
  return data;
}
