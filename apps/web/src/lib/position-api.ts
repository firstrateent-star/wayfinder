import { supabase } from "@/lib/supabase";

export type PositionQuestionMode = "TASK_DRIVEN" | "AMBIENT" | "DISCOVERY_SESSION";

export interface PositionScheduleScope {
  from: string;
  to: string;
  zoneId: string;
}

export interface PositionQuestionOpportunity {
  opportunityId: string;
  questionKey: string;
  questionIntent: string;
  whyThisMatters: string;
  mayPersistAnswer: boolean;
  requiresExplicitAuthorizationForWrite: boolean;
  informationNeed: {
    needId: string;
    concept: string;
    priorityClass: "P0_BLOCKING" | "P1_HIGH_IMPACT" | "P2_HIGH_LEVERAGE" | "P3_CALIBRATION" | "P4_OPTIONAL";
    evidence?: unknown;
  };
}

export interface PositionScheduleAllocation {
  id: string;
  version: string;
  label: string;
  kind: "HARD" | "SOFT" | "WINDOWED" | "FLOATING";
  state: "PLANNED" | "CANCELLED";
  startsAt: string | null;
  endsAt: string | null;
  windowStartsAt: string | null;
  windowEndsAt: string | null;
  dueAt: string | null;
  zoneId: string;
}

export interface PositionDirectionNode {
  id: string;
  version: string;
  kind: "value" | "direction" | "outcome" | "commitment" | "quest" | "plan" | "action";
  title: string;
  description: string | null;
  intentState: "ACTIVE" | "PAUSED" | "WITHDRAWN";
  recordedAt: string;
}

export interface PositionInsight {
  kind: "RECORDED_CONSTRAINTS" | "RECORDED_WINDOW" | "RECORDED_OVERLAP" | "FOCUS_WINDOW";
  headline: string;
  detail: string;
  claimClass: "DETERMINISTIC_DERIVATION";
}

export interface InitialPositionRead {
  projection_type: "initial_position";
  rule_version: "initial_position_v0.2";
  computed_at: string;
  person: {
    display_name: string;
  } | null;
  foundation: {
    origin_established: boolean;
    birth_time_known: boolean;
    birth_place_known: boolean;
    body_baseline: "ESTABLISHED" | "PARTIAL" | "NOT_RECORDED";
  };
  direction: {
    current_focus: PositionDirectionNode | null;
    active_direction_count: number;
    note: string;
  };
  schedule: {
    scope: PositionScheduleScope & { intervalSemantics: "[start,end)" };
    allocations: PositionScheduleAllocation[];
    recorded_allocation_count: number;
    hard_block_count: number;
    recorded_hard_committed_seconds: number;
    next_recorded_allocation: PositionScheduleAllocation | null;
    largest_between_commitment_gap: {
      from: string;
      to: string;
      durationSeconds: number;
      after: { id: string; label: string };
      before: { id: string; label: string };
    } | null;
    overlaps: Array<{
      first: { id: string; label: string };
      second: { id: string; label: string };
      overlapSeconds: number;
    }>;
    result_coverage: "COMPLETE" | "PARTIAL";
    epistemic_coverage: "UNKNOWN";
    note: string;
  };
  insights: PositionInsight[];
  question_opportunities: PositionQuestionOpportunity[];
  does_not_assert: string[];
}

export function nextLocalDayScope(now = new Date()): PositionScheduleScope {
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2, 0, 0, 0, 0);
  const zoneId = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

  return {
    from: from.toISOString(),
    to: to.toISOString(),
    zoneId
  };
}

export async function getInitialPosition(input: {
  questionMode?: PositionQuestionMode;
  scheduleScope: PositionScheduleScope;
}) {
  const { data, error } = await supabase.functions.invoke<InitialPositionRead>("initial-position", {
    body: {
      questionMode: input.questionMode ?? "TASK_DRIVEN",
      scheduleScope: input.scheduleScope
    }
  });

  if (error) throw new Error(error.message || "Wayfinder could not assemble your position.");
  if (!data) throw new Error("Wayfinder returned no position data.");
  return data;
}
