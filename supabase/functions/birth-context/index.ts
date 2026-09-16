import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createBirthContextRuntime } from "../_shared/intelligence/birth-context-service.ts";
import type { QuestionMode } from "../_shared/intelligence/contracts.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

interface BirthContextRequestBody {
  purpose?: "NATAL_READINESS" | "FULL_NATAL_CHART";
  questionMode?: QuestionMode;
  selectedPlaceId?: string;
  includeOptionalQuestions?: boolean;
  locale?: string;
}

interface PersonRpcPayload {
  person?: {
    ref?: {
      id?: string;
      version?: string;
    };
    display_name?: string;
    birth_date?: string | null;
    birth_time_local?: string | null;
    birth_time_accuracy?: "EXACT" | "APPROXIMATE" | null;
    birth_place_label?: string | null;
  } | null;
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

async function readCurrentPerson(authHeader: string): Promise<PersonRpcPayload> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) throw new Error("SUPABASE_RUNTIME_ENV_MISSING");

  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/wf_person_current_v0`, {
    method: "POST",
    headers: {
      Authorization: authHeader,
      apikey: anonKey,
      "Content-Type": "application/json"
    },
    body: "{}"
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`PERSON_READ_FAILED:${response.status}:${text.slice(0, 500)}`);
  }

  return (await response.json()) as PersonRpcPayload;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "METHOD_NOT_ALLOWED" }, 405);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "AUTHORIZATION_REQUIRED" }, 401);

  let body: BirthContextRequestBody = {};
  try {
    const text = await req.text();
    body = text.trim() ? (JSON.parse(text) as BirthContextRequestBody) : {};
  } catch {
    return json({ error: "INVALID_JSON" }, 400);
  }

  const now = new Date().toISOString();

  try {
    const personRead = await readCurrentPerson(authHeader);
    const person = personRead.person
      ? {
          personId: personRead.person.ref?.id,
          personVersionId: personRead.person.ref?.version,
          displayName: personRead.person.display_name,
          birthDate: personRead.person.birth_date,
          birthTimeLocal: personRead.person.birth_time_local,
          birthTimeAccuracy: personRead.person.birth_time_accuracy,
          birthPlaceLabel: personRead.person.birth_place_label
        }
      : null;

    const runtime = createBirthContextRuntime();
    const result = await runtime.resolve({
      person,
      now,
      locale: body.locale ?? "en",
      purpose: body.purpose ?? "NATAL_READINESS",
      questionMode: body.questionMode ?? "TASK_DRIVEN",
      selectedPlaceId: body.selectedPlaceId,
      includeOptionalQuestions: body.includeOptionalQuestions ?? false
    });

    return json(result);
  } catch (error) {
    console.error("birth-context failure", error);
    return json(
      {
        error: "BIRTH_CONTEXT_FAILED",
        message: error instanceof Error ? error.message : "Unknown birth-context failure."
      },
      500
    );
  }
});
