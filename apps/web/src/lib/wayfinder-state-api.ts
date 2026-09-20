import { supabase } from "@/lib/supabase";
import type { InitialPositionRead, PositionQuestionMode, PositionScheduleScope } from "@/lib/position-api";

export interface WayfinderChangeCursor {
  committed_at: string;
  id: string;
}

export interface WayfinderBearingAction {
  id: string;
  version: string;
  title: string;
  intent_state: string;
  evidence_state: "CURRENT_EVIDENCE_PRESENT" | "STALE_RECORDED_EVIDENCE_ONLY" | "NO_RECORDED_EVIDENCE";
  current_qualifying_evidence_count: number;
  stale_recorded_evidence_count: number;
}

export interface WayfinderBearingRead {
  projection_type: "bearing";
  rule_version: string;
  computed_at: string;
  state: "NO_ACTIVE_ACTIONS" | "RECORDED_EVIDENCE_OF_MOVEMENT" | "NO_RECORDED_EVIDENCE_OF_MOVEMENT";
  active_action_count: number;
  evidenced_active_action_count: number;
  stale_evidence_only_action_count: number;
  actions: WayfinderBearingAction[];
}

export interface FocusBranchNode {
  id: string;
  version: string;
  kind: "value" | "direction" | "outcome" | "commitment" | "quest" | "plan" | "action";
  title: string;
  description: string | null;
  intent_state: "ACTIVE" | "PAUSED" | "WITHDRAWN";
  recorded_at: string;
  depth_from_focus: number;
}

export interface WayfinderStateRead {
  contract: "wayfinder-state.v0.5";
  computed_at: string;
  change_cursor: WayfinderChangeCursor | null;
  recomputation: {
    reason: "INITIAL_LOAD" | "NO_CHANGE" | "MODULE_CHANGE" | "COALESCED_PARTIAL_CHANGE_WINDOW";
    changedModules: string[];
    invalidated: string[];
    recomputeNow: string[];
    deferred: Array<{ target: "REQUIREMENTS" | "CHARACTER"; reason: string }>;
    navigatorContextInvalidated: boolean;
    sourceChangeCount: number;
    resultCoverage: "COMPLETE" | "PARTIAL";
  };
  position: InitialPositionRead;
  requirements: {
    projection_type: "requirements";
    rule_version: "requirements_projection_v0.1";
    configured_requirement_count: number;
    evaluations: Array<{
      requirementKey: string;
      domain: string;
      metric: string;
      unit: string;
      evaluation: {
        state: "SATISFIED" | "IN_PROGRESS" | "CLOSED_BELOW_TARGET" | "BREACHED" | "UNKNOWN";
        observedValue: number | null;
        coverage: "COMPLETE" | "PARTIAL" | "UNKNOWN";
        remainingToMinimum: number | null;
        scopeClosed: boolean;
      };
    }>;
    guidance_candidates: Array<{
      signalId: string;
      kind: "RECORDED_REQUIREMENT_GAP";
      summary: string;
      coverage: "COMPLETE" | "PARTIAL" | "UNKNOWN";
      scopeEndsAt: string;
    }>;
    unconfigured_domains: string[];
  };
  character: {
    projection_type: "character";
    rule_version: "character_v0.2";
    evidenced_facets: Array<"Might" | "Craft" | "Vigor" | "Fortune" | "Insight" | "Bond" | "Flow" | "Lore">;
    facets: Array<{
      facet: "Might" | "Craft" | "Vigor" | "Fortune" | "Insight" | "Bond" | "Flow" | "Lore";
      element: "FIRE" | "EARTH" | "WATER" | "AIR";
      state: "EVIDENCED" | "UNOBSERVED";
      growth: { state: "EVIDENCED" | "INSUFFICIENT_EVIDENCE"; summary: string };
    }>;
  };
  progression: {
    projection_type: "voyage_progression";
    rule_version: "voyage_progression_v0.1";
    state: "AVAILABLE" | "UNKNOWN";
    voyage_xp: number | null;
    encounter_count: number | null;
    xp_unit: "ONE_PER_UNIQUE_CANONICAL_ENCOUNTER";
    configured_providers: Array<{
      id: "training.strength-session-encounter.v0.1";
      domain: "training";
      encounterKind: "TRAINING_STRENGTH_SESSION";
      xpPerEncounter: 1;
      status: "AVAILABLE" | "UNKNOWN";
    }>;
    recent_encounters: Array<{
      encounterKey: string;
      encounterKind: "TRAINING_STRENGTH_SESSION";
      providerId: "training.strength-session-encounter.v0.1";
      domain: "training";
      xp: 1;
      occurredAt: string;
      label: string | null;
      source: { namespace: string; type: string; id: string; version: string };
    }>;
    count_coverage: "COMPLETE" | "UNKNOWN";
    epistemic_coverage: "UNKNOWN" | "PARTIAL" | "COMPLETE";
    does_not_assert: string[];
  };
  skills: {
    projection_type: "skills";
    rule_version: "skills_v0.2";
    computed_at: string;
    configured_skill_count: number;
    observed_skill_count: number;
    skills: Array<{
      skillKey: string;
      label: string;
      association: {
        mode: "DETERMINISTIC_DOMAIN" | "GOVERNED_PRACTICE_ALIAS";
        providerId: string;
      };
      state: "OBSERVED" | "UNOBSERVED" | "UNKNOWN";
      experience: {
        unit: "UNIQUE_GOVERNED_ENCOUNTER";
        encounterCount: number | null;
        firstEvidencedAt: string | null;
        lastEvidencedAt: string | null;
        recentEncounters: Array<{
          encounterKey: string;
          skillExperienceKey: string;
          occurredAt: string;
          source: {
            namespace: "training" | "practice";
            type: "session";
            id: string;
            version: string;
          };
          practice?: {
            id: string;
            name: string;
          };
        }>;
      };
      sharpness: {
        mode: "UNKNOWN" | "UNOBSERVED" | "RECENCY_ONLY" | "CADENCE_AWARE";
        state: "UNKNOWN" | "UNOBSERVED" | "UNESTABLISHED" | "SHARP" | "WARM" | "COOL" | "DORMANT";
        currentGapSeconds: number | null;
        typicalIntervalSeconds: number | null;
        cadenceSampleCount: number;
        cadenceRatio: number | null;
      };
      capability: { state: "UNKNOWN"; note: string };
      mastery: { state: "NOT_EVALUATED"; note: string };
      epistemicCoverage: "UNKNOWN" | "PARTIAL" | "COMPLETE";
      doesNotAssert: string[];
    }>;
    does_not_assert: string[];
  };
  bearing: WayfinderBearingRead;
  guidance_candidates: Array<{
    signalId: string;
    kind: "RECORDED_REQUIREMENT_GAP";
    summary: string;
    coverage: "COMPLETE" | "PARTIAL" | "UNKNOWN";
    scopeEndsAt: string;
  }>;
  helm: {
    projection_type: "helm_state";
    rule_version: "helm_state_v0.1";
    current_direction: InitialPositionRead["direction"]["current_focus"];
    focus_branch: {
      focus_id: string | null;
      nodes: FocusBranchNode[];
      actions: FocusBranchNode[];
      outcomes: FocusBranchNode[];
    };
    bearing: {
      state: WayfinderBearingRead["state"];
      active_action_count: number;
      focus_branch_action_count: number;
      actions: WayfinderBearingAction[];
    };
    primary_insight: InitialPositionRead["insights"][number] | null;
    note: string;
    does_not_assert: string[];
  };
  invariants: {
    projectionsPersisted: false;
    canonicalSourceOfTruth: true;
    moduleChangeIsInvalidationOnly: true;
    requirementsRecomputed: true;
    characterRecomputed: true;
    progressionRecomputed: true;
    progressionPersisted: false;
    skillsRecomputed: true;
    skillsPersisted: false;
    characterGrowthAsserted: boolean;
    voyageXpDoesNotMutateCharacter: true;
    skillExperienceDoesNotAssertCapability: true;
    sharpnessDoesNotMutateExperience: true;
    requirementDefaultsInvented: false;
  };
}

export async function getWayfinderState(input: {
  questionMode?: PositionQuestionMode;
  scheduleScope: PositionScheduleScope;
  changeCursor?: WayfinderChangeCursor | null;
}) {
  const { data, error } = await supabase.functions.invoke<WayfinderStateRead>("wayfinder-state", {
    body: {
      questionMode: input.questionMode ?? "TASK_DRIVEN",
      scheduleScope: input.scheduleScope,
      changeCursor: input.changeCursor ?? null
    }
  });

  if (error) throw new Error(error.message || "Wayfinder could not recompute your current state.");
  if (!data) throw new Error("Wayfinder returned no current-state data.");
  return data;
}
