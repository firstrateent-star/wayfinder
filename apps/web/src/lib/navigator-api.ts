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

export type NavigatorChatResponse = {
  contract: "navigator-chat.v0.2";
  message: string;
  episode: NavigatorEpisode | null;
  suggestions: NavigatorSuggestion[];
  confirmed?: boolean;
  disposition?: string;
  reason?: string;
  proposal?: { domain: string; disposition: string };
  semantic_mode?: "GENERAL_READ_ONLY";
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
