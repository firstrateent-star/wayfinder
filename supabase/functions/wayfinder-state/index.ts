import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { buildInitialPosition } from "../_shared/intelligence/initial-position-service.ts";
import { planRecomputation, type ModuleChangeRead } from "../_shared/intelligence/recomputation-planner.ts";
import { buildHelmState, type BearingRead, type DirectionGraphRead } from "../_shared/intelligence/wayfinder-state-service.ts";
import { buildRequirementsProjection, type RequirementInputRead } from "../_shared/intelligence/requirement-providers.ts";
import { buildCharacterProjection, type TrainingCharacterRead } from "../_shared/intelligence/character-projection.ts";
import { buildVoyageProgression, type TrainingVoyageProgressionInputRead } from "../_shared/intelligence/voyage-progression.ts";
import {
  buildSkillsProjection,
  practiceSkillProvider,
  trainingStrengthSkillProvider,
  type PracticeSkillInputRead,
  type TrainingStrengthSkillInputRead
} from "../_shared/intelligence/skill-projection.ts";
import { createWayfinderSkillConceptRegistryV0 } from "../_shared/intelligence/skill-association.ts";
import type { QuestionMode } from "../_shared/intelligence/contracts.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

interface RequestBody {
  questionMode?: QuestionMode;
  scheduleScope?: { from: string; to: string; zoneId: string };
  changeCursor?: { committed_at: string; id: string } | null;
}

interface PersonRead {
  person?: {
    display_name?: string;
    birth_date?: string | null;
    birth_time_local?: string | null;
    birth_place_label?: string | null;
  } | null;
}

interface BodyRead { height?: unknown | null; weight?: unknown | null; }

interface ScheduleRead {
  allocations?: Array<{
    id: string; version: string; label: string;
    kind: "HARD" | "SOFT" | "WINDOWED" | "FLOATING";
    state: "PLANNED" | "CANCELLED";
    starts_at: string | null; ends_at: string | null;
    window_starts_at: string | null; window_ends_at: string | null;
    due_at: string | null; zone_id: string;
  }>;
  result_coverage?: { completeness?: "COMPLETE" | "PARTIAL" };
}

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
    throw new Error(`${name.toUpperCase()}_FAILED:${response.status}:${detail.slice(0,500)}`);
  }
  return await response.json() as T;
}

function defaultScope(now = new Date()) {
  return {
    from: now.toISOString(),
    to: new Date(now.getTime() + 36 * 60 * 60 * 1000).toISOString(),
    zoneId: "UTC"
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "AUTHORIZATION_REQUIRED" }, 401);

  let body: RequestBody = {};
  try {
    const text = await req.text();
    body = text.trim() ? JSON.parse(text) : {};
  } catch {
    return json({ error: "INVALID_JSON" }, 400);
  }

  const scope = body.scheduleScope ?? defaultScope();
  if (!Number.isFinite(Date.parse(scope.from)) || !Number.isFinite(Date.parse(scope.to)) || Date.parse(scope.to) <= Date.parse(scope.from)) {
    return json({ error: "INVALID_SCHEDULE_SCOPE" }, 400);
  }
  if (body.changeCursor && (!Number.isFinite(Date.parse(body.changeCursor.committed_at)) || !body.changeCursor.id)) {
    return json({ error: "INVALID_CHANGE_CURSOR" }, 400);
  }

  try {
    const computedAt = new Date().toISOString();
    const characterFrom = new Date(Date.parse(computedAt) - 90 * 24 * 60 * 60 * 1000).toISOString();
    const skillConcepts = createWayfinderSkillConceptRegistryV0();
    const musicProductionSkill = skillConcepts.get("creative.music_production")!;
    const drawingSkill = skillConcepts.get("creative.drawing")!;
    const [personRead, bodyRead, directionRead, scheduleRead, bearing, changeRead, trainingRequirement, nutritionRequirement, trainingCharacterRead, trainingVoyageRead, trainingSkillRead, musicProductionSkillRead, drawingSkillRead] = await Promise.all([
      rpc<PersonRead>(authHeader, "wf_person_current_v0"),
      rpc<BodyRead>(authHeader, "wf_body_current_v0"),
      rpc<DirectionGraphRead>(authHeader, "wf_direction_current"),
      rpc<ScheduleRead>(authHeader, "wf_schedule_current_v0", { p_from: scope.from, p_to: scope.to, p_limit: 50 }),
      rpc<BearingRead>(authHeader, "wf_bearing_v0"),
      rpc<ModuleChangeRead>(authHeader, "wf_module_changes_v0", {
        p_after_committed_at: body.changeCursor?.committed_at ?? null,
        p_after_id: body.changeCursor?.id ?? null,
        p_limit: 100
      }),
      rpc<RequirementInputRead>(authHeader, "wf_training_strength_requirement_input_v0", { p_as_of: computedAt }),
      rpc<RequirementInputRead>(authHeader, "wf_nutrition_protein_requirement_input_v0", { p_as_of: computedAt }),
      rpc<TrainingCharacterRead>(authHeader, "wf_training_recent_v0", {
        p_from: characterFrom,
        p_to: computedAt,
        p_limit: 100
      }),
      rpc<TrainingVoyageProgressionInputRead>(authHeader, "wf_training_voyage_progression_input_v0", {
        p_as_of: computedAt,
        p_recent_limit: 25
      }),
      rpc<TrainingStrengthSkillInputRead>(authHeader, "wf_training_strength_skill_input_v0", {
        p_as_of: computedAt,
        p_recent_limit: 25
      }),
      rpc<PracticeSkillInputRead>(authHeader, "wf_practice_skill_input_v0", {
        p_normalized_practice_names: skillConcepts.practiceAliasesFor(musicProductionSkill.skillKey),
        p_as_of: computedAt,
        p_recent_limit: 25
      }),
      rpc<PracticeSkillInputRead>(authHeader, "wf_practice_skill_input_v0", {
        p_normalized_practice_names: skillConcepts.practiceAliasesFor(drawingSkill.skillKey),
        p_as_of: computedAt,
        p_recent_limit: 25
      })
    ]);

    const position = buildInitialPosition({
      now: computedAt,
      questionMode: body.questionMode ?? "TASK_DRIVEN",
      person: personRead.person ? {
        displayName: personRead.person.display_name?.trim() || "Player",
        birthDateKnown: Boolean(personRead.person.birth_date),
        birthTimeKnown: Boolean(personRead.person.birth_time_local),
        birthPlaceKnown: Boolean(personRead.person.birth_place_label?.trim())
      } : null,
      body: {
        heightRecorded: Boolean(bodyRead.height),
        weightRecorded: Boolean(bodyRead.weight)
      },
      direction: {
        nodes: (directionRead.nodes ?? []).map((node) => ({
          id: node.id, version: node.version, kind: node.kind, title: node.title,
          description: node.description, intentState: node.intent_state, recordedAt: node.recorded_at
        }))
      },
      schedule: {
        scope: { from: scope.from, to: scope.to, zoneId: scope.zoneId, intervalSemantics: "[start,end)" },
        allocations: (scheduleRead.allocations ?? []).map((item) => ({
          id: item.id, version: item.version, label: item.label, kind: item.kind, state: item.state,
          startsAt: item.starts_at, endsAt: item.ends_at,
          windowStartsAt: item.window_starts_at, windowEndsAt: item.window_ends_at,
          dueAt: item.due_at, zoneId: item.zone_id
        })),
        resultCoverage: scheduleRead.result_coverage?.completeness ?? "PARTIAL",
        epistemicCoverage: "UNKNOWN"
      }
    });

    const requirements = buildRequirementsProjection([
      { domain: "training", read: trainingRequirement },
      { domain: "nutrition", read: nutritionRequirement }
    ], computedAt);
    const character = buildCharacterProjection({
      training: trainingCharacterRead,
      computedAt
    });
    const progression = buildVoyageProgression({
      training: trainingVoyageRead,
      computedAt
    });
    const skills = buildSkillsProjection({
      providers: [
        trainingStrengthSkillProvider(trainingSkillRead),
        practiceSkillProvider({
          skillKey: musicProductionSkill.skillKey,
          label: musicProductionSkill.label,
          read: musicProductionSkillRead
        }),
        practiceSkillProvider({
          skillKey: drawingSkill.skillKey,
          label: drawingSkill.label,
          read: drawingSkillRead
        })
      ],
      computedAt
    });
    const recomputation = planRecomputation(changeRead);
    const helm = buildHelmState({ position, bearing, direction: directionRead });

    return json({
      contract: "wayfinder-state.v0.5",
      computed_at: computedAt,
      change_cursor: changeRead.cursor,
      recomputation,
      position,
      requirements,
      character,
      progression,
      skills,
      bearing,
      guidance_candidates: requirements.guidance_candidates,
      helm,
      invariants: {
        projectionsPersisted: false,
        canonicalSourceOfTruth: true,
        moduleChangeIsInvalidationOnly: true,
        requirementsRecomputed: true,
        characterRecomputed: true,
        progressionRecomputed: true,
        progressionPersisted: false,
        skillsRecomputed: true,
        skillsPersisted: false,
        characterGrowthAsserted: character.facets.some((facet) => facet.growth.state === "EVIDENCED"),
        voyageXpDoesNotMutateCharacter: true,
        skillExperienceDoesNotAssertCapability: true,
        sharpnessDoesNotMutateExperience: true,
        requirementDefaultsInvented: false
      }
    });
  } catch (cause) {
    console.error(cause);
    return json({
      error: "WAYFINDER_STATE_FAILED",
      message: cause instanceof Error ? cause.message : "Unknown Wayfinder State failure."
    }, 500);
  }
});
