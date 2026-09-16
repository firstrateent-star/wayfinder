import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { AdmissionRegistry, runSemanticAdmission, type SourceEnvelope } from "../_shared/intelligence/semantic-admission.ts";
import { recognizeTraining, trainingAdmissionContract, type TrainingSessionCandidatePayload } from "../_shared/intelligence/training-semantic.ts";
import { createIntlLocalInstantProvider } from "../_shared/intelligence/local-time-resolver.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

type Stage = "TRAINING_SCOPE" | "TRAINING_MODE" | "TRAINING_DETAILS" | "TRAINING_TIME" | "TRAINING_CONFIRM";
type Focus = "LEGS" | "PUSH" | "PULL" | "FULL_BODY" | "OTHER";
type OccurrencePrecision = "DAY" | "INSTANT";

interface DraftSet {
  exerciseKey: string;
  exerciseLabel: string;
  reps?: number;
  loadValue?: number;
  loadUnit?: "LB" | "KG";
  rpe?: number;
}

interface TrainingDraft {
  label: string;
  sets: DraftSet[];
  occurrencePrecision: OccurrencePrecision;
  occurredLocalDate: string;
  occurredAt?: string;
  provenanceSourceId: string;
  partial: boolean;
}

interface NavigatorEpisode {
  id: string;
  kind: "TRAINING_CAPTURE";
  stage: Stage;
  startedAt: string;
  focus?: Focus;
  occurredLocalDate: string;
  lastWorkout?: TrainingDraft;
  draft?: TrainingDraft;
}

interface NavigatorSuggestion {
  id: string;
  label: string;
  tone?: "primary" | "secondary" | "quiet";
}

interface RequestBody {
  text?: string;
  action?: string;
  episode?: NavigatorEpisode | null;
  zoneId?: string;
  sourceId?: string;
}

interface TrainingRecentSet {
  exercise_key: string;
  exercise_label: string;
  reps: number | null;
  load_value: number | null;
  load_unit: "LB" | "KG" | null;
  rpe: number | null;
}

interface TrainingRecentSession {
  id: string;
  label: string | null;
  kind: string;
  occurrence: { from: string; to: string; precision: string; zone_id: string };
  sets: TrainingRecentSet[];
}

interface TrainingRecentRead {
  sessions?: TrainingRecentSession[];
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

function localDateInZone(instant: string, zoneId: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: zoneId,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date(instant));
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
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

function lowerBodySession(session: TrainingRecentSession) {
  if (/lower|leg/i.test(session.label ?? "")) return true;
  const lowerKeys = ["squat", "leg", "lunge", "deadlift", "romanian", "rdl", "hamstring", "calf", "hip_thrust", "bulgarian"];
  return session.sets.some((set) => lowerKeys.some((term) => set.exercise_key.toLowerCase().includes(term)));
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

function genericDraft(focus: Focus, localDate: string, sourceId: string): TrainingDraft {
  const label = focus === "LEGS" ? "Lower-body strength training" : focus === "PUSH" ? "Push strength training" : focus === "PULL" ? "Pull strength training" : focus === "FULL_BODY" ? "Full-body strength training" : "Strength training";
  return {
    label,
    sets: [],
    occurrencePrecision: "DAY",
    occurredLocalDate: localDate,
    provenanceSourceId: sourceId,
    partial: true
  };
}

function summarizeDraft(draft: TrainingDraft) {
  if (draft.sets.length === 0) return `${draft.label}. Exercise details are unknown.`;
  const lines = draft.sets.map((set, index) => {
    const load = set.loadValue != null ? `${set.loadValue}${set.loadUnit === "KG" ? " kg" : " lb"}` : "load unknown";
    const reps = set.reps != null ? `${set.reps} reps` : "reps unknown";
    return `${index + 1}. ${set.exerciseLabel} — ${load}, ${reps}`;
  });
  return `${draft.label}\n${lines.join("\n")}`;
}

function suggestionsForMode(hasLast: boolean): NavigatorSuggestion[] {
  return [
    ...(hasLast ? [{ id: "USE_LAST", label: "Use last leg workout", tone: "primary" as const }] : []),
    { id: "NEW_WORKOUT", label: "Tell you about a new workout", tone: hasLast ? "secondary" : "primary" },
    { id: "GENERIC_WORKOUT", label: "Just log leg day", tone: "secondary" },
    { id: "SKIP", label: "Skip", tone: "quiet" }
  ];
}

async function recentLowerBody(authHeader: string, localDate: string, sourceId: string) {
  const to = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const from = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString();
  const recent = await rpc<TrainingRecentRead>(authHeader, "wf_training_recent_v0", { p_from: from, p_to: to, p_limit: 50 });
  const session = recent.sessions?.find(lowerBodySession);
  return session ? toDraft(session, localDate, sourceId) : undefined;
}

function withResponse(message: string, episode: NavigatorEpisode | null, suggestions: NavigatorSuggestion[] = [], extra: Record<string, unknown> = {}) {
  return {
    contract: "navigator-chat.v0.1",
    message,
    episode,
    suggestions,
    ...extra,
    retention: {
      conversation_persisted_server_side: false,
      candidate_persistence: "TRANSIENT",
      rule: "Conversation is working context. Canonical writes occur only after explicit confirmation."
    }
  };
}

async function understandTrainingDetails(text: string, episode: NavigatorEpisode, zoneId: string, sourceId: string) {
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
  const result = await runSemanticAdmission(graph, registry, { now: source.receivedAt, source });
  const decision = result.decisions[0];
  if (!decision) return { kind: "UNKNOWN" as const };
  if (decision.disposition === "NEEDS_CLARIFICATION") {
    return { kind: "CLARIFY" as const, message: decision.informationNeed?.questionIntent ?? "I need one more detail before I can structure that workout safely." };
  }
  const normalized = decision.normalized as TrainingSessionCandidatePayload | undefined;
  if (!normalized) return { kind: "UNKNOWN" as const };
  const sets = normalized.sets
    .filter((set) => set.exerciseKey && set.exerciseLabel)
    .map((set) => ({
      exerciseKey: set.exerciseKey!,
      exerciseLabel: set.exerciseLabel!,
      reps: set.reps,
      loadValue: set.loadValue,
      loadUnit: set.loadUnit,
      rpe: set.rpe
    }));
  return {
    kind: "UNDERSTOOD" as const,
    draft: {
      label: normalized.label ?? (episode.focus === "LEGS" ? "Lower-body strength training" : "Strength training"),
      sets,
      occurrencePrecision: "DAY" as const,
      occurredLocalDate: episode.occurredLocalDate,
      provenanceSourceId: sourceId,
      partial: normalized.genericStrengthSession === true || sets.length === 0
    }
  };
}

function parseTime(text: string) {
  const lower = text.trim().toLowerCase().replace(/\./g, "");
  const match = lower.match(/\b(?:around\s+|at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2] ?? "0");
  const meridiem = match[3];
  if (hour > 23 || minute > 59) return null;
  if (meridiem === "pm" && hour < 12) hour += 12;
  if (meridiem === "am" && hour === 12) hour = 0;
  if (!meridiem && hour <= 7 && /evening|night|tonight/.test(lower)) hour += 12;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`;
}

function resolveLocalInstant(localDate: string, localTime: string, zoneId: string) {
  const provider = createIntlLocalInstantProvider();
  return provider.resolve({
    id: crypto.randomUUID(),
    capability: "time.resolve_local_instant",
    input: { localDate, localTime, timeZone: zoneId },
    requestedAt: new Date().toISOString()
  });
}

async function confirmTraining(authHeader: string, episode: NavigatorEpisode, zoneId: string) {
  if (!episode.draft) throw new Error("TRAINING_DRAFT_REQUIRED");
  const draft = episode.draft;
  const result = await rpc<unknown>(authHeader, "wf_training_capture_strength_session", {
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
  return result;
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
  const text = body.text?.trim() ?? "";
  const action = body.action?.trim().toUpperCase() ?? "";
  const sourceId = body.sourceId?.trim() || crypto.randomUUID();
  const today = localDateInZone(now, zoneId);
  let episode = body.episode ?? null;

  try {
    if (!episode) {
      if (!text) {
        return json(withResponse("What’s going on? Tell me naturally — I’ll only keep what I can place safely in Wayfinder.", null));
      }
      if (!looksLikeWorkout(text)) {
        return json(withResponse("I understand that you’re telling me something, but none of the live domains can safely own it yet. I’m not going to file it as a miscellaneous fact. You can keep talking; Training is the first conversational domain that is live.", null, [
          { id: "START_TRAINING", label: "Tell you about a workout", tone: "secondary" }
        ], { disposition: "DROP", reason: "NO_LIVE_DOMAIN_CLAIM" }));
      }

      const focus = focusFromText(text);
      episode = {
        id: crypto.randomUUID(),
        kind: "TRAINING_CAPTURE",
        stage: focus ? "TRAINING_MODE" : "TRAINING_SCOPE",
        startedAt: now,
        focus: focus ?? undefined,
        occurredLocalDate: /\byesterday\b/i.test(text) ? localDateInZone(new Date(Date.now() - 86400000).toISOString(), zoneId) : today
      };

      if (!focus) {
        return json(withResponse("Got it — you worked out. What did you train?", episode, [
          { id: "FOCUS_LEGS", label: "Legs", tone: "primary" },
          { id: "FOCUS_PUSH", label: "Push", tone: "secondary" },
          { id: "FOCUS_PULL", label: "Pull", tone: "secondary" },
          { id: "FOCUS_FULL_BODY", label: "Full body", tone: "secondary" },
          { id: "SKIP", label: "Skip", tone: "quiet" }
        ]));
      }

      if (focus === "LEGS") {
        episode.lastWorkout = await recentLowerBody(authHeader, episode.occurredLocalDate, sourceId);
        return json(withResponse(
          episode.lastWorkout
            ? `Got it — legs. I found your last lower-body workout. Do you want me to use that as today’s starting structure, or tell me about a new workout?`
            : "Got it — legs. I don’t have a structured lower-body workout to reuse yet. Tell me about the new workout, or I can simply record that leg training happened.",
          episode,
          suggestionsForMode(Boolean(episode.lastWorkout))
        ));
      }

      return json(withResponse(`Got it — ${focus === "PUSH" ? "push" : focus === "PULL" ? "pull" : "full body"}. Tell me what you did, or I can record only that the session happened.`, episode, [
        { id: "NEW_WORKOUT", label: "Tell you the workout", tone: "primary" },
        { id: "GENERIC_WORKOUT", label: "Just log the session", tone: "secondary" },
        { id: "SKIP", label: "Skip", tone: "quiet" }
      ]));
    }

    if (episode.kind !== "TRAINING_CAPTURE") return json({ error: "UNSUPPORTED_EPISODE" }, 400);

    if (episode.stage === "TRAINING_SCOPE") {
      if (action === "SKIP") return json(withResponse("No problem. I didn’t save anything.", null, [], { disposition: "DROP" }));
      const focus = action === "FOCUS_LEGS" ? "LEGS" : action === "FOCUS_PUSH" ? "PUSH" : action === "FOCUS_PULL" ? "PULL" : action === "FOCUS_FULL_BODY" ? "FULL_BODY" : focusFromText(text);
      if (!focus) return json(withResponse("What did you train? You can say something like legs, push, pull, or full body.", episode));
      episode = { ...episode, focus, stage: "TRAINING_MODE" };
      if (focus === "LEGS") episode.lastWorkout = await recentLowerBody(authHeader, episode.occurredLocalDate, sourceId);
      return json(withResponse(
        focus === "LEGS" && episode.lastWorkout
          ? "I found your last lower-body workout. Reuse it, tell me about today’s workout, or just record that leg day happened?"
          : `Okay — ${focus === "LEGS" ? "legs" : focus === "PUSH" ? "push" : focus === "PULL" ? "pull" : "full body"}. Tell me the workout, or keep it broad.`,
        episode,
        focus === "LEGS" ? suggestionsForMode(Boolean(episode.lastWorkout)) : [
          { id: "NEW_WORKOUT", label: "Tell you the workout", tone: "primary" },
          { id: "GENERIC_WORKOUT", label: "Just log the session", tone: "secondary" },
          { id: "SKIP", label: "Skip", tone: "quiet" }
        ]
      ));
    }

    if (episode.stage === "TRAINING_MODE") {
      if (action === "SKIP") return json(withResponse("No problem. I didn’t save anything.", null, [], { disposition: "DROP" }));
      if (action === "USE_LAST") {
        if (!episode.lastWorkout) return json(withResponse("I don’t have a previous lower-body workout I can safely reuse.", episode, suggestionsForMode(false)));
        episode = { ...episode, draft: { ...episode.lastWorkout, provenanceSourceId: sourceId }, stage: "TRAINING_TIME" };
        return json(withResponse(`I’ll use the last workout as the structure:\n\n${summarizeDraft(episode.draft)}\n\nWhen did you do it?`, episode, [
          { id: "TIME_NOW", label: "Just now", tone: "primary" },
          { id: "TIME_SKIP", label: "Time doesn’t matter", tone: "secondary" },
          { id: "SKIP", label: "Cancel", tone: "quiet" }
        ]));
      }
      if (action === "GENERIC_WORKOUT") {
        episode = { ...episode, draft: genericDraft(episode.focus ?? "OTHER", episode.occurredLocalDate, sourceId), stage: "TRAINING_TIME" };
        return json(withResponse("Okay. I’ll keep the details unknown and only record that the strength session happened. When did you do it?", episode, [
          { id: "TIME_NOW", label: "Just now", tone: "primary" },
          { id: "TIME_SKIP", label: "Skip exact time", tone: "secondary" },
          { id: "SKIP", label: "Cancel", tone: "quiet" }
        ]));
      }
      if (action === "NEW_WORKOUT" || text) {
        episode = { ...episode, stage: "TRAINING_DETAILS" };
        if (!text) return json(withResponse("Tell me what you did however you remember it. I’ll structure only the details I can support. For example: “bench 185 for 8 reps for 3 sets.”", episode, [
          { id: "GENERIC_WORKOUT", label: "Just keep it broad", tone: "secondary" },
          { id: "SKIP", label: "Skip", tone: "quiet" }
        ]));
      }
    }

    if (episode.stage === "TRAINING_DETAILS") {
      if (action === "SKIP") return json(withResponse("No problem. I didn’t save anything.", null, [], { disposition: "DROP" }));
      if (action === "GENERIC_WORKOUT") {
        episode = { ...episode, draft: genericDraft(episode.focus ?? "OTHER", episode.occurredLocalDate, sourceId), stage: "TRAINING_TIME" };
        return json(withResponse("I’ll keep the exercise details unknown. When did you do the workout?", episode, [
          { id: "TIME_NOW", label: "Just now", tone: "primary" },
          { id: "TIME_SKIP", label: "Skip exact time", tone: "secondary" }
        ]));
      }
      if (!text) return json(withResponse("Tell me the workout details, or choose to keep the session broad.", episode));
      const understood = await understandTrainingDetails(text, episode, zoneId, sourceId);
      if (understood.kind === "CLARIFY") {
        return json(withResponse(`${understood.message} If it’s easier, restate the set as exercise + weight + reps + number of sets.`, episode, [
          { id: "GENERIC_WORKOUT", label: "Just keep it broad", tone: "secondary" },
          { id: "SKIP", label: "Skip", tone: "quiet" }
        ]));
      }
      if (understood.kind === "UNKNOWN") {
        return json(withResponse("I can tell you’re describing training, but I can’t structure those details safely yet. I won’t invent them. You can rephrase the exercise/load/reps/sets, or I can record only that the session happened.", episode, [
          { id: "GENERIC_WORKOUT", label: "Just log the session", tone: "secondary" },
          { id: "SKIP", label: "Skip", tone: "quiet" }
        ], { disposition: "UNRESOLVED" }));
      }
      episode = { ...episode, draft: understood.draft, stage: "TRAINING_TIME" };
      return json(withResponse(`I understood this as:\n\n${summarizeDraft(understood.draft)}\n\nWhen did you do it?`, episode, [
        { id: "TIME_NOW", label: "Just now", tone: "primary" },
        { id: "TIME_SKIP", label: "Skip exact time", tone: "secondary" },
        { id: "SKIP", label: "Cancel", tone: "quiet" }
      ]));
    }

    if (episode.stage === "TRAINING_TIME") {
      if (!episode.draft) return json({ error: "TRAINING_DRAFT_REQUIRED" }, 400);
      if (action === "SKIP") return json(withResponse("Cancelled. I didn’t save the workout.", null, [], { disposition: "DROP" }));
      let draft = { ...episode.draft };
      if (action === "TIME_NOW") {
        draft = { ...draft, occurrencePrecision: "INSTANT", occurredAt: now };
      } else if (action === "TIME_SKIP") {
        draft = { ...draft, occurrencePrecision: "DAY", occurredAt: undefined };
      } else if (text) {
        const localTime = parseTime(text);
        if (!localTime) return json(withResponse("I couldn’t place that time safely. Say something like “7 PM”, choose Just now, or skip the exact time.", episode, [
          { id: "TIME_NOW", label: "Just now", tone: "primary" },
          { id: "TIME_SKIP", label: "Skip exact time", tone: "secondary" }
        ]));
        const resolution = await resolveLocalInstant(episode.occurredLocalDate, localTime, zoneId);
        if (resolution.status !== "RESOLVED" || !resolution.value) {
          return json(withResponse("That local time is ambiguous or invalid in your timezone. I won’t guess. You can choose Just now or skip the exact time.", episode, [
            { id: "TIME_NOW", label: "Just now", tone: "primary" },
            { id: "TIME_SKIP", label: "Skip exact time", tone: "secondary" }
          ]));
        }
        draft = { ...draft, occurrencePrecision: "INSTANT", occurredAt: resolution.value.utcInstant };
      } else {
        return json(withResponse("When did you do it?", episode, [
          { id: "TIME_NOW", label: "Just now", tone: "primary" },
          { id: "TIME_SKIP", label: "Skip exact time", tone: "secondary" }
        ]));
      }
      episode = { ...episode, draft, stage: "TRAINING_CONFIRM" };
      return json(withResponse(`Here’s what I’m ready to put into Training:\n\n${summarizeDraft(draft)}\n\n${draft.occurrencePrecision === "INSTANT" ? `Time: ${new Date(draft.occurredAt!).toLocaleString()}` : `Day: ${draft.occurredLocalDate}; exact time unknown.`}\n\nConfirm it?`, episode, [
        { id: "CONFIRM", label: "Confirm & log", tone: "primary" },
        { id: "CHANGE", label: "Change something", tone: "secondary" },
        { id: "SKIP", label: "Don’t save", tone: "quiet" }
      ], { proposal: { domain: "training", disposition: draft.partial ? "ACCEPT_PARTIAL" : "ACCEPT" } }));
    }

    if (episode.stage === "TRAINING_CONFIRM") {
      if (action === "SKIP") return json(withResponse("Okay — I didn’t save it.", null, [], { disposition: "DROP" }));
      if (action === "CHANGE") {
        episode = { ...episode, stage: "TRAINING_DETAILS" };
        return json(withResponse("Tell me what you want to change. For this first version, the safest path is to restate the workout details; I’ll rebuild the proposal before anything is saved.", episode, [
          { id: "GENERIC_WORKOUT", label: "Keep only the broad session", tone: "secondary" },
          { id: "SKIP", label: "Cancel", tone: "quiet" }
        ]));
      }
      if (action !== "CONFIRM") return json(withResponse("Nothing is saved until you confirm the proposed Training record.", episode, [
        { id: "CONFIRM", label: "Confirm & log", tone: "primary" },
        { id: "CHANGE", label: "Change something", tone: "secondary" },
        { id: "SKIP", label: "Don’t save", tone: "quiet" }
      ]));
      const commandResult = await confirmTraining(authHeader, episode, zoneId);
      return json(withResponse("Logged to Training. That confirmation is now canonical history — rewinding the chat won’t erase it. If something is wrong, we’ll correct the Training record instead of pretending it never happened.", null, [
        { id: "START_TRAINING", label: "Log another workout", tone: "secondary" }
      ], { confirmed: true, command_result: commandResult }));
    }

    return json({ error: "UNHANDLED_NAVIGATOR_STATE" }, 500);
  } catch (cause) {
    console.error(cause);
    return json({ error: cause instanceof Error ? cause.message : "NAVIGATOR_RUNTIME_FAILED" }, 500);
  }
});
