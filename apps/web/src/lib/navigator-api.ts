import { supabase } from "@/lib/supabase";

export type NavigatorSuggestion = {
  id: string;
  label: string;
  tone?: "primary" | "secondary" | "quiet";
  proposalId?: string;
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

export type NavigatorEpisode = NavigatorSemanticEpisode;

export type NavigatorAdmissionProposal = {
  proposalId: string;
  sourceId: string;
  candidateId: string;
  owner: string;
  claimType: string;
  concept: string;
  subject: { kind: "SELF" | "KNOWN_OTHER" | "UNKNOWN_OTHER" | "GENERAL"; entityRef?: string; label?: string };
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
  disposition: "READY_FOR_DOMAIN_ADMISSION" | "NEEDS_AUTHORIZATION" | "NEEDS_CLARIFICATION" | "SESSION_ONLY" | "DROP" | "REJECT";
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
};

export type NavigatorFulfillmentItem = {
  proposalId: string;
  candidateId: string;
  owner: string;
  claimType: string;
  disposition: "READY_FOR_CONFIRMATION" | "NEEDS_CLARIFICATION" | "SESSION_ONLY" | "REJECT";
  summary?: string;
  question?: string;
  reason: string;
};

export type NavigatorChatResponse = {
  contract: "navigator-chat.v0.4";
  message: string;
  episode: NavigatorEpisode | null;
  suggestions: NavigatorSuggestion[];
  confirmed?: boolean;
  disposition?: string;
  semantic_mode?: "GENERAL_READ_ONLY" | "UNAVAILABLE";
  admission_plan?: NavigatorAdmissionPlan;
  admission_fulfillment?: { sourceId: string; items: NavigatorFulfillmentItem[] };
  staged_proposals?: Array<{ proposal_id: string; status: string; expires_at: string; summary: string }>;
  command_result?: unknown;
  canonical_change?: { module: string; claim_type: string; proposal_id: string } | null;
  projection_refresh?: boolean;
  replayed_confirmation?: boolean;
};

export async function navigatorChat(input: {
  text?: string;
  action?: string;
  proposalId?: string;
  episode?: NavigatorEpisode | null;
  zoneId?: string;
  sourceId?: string;
}) {
  const { data, error } = await supabase.functions.invoke<NavigatorChatResponse>("navigator-chat", { body: input });
  if (error) throw error;
  if (!data) throw new Error("Navigator returned no response.");
  return data;
}
