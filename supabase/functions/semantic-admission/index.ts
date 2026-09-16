import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { AdmissionRegistry, accepted, runSemanticAdmission, type SourceEnvelope } from "../_shared/intelligence/semantic-admission.ts";
import { recognizeTraining, trainingAdmissionContract } from "../_shared/intelligence/training-semantic.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

interface RequestBody {
  text?: string;
  sourceId?: string;
  sourceType?: "PLAYER_TEXT" | "PLAYER_VOICE";
  interactionIntent?: "RECORD" | "CONVERSATION" | "ASK" | "REFLECT" | "UNKNOWN";
  authorizeWrite?: boolean;
  zoneId?: string;
  occurredAt?: string;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" }
  });
}

async function rpc<T>(authHeader: string, name: string, args: Record<string, unknown>): Promise<T> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) throw new Error("SUPABASE_RUNTIME_ENV_MISSING");

  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { Authorization: authHeader, apikey: anonKey, "Content-Type": "application/json" },
    body: JSON.stringify(args)
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${name.toUpperCase()}_FAILED:${response.status}:${text.slice(0, 500)}`);
  }
  return (await response.json()) as T;
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

  const text = body.text?.trim();
  if (!text) return json({ error: "TEXT_REQUIRED" }, 400);
  if (text.length > 4000) return json({ error: "INPUT_TOO_LONG" }, 400);

  const now = new Date().toISOString();
  const source: SourceEnvelope = {
    sourceId: body.sourceId?.trim() || crypto.randomUUID(),
    sourceType: body.sourceType ?? "PLAYER_TEXT",
    content: text,
    receivedAt: now,
    occurredAt: body.occurredAt,
    interactionIntent: body.interactionIntent ?? "CONVERSATION",
    authorizesCanonicalWrite: body.authorizeWrite === true,
    zoneId: body.zoneId ?? "UTC"
  };

  const graph = recognizeTraining(source);
  const registry = new AdmissionRegistry().register(trainingAdmissionContract);
  const result = await runSemanticAdmission(graph, registry, { now, source });

  const writes: Array<{ candidateId: string; result: unknown }> = [];
  for (const decision of result.decisions) {
    if (!accepted(decision) || !decision.command) continue;
    if (decision.command.module !== "training" || decision.command.commandType !== "training.capture_strength_session") {
      return json({ error: "UNSUPPORTED_COMMAND_PROPOSAL" }, 500);
    }
    const commandResult = await rpc<unknown>(authHeader, "wf_training_capture_strength_session", decision.command.args);
    writes.push({ candidateId: decision.candidateId, result: commandResult });
  }

  let trainingUnderstanding: unknown = null;
  if (writes.length > 0) {
    const from = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    const to = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    trainingUnderstanding = await rpc(authHeader, "wf_training_recent_v0", { p_from: from, p_to: to, p_limit: 20 });
  }

  const noClaim = graph.candidates.length === 0;
  return json({
    contract: "semantic-admission.v0.1",
    source: {
      source_id: source.sourceId,
      source_type: source.sourceType,
      interaction_intent: source.interactionIntent,
      canonical_write_authorized: source.authorizesCanonicalWrite
    },
    candidate_count: graph.candidates.length,
    decisions: result.decisions,
    unclaimed_candidate_ids: result.unclaimedCandidateIds,
    dropped: noClaim,
    drop_reason: noClaim ? "NO_DOMAIN_CLAIM" : null,
    writes,
    recomputed: writes.length > 0 ? { training_recent: trainingUnderstanding } : null,
    retention: {
      raw_input_persisted_by_semantic_admission: false,
      rule: "No owner, no persistence. Raw input is processing material, not canonical player state."
    }
  });
});
