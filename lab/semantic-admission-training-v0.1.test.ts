import { AdmissionRegistry, runSemanticAdmission, type SourceEnvelope } from "../supabase/functions/_shared/intelligence/semantic-admission.ts";
import { recognizeTraining, trainingAdmissionContract } from "../supabase/functions/_shared/intelligence/training-semantic.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function source(content: string, overrides: Partial<SourceEnvelope> = {}): SourceEnvelope {
  return {
    sourceId: crypto.randomUUID(),
    sourceType: "PLAYER_TEXT",
    content,
    receivedAt: "2026-09-16T12:00:00.000Z",
    interactionIntent: "RECORD",
    authorizesCanonicalWrite: true,
    zoneId: "America/New_York",
    ...overrides
  };
}

const registry = () => new AdmissionRegistry().register(trainingAdmissionContract);

Deno.test("explicit natural-language bench sets become one admissible Training command", async () => {
  const input = source("I benched 185 lbs for 8 reps for 3 sets today");
  const graph = recognizeTraining(input);
  const result = await runSemanticAdmission(graph, registry(), { now: input.receivedAt, source: input });

  assert(graph.candidates.length === 1, "expected one Training candidate");
  assert(result.decisions.length === 1, "expected one admission decision");
  const decision = result.decisions[0];
  assert(decision.disposition === "ACCEPT", `expected ACCEPT, got ${decision.disposition}`);
  assert(decision.owner === "training", "Training must be the canonical owner");
  assert(decision.command?.commandType === "training.capture_strength_session", "expected typed Training command");
  const sets = decision.command?.args.p_sets as Array<Record<string, unknown>>;
  assert(sets.length === 3, "expected exactly three sets");
  assert(sets.every((set) => set.exercise_key === "barbell_bench_press"), "bench must resolve to the reference exercise key");
  assert(sets.every((set) => set.reps === 8), "reps should be preserved");
  assert(sets.every((set) => set.load_value === 185 && set.load_unit === "LB"), "load should be preserved");
});

Deno.test("ambiguous 'three times' is clarified instead of being silently persisted", async () => {
  const input = source("I benched 185 for 8 three times today");
  const result = await runSemanticAdmission(recognizeTraining(input), registry(), { now: input.receivedAt, source: input });
  assert(result.decisions[0].disposition === "NEEDS_CLARIFICATION", "ambiguous repetition must not become canonical sets");
  assert(result.decisions[0].informationNeed?.concept === "training.exercise_set.structure", "expected set-structure information need");
  assert(!result.decisions[0].command, "clarification must not propose a canonical command");
});

Deno.test("generic leg-day statement is accepted only as partial reality and invents no exercise sets", async () => {
  const input = source("I crushed legs today");
  const result = await runSemanticAdmission(recognizeTraining(input), registry(), { now: input.receivedAt, source: input });
  const decision = result.decisions[0];
  assert(decision.disposition === "ACCEPT_PARTIAL", "generic strength session should be valid partial reality");
  const sets = decision.command?.args.p_sets as unknown[];
  assert(Array.isArray(sets) && sets.length === 0, "Wayfinder must not invent exercises, reps, or load");
});

Deno.test("conversational disclosure requires authorization even when meaning is clear", async () => {
  const input = source("I benched 185 for 8 reps for 3 sets today", {
    interactionIntent: "CONVERSATION",
    authorizesCanonicalWrite: false
  });
  const result = await runSemanticAdmission(recognizeTraining(input), registry(), { now: input.receivedAt, source: input });
  assert(result.decisions[0].disposition === "NEEDS_AUTHORIZATION", "conversation must not silently become canonical reality");
  assert(!result.decisions[0].command, "unauthorized disclosure must not produce an executable command");
});

Deno.test("irrelevant unclaimed input is dropped rather than assigned to a junk drawer", async () => {
  const input = source("I saw a cool red Corvette across the street");
  const graph = recognizeTraining(input);
  const result = await runSemanticAdmission(graph, registry(), { now: input.receivedAt, source: input });
  assert(graph.candidates.length === 0, "Training should claim nothing");
  assert(result.decisions.length === 0, "there should be no invented domain decision");
  assert(result.unclaimedCandidateIds.length === 0, "recognizer should not manufacture an unowned candidate");
});
