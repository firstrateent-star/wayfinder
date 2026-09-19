import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { AdmissionRegistry, runSemanticAdmission, type SourceEnvelope } from "../_shared/intelligence/semantic-admission.ts";
import { recognizeTraining, trainingAdmissionContract, type TrainingSessionCandidatePayload } from "../_shared/intelligence/training-semantic.ts";
import { createIntlLocalInstantProvider, type ResolvedLocalInstant } from "../_shared/intelligence/local-time-resolver.ts";
import { createCoreLifeConceptRegistryV0 } from "../_shared/intelligence/concept-registry.ts";
import { SemanticContextProviderRegistry, type ReadOnlySemanticLoopResult } from "../_shared/intelligence/context-assembler.ts";
import { runSemanticEpisodeTurn, type SemanticEpisode } from "../_shared/intelligence/semantic-episode.ts";
import { LiveSemanticReasoner, OpenAIResponsesProvider } from "../_shared/intelligence/live-semantic-reasoner.ts";
import { createWayfinderCapacityV0 } from "../_shared/intelligence/wayfinder-capacity.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

type Stage = "TRAINING_SCOPE" | "TRAINING_MODE" | "TRAINING_DETAILS" | "TRAINING_TIME" | "TRAINING_CONFIRM";
type Focus = "LEGS" | "PUSH" | "PULL" | "FULL_BODY" | "OTHER";

type DraftSet = {
  exerciseKey: string;
  exerciseLabel: string;
  reps?: number;
  loadValue?: number;
  loadUnit?: "LB" | "KG";
  rpe?: number;
};

type TrainingDraft = {
  label: string;
  sets: DraftSet[];
  occurrencePrecision: "DAY" | "INSTANT";
  occurredLocalDate: string;
  occurredAt?: string;
  provenanceSourceId: string;
  partial: boolean;
};

type TrainingNavigatorEpisode = {
  id: string;
  kind: "TRAINING_CAPTURE";
  stage: Stage;
  startedAt: string;
  focus?: Focus;
  occurredLocalDate: string;
  lastWorkout?: TrainingDraft;
  draft?: TrainingDraft;
};

type SemanticNavigatorEpisode = {
  id: string;
  kind: "SEMANTIC";
  semantic: SemanticEpisode;
};

type NavigatorEpisode = TrainingNavigatorEpisode | SemanticNavigatorEpisode;

type Suggestion = {
  id: string;
  label: string;
  tone?: "primary" | "secondary" | "quiet";
};

type RequestBody = {
  text?: string;
  action?: string;
  episode?: NavigatorEpisode | null;
  zoneId?: string;
  sourceId?: string;
};

type TrainingRecentSet = {
  exercise_key: string;
  exercise_label: string;
  reps: number | null;
  load_value: number | null;
  load_unit: "LB" | "KG" | null;
  rpe: number | null;
};

type TrainingRecentSession = {
  id: string;
  label: string | null;
  kind: string;
  occurrence: { from: string; to: string; precision: string; zone_id: string };
  sets: TrainingRecentSet[];
};

type TrainingRecentRead = { sessions?: TrainingRecentSession[] };

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
    const detail = await response.text();
    throw new Error(`${name.toUpperCase()}_FAILED:${response.status}:${detail.slice(0, 500)}`);
  }
  return (await response.json()) as T;
}

function localDateInZone(instant: string, zoneId: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: zoneId,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date(instant));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function focusFromText(text: string): Focus | null {
  const lower = text.toLowerCase();
  if (/\b(legs?|leg day|lower body|lower-body)\b/.test(lower)) return "LEGS";
  if (/\b(push|chest|shoulders?|triceps?)\b/.test(lower)) return "PUSH";
  if (/\b(pull|back|biceps?)\b/.test(lower)) return "PULL";
  if (/\b(full body|full-body|everything)\b/.test(lower)) return "FULL_BODY";
  return null;
}

function looksLikeWorkout(text: string) {
  return /\b(worked out|workout|work out|gym|lifted|lifting|trained|training|benched|bench press|leg day)\b/i.test(text);
}

function genericDraft(focus: Focus, localDate: string, sourceId: string): TrainingDraft {
  const label = focus === "LEGS"
    ? "Lower-body strength training"
    : focus === "PUSH"
      ? "Push strength training"
      : focus === "PULL"
        ? "Pull strength training"
        : focus === "FULL_BODY"
          ? "Full-body strength training"
          : "Strength training";
  return {
    label,
    sets: [],
    occurrencePrecision: "DAY",
    occurredLocalDate: localDate,
    provenanceSourceId: sourceId,
    partial: true
  };
}

function isLowerBody(session: TrainingRecentSession) {
  if (/lower|leg/i.test(session.label ?? "")) return true;
  const words = ["squat", "leg", "lunge", "deadlift", "romanian", "rdl", "hamstring", "calf", "hip_thrust", "bulgarian"];
  return session.sets.some((set) => words.some((word) => set.exercise_key.toLowerCase().includes(word)));
}

function toDraft(session: TrainingRecentSession, localDate: string, sourceId: string): TrainingDraft {
  return {
    label: session.label || "Strength training",
    sets: session.sets.map((set) => ({
      exerciseKey: set.exercise_key,
      exerciseLabel: set.exercise_label,
      reps: set.reps ?? undefined,
      loadValue: set.load_value ?? undefined,
      loadUnit: set.load_unit ?? undefined,
      rpe: set.rpe ?? undefined
    })),
    occurrencePrecision: "DAY",
    occurredLocalDate: localDate,
    provenanceSourceId: sourceId,
    partial: session.sets.length === 0
  };
}

async function findLastLegWorkout(authHeader: string, localDate: string, sourceId: string) {
  const from = new Date(Date.now() - 120 * 86400000).toISOString();
  const to = new Date(Date.now() + 86400000).toISOString();
  const read = await rpc<TrainingRecentRead>(authHeader, "wf_training_recent_v0", { p_from: from, p_to: to, p_limit: 50 });
  const match = read.sessions?.find(isLowerBody);
  return match ? toDraft(match, localDate, sourceId) : undefined;
}

function summarizeDraft(draft: TrainingDraft) {
  if (draft.sets.length === 0) return `${draft.label}. Exercise details are unknown.`;
  const rows = draft.sets.map((set, index) => {
    const load = set.loadValue != null ? `${set.loadValue}${set.loadUnit === "KG" ? " kg" : " lb"}` : "load unknown";
    const reps = set.reps != null ? `${set.reps} reps` : "reps unknown";
    return `${index + 1}. ${set.exerciseLabel} — ${load}, ${reps}`;
  });
  return `${draft.label}\n${rows.join("\n")}`;
}

function modeSuggestions(hasLast: boolean): Suggestion[] {
  return [
    ...(hasLast ? [{ id: "USE_LAST", label: "Use last leg workout", tone: "primary" as const }] : []),
    { id: "NEW_WORKOUT", label: "Tell you about a new workout", tone: hasLast ? "secondary" : "primary" },
    { id: "GENERIC_WORKOUT", label: "Just log leg day", tone: "secondary" },
    { id: "SKIP", label: "Skip", tone: "quiet" }
  ];
}

const semanticConcepts = createCoreLifeConceptRegistryV0();
const semanticCapacity = createWayfinderCapacityV0();
const semanticProviders = new SemanticContextProviderRegistry();

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

function summarizeSemanticResult(result: ReadOnlySemanticLoopResult) {
  const graph = result.compilation.graph;
  const meaningful = graph.nodes.filter((node) => node.nodeType !== "ENTITY");
  const labels = [...new Set(meaningful.map((node) => conceptLabel(node.concept)))].slice(0, 4);
  const blocking = meaningful
    .flatMap((node) => node.unresolved ?? [])
    .find((item) => item.blocking);
  const training = meaningful.some((node) =>
    node.concept === "STRENGTH_TRAINING" &&
    node.subject.kind === "SELF" &&
    node.realityMode === "OCCURRED"
  );

  const suggestions: Suggestion[] = training
    ? [{ id: "START_TRAINING", label: "Log this as Training", tone: "primary" }]
    : [];

  if (meaningful.length === 0) {
    return {
      message: "I don’t have enough grounded meaning to place that yet. I’ll leave it unresolved rather than guess.",
      suggestions,
      disposition: "UNRESOLVED"
    };
  }

  const understood = labels.length
    ? `I understood that as ${joinNatural(labels)}.`
    : "I understood the main meaning.";

  if (blocking) {
    return {
      message: `${understood} One part still needs resolution: ${blocking.description} I’ll keep that uncertainty instead of inventing an answer.`,
      suggestions,
      disposition: "CLARIFY"
    };
  }

  const unsupported = result.compilation.routing.filter((route) => route.route !== "ROUTE_TO_DOMAIN").length;
  return {
    message: `${understood} I can carry that meaning forward in this conversation. ${unsupported > 0 ? "I won’t save the parts that do not yet have a proven canonical owner." : "Nothing becomes canonical until you explicitly confirm a domain write."}`,
    suggestions,
    disposition: training ? "UNDERSTOOD_TRAINING_AVAILABLE" : "SESSION_ONLY"
  };
}

async function runSemanticConversation(
  text: string,
  episode: SemanticNavigatorEpisode | null,
  zoneId: string,
  sourceId: string,
  now: string
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

  const outcome = await runSemanticEpisodeTurn({
    episode: episode?.semantic,
    episodeId: episode?.semantic.episodeId ?? `navigator:${crypto.randomUUID()}`,
    source,
    initialContext: { asOf: now, items: [] },
    reasoner,
    concepts: semanticConcepts,
    capacity: semanticCapacity,
    providers: semanticProviders,
    episodeLimits: { maxTurns: 12, maxContextNodes: 12 },
    semanticLimits: {
      maxReasonerPasses: 2,
      maxRequestsPerPass: 3,
      maxContextItems: 24,
      maxItemsPerRequest: 8,
      maxPersonalAliases: 12
    }
  });

  const summary = summarizeSemanticResult(outcome.result);
  const wrapped: SemanticNavigatorEpisode = {
    id: outcome.episode.episodeId,
    kind: "SEMANTIC",
    semantic: outcome.episode
  };

  return { ...summary, episode: wrapped };
}

function respond(message: string, episode: NavigatorEpisode | null, suggestions: Suggestion[] = [], extra: Record<string, unknown> = {}) {
  return {
    contract: "navigator-chat.v0.2",
    message,
    episode,
    suggestions,
    ...extra,
    retention: {
      conversation_persisted_server_side: false,
      candidate_persistence: "TRANSIENT",
      rule: "Conversation is transient semantic working state. Canonical writes occur only through an owning domain after explicit confirmation."
    }
  };
}

async function understandWorkout(text: string, episode: TrainingNavigatorEpisode, zoneId: string, sourceId: string) {
  const source: SourceEnvelope = {
    sourceId,
    sourceType: "PLAYER_TEXT",
    content: text,
    receivedAt: new Date().toISOString(),
    interactionIntent: "RECORD",
    authorizesCanonicalWrite: false,
    zoneId
  };
  const graph = recognizeTraining(source);
  const registry = new AdmissionRegistry().register(trainingAdmissionContract);
  const admitted = await runSemanticAdmission(graph, registry, { now: source.receivedAt, source });
  const decision = admitted.decisions[0];
  if (!decision) return { kind: "UNKNOWN" as const };
  if (decision.disposition === "NEEDS_CLARIFICATION") {
    return { kind: "CLARIFY" as const, message: decision.informationNeed?.questionIntent ?? "I need one more detail." };
  }
  const normalized = decision.normalized as TrainingSessionCandidatePayload | undefined;
  if (!normalized) return { kind: "UNKNOWN" as const };
  const sets: DraftSet[] = normalized.sets
    .filter((set) => Boolean(set.exerciseKey && set.exerciseLabel))
    .map((set) => ({
      exerciseKey: set.exerciseKey!,
      exerciseLabel: set.exerciseLabel!,
      reps: set.reps,
      loadValue: set.loadValue,
      loadUnit: set.loadUnit,
      rpe: set.rpe
    }));
  const draft: TrainingDraft = {
    label: normalized.label ?? (episode.focus === "LEGS" ? "Lower-body strength training" : "Strength training"),
    sets,
    occurrencePrecision: "DAY",
    occurredLocalDate: episode.occurredLocalDate,
    provenanceSourceId: sourceId,
    partial: normalized.genericStrengthSession === true || sets.length === 0
  };
  return { kind: "UNDERSTOOD" as const, draft };
}

function parseClockTime(text: string) {
  const lower = text.toLowerCase().replace(/\./g, "").trim();
  const match = lower.match(/\b(?:around\s+|at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2] ?? "0");
  const meridiem = match[3];
  if (hour > 23 || minute > 59) return null;
  if (meridiem === "pm" && hour < 12) hour += 12;
  if (meridiem === "am" && hour === 12) hour = 0;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`;
}

async function resolveClock(localDate: string, localTime: string, zoneId: string) {
  const provider = createIntlLocalInstantProvider();
  const now = new Date().toISOString();
  const result = await provider.resolve(
    {
      requestId: crypto.randomUUID(),
      capability: "time.resolve_local_instant",
      input: { localDate, localTime, timeZone: zoneId },
      asOf: now,
      purpose: "Resolve player-reported workout wall time to an occurrence instant."
    },
    { now }
  );
  if (result.status !== "RESOLVED" || !result.value) return null;
  return result.value as ResolvedLocalInstant;
}

async function persistTraining(authHeader: string, episode: TrainingNavigatorEpisode, zoneId: string) {
  const draft = episode.draft;
  if (!draft) throw new Error("TRAINING_DRAFT_REQUIRED");
  return await rpc<unknown>(authHeader, "wf_training_capture_strength_session", {
    p_command_id: crypto.randomUUID(),
    p_occurrence_precision: draft.occurrencePrecision,
    p_zone_id: zoneId,
    p_occurred_at: draft.occurrencePrecision === "INSTANT" ? draft.occurredAt ?? null : null,
    p_occurred_local_date: draft.occurrencePrecision === "DAY" ? draft.occurredLocalDate : null,
    p_label: draft.label,
    p_sets: draft.sets.map((set) => ({
      exercise_key: set.exerciseKey,
      exercise_label: set.exerciseLabel,
      reps: set.reps ?? null,
      load_value: set.loadValue ?? null,
      load_unit: set.loadUnit ?? null,
      rpe: set.rpe ?? null
    })),
    p_provenance_source_id: draft.provenanceSourceId
  });
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
  const today = localDateInZone(now, zoneId);
  let episode = body.episode ?? null;

  try {
    if ((!episode || episode.kind === "SEMANTIC") && action !== "START_TRAINING") {
      if (!text) {
        return json(respond(
          "What’s going on? Tell me naturally. I’ll carry the meaning forward in this conversation, and I won’t save anything without a proven owner and explicit confirmation.",
          episode
        ));
      }

      const semantic = await runSemanticConversation(
        text,
        episode?.kind === "SEMANTIC" ? episode : null,
        zoneId,
        sourceId,
        now
      );

      if (semantic) {
        return json(respond(
          semantic.message,
          semantic.episode,
          semantic.suggestions,
          { disposition: semantic.disposition, semantic_mode: "GENERAL_READ_ONLY" }
        ));
      }

      if (!episode && looksLikeWorkout(text)) {
        // Degrade to the already-proven Training flow when the live semantic
        // provider is not configured. This preserves existing app capability
        // without pretending broad semantic reasoning occurred.
      } else {
        return json(respond(
          "Navigator’s broader semantic reasoning is not configured in this environment yet. I won’t guess or save this. Training capture remains available.",
          null,
          [{ id: "START_TRAINING", label: "Log a workout", tone: "secondary" }],
          { disposition: "SESSION_ONLY", semantic_mode: "UNAVAILABLE" }
        ));
      }
    }

    if (action === "START_TRAINING" && episode?.kind === "SEMANTIC") {
      episode = null;
    }

    if (!episode) {
      const effectiveText = action === "START_TRAINING" && !text ? "I want to log a workout" : text;
      if (!effectiveText) return json(respond("What’s going on? Tell me naturally — I’ll only keep what I can place safely in Wayfinder.", null));
      if (!looksLikeWorkout(effectiveText)) {
        return json(respond(
          "I understand that you’re telling me something, but none of the live domains can safely own it yet. I’m not going to file it as a miscellaneous fact. Training is the first conversational domain that is live.",
          null,
          [{ id: "START_TRAINING", label: "Tell you about a workout", tone: "secondary" }],
          { disposition: "DROP", reason: "NO_LIVE_DOMAIN_CLAIM" }
        ));
      }

      const focus = focusFromText(effectiveText);
      episode = {
        id: crypto.randomUUID(),
        kind: "TRAINING_CAPTURE",
        stage: focus ? "TRAINING_MODE" : "TRAINING_SCOPE",
        startedAt: now,
        focus: focus ?? undefined,
        occurredLocalDate: /\byesterday\b/i.test(effectiveText) ? localDateInZone(new Date(Date.now() - 86400000).toISOString(), zoneId) : today
      };

      if (!focus) {
        return json(respond("Got it — you worked out. What did you train?", episode, [
          { id: "FOCUS_LEGS", label: "Legs", tone: "primary" },
          { id: "FOCUS_PUSH", label: "Push", tone: "secondary" },
          { id: "FOCUS_PULL", label: "Pull", tone: "secondary" },
          { id: "FOCUS_FULL_BODY", label: "Full body", tone: "secondary" },
          { id: "SKIP", label: "Skip", tone: "quiet" }
        ]));
      }

      if (focus === "LEGS") episode.lastWorkout = await findLastLegWorkout(authHeader, episode.occurredLocalDate, sourceId);
      return json(respond(
        focus === "LEGS" && episode.lastWorkout
          ? "Got it — legs. I found your last lower-body workout. Reuse it, tell me about today’s workout, or just record that leg day happened?"
          : `Got it — ${focus === "LEGS" ? "legs" : focus === "PUSH" ? "push" : focus === "PULL" ? "pull" : "full body"}. Tell me the workout, or keep it broad.`,
        episode,
        focus === "LEGS" ? modeSuggestions(Boolean(episode.lastWorkout)) : [
          { id: "NEW_WORKOUT", label: "Tell you the workout", tone: "primary" },
          { id: "GENERIC_WORKOUT", label: "Just log the session", tone: "secondary" },
          { id: "SKIP", label: "Skip", tone: "quiet" }
        ]
      ));
    }

    if (episode.kind !== "TRAINING_CAPTURE") return json({ error: "UNSUPPORTED_EPISODE" }, 400);

    if (episode.stage === "TRAINING_SCOPE") {
      if (action === "SKIP") return json(respond("No problem. I didn’t save anything.", null, [], { disposition: "DROP" }));
      const focus = action === "FOCUS_LEGS"
        ? "LEGS"
        : action === "FOCUS_PUSH"
          ? "PUSH"
          : action === "FOCUS_PULL"
            ? "PULL"
            : action === "FOCUS_FULL_BODY"
              ? "FULL_BODY"
              : focusFromText(text);
      if (!focus) return json(respond("What did you train? You can say legs, push, pull, or full body.", episode));
      episode = { ...episode, focus, stage: "TRAINING_MODE" };
      if (focus === "LEGS") episode.lastWorkout = await findLastLegWorkout(authHeader, episode.occurredLocalDate, sourceId);
      return json(respond(
        focus === "LEGS" && episode.lastWorkout
          ? "I found your last lower-body workout. Reuse it, tell me about today’s workout, or just record that leg day happened?"
          : `Okay — ${focus === "LEGS" ? "legs" : focus === "PUSH" ? "push" : focus === "PULL" ? "pull" : "full body"}. Tell me the workout, or keep it broad.`,
        episode,
        focus === "LEGS" ? modeSuggestions(Boolean(episode.lastWorkout)) : [
          { id: "NEW_WORKOUT", label: "Tell you the workout", tone: "primary" },
          { id: "GENERIC_WORKOUT", label: "Just log the session", tone: "secondary" },
          { id: "SKIP", label: "Skip", tone: "quiet" }
        ]
      ));
    }

    if (episode.stage === "TRAINING_MODE") {
      if (action === "SKIP") return json(respond("No problem. I didn’t save anything.", null, [], { disposition: "DROP" }));
      if (action === "USE_LAST") {
        const reused = episode.lastWorkout;
        if (!reused) return json(respond("I don’t have a previous lower-body workout I can safely reuse.", episode, modeSuggestions(false)));
        const draft: TrainingDraft = { ...reused, provenanceSourceId: sourceId };
        episode = { ...episode, draft, stage: "TRAINING_TIME" };
        return json(respond(`I’ll use the last workout as the structure:\n\n${summarizeDraft(draft)}\n\nWhen did you do it?`, episode, [
          { id: "TIME_NOW", label: "Just now", tone: "primary" },
          { id: "TIME_SKIP", label: "Skip exact time", tone: "secondary" },
          { id: "SKIP", label: "Cancel", tone: "quiet" }
        ]));
      }
      if (action === "GENERIC_WORKOUT") {
        const draft = genericDraft(episode.focus ?? "OTHER", episode.occurredLocalDate, sourceId);
        episode = { ...episode, draft, stage: "TRAINING_TIME" };
        return json(respond("Okay. I’ll keep the details unknown and only record that the strength session happened. When did you do it?", episode, [
          { id: "TIME_NOW", label: "Just now", tone: "primary" },
          { id: "TIME_SKIP", label: "Skip exact time", tone: "secondary" },
          { id: "SKIP", label: "Cancel", tone: "quiet" }
        ]));
      }
      if (action === "NEW_WORKOUT" || text) {
        episode = { ...episode, stage: "TRAINING_DETAILS" };
        if (!text) return json(respond("Tell me what you did however you remember it. I’ll structure only the details I can support. Example: “bench 185 for 8 reps for 3 sets.”", episode, [
          { id: "GENERIC_WORKOUT", label: "Just keep it broad", tone: "secondary" },
          { id: "SKIP", label: "Skip", tone: "quiet" }
        ]));
      }
    }

    if (episode.stage === "TRAINING_DETAILS") {
      if (action === "SKIP") return json(respond("No problem. I didn’t save anything.", null, [], { disposition: "DROP" }));
      if (action === "GENERIC_WORKOUT") {
        const draft = genericDraft(episode.focus ?? "OTHER", episode.occurredLocalDate, sourceId);
        episode = { ...episode, draft, stage: "TRAINING_TIME" };
        return json(respond("I’ll keep the exercise details unknown. When did you do the workout?", episode, [
          { id: "TIME_NOW", label: "Just now", tone: "primary" },
          { id: "TIME_SKIP", label: "Skip exact time", tone: "secondary" }
        ]));
      }
      if (!text) return json(respond("Tell me the workout details, or choose to keep the session broad.", episode));
      const understood = await understandWorkout(text, episode, zoneId, sourceId);
      if (understood.kind === "CLARIFY") {
        return json(respond(`${understood.message} If it’s easier, restate it as exercise + weight + reps + number of sets.`, episode, [
          { id: "GENERIC_WORKOUT", label: "Just keep it broad", tone: "secondary" },
          { id: "SKIP", label: "Skip", tone: "quiet" }
        ]));
      }
      if (understood.kind === "UNKNOWN") {
        return json(respond("I can tell you’re describing training, but I can’t structure those details safely yet. I won’t invent them. Rephrase the exercise/load/reps/sets, or let me keep only the broad session.", episode, [
          { id: "GENERIC_WORKOUT", label: "Just log the session", tone: "secondary" },
          { id: "SKIP", label: "Skip", tone: "quiet" }
        ], { disposition: "UNRESOLVED" }));
      }
      const draft = understood.draft;
      episode = { ...episode, draft, stage: "TRAINING_TIME" };
      return json(respond(`I understood this as:\n\n${summarizeDraft(draft)}\n\nWhen did you do it?`, episode, [
        { id: "TIME_NOW", label: "Just now", tone: "primary" },
        { id: "TIME_SKIP", label: "Skip exact time", tone: "secondary" },
        { id: "SKIP", label: "Cancel", tone: "quiet" }
      ]));
    }

    if (episode.stage === "TRAINING_TIME") {
      const existing = episode.draft;
      if (!existing) return json({ error: "TRAINING_DRAFT_REQUIRED" }, 400);
      if (action === "SKIP") return json(respond("Cancelled. I didn’t save the workout.", null, [], { disposition: "DROP" }));
      let draft: TrainingDraft = { ...existing };
      if (action === "TIME_NOW") {
        draft = { ...draft, occurrencePrecision: "INSTANT", occurredAt: now };
      } else if (action === "TIME_SKIP") {
        draft = { ...draft, occurrencePrecision: "DAY", occurredAt: undefined };
      } else if (text) {
        const localTime = parseClockTime(text);
        if (!localTime) return json(respond("I couldn’t place that time safely. Say something like “7 PM”, choose Just now, or skip the exact time.", episode, [
          { id: "TIME_NOW", label: "Just now", tone: "primary" },
          { id: "TIME_SKIP", label: "Skip exact time", tone: "secondary" }
        ]));
        const resolved = await resolveClock(episode.occurredLocalDate, localTime, zoneId);
        if (!resolved) return json(respond("That local time is ambiguous or invalid in your timezone. I won’t guess. Choose Just now or skip the exact time.", episode, [
          { id: "TIME_NOW", label: "Just now", tone: "primary" },
          { id: "TIME_SKIP", label: "Skip exact time", tone: "secondary" }
        ]));
        draft = { ...draft, occurrencePrecision: "INSTANT", occurredAt: resolved.utcInstant };
      } else {
        return json(respond("When did you do it?", episode, [
          { id: "TIME_NOW", label: "Just now", tone: "primary" },
          { id: "TIME_SKIP", label: "Skip exact time", tone: "secondary" }
        ]));
      }
      episode = { ...episode, draft, stage: "TRAINING_CONFIRM" };
      return json(respond(
        `Here’s what I’m ready to put into Training:\n\n${summarizeDraft(draft)}\n\n${draft.occurrencePrecision === "INSTANT" ? `Time: ${draft.occurredAt}` : `Day: ${draft.occurredLocalDate}; exact time unknown.`}\n\nConfirm it?`,
        episode,
        [
          { id: "CONFIRM", label: "Confirm & log", tone: "primary" },
          { id: "CHANGE", label: "Change something", tone: "secondary" },
          { id: "SKIP", label: "Don’t save", tone: "quiet" }
        ],
        { proposal: { domain: "training", disposition: draft.partial ? "ACCEPT_PARTIAL" : "ACCEPT" } }
      ));
    }

    if (episode.stage === "TRAINING_CONFIRM") {
      if (action === "SKIP") return json(respond("Okay — I didn’t save it.", null, [], { disposition: "DROP" }));
      if (action === "CHANGE") {
        episode = { ...episode, stage: "TRAINING_DETAILS" };
        return json(respond("Tell me what you want to change. For this first version, restate the workout details and I’ll rebuild the proposal before anything is saved.", episode, [
          { id: "GENERIC_WORKOUT", label: "Keep only the broad session", tone: "secondary" },
          { id: "SKIP", label: "Cancel", tone: "quiet" }
        ]));
      }
      if (action !== "CONFIRM") {
        return json(respond("Nothing is saved until you confirm the proposed Training record.", episode, [
          { id: "CONFIRM", label: "Confirm & log", tone: "primary" },
          { id: "CHANGE", label: "Change something", tone: "secondary" },
          { id: "SKIP", label: "Don’t save", tone: "quiet" }
        ]));
      }
      const commandResult = await persistTraining(authHeader, episode, zoneId);
      return json(respond(
        "Logged to Training. That confirmation is now canonical history — rewinding the chat won’t erase it. If something is wrong, we’ll correct the Training record instead of pretending it never happened.",
        null,
        [{ id: "START_TRAINING", label: "Log another workout", tone: "secondary" }],
        { confirmed: true, command_result: commandResult }
      ));
    }

    return json({ error: "UNHANDLED_NAVIGATOR_STATE" }, 500);
  } catch (cause) {
    console.error(cause);
    return json({ error: cause instanceof Error ? cause.message : "NAVIGATOR_RUNTIME_FAILED" }, 500);
  }
});
