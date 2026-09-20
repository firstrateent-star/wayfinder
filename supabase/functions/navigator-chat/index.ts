import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import type { SourceEnvelope } from "../_shared/intelligence/semantic-admission.ts";
import { createCoreLifeConceptRegistryV0 } from "../_shared/intelligence/concept-registry.ts";
import { SemanticContextProviderRegistry, type ReadOnlySemanticLoopResult } from "../_shared/intelligence/context-assembler.ts";
import { runSemanticEpisodeTurn, type SemanticEpisode } from "../_shared/intelligence/semantic-episode.ts";
import { LiveSemanticReasoner, OpenAIResponsesProvider } from "../_shared/intelligence/live-semantic-reasoner.ts";
import { createWayfinderCapacityV0 } from "../_shared/intelligence/wayfinder-capacity.ts";
import { createNavigatorCanonicalContextProvider } from "../_shared/intelligence/navigator-canonical-context.ts";
import {
  createWayfinderAdmissionPlanningRegistryV0,
  planSemanticAdmission,
  type AdmissionPlan
} from "../_shared/intelligence/admission-planner.ts";
import {
  authorizeStagedFulfillment,
  createWayfinderFulfillmentRegistryV0,
  fulfillAdmissionPlan,
  type AdmissionFulfillmentResult,
  type StagedAdmissionEnvelope
} from "../_shared/intelligence/admission-fulfillment.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

type SemanticNavigatorEpisode = {
  id: string;
  kind: "SEMANTIC";
  semantic: SemanticEpisode;
};

type NavigatorEpisode = SemanticNavigatorEpisode;

type Suggestion = {
  id: string;
  label: string;
  tone?: "primary" | "secondary" | "quiet";
  proposalId?: string;
};

type RequestBody = {
  text?: string;
  action?: string;
  proposalId?: string;
  episode?: NavigatorEpisode | null;
  zoneId?: string;
  sourceId?: string;
};

type StageResponse = {
  proposal_id: string;
  status: string;
  expires_at: string;
  summary: string;
  replayed: boolean;
};

type StoredEnvelope = {
  proposal_id: string;
  planner_proposal_id: string;
  episode_id: string;
  turn_id: string;
  candidate_id: string;
  domain_owner: string;
  claim_type: string;
  normalized_payload: unknown;
  source_context: StagedAdmissionEnvelope["sourceContext"];
  summary: string;
  command_id: string;
  status: "STAGED" | "APPLIED" | "REJECTED";
  command_result?: unknown;
  expires_at: string;
};

const semanticConcepts = createCoreLifeConceptRegistryV0();
const semanticCapacity = createWayfinderCapacityV0();

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" }
  });
}

async function rpc<T>(authHeader: string, name: string, args: Record<string, unknown> = {}): Promise<T> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) throw new Error("SUPABASE_RUNTIME_ENV_MISSING");

  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { Authorization: authHeader, apikey: anonKey, "Content-Type": "application/json" },
    body: JSON.stringify(args)
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`${name.toUpperCase()}_FAILED:${response.status}:${detail.slice(0, 500)}`);
  }
  return (await response.json()) as T;
}

async function serviceRpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) throw new Error("SUPABASE_SERVICE_RUNTIME_ENV_MISSING");

  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "Content-Type": "application/json" },
    body: JSON.stringify(args)
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`${name.toUpperCase()}_FAILED:${response.status}:${detail.slice(0, 500)}`);
  }
  return (await response.json()) as T;
}

async function authenticatedUserId(authHeader: string) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) throw new Error("SUPABASE_RUNTIME_ENV_MISSING");
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { Authorization: authHeader, apikey: anonKey }
  });
  if (!response.ok) throw new Error("AUTHENTICATED_USER_LOOKUP_FAILED");
  const data = await response.json() as { id?: string };
  if (!data.id) throw new Error("AUTHENTICATED_USER_ID_MISSING");
  return data.id;
}

function semanticReasoner() {
  const apiKey = Deno.env.get("OPENAI_API_KEY")?.trim();
  if (!apiKey) return null;
  return new LiveSemanticReasoner({
    provider: new OpenAIResponsesProvider({ apiKey }),
    model: Deno.env.get("WAYFINDER_SEMANTIC_MODEL")?.trim() || "gpt-5.6-luna",
    maxOutputTokens: 4500
  });
}

function conceptLabel(concept: string) {
  return semanticConcepts.get(concept)?.label ?? concept.toLowerCase().replace(/[_-]+/g, " ");
}

function joinNatural(values: string[]) {
  if (values.length === 0) return "";
  if (values.length === 1) return values[0];
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(", ")}, and ${values.at(-1)}`;
}

function respond(message: string, episode: NavigatorEpisode | null, suggestions: Suggestion[] = [], extra: Record<string, unknown> = {}) {
  return {
    contract: "navigator-chat.v0.4",
    message,
    episode,
    suggestions,
    ...extra,
    retention: {
      conversation_persisted_server_side: false,
      candidate_persistence: "TRANSIENT",
      staged_admission_persistence: "EXPIRING_NONCANONICAL_ENVELOPE",
      rule: "Conversation is transient semantic working state. Canonical writes require a server-staged proposal, explicit confirmation, owning-domain admission, and a typed domain command."
    }
  };
}

function semanticFingerprint(input: {
  episodeId: string;
  turnId: string;
  candidateId: string;
  owner: string;
  claimType: string;
  normalizedPayload: unknown;
  sourceContext: unknown;
}) {
  return crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify(input))
  ).then((buffer) => [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join(""));
}

async function stageFulfillment(
  authUserId: string,
  episode: SemanticEpisode,
  fulfillment: AdmissionFulfillmentResult
) {
  const latestTurn = episode.turns.at(-1);
  if (!latestTurn) return [] as Array<{ item: AdmissionFulfillmentResult["items"][number]; stage: StageResponse }>;

  const staged: Array<{ item: AdmissionFulfillmentResult["items"][number]; stage: StageResponse }> = [];
  for (const item of fulfillment.items) {
    if (
      item.disposition !== "READY_FOR_CONFIRMATION" ||
      !item.normalizedPayload ||
      !item.sourceContext ||
      !item.summary
    ) continue;

    const proposalId = crypto.randomUUID();
    const commandId = crypto.randomUUID();
    const fingerprint = await semanticFingerprint({
      episodeId: episode.episodeId,
      turnId: latestTurn.turnId,
      candidateId: item.candidateId,
      owner: item.owner,
      claimType: item.claimType,
      normalizedPayload: item.normalizedPayload,
      sourceContext: item.sourceContext
    });

    const stage = await serviceRpc<StageResponse>("wf_admission_stage_v0", {
      p_auth_user_id: authUserId,
      p_proposal_id: proposalId,
      p_planner_proposal_id: item.proposalId,
      p_episode_id: episode.episodeId,
      p_turn_id: latestTurn.turnId,
      p_candidate_id: item.candidateId,
      p_domain_owner: item.owner,
      p_claim_type: item.claimType,
      p_semantic_fingerprint: fingerprint,
      p_normalized_payload: item.normalizedPayload,
      p_source_context: item.sourceContext,
      p_summary: item.summary,
      p_command_id: commandId,
      p_ttl_seconds: 900
    });
    staged.push({ item, stage });
  }
  return staged;
}

function summarizeSemanticResult(
  result: ReadOnlySemanticLoopResult,
  plan: AdmissionPlan,
  fulfillment: AdmissionFulfillmentResult,
  staged: Array<{ item: AdmissionFulfillmentResult["items"][number]; stage: StageResponse }>
) {
  const meaningful = result.compilation.graph.nodes.filter((node) => node.nodeType !== "ENTITY");
  const labels = [...new Set(meaningful.map((node) => conceptLabel(node.concept)))].slice(0, 4);
  const understood = labels.length ? `I understood that as ${joinNatural(labels)}.` : "I understood the main meaning.";

  if (meaningful.length === 0) {
    return { message: "I don’t have enough grounded meaning to place that yet. I’ll leave it unresolved rather than guess.", suggestions: [] as Suggestion[], disposition: "UNRESOLVED" };
  }

  const blocking = meaningful.flatMap((node) => node.unresolved ?? []).find((item) => item.blocking);
  if (blocking) {
    return {
      message: `${understood} One part still needs resolution: ${blocking.description} I’ll keep that uncertainty instead of inventing an answer.`,
      suggestions: [] as Suggestion[],
      disposition: "CLARIFY"
    };
  }

  const clarification = fulfillment.items.find((item) => item.disposition === "NEEDS_CLARIFICATION");
  if (clarification?.question) {
    return {
      message: `${understood} ${clarification.question}`,
      suggestions: [] as Suggestion[],
      disposition: "CLARIFY"
    };
  }

  if (staged.length > 0) {
    const summaries = staged.map(({ item }) => item.summary).filter((value): value is string => Boolean(value));
    const suggestions: Suggestion[] = staged.map(({ item, stage }) => ({
      id: "CONFIRM_ADMISSION",
      proposalId: stage.proposal_id,
      label: staged.length === 1 ? `Confirm ${item.owner}` : `Confirm ${item.owner}: ${item.claimType}`,
      tone: "primary"
    }));
    return {
      message: `${understood} I can hand the following to the owning domain:\n\n${summaries.join("\n\n")}\n\nNothing is canonical until you confirm.`,
      suggestions,
      disposition: "CONFIRMATION_READY"
    };
  }

  const eligible = plan.items.some((item) => item.disposition === "NEEDS_AUTHORIZATION" || item.disposition === "READY_FOR_DOMAIN_ADMISSION");
  return {
    message: eligible
      ? `${understood} An owning domain exists, but the current meaning is not yet safe to lower into its canonical contract. I’ll keep it transient rather than improvise.`
      : `${understood} I can carry that meaning forward in this conversation. It stays transient unless an owning domain can admit it.`,
    suggestions: [] as Suggestion[],
    disposition: "SESSION_ONLY"
  };
}

async function runSemanticConversation(
  text: string,
  episode: SemanticNavigatorEpisode | null,
  zoneId: string,
  sourceId: string,
  now: string,
  authHeader: string,
  authUserId: string
) {
  const source: SourceEnvelope = {
    sourceId,
    sourceType: "PLAYER_TEXT",
    content: text,
    receivedAt: now,
    interactionIntent: "CONVERSATION",
    authorizesCanonicalWrite: false,
    zoneId
  };

  const reasoner = semanticReasoner();
  if (!reasoner) return null;

  const providers = new SemanticContextProviderRegistry().register(
    createNavigatorCanonicalContextProvider({
      concepts: semanticConcepts,
      rpc: <T>(name: string, args: Record<string, unknown> = {}) => rpc<T>(authHeader, name, args)
    })
  );

  const outcome = await runSemanticEpisodeTurn({
    episode: episode?.semantic,
    episodeId: episode?.semantic.episodeId ?? `navigator:${crypto.randomUUID()}`,
    source,
    initialContext: { asOf: now, items: [] },
    reasoner,
    concepts: semanticConcepts,
    capacity: semanticCapacity,
    providers,
    episodeLimits: { maxTurns: 12, maxContextNodes: 12 },
    semanticLimits: {
      maxReasonerPasses: 2,
      maxRequestsPerPass: 3,
      maxContextItems: 24,
      maxItemsPerRequest: 8,
      maxPersonalAliases: 12
    }
  });

  const plan = planSemanticAdmission(outcome.result.compilation, createWayfinderAdmissionPlanningRegistryV0(), now);
  const fulfillment = await fulfillAdmissionPlan(
    outcome.result.compilation,
    plan,
    outcome.result.context,
    createWayfinderFulfillmentRegistryV0()
  );
  const staged = await stageFulfillment(authUserId, outcome.episode, fulfillment);
  const summary = summarizeSemanticResult(outcome.result, plan, fulfillment, staged);

  return {
    ...summary,
    episode: { id: outcome.episode.episodeId, kind: "SEMANTIC" as const, semantic: outcome.episode },
    admissionPlan: plan,
    fulfillment,
    staged: staged.map(({ stage }) => stage)
  };
}

async function executeAuthorizedDecision(authHeader: string, decision: Awaited<ReturnType<typeof authorizeStagedFulfillment>>) {
  if (!decision.command) throw new Error("AUTHORIZED_ADMISSION_COMMAND_MISSING");
  const key = `${decision.command.module}:${decision.command.commandType}`;
  const rpcName = key === "training:training.capture_strength_session"
    ? "wf_training_capture_strength_session"
    : key === "direction:direction.create_node"
      ? "wf_direction_create_node"
      : key === "schedule:schedule.create_allocation"
        ? "wf_schedule_create_allocation"
        : key === "nutrition:nutrition.capture_intake"
          ? "wf_nutrition_capture_intake"
          : key === "practice:practice.capture_session"
            ? "wf_practice_capture_session"
          : key === "training:training.set_strength_standard"
            ? "wf_training_set_strength_standard_v0"
            : key === "nutrition:nutrition.set_protein_standard"
              ? "wf_nutrition_set_protein_standard_v0"
              : null;
  if (!rpcName) throw new Error(`UNSUPPORTED_DOMAIN_COMMAND:${key}`);
  return await rpc<unknown>(authHeader, rpcName, decision.command.args);
}

async function confirmAdmission(authHeader: string, authUserId: string, proposalId: string) {
  const stored = await serviceRpc<StoredEnvelope>("wf_admission_fetch_v0", {
    p_auth_user_id: authUserId,
    p_proposal_id: proposalId
  });

  if (stored.status === "APPLIED" || stored.status === "REJECTED") {
    return {
      replayed: true,
      stored,
      commandResult: stored.command_result
    };
  }

  const envelope: StagedAdmissionEnvelope = {
    proposalId: stored.proposal_id,
    plannerProposalId: stored.planner_proposal_id,
    episodeId: stored.episode_id,
    turnId: stored.turn_id,
    candidateId: stored.candidate_id,
    owner: stored.domain_owner,
    claimType: stored.claim_type,
    normalizedPayload: stored.normalized_payload,
    sourceContext: stored.source_context,
    summary: stored.summary,
    commandId: stored.command_id
  };

  const decision = await authorizeStagedFulfillment(envelope);
  if (!["ACCEPT", "ACCEPT_PARTIAL"].includes(decision.disposition) || !decision.command) {
    throw new Error(`STAGED_ADMISSION_NOT_ACCEPTED:${decision.disposition}:${decision.reason ?? "UNKNOWN"}`);
  }

  const commandResult = await executeAuthorizedDecision(authHeader, decision);
  await serviceRpc("wf_admission_complete_v0", {
    p_auth_user_id: authUserId,
    p_proposal_id: proposalId,
    p_command_result: commandResult
  });

  return { replayed: false, stored, decision, commandResult };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "AUTHORIZATION_REQUIRED" }, 401);

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: "INVALID_JSON" }, 400);
  }

  const now = new Date().toISOString();
  const zoneId = body.zoneId?.trim() || "UTC";
  const sourceId = body.sourceId?.trim() || crypto.randomUUID();
  const text = body.text?.trim() ?? "";
  const action = body.action?.trim().toUpperCase() ?? "";
  const episode = body.episode?.kind === "SEMANTIC" ? body.episode : null;

  try {
    const authUserId = await authenticatedUserId(authHeader);

    if (action === "CONFIRM_ADMISSION") {
      if (!body.proposalId) return json({ error: "PROPOSAL_ID_REQUIRED" }, 400);
      const confirmed = await confirmAdmission(authHeader, authUserId, body.proposalId);
      const result = confirmed.commandResult as { status?: string; error_code?: string | null } | undefined;
      const canonical = result?.status === "APPLIED" || result?.status === "NOOP";
      return json(respond(
        canonical
          ? `${confirmed.stored.summary}\n\nConfirmed. The owning domain accepted the write, and Wayfinder will recompute from canonical reality.`
          : `The owning domain rejected this proposal${result?.error_code ? `: ${result.error_code}` : "."}`,
        episode,
        [],
        {
          confirmed: canonical,
          command_result: confirmed.commandResult,
          canonical_change: canonical ? {
            module: confirmed.stored.domain_owner,
            claim_type: confirmed.stored.claim_type,
            proposal_id: confirmed.stored.proposal_id
          } : null,
          projection_refresh: canonical,
          replayed_confirmation: confirmed.replayed
        }
      ));
    }

    if (!text) {
      return json(respond(
        "What’s going on? Tell me naturally. I’ll understand first, ask only for material gaps, and stage a domain write only when a real owner can accept it.",
        episode
      ));
    }

    const semantic = await runSemanticConversation(text, episode, zoneId, sourceId, now, authHeader, authUserId);
    if (!semantic) {
      return json(respond(
        "Navigator’s broader semantic reasoner is not configured in this environment. I won’t create a write proposal from an unverified interpretation.",
        episode,
        [],
        { disposition: "SESSION_ONLY", semantic_mode: "UNAVAILABLE" }
      ));
    }

    return json(respond(
      semantic.message,
      semantic.episode,
      semantic.suggestions,
      {
        disposition: semantic.disposition,
        semantic_mode: "GENERAL_READ_ONLY",
        admission_plan: semantic.admissionPlan,
        admission_fulfillment: semantic.fulfillment,
        staged_proposals: semantic.staged
      }
    ));
  } catch (cause) {
    console.error(cause);
    return json({
      error: "NAVIGATOR_RUNTIME_FAILED",
      message: cause instanceof Error ? cause.message : "Unknown Navigator failure."
    }, 500);
  }
});
