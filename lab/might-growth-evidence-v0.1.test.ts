import {
  evaluateMightGrowth,
  extractStrengthCapabilityObservations,
  type MightGrowthTrainingRead
} from "../supabase/functions/_shared/intelligence/might-growth.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function session(
  id: string,
  day: number,
  exerciseKey: string,
  exerciseLabel: string,
  load: number,
  unit: "LB" | "KG",
  reps: number
): NonNullable<MightGrowthTrainingRead["sessions"]>[number] {
  return {
    id,
    version: id + "-v1",
    kind: "STRENGTH",
    occurrence: {
      from: `2026-09-${String(day).padStart(2, "0")}T18:00:00.000Z`,
      precision: "INSTANT",
      zone_id: "America/New_York"
    },
    sets: [{
      id: id + "-set",
      exercise_key: exerciseKey,
      exercise_label: exerciseLabel,
      load_value: load,
      load_unit: unit,
      reps
    }]
  };
}

Deno.test("one later performance expansion is not enough to establish Might growth", () => {
  const read: MightGrowthTrainingRead = {
    sessions: [
      session("b1", 1, "barbell_bench_press", "Barbell Bench Press", 180, "LB", 8),
      session("b2", 3, "barbell_bench_press", "Barbell Bench Press", 185, "LB", 8),
      session("c1", 6, "barbell_bench_press", "Barbell Bench Press", 190, "LB", 8)
    ]
  };
  const result = evaluateMightGrowth(read);
  assert(result.state === "INSUFFICIENT_EVIDENCE", "one post-baseline expansion must remain insufficient");
  assert(result.proofs.length === 0, "no proof should be emitted without a later confirmation");
});

Deno.test("one baseline session cannot establish a longitudinal growth baseline", () => {
  const read: MightGrowthTrainingRead = {
    sessions: [
      session("b1", 1, "barbell_bench_press", "Barbell Bench Press", 185, "LB", 8),
      session("c1", 4, "barbell_bench_press", "Barbell Bench Press", 190, "LB", 8),
      session("c2", 7, "barbell_bench_press", "Barbell Bench Press", 190, "LB", 9)
    ]
  };
  const result = evaluateMightGrowth(read);
  assert(result.state === "INSUFFICIENT_EVIDENCE", "two later performances cannot replace a two-session baseline");
});

Deno.test("two-session baseline plus two later repeated frontier expansions evidences bounded Might growth", () => {
  const read: MightGrowthTrainingRead = {
    sessions: [
      session("b1", 1, "barbell_bench_press", "Barbell Bench Press", 180, "LB", 8),
      session("b2", 3, "barbell_bench_press", "Barbell Bench Press", 185, "LB", 8),
      session("c1", 6, "barbell_bench_press", "Barbell Bench Press", 190, "LB", 8),
      session("c2", 9, "barbell_bench_press", "Barbell Bench Press", 185, "LB", 9)
    ]
  };
  const result = evaluateMightGrowth(read);
  assert(result.state === "EVIDENCED", "repeatable expansion beyond the frozen baseline should evidence growth");
  assert(result.proofs.length === 1, "one exercise proof should be emitted");
  assert(result.proofs[0].exerciseKey === "barbell_bench_press", "proof must remain exercise-specific");
  assert(result.proofs[0].baselineSessionCount === 2, "proof should record the bounded baseline session count");
  assert(
    result.proofs[0].baselineSessions.map((item) => item.sessionId).join(",") === "b1,b2",
    "proof must preserve both canonical baseline sessions, not only the frontier anchor"
  );
  assert(result.proofs[0].candidate.sessionId === "c1", "first frontier expansion should be the candidate");
  assert(result.proofs[0].confirmation.sessionId === "c2", "second independent later expansion should confirm it");
});

Deno.test("performances from different exercises cannot establish growth", () => {
  const read: MightGrowthTrainingRead = {
    sessions: [
      session("bench-b1", 1, "barbell_bench_press", "Barbell Bench Press", 180, "LB", 8),
      session("bench-b2", 3, "barbell_bench_press", "Barbell Bench Press", 185, "LB", 8),
      session("squat-c1", 6, "back_squat", "Back Squat", 225, "LB", 8),
      session("squat-c2", 9, "back_squat", "Back Squat", 235, "LB", 8)
    ]
  };
  const result = evaluateMightGrowth(read);
  assert(result.state === "INSUFFICIENT_EVIDENCE", "cross-exercise performance must never be treated as comparable growth");
});

Deno.test("higher load with fewer reps is a tradeoff, not Pareto growth", () => {
  const read: MightGrowthTrainingRead = {
    sessions: [
      session("b1", 1, "barbell_bench_press", "Barbell Bench Press", 180, "LB", 8),
      session("b2", 3, "barbell_bench_press", "Barbell Bench Press", 185, "LB", 8),
      session("c1", 6, "barbell_bench_press", "Barbell Bench Press", 195, "LB", 6),
      session("c2", 9, "barbell_bench_press", "Barbell Bench Press", 200, "LB", 6)
    ]
  };
  const result = evaluateMightGrowth(read);
  assert(result.state === "INSUFFICIENT_EVIDENCE", "load/repetition tradeoffs must not become a hidden one-rep-max estimate");
});

Deno.test("LB and KG observations normalize before comparison without conversion-noise growth", () => {
  const equivalent = extractStrengthCapabilityObservations({
    sessions: [
      session("lb", 1, "barbell_bench_press", "Barbell Bench Press", 185, "LB", 8),
      session("kg", 3, "barbell_bench_press", "Barbell Bench Press", 84, "KG", 8)
    ]
  }).observations;
  assert(equivalent[0].normalizedLoadKg === equivalent[1].normalizedLoadKg, "185 lb and 84 kg should land on the same 0.5 kg comparison quantum");

  const read: MightGrowthTrainingRead = {
    sessions: [
      session("b1", 1, "barbell_bench_press", "Barbell Bench Press", 180, "LB", 8),
      session("b2", 3, "barbell_bench_press", "Barbell Bench Press", 185, "LB", 8),
      session("c1", 6, "barbell_bench_press", "Barbell Bench Press", 87, "KG", 8),
      session("c2", 9, "barbell_bench_press", "Barbell Bench Press", 87, "KG", 9)
    ]
  };
  assert(evaluateMightGrowth(read).state === "EVIDENCED", "meaningful mixed-unit improvements should remain comparable");
});

Deno.test("unsupported or incomplete loaded sets are excluded rather than interpreted as zero", () => {
  const result = extractStrengthCapabilityObservations({
    sessions: [{
      id: "s1",
      version: "s1-v1",
      kind: "STRENGTH",
      occurrence: { from: "2026-09-01T18:00:00.000Z" },
      sets: [
        { id: "missing-load", exercise_key: "barbell_bench_press", exercise_label: "Bench", reps: 8, load_value: null, load_unit: "LB" },
        { id: "unsupported-unit", exercise_key: "barbell_bench_press", exercise_label: "Bench", reps: 8, load_value: 80, load_unit: "STONE" }
      ]
    }]
  });
  assert(result.observations.length === 0, "incomplete or unsupported observations should not become capability facts");
  assert(result.excludedObservationCount === 2, "exclusions should stay visible to the evaluator");
});

Deno.test("same-time sessions cannot fake a later confirmation", () => {
  const read: MightGrowthTrainingRead = {
    sessions: [
      session("b1", 1, "barbell_bench_press", "Barbell Bench Press", 180, "LB", 8),
      session("b2", 3, "barbell_bench_press", "Barbell Bench Press", 185, "LB", 8),
      session("c1", 6, "barbell_bench_press", "Barbell Bench Press", 190, "LB", 8),
      session("c2", 6, "barbell_bench_press", "Barbell Bench Press", 190, "LB", 9)
    ]
  };
  const result = evaluateMightGrowth(read);
  assert(result.state === "INSUFFICIENT_EVIDENCE", "confirmation must occur strictly later than the candidate");
});
