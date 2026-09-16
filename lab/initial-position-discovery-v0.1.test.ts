import { buildInitialPosition } from "../supabase/functions/_shared/intelligence/initial-position-service.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const now = "2026-09-16T03:15:00.000Z";
const scope = {
  from: "2026-09-16T04:00:00.000Z",
  to: "2026-09-17T04:00:00.000Z",
  zoneId: "America/New_York",
  intervalSemantics: "[start,end)" as const
};

const basePerson = {
  displayName: "Sean",
  birthDateKnown: true,
  birthTimeKnown: true,
  birthPlaceKnown: true
};

const emptyDirection = { nodes: [] };

function hardAllocation(
  id: string,
  label: string,
  startsAt: string,
  endsAt: string
) {
  return {
    id,
    version: `${id.slice(0, -1)}2`,
    label,
    kind: "HARD" as const,
    state: "PLANNED" as const,
    startsAt,
    endsAt,
    windowStartsAt: null,
    windowEndsAt: null,
    dueAt: null,
    zoneId: "America/New_York"
  };
}

Deno.test("initial Position remains quiet outside Discovery Session", () => {
  const result = buildInitialPosition({
    now,
    questionMode: "TASK_DRIVEN",
    person: basePerson,
    body: { heightRecorded: true, weightRecorded: true },
    direction: emptyDirection,
    schedule: {
      scope,
      allocations: [],
      resultCoverage: "COMPLETE",
      epistemicCoverage: "UNKNOWN"
    }
  });

  assert(result.rule_version === "initial_position_v0.2", "expected synthesized Position rule version");
  assert(result.foundation.origin_established, "origin should be established");
  assert(result.foundation.body_baseline === "ESTABLISHED", "body baseline should be established");
  assert(result.schedule.recorded_allocation_count === 0, "schedule should have zero recorded allocations");
  assert(result.direction.current_focus === null, "missing Direction must remain unknown");
  assert(result.question_opportunities.length === 0, "task-driven Helm should remain quiet");
  assert(result.does_not_assert.includes("that unscheduled time is free"), "projection must preserve schedule uncertainty");
});

Deno.test("Discovery Session starts with a real schedule constraint when no schedule exists", () => {
  const result = buildInitialPosition({
    now,
    questionMode: "DISCOVERY_SESSION",
    person: basePerson,
    body: { heightRecorded: true, weightRecorded: false },
    direction: emptyDirection,
    schedule: {
      scope,
      allocations: [],
      resultCoverage: "COMPLETE",
      epistemicCoverage: "UNKNOWN"
    }
  });

  assert(result.foundation.body_baseline === "PARTIAL", "one body observation should produce a partial baseline");
  assert(result.question_opportunities.length === 1, "discovery should surface one bounded question");
  assert(result.question_opportunities[0].questionKey === "schedule.next_day.coverage.v2", "unexpected first discovery question");
  assert(result.question_opportunities[0].informationNeed.priorityClass === "P1_HIGH_IMPACT", "empty schedule should be the first high-impact discovery need");
});

Deno.test("after one schedule answer Discovery changes domains instead of repeating the form", () => {
  const result = buildInitialPosition({
    now,
    questionMode: "DISCOVERY_SESSION",
    person: basePerson,
    body: { heightRecorded: true, weightRecorded: true },
    direction: emptyDirection,
    schedule: {
      scope,
      allocations: [
        hardAllocation(
          "11111111-1111-1111-1111-111111111111",
          "Chiro",
          "2026-09-16T15:45:00.000Z",
          "2026-09-16T16:45:00.000Z"
        )
      ],
      resultCoverage: "COMPLETE",
      epistemicCoverage: "UNKNOWN"
    }
  });

  assert(result.schedule.recorded_allocation_count === 1, "known allocation should be surfaced");
  assert(result.schedule.next_recorded_allocation?.label === "Chiro", "next allocation should be preserved");
  assert(result.question_opportunities.length === 1, "discovery should still ask only one question");
  assert(result.question_opportunities[0].informationNeed.concept === "direction.current_focus", "next question should move from schedule to Direction");
  assert(result.question_opportunities[0].informationNeed.priorityClass === "P2_HIGH_LEVERAGE", "current Direction should outrank schedule calibration");
});

Deno.test("Position synthesizes two commitments into a recorded window and cross-domain focus insight", () => {
  const result = buildInitialPosition({
    now,
    questionMode: "TASK_DRIVEN",
    person: basePerson,
    body: { heightRecorded: true, weightRecorded: true },
    direction: {
      nodes: [
        {
          id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
          version: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
          kind: "direction",
          title: "Build Wayfinder into something genuinely useful",
          description: null,
          intentState: "ACTIVE",
          recordedAt: "2026-09-15T23:00:00.000Z"
        }
      ]
    },
    schedule: {
      scope,
      allocations: [
        hardAllocation(
          "11111111-1111-1111-1111-111111111111",
          "Chiro",
          "2026-09-16T15:45:00.000Z",
          "2026-09-16T16:45:00.000Z"
        ),
        hardAllocation(
          "33333333-3333-3333-3333-333333333333",
          "Stage Presence",
          "2026-09-16T19:00:00.000Z",
          "2026-09-16T22:00:00.000Z"
        )
      ],
      resultCoverage: "COMPLETE",
      epistemicCoverage: "UNKNOWN"
    }
  });

  assert(result.schedule.allocations.length === 2, "all recorded planned items should be surfaced, not only the first one");
  assert(result.schedule.hard_block_count === 2, "hard blocks should be counted");
  assert(result.schedule.recorded_hard_committed_seconds === 4 * 60 * 60, "committed time should be synthesized without double counting");
  assert(result.schedule.largest_between_commitment_gap?.durationSeconds === 2.25 * 60 * 60, "between-commitment gap should be derived");
  assert(result.direction.current_focus?.title.includes("Wayfinder"), "current Direction should be composed into Position");
  assert(result.insights.some((insight) => insight.kind === "FOCUS_WINDOW"), "schedule + Direction should produce a cross-domain planning insight");
  assert(result.does_not_assert.includes("that a recorded gap is actually available"), "derived window must not become a free-time claim");
});

Deno.test("Position detects overlapping recorded hard commitments", () => {
  const result = buildInitialPosition({
    now,
    questionMode: "TASK_DRIVEN",
    person: basePerson,
    body: { heightRecorded: false, weightRecorded: false },
    direction: emptyDirection,
    schedule: {
      scope,
      allocations: [
        hardAllocation(
          "11111111-1111-1111-1111-111111111111",
          "Client call",
          "2026-09-16T15:00:00.000Z",
          "2026-09-16T16:00:00.000Z"
        ),
        hardAllocation(
          "33333333-3333-3333-3333-333333333333",
          "Chiro",
          "2026-09-16T15:30:00.000Z",
          "2026-09-16T16:30:00.000Z"
        )
      ],
      resultCoverage: "COMPLETE",
      epistemicCoverage: "UNKNOWN"
    }
  });

  assert(result.schedule.overlaps.length === 1, "overlap should be detected deterministically");
  assert(result.schedule.overlaps[0].overlapSeconds === 30 * 60, "overlap duration should be derived");
  assert(result.insights[0].kind === "RECORDED_OVERLAP", "overlap should become the highest-salience Position insight");
});
