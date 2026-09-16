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

export interface InitialPositionDirectionNode {
  id: string;
  version: string;
  kind: "value" | "direction" | "outcome" | "commitment" | "quest" | "plan" | "action";
  title: string;
  description: string | null;
  intentState: "ACTIVE" | "PAUSED" | "WITHDRAWN";
  recordedAt: string;
}

export interface InitialPositionDirectionSnapshot {
  nodes: InitialPositionDirectionNode[];
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
  direction: InitialPositionDirectionSnapshot;
  schedule: InitialPositionScheduleSnapshot;
}

export type BodyBaselineState = "ESTABLISHED" | "PARTIAL" | "NOT_RECORDED";

export interface RecordedGap {
  from: string;
  to: string;
  durationSeconds: number;
  after: {
    id: string;
    label: string;
  };
  before: {
    id: string;
    label: string;
  };
}

export interface RecordedOverlap {
  first: {
    id: string;
    label: string;
  };
  second: {
    id: string;
    label: string;
  };
  overlapSeconds: number;
}

export interface PositionInsight {
  kind: "RECORDED_CONSTRAINTS" | "RECORDED_WINDOW" | "RECORDED_OVERLAP" | "FOCUS_WINDOW";
  headline: string;
  detail: string;
  claimClass: "DETERMINISTIC_DERIVATION";
}

export interface InitialPositionProjection {
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
    body_baseline: BodyBaselineState;
  };
  direction: {
    current_focus: InitialPositionDirectionNode | null;
    active_direction_count: number;
    note: string;
  };
  schedule: {
    scope: InitialPositionScheduleSnapshot["scope"];
    allocations: InitialPositionScheduleItem[];
    recorded_allocation_count: number;
    hard_block_count: number;
    recorded_hard_committed_seconds: number;
    next_recorded_allocation: InitialPositionScheduleItem | null;
    largest_between_commitment_gap: RecordedGap | null;
    overlaps: RecordedOverlap[];
    result_coverage: "COMPLETE" | "PARTIAL";
    epistemic_coverage: "UNKNOWN";
    note: string;
  };
  insights: PositionInsight[];
  question_opportunities: QuestionOpportunity[];
  does_not_assert: string[];
}

const scheduleQuestionSpec: QuestionSpec = {
  concept: "schedule.next_day.coverage",
  questionKey: "schedule.next_day.coverage.v2",
  questionIntent:
    "Learn whether the player has a fixed commitment inside the supplied next-day schedule scope that Wayfinder does not yet know about.",
  expectedAnswerShape: "yes/no; if yes, a short label and local start/end time",
  whyThisMatters:
    "Fixed time constraints materially improve Navigator planning, but missing schedule records must never be treated as free time.",
  mayPersistAnswer: true,
  requiresExplicitAuthorizationForWrite: true
};

const directionQuestionSpec: QuestionSpec = {
  concept: "direction.current_focus",
  questionKey: "direction.current_focus.v1",
  questionIntent: "Learn the one thing the player is most actively trying to move forward right now.",
  expectedAnswerShape: "one short current direction in the player's own words",
  whyThisMatters:
    "Knowing your current direction lets Wayfinder connect time, evidence, and future questions to something that actually matters instead of merely collecting facts.",
  mayPersistAnswer: true,
  requiresExplicitAuthorizationForWrite: true
};

function bodyBaseline(body: InitialPositionBodySnapshot): BodyBaselineState {
  if (body.heightRecorded && body.weightRecorded) return "ESTABLISHED";
  if (body.heightRecorded || body.weightRecorded) return "PARTIAL";
  return "NOT_RECORDED";
}

function activeCurrentFocus(direction: InitialPositionDirectionSnapshot) {
  return (
    direction.nodes
      .filter((node) => node.kind === "direction" && node.intentState === "ACTIVE")
      .sort((a, b) => Date.parse(b.recordedAt) - Date.parse(a.recordedAt))[0] ?? null
  );
}

function scheduleCoverageNeed(input: InitialPositionInput): InformationNeed {
  const recordedCount = input.schedule.allocations.filter((item) => item.state === "PLANNED").length;
  const priorityClass = recordedCount === 0 ? "P1_HIGH_IMPACT" : recordedCount === 1 ? "P3_CALIBRATION" : "P4_OPTIONAL";

  return {
    needId: `schedule-next-day-coverage:${input.schedule.scope.from}:${input.schedule.scope.to}`,
    concept: "schedule.next_day.coverage",
    kind: recordedCount === 0 ? "MISSING" : "LOW_COVERAGE",
    purpose:
      recordedCount === 0
        ? "Establish the first known fixed constraint in the player's next local day."
        : "Check whether additional fixed constraints exist beyond the schedule records already known for the next local day.",
    consumers: ["position", "navigator", "schedule", "temporal_planning"],
    priorityClass,
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
      uncertaintyReduction: recordedCount === 0 ? 0.95 : 0.55,
      currentRelevance: 0.82,
      decisionImpact: recordedCount === 0 ? 0.9 : 0.52,
      crossDomainLeverage: 0.72,
      futureReuse: 0.45,
      freshnessValue: 0.95,
      requirementOrDeadlineImpact: 0.78,
      naturalTimingOpportunity: 0.9,
      userBurden: 0.2,
      interruptionCost: 0.18,
      redundancy: recordedCount >= 2 ? 0.85 : recordedCount === 1 ? 0.35 : 0,
      recentRepetition: recordedCount >= 2 ? 0.9 : recordedCount === 1 ? 0.25 : 0
    }
  };
}

function directionFocusNeed(input: InitialPositionInput): InformationNeed | null {
  if (activeCurrentFocus(input.direction)) return null;

  return {
    needId: "direction-current-focus",
    concept: "direction.current_focus",
    kind: "MISSING",
    purpose: "Give Position and Navigator one explicit current direction to organize future discovery around.",
    consumers: ["position", "navigator", "planning", "discovery"],
    priorityClass: "P2_HIGH_LEVERAGE",
    resolutionOptions: ["CANONICAL_READ", "PLAYER", "PRESERVE_UNKNOWN"],
    canonicalDestination: {
      module: "direction",
      commandType: "CAPTURE_DIRECTION"
    },
    expectedLifetime: "TEMPORAL",
    sensitivity: "LOW",
    answerability: "HIGH",
    questionSignals: {
      uncertaintyReduction: 0.9,
      currentRelevance: 0.9,
      decisionImpact: 0.88,
      crossDomainLeverage: 0.95,
      futureReuse: 0.9,
      freshnessValue: 0.65,
      naturalTimingOpportunity: 0.9,
      userBurden: 0.22,
      interruptionCost: 0.2,
      redundancy: 0,
      recentRepetition: 0
    }
  };
}

function plannedSortInstant(item: InitialPositionScheduleItem) {
  return item.startsAt ?? item.windowStartsAt ?? item.dueAt ?? "9999-12-31T23:59:59.999Z";
}

function orderedPlannedAllocations(input: InitialPositionInput) {
  return input.schedule.allocations
    .filter((item) => item.state === "PLANNED")
    .slice()
    .sort((a, b) => Date.parse(plannedSortInstant(a)) - Date.parse(plannedSortInstant(b)) || a.id.localeCompare(b.id));
}

function hardIntervals(planned: InitialPositionScheduleItem[]) {
  return planned
    .filter((item) => item.kind === "HARD" && item.startsAt && item.endsAt)
    .map((item) => ({ item, start: Date.parse(item.startsAt as string), end: Date.parse(item.endsAt as string) }))
    .filter((entry) => Number.isFinite(entry.start) && Number.isFinite(entry.end) && entry.end > entry.start)
    .sort((a, b) => a.start - b.start || a.end - b.end || a.item.id.localeCompare(b.item.id));
}

function analyzeHardSchedule(planned: InitialPositionScheduleItem[]) {
  const intervals = hardIntervals(planned);
  const overlaps: RecordedOverlap[] = [];

  for (let i = 0; i < intervals.length; i += 1) {
    for (let j = i + 1; j < intervals.length; j += 1) {
      const first = intervals[i];
      const second = intervals[j];
      if (second.start >= first.end) break;
      const overlapSeconds = Math.max(0, Math.min(first.end, second.end) - Math.max(first.start, second.start)) / 1000;
      if (overlapSeconds > 0) {
        overlaps.push({
          first: { id: first.item.id, label: first.item.label },
          second: { id: second.item.id, label: second.item.label },
          overlapSeconds
        });
      }
    }
  }

  const merged: Array<{ start: number; end: number; firstLabel: string; lastLabel: string; firstId: string; lastId: string }> = [];
  for (const entry of intervals) {
    const last = merged[merged.length - 1];
    if (!last || entry.start > last.end) {
      merged.push({
        start: entry.start,
        end: entry.end,
        firstLabel: entry.item.label,
        lastLabel: entry.item.label,
        firstId: entry.item.id,
        lastId: entry.item.id
      });
    } else if (entry.end > last.end) {
      last.end = entry.end;
      last.lastLabel = entry.item.label;
      last.lastId = entry.item.id;
    }
  }

  const committedSeconds = merged.reduce((sum, interval) => sum + (interval.end - interval.start) / 1000, 0);
  const gaps: RecordedGap[] = [];
  for (let index = 1; index < merged.length; index += 1) {
    const previous = merged[index - 1];
    const current = merged[index];
    if (current.start <= previous.end) continue;
    gaps.push({
      from: new Date(previous.end).toISOString(),
      to: new Date(current.start).toISOString(),
      durationSeconds: (current.start - previous.end) / 1000,
      after: { id: previous.lastId, label: previous.lastLabel },
      before: { id: current.firstId, label: current.firstLabel }
    });
  }

  const largestGap = gaps.slice().sort((a, b) => b.durationSeconds - a.durationSeconds)[0] ?? null;
  return { intervals, overlaps, committedSeconds, largestGap };
}

function formatDuration(seconds: number) {
  const minutes = Math.round(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours <= 0) return `${minutes} min`;
  if (remainder === 0) return `${hours} hr${hours === 1 ? "" : "s"}`;
  return `${hours} hr ${remainder} min`;
}

function buildInsights(
  planned: InitialPositionScheduleItem[],
  hardAnalysis: ReturnType<typeof analyzeHardSchedule>,
  focus: InitialPositionDirectionNode | null
): PositionInsight[] {
  const insights: PositionInsight[] = [];

  if (hardAnalysis.intervals.length > 0) {
    insights.push({
      kind: "RECORDED_CONSTRAINTS",
      headline: `${hardAnalysis.intervals.length} recorded hard commitment${hardAnalysis.intervals.length === 1 ? "" : "s"} shape the day so far.`,
      detail: `${formatDuration(hardAnalysis.committedSeconds)} is occupied by recorded hard plans. This is schedule structure, not proof that those activities will occur or that the remaining time is free.`,
      claimClass: "DETERMINISTIC_DERIVATION"
    });
  }

  if (hardAnalysis.overlaps.length > 0) {
    const first = hardAnalysis.overlaps[0];
    insights.unshift({
      kind: "RECORDED_OVERLAP",
      headline: `${first.first.label} and ${first.second.label} overlap in the recorded plan.`,
      detail: `The overlap is ${formatDuration(first.overlapSeconds)}. Navigator should treat this as a planning conflict until one of the records is corrected or clarified.`,
      claimClass: "DETERMINISTIC_DERIVATION"
    });
  } else if (hardAnalysis.largestGap && hardAnalysis.largestGap.durationSeconds >= 30 * 60) {
    const gap = hardAnalysis.largestGap;
    insights.push({
      kind: focus ? "FOCUS_WINDOW" : "RECORDED_WINDOW",
      headline: focus
        ? `Your recorded plan leaves ${formatDuration(gap.durationSeconds)} between ${gap.after.label} and ${gap.before.label}; ${focus.title} could potentially fit there.`
        : `Your recorded plan leaves ${formatDuration(gap.durationSeconds)} between ${gap.after.label} and ${gap.before.label}.`,
      detail: focus
        ? `That is a candidate planning window derived from the records you gave me, not a claim that the time is actually free. A later planning step can ask whether you want to protect some of it for ${focus.title}.`
        : "This is only a gap between recorded hard commitments. Wayfinder still needs a current direction before that time can become useful planning context.",
      claimClass: "DETERMINISTIC_DERIVATION"
    });
  }

  if (planned.length > 0 && insights.length === 0) {
    insights.push({
      kind: "RECORDED_CONSTRAINTS",
      headline: `${planned.length} planned item${planned.length === 1 ? "" : "s"} are now part of Position.`,
      detail: "Wayfinder can use these records as constraints while preserving the difference between recorded schedule coverage and the full reality of your day.",
      claimClass: "DETERMINISTIC_DERIVATION"
    });
  }

  return insights;
}

export function buildInitialPosition(input: InitialPositionInput): InitialPositionProjection {
  if (!Number.isFinite(Date.parse(input.now))) throw new Error("INITIAL_POSITION_INVALID_NOW");
  if (!Number.isFinite(Date.parse(input.schedule.scope.from)) || !Number.isFinite(Date.parse(input.schedule.scope.to))) {
    throw new Error("INITIAL_POSITION_INVALID_SCHEDULE_SCOPE");
  }
  if (Date.parse(input.schedule.scope.to) <= Date.parse(input.schedule.scope.from)) {
    throw new Error("INITIAL_POSITION_INVALID_SCHEDULE_SCOPE");
  }

  const planned = orderedPlannedAllocations(input);
  const focus = activeCurrentFocus(input.direction);
  const hardAnalysis = analyzeHardSchedule(planned);
  const needs: InformationNeed[] = [scheduleCoverageNeed(input)];
  const directionNeed = directionFocusNeed(input);
  if (directionNeed) needs.push(directionNeed);

  const planner = new QuestionPlanner()
    .registerSpec(scheduleQuestionSpec)
    .registerSpec(directionQuestionSpec);
  const opportunities = planner.plan(needs, {
    mode: input.questionMode,
    now: input.now,
    budget: input.questionMode === "DISCOVERY_SESSION" ? 1 : 0
  });

  return {
    projection_type: "initial_position",
    rule_version: "initial_position_v0.2",
    computed_at: input.now,
    person: input.person ? { display_name: input.person.displayName } : null,
    foundation: {
      origin_established: Boolean(input.person?.birthDateKnown),
      birth_time_known: Boolean(input.person?.birthTimeKnown),
      birth_place_known: Boolean(input.person?.birthPlaceKnown),
      body_baseline: bodyBaseline(input.body)
    },
    direction: {
      current_focus: focus,
      active_direction_count: input.direction.nodes.filter((node) => node.kind === "direction" && node.intentState === "ACTIVE").length,
      note: focus
        ? "Current focus is an explicit Direction record, not an inferred personality trait or permanent Role."
        : "No explicit current Direction is recorded yet; Wayfinder should not invent one from unrelated data."
    },
    schedule: {
      scope: input.schedule.scope,
      allocations: planned,
      recorded_allocation_count: planned.length,
      hard_block_count: hardAnalysis.intervals.length,
      recorded_hard_committed_seconds: hardAnalysis.committedSeconds,
      next_recorded_allocation: planned[0] ?? null,
      largest_between_commitment_gap: hardAnalysis.largestGap,
      overlaps: hardAnalysis.overlaps,
      result_coverage: input.schedule.resultCoverage,
      epistemic_coverage: "UNKNOWN",
      note:
        planned.length === 0
          ? "No planned allocation is recorded in this scope. This does not establish that the player's time is free."
          : "Recorded allocations are now synthesized into constraint, overlap and between-commitment-window structure. Missing schedule coverage remains unknown."
    },
    insights: buildInsights(planned, hardAnalysis, focus),
    question_opportunities: opportunities,
    does_not_assert: [
      "that unscheduled time is free",
      "that a planned allocation occurred",
      "that the player has no additional commitments",
      "that a recorded gap is actually available",
      "that missing body observations are zero or absent in reality"
    ]
  };
}
