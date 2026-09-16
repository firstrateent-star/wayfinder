import type {
  InformationNeed,
  QuestionMode,
  QuestionOpportunity,
  QuestionSpec
} from "./contracts.ts";
import { QuestionPlanner } from "./question-planner.ts";

export interface InitialPositionPersonSnapshot {
  displayName: string;
  birthDateKnown: boolean;
  birthTimeKnown: boolean;
  birthPlaceKnown: boolean;
}

export interface InitialPositionBodySnapshot {
  heightRecorded: boolean;
  weightRecorded: boolean;
}

export interface InitialPositionScheduleItem {
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

export interface InitialPositionScheduleSnapshot {
  scope: {
    from: string;
    to: string;
    zoneId: string;
    intervalSemantics: "[start,end)";
  };
  allocations: InitialPositionScheduleItem[];
  resultCoverage: "COMPLETE" | "PARTIAL";
  epistemicCoverage: "UNKNOWN";
}

export interface InitialPositionInput {
  now: string;
  questionMode: QuestionMode;
  person: InitialPositionPersonSnapshot | null;
  body: InitialPositionBodySnapshot;
  schedule: InitialPositionScheduleSnapshot;
}

export type BodyBaselineState = "ESTABLISHED" | "PARTIAL" | "NOT_RECORDED";

export interface InitialPositionProjection {
  projection_type: "initial_position";
  rule_version: "initial_position_v0.1";
  computed_at: string;
  person: {
    display_name: string;
  } | null;
  foundation: {
    origin_established: boolean;
    birth_time_known: boolean;
    birth_place_known: boolean;
    body_baseline: BodyBaselineState;
  };
  schedule: {
    scope: InitialPositionScheduleSnapshot["scope"];
    recorded_allocation_count: number;
    next_recorded_allocation: InitialPositionScheduleItem | null;
    result_coverage: "COMPLETE" | "PARTIAL";
    epistemic_coverage: "UNKNOWN";
    note: string;
  };
  question_opportunities: QuestionOpportunity[];
  does_not_assert: string[];
}

const scheduleQuestionSpec: QuestionSpec = {
  concept: "schedule.next_day.coverage",
  questionKey: "schedule.next_day.coverage.v1",
  questionIntent:
    "Learn whether the player has a fixed commitment inside the supplied next-day schedule scope that Wayfinder does not yet know about.",
  expectedAnswerShape: "yes/no; if yes, a short label and local start/end time",
  whyThisMatters:
    "Fixed time constraints materially improve Navigator planning, but missing schedule records must never be treated as free time.",
  mayPersistAnswer: true,
  requiresExplicitAuthorizationForWrite: true
};

function bodyBaseline(body: InitialPositionBodySnapshot): BodyBaselineState {
  if (body.heightRecorded && body.weightRecorded) return "ESTABLISHED";
  if (body.heightRecorded || body.weightRecorded) return "PARTIAL";
  return "NOT_RECORDED";
}

function scheduleCoverageNeed(input: InitialPositionInput): InformationNeed {
  const recordedCount = input.schedule.allocations.filter((item) => item.state === "PLANNED").length;

  return {
    needId: `schedule-next-day-coverage:${input.schedule.scope.from}:${input.schedule.scope.to}`,
    concept: "schedule.next_day.coverage",
    kind: recordedCount === 0 ? "MISSING" : "LOW_COVERAGE",
    purpose:
      recordedCount === 0
        ? "Establish the first known fixed constraint in the player's next local day."
        : "Check whether additional fixed constraints exist beyond the schedule records already known for the next local day.",
    consumers: ["position", "navigator", "schedule", "temporal_planning"],
    priorityClass: recordedCount === 0 ? "P2_HIGH_LEVERAGE" : "P3_CALIBRATION",
    resolutionOptions: ["CANONICAL_READ", "PLAYER", "PRESERVE_UNKNOWN"],
    canonicalDestination: {
      module: "schedule",
      commandType: "CREATE_ALLOCATION"
    },
    expectedLifetime: "TEMPORAL",
    sensitivity: "LOW",
    answerability: "HIGH",
    expiresAt: input.schedule.scope.to,
    evidence: {
      recordedAllocationCount: recordedCount,
      scheduleEpistemicCoverage: input.schedule.epistemicCoverage
    },
    questionSignals: {
      uncertaintyReduction: 0.85,
      currentRelevance: 0.82,
      decisionImpact: 0.76,
      crossDomainLeverage: 0.72,
      futureReuse: 0.45,
      freshnessValue: 0.95,
      requirementOrDeadlineImpact: 0.78,
      naturalTimingOpportunity: 0.9,
      userBurden: 0.2,
      interruptionCost: 0.18,
      redundancy: recordedCount > 0 ? 0.25 : 0,
      recentRepetition: 0
    }
  };
}

export function buildInitialPosition(input: InitialPositionInput): InitialPositionProjection {
  if (!Number.isFinite(Date.parse(input.now))) throw new Error("INITIAL_POSITION_INVALID_NOW");
  if (!Number.isFinite(Date.parse(input.schedule.scope.from)) || !Number.isFinite(Date.parse(input.schedule.scope.to))) {
    throw new Error("INITIAL_POSITION_INVALID_SCHEDULE_SCOPE");
  }
  if (Date.parse(input.schedule.scope.to) <= Date.parse(input.schedule.scope.from)) {
    throw new Error("INITIAL_POSITION_INVALID_SCHEDULE_SCOPE");
  }

  const planned = input.schedule.allocations.filter((item) => item.state === "PLANNED");
  const planner = new QuestionPlanner().registerSpec(scheduleQuestionSpec);
  const opportunities = planner.plan([scheduleCoverageNeed(input)], {
    mode: input.questionMode,
    now: input.now,
    budget: input.questionMode === "DISCOVERY_SESSION" ? 1 : 0
  });

  return {
    projection_type: "initial_position",
    rule_version: "initial_position_v0.1",
    computed_at: input.now,
    person: input.person ? { display_name: input.person.displayName } : null,
    foundation: {
      origin_established: Boolean(input.person?.birthDateKnown),
      birth_time_known: Boolean(input.person?.birthTimeKnown),
      birth_place_known: Boolean(input.person?.birthPlaceKnown),
      body_baseline: bodyBaseline(input.body)
    },
    schedule: {
      scope: input.schedule.scope,
      recorded_allocation_count: planned.length,
      next_recorded_allocation: planned[0] ?? null,
      result_coverage: input.schedule.resultCoverage,
      epistemic_coverage: "UNKNOWN",
      note:
        planned.length === 0
          ? "No planned allocation is recorded in this scope. This does not establish that the player's time is free."
          : "Recorded allocations describe known planned time only; additional real-world commitments may still be missing."
    },
    question_opportunities: opportunities,
    does_not_assert: [
      "that unscheduled time is free",
      "that a planned allocation occurred",
      "that the player has no additional commitments",
      "that missing body observations are zero or absent in reality"
    ]
  };
}
