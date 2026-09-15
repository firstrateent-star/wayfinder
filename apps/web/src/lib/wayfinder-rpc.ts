import { supabase } from "@/lib/supabase";
import type { CommandResponse, HelmRead, JourneyRead, OwnerBootstrap } from "@/lib/wayfinder-types";

function rpcErrorMessage(error: {
  message?: string;
  details?: string;
  hint?: string;
  code?: string;
}) {
  const parts = [
    error.message,
    error.details && error.details !== error.message ? error.details : null,
    error.hint ? `Hint: ${error.hint}` : null,
    error.code ? `Code: ${error.code}` : null
  ].filter((part): part is string => Boolean(part));

  return parts.join(" · ") || "Wayfinder RPC failed.";
}

async function rpc<T>(name: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(name, args ?? {});
  if (error) throw new Error(rpcErrorMessage(error));
  return data as T;
}

function commandId() {
  return crypto.randomUUID();
}

export async function ensureOwner(timezone: string): Promise<OwnerBootstrap> {
  return rpc<OwnerBootstrap>("wf_ensure_owner", { p_timezone: timezone });
}

export async function getHelm(input: {
  from: string;
  to: string;
  sessionLimit?: number;
}): Promise<HelmRead> {
  return rpc<HelmRead>("wf_helm_v0", {
    p_from: input.from,
    p_to: input.to,
    p_session_limit: input.sessionLimit ?? 20
  });
}

export async function getJourney(input: {
  from: string;
  to: string;
  limit?: number;
}): Promise<JourneyRead> {
  return rpc<JourneyRead>("wf_journey_v0", {
    p_from: input.from,
    p_to: input.to,
    p_limit: input.limit ?? 100
  });
}

export async function captureDirectionNode(input: {
  kind: "value" | "direction" | "outcome" | "commitment" | "quest" | "plan" | "action";
  title: string;
  description?: string;
  intentState?: "ACTIVE" | "PAUSED" | "WITHDRAWN";
  supportsTargetId?: string | null;
  commandId?: string;
}): Promise<CommandResponse> {
  return rpc<CommandResponse>("wf_direction_capture_node", {
    p_command_id: input.commandId ?? commandId(),
    p_kind: input.kind,
    p_title: input.title,
    p_description: input.description ?? null,
    p_intent_state: input.intentState ?? "ACTIVE",
    p_supports_target_id: input.supportsTargetId ?? null
  });
}

export async function createDirectionNode(input: {
  kind: "value" | "direction" | "outcome" | "commitment" | "quest" | "plan" | "action";
  title: string;
  description?: string;
  intentState?: "ACTIVE" | "PAUSED" | "WITHDRAWN";
  commandId?: string;
}): Promise<CommandResponse> {
  return rpc<CommandResponse>("wf_direction_create_node", {
    p_command_id: input.commandId ?? commandId(),
    p_kind: input.kind,
    p_title: input.title,
    p_description: input.description ?? null,
    p_intent_state: input.intentState ?? "ACTIVE"
  });
}

export async function createDirectionEdge(input: {
  fromNodeId: string;
  toNodeId: string;
  relation?: "SUPPORTS";
  commandId?: string;
}): Promise<CommandResponse> {
  return rpc<CommandResponse>("wf_direction_create_edge", {
    p_command_id: input.commandId ?? commandId(),
    p_from_node_id: input.fromNodeId,
    p_to_node_id: input.toNodeId,
    p_relation: input.relation ?? "SUPPORTS"
  });
}

export async function createPractice(input: {
  name: string;
  description?: string;
  commandId?: string;
}): Promise<CommandResponse> {
  return rpc<CommandResponse>("wf_practice_create", {
    p_command_id: input.commandId ?? commandId(),
    p_name: input.name,
    p_description: input.description ?? null
  });
}

export async function capturePracticeSession(input: {
  practiceId?: string | null;
  newPracticeName?: string | null;
  newPracticeDescription?: string | null;
  occurredFrom: string;
  occurredTo?: string | null;
  fromPrecision?: string;
  toPrecision?: string | null;
  zoneId?: string | null;
  durationSeconds?: number | null;
  focus?: string | null;
  commandId?: string;
}): Promise<CommandResponse> {
  return rpc<CommandResponse>("wf_practice_capture_session", {
    p_command_id: input.commandId ?? commandId(),
    p_practice_id: input.practiceId ?? null,
    p_new_practice_name: input.newPracticeName ?? null,
    p_new_practice_description: input.newPracticeDescription ?? null,
    p_occurred_from: input.occurredFrom,
    p_occurred_to: input.occurredTo ?? null,
    p_from_precision: input.fromPrecision ?? "INSTANT",
    p_to_precision: input.toPrecision ?? (input.occurredTo ? "INSTANT" : null),
    p_zone_id: input.zoneId ?? null,
    p_duration_seconds: input.durationSeconds ?? null,
    p_focus: input.focus ?? null
  });
}

export async function logPracticeSession(input: {
  practiceId: string;
  occurredFrom: string;
  occurredTo?: string | null;
  fromPrecision?: string;
  toPrecision?: string | null;
  zoneId?: string | null;
  durationSeconds?: number | null;
  focus?: string | null;
  commandId?: string;
}): Promise<CommandResponse> {
  return rpc<CommandResponse>("wf_practice_log_session", {
    p_command_id: input.commandId ?? commandId(),
    p_practice_id: input.practiceId,
    p_occurred_from: input.occurredFrom,
    p_occurred_to: input.occurredTo ?? null,
    p_from_precision: input.fromPrecision ?? "INSTANT",
    p_to_precision: input.toPrecision ?? (input.occurredTo ? "INSTANT" : null),
    p_zone_id: input.zoneId ?? null,
    p_duration_seconds: input.durationSeconds ?? null,
    p_focus: input.focus ?? null
  });
}

export async function correctPracticeSession(input: {
  sessionId: string;
  expectedVersionId: string;
  practiceId: string;
  occurredFrom: string;
  occurredTo?: string | null;
  fromPrecision?: string;
  toPrecision?: string | null;
  zoneId?: string | null;
  durationSeconds?: number | null;
  focus?: string | null;
  commandId?: string;
}): Promise<CommandResponse> {
  return rpc<CommandResponse>("wf_practice_correct_session", {
    p_command_id: input.commandId ?? commandId(),
    p_session_id: input.sessionId,
    p_expected_version_id: input.expectedVersionId,
    p_practice_id: input.practiceId,
    p_occurred_from: input.occurredFrom,
    p_occurred_to: input.occurredTo ?? null,
    p_from_precision: input.fromPrecision ?? "INSTANT",
    p_to_precision: input.toPrecision ?? (input.occurredTo ? "INSTANT" : null),
    p_zone_id: input.zoneId ?? null,
    p_duration_seconds: input.durationSeconds ?? null,
    p_focus: input.focus ?? null
  });
}

export async function attachFulfillmentEvidence(input: {
  sourceSessionId: string;
  sourceVersionId: string;
  targetActionId: string;
  targetVersionId: string;
  reason?: string;
  commandId?: string;
}): Promise<CommandResponse> {
  return rpc<CommandResponse>("wf_evidence_create_fulfillment_link", {
    p_command_id: input.commandId ?? commandId(),
    p_source_session_id: input.sourceSessionId,
    p_source_version_id: input.sourceVersionId,
    p_target_action_id: input.targetActionId,
    p_target_version_id: input.targetVersionId,
    p_reason: input.reason ?? null
  });
}
