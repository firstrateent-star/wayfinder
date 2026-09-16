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

Deno.test("initial Position remains quiet outside Discovery Session", () => {
  const result = buildInitialPosition({
    now,
    questionMode: "TASK_DRIVEN",
    person: {
      displayName: "Sean",
      birthDateKnown: true,
      birthTimeKnown: true,
      birthPlaceKnown: true
    },
    body: { heightRecorded: true, weightRecorded: true },
    schedule: {
      scope,
      allocations: [],
      resultCoverage: "COMPLETE",
      epistemicCoverage: "UNKNOWN"
    }
  });

  assert(result.foundation.origin_established, "origin should be established");
  assert(result.foundation.body_baseline === "ESTABLISHED", "body baseline should be established");
  assert(result.schedule.recorded_allocation_count === 0, "schedule should have zero recorded allocations");
  assert(result.question_opportunities.length === 0, "task-driven Helm should not proactively ask the P2 discovery question");
  assert(result.does_not_assert.includes("that unscheduled time is free"), "projection must preserve schedule uncertainty");
});

Deno.test("Discovery Session surfaces the schedule coverage question", () => {
  const result = buildInitialPosition({
    now,
    questionMode: "DISCOVERY_SESSION",
    person: {
      displayName: "Sean",
      birthDateKnown: true,
      birthTimeKnown: true,
      birthPlaceKnown: true
    },
    body: { heightRecorded: true, weightRecorded: false },
    schedule: {
      scope,
      allocations: [],
      resultCoverage: "COMPLETE",
      epistemicCoverage: "UNKNOWN"
    }
  });

  assert(result.foundation.body_baseline === "PARTIAL", "one body observation should produce a partial baseline");
  assert(result.question_opportunities.length === 1, "discovery should surface one bounded question");
  assert(result.question_opportunities[0].questionKey === "schedule.next_day.coverage.v1", "unexpected discovery question");
  assert(result.question_opportunities[0].informationNeed.priorityClass === "P2_HIGH_LEVERAGE", "empty schedule should be high leverage discovery");
  assert(result.question_opportunities[0].requiresExplicitAuthorizationForWrite, "schedule write must require explicit authorization");
});

Deno.test("known schedule is surfaced without claiming coverage is complete", () => {
  const result = buildInitialPosition({
    now,
    questionMode: "DISCOVERY_SESSION",
    person: {
      displayName: "Sean",
      birthDateKnown: true,
      birthTimeKnown: false,
      birthPlaceKnown: true
    },
    body: { heightRecorded: false, weightRecorded: false },
    schedule: {
      scope,
      allocations: [
        {
          id: "11111111-1111-1111-1111-111111111111",
          version: "22222222-2222-2222-2222-222222222222",
          label: "Stage Presence",
          kind: "HARD",
          state: "PLANNED",
          startsAt: "2026-09-16T14:00:00.000Z",
          endsAt: "2026-09-16T21:00:00.000Z",
          windowStartsAt: null,
          windowEndsAt: null,
          dueAt: null,
          zoneId: "America/New_York"
        }
      ],
      resultCoverage: "COMPLETE",
      epistemicCoverage: "UNKNOWN"
    }
  });

  assert(result.schedule.recorded_allocation_count === 1, "known allocation should be surfaced");
  assert(result.schedule.next_recorded_allocation?.label === "Stage Presence", "next allocation should be preserved");
  assert(result.schedule.epistemic_coverage === "UNKNOWN", "record completeness must not become lived-reality completeness");
  assert(result.question_opportunities[0].informationNeed.priorityClass === "P3_CALIBRATION", "existing schedule should lower the coverage question to calibration");
});
