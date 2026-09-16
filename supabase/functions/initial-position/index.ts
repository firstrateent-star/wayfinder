import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { buildInitialPosition } from "../_shared/intelligence/initial-position-service.ts";
import type { QuestionMode } from "../_shared/intelligence/contracts.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

interface InitialPositionRequestBody {
  questionMode?: QuestionMode;
  scheduleScope?: {
    from: string;
    to: string;
    zoneId: string;
  };
}

interface PersonRead {
  person?: {
    display_name?: string;
    birth_date?: string | null;
    birth_time_local?: string | null;
    birth_place_label?: string | null;
  } | null;
}

interface BodyRead {
  height?: unknown | null;
  weight?: unknown | null;
}

interface DirectionRead {
  nodes?: Array<{
    id: string;
    version: string;
    kind: "value" | "direction" | "outcome" | "commitment" | "quest" | "plan" | "action";
    title: string;
    description: string | null;
    intent_state: "ACTIVE" | "PAUSED" | "WITHDRAWN";
    lifecycle_status: "ACTIVE";
    recorded_at: string;
  }>;
}

interface ScheduleRead {
  allocations?: Array<{
    id: string;
    version: string;
    label: string;
    kind: "HARD" | "SOFT" | "WINDOWED" | "FLOATING";
    state: "PLANNED" | "CANCELLED";
    starts_at: string | null;
    ends_at: string | null;
    window_starts_at: string | null;
    window_ends_at: string | null;
    due_at: string | null;
    zone_id: string;
  }>;
  result_coverage?: {
    completeness?: "COMPLETE" | "PARTIAL";
  };
  epistemic_coverage?: {
    completeness?: "UNKNOWN";
  };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    }
  });
}

async function rpc<T>(authHeader: string, name: string, args: Record<string, unknown> = {}): Promise<T> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) throw new Error("SUPABASE_RUNTIME_ENV_MISSING");

  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      Authorization: authHeader,
      apikey: anonKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(args)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${name.toUpperCase()}_FAILED:${response.status}:${text.slice(0, 500)}`);
  }

  return (await response.json()) as T;
}

function defaultScope(now = new Date()) {
  const from = new Date(now.getTime());
  const to = new Date(now.getTime() + 36 * 60 * 60 * 1000);
  return {
    from: from.toISOString(),
    to: to.toISOString(),
    zoneId: "UTC"
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "AUTHORIZATION_REQUIRED" }, 401);

  let body: InitialPositionRequestBody = {};
  try {
    const text = await req.text();
    body = text.trim() ? (JSON.parse(text) as InitialPositionRequestBody) : {};
  } catch {
    return json({ error: "INVALID_JSON" }, 400);
  }

  const scope = body.scheduleScope ?? defaultScope();
  if (!Number.isFinite(Date.parse(scope.from)) || !Number.isFinite(Date.parse(scope.to)) || Date.parse(scope.to) <= Date.parse(scope.from)) {
    return json({ error: "INVALID_SCHEDULE_SCOPE" }, 400);
  }

  try {
    const [personRead, bodyRead, directionRead, scheduleRead] = await Promise.all([
      rpc<PersonRead>(authHeader, "wf_person_current_v0"),
      rpc<BodyRead>(authHeader, "wf_body_current_v0"),
      rpc<DirectionRead>(authHeader, "wf_direction_current"),
      rpc<ScheduleRead>(authHeader, "wf_schedule_current_v0", {
        p_from: scope.from,
        p_to: scope.to,
        p_limit: 50
      })
    ]);

    const person = personRead.person
      ? {
          displayName: personRead.person.display_name?.trim() || "Player",
          birthDateKnown: Boolean(personRead.person.birth_date),
          birthTimeKnown: Boolean(personRead.person.birth_time_local),
          birthPlaceKnown: Boolean(personRead.person.birth_place_label?.trim())
        }
      : null;

    const result = buildInitialPosition({
      now: new Date().toISOString(),
      questionMode: body.questionMode ?? "TASK_DRIVEN",
      person,
      body: {
        heightRecorded: Boolean(bodyRead.height),
        weightRecorded: Boolean(bodyRead.weight)
      },
      direction: {
        nodes: (directionRead.nodes ?? []).map((node) => ({
          id: node.id,
          version: node.version,
          kind: node.kind,
          title: node.title,
          description: node.description,
          intentState: node.intent_state,
          recordedAt: node.recorded_at
        }))
      },
      schedule: {
        scope: {
          from: scope.from,
          to: scope.to,
          zoneId: scope.zoneId,
          intervalSemantics: "[start,end)"
        },
        allocations: (scheduleRead.allocations ?? []).map((item) => ({
          id: item.id,
          version: item.version,
          label: item.label,
          kind: item.kind,
          state: item.state,
          startsAt: item.starts_at,
          endsAt: item.ends_at,
          windowStartsAt: item.window_starts_at,
          windowEndsAt: item.window_ends_at,
          dueAt: item.due_at,
          zoneId: item.zone_id
        })),
        resultCoverage: scheduleRead.result_coverage?.completeness ?? "PARTIAL",
        epistemicCoverage: "UNKNOWN"
      }
    });

    return json(result);
  } catch (error) {
    console.error("initial-position failure", error);
    return json(
      {
        error: "INITIAL_POSITION_FAILED",
        message: error instanceof Error ? error.message : "Unknown initial-position failure."
      },
      500
    );
  }
});
