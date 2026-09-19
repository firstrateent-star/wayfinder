import { createCoreLifeConceptRegistryV0 } from "../supabase/functions/_shared/intelligence/concept-registry.ts";
import {
  AdmissionPlanningPolicyRegistry,
  createTrainingAdmissionPlanningPolicy,
  planSemanticAdmission
} from "../supabase/functions/_shared/intelligence/admission-planner.ts";
import {
  authorizeStagedFulfillment,
  createWayfinderFulfillmentRegistryV0,
  fulfillAdmissionPlan,
  type StagedAdmissionEnvelope
} from "../supabase/functions/_shared/intelligence/admission-fulfillment.ts";
import type {
  CandidateLifeGraph,
  CandidateLifeNode,
  SemanticCompilation
} from "../supabase/functions/_shared/intelligence/semantic-compiler.ts";
import type { SourceEnvelope } from "../supabase/functions/_shared/intelligence/semantic-admission.ts";
import { createWayfinderCapacityV0 } from "../supabase/functions/_shared/intelligence/wayfinder-capacity.ts";
import { resolveTrainingExercise } from "../supabase/functions/_shared/intelligence/training-exercises.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function source(content: string): SourceEnvelope {
  return {
    sourceId: "fulfillment-source",
    sourceType: "PLAYER_TEXT",
    content,
    receivedAt: "2026-09-19T19:00:00.000Z",
    interactionIntent: "CONVERSATION",
    authorizesCanonicalWrite: false,
    zoneId: "America/New_York"
  };
}

function trainingNode(attributes: CandidateLifeNode["attributes"] = {}, temporal?: CandidateLifeNode["temporal"]): CandidateLifeNode {
  return {
    candidateId: "training",
    nodeType: "EVENT",
    concept: "STRENGTH_TRAINING",
    subject: { kind: "SELF" },
    realityMode: "OCCURRED",
    attributes,
    ...(temporal ? { temporal } : {}),
    certainty: "HIGH",
    sourceSpans: ["workout"]
  };
}

function compilation(inputSource: SourceEnvelope, node: CandidateLifeNode): SemanticCompilation {
  const graph: CandidateLifeGraph = {
    sourceId: inputSource.sourceId,
    nodes: [node],
    edges: [],
    references: [],
    alternateInterpretations: [],
    trace: []
  };
  const capacity = createWayfinderCapacityV0();
  const assessment = capacity.assessNode(node);
  return {
    source: inputSource,
    graph,
    capacity: [assessment],
    routing: [{
      candidateId: node.candidateId,
      route: "ROUTE_TO_DOMAIN",
      owner: "training",
      claimType: "TRAINING_STRENGTH_SESSION",
      reason: "DETERMINISTIC_DECLARED_CLAIM_ROUTE",
      capacity: assessment
    }],
    contextRequests: [],
    validationErrors: []
  };
}

async function fulfill(inputSource: SourceEnvelope, node: CandidateLifeNode) {
  const compiled = compilation(inputSource, node);
  const planner = new AdmissionPlanningPolicyRegistry().register(createTrainingAdmissionPlanningPolicy());
  const plan = planSemanticAdmission(compiled, planner);
  return await fulfillAdmissionPlan(
    compiled,
    plan,
    { asOf: inputSource.receivedAt, items: [] },
    createWayfinderFulfillmentRegistryV0()
  );
}

Deno.test("common Training exercise vocabulary resolves deterministically", () => {
  for (const [phrase, key] of [
    ["squats", "back_squat"],
    ["leg press", "leg_press"],
    ["hamstring curls", "hamstring_curl"],
    ["calves", "calf_raise"],
    ["RDL", "romanian_deadlift"],
    ["lat pulldown", "lat_pulldown"],
    ["hammer curls", "hammer_curl"]
  ]) {
    assert(resolveTrainingExercise(phrase)?.key === key, `${phrase} should resolve to ${key}`);
  }
});

Deno.test("generic occurred workout today lowers through Training Admission without inventing exercises", async () => {
  const result = await fulfill(
    source("I worked out today."),
    trainingNode({}, { localDate: "2026-09-19", precision: "RELATIVE", certainty: "HIGH" })
  );
  const item = result.items[0];
  assert(item.disposition === "READY_FOR_CONFIRMATION", "generic Training should be ready for confirmation");
  const payload = item.normalizedPayload as { sets: unknown[]; genericStrengthSession?: boolean; localDate?: string };
  assert(payload.sets.length === 0, "generic session should keep exercise details unknown");
  assert(payload.genericStrengthSession === true, "generic session should remain explicitly partial");
  assert(payload.localDate === "2026-09-19", "semantic local date should survive");
});

Deno.test("exercise list and explicit skip lower without restoring the skipped exercise", async () => {
  const result = await fulfill(
    source("Same leg workout as last time except I skipped calves today."),
    trainingNode({
      exercises: { value: ["squats", "leg press", "hamstring curls"], state: "RESOLVED", certainty: "HIGH", sourceSpans: ["same leg workout"] },
      skippedExercises: { value: ["calves"], state: "RESOLVED", certainty: "HIGH", sourceSpans: ["skipped calves"] },
      focus: { value: "lower body", state: "RESOLVED", certainty: "HIGH", sourceSpans: ["leg workout"] }
    }, { localDate: "2026-09-19", precision: "RELATIVE", certainty: "HIGH" })
  );
  const item = result.items[0];
  assert(item.disposition === "READY_FOR_CONFIRMATION", "known exercise list should be fulfillable");
  const payload = item.normalizedPayload as { sets: Array<{ exerciseKey?: string }> };
  assert(payload.sets.length === 3, "only three performed exercises should remain");
  assert(!payload.sets.some((set) => set.exerciseKey === "calf_raise"), "skipped calves must not be reintroduced");
});

Deno.test("single exercise reps load and set count preserve structured detail", async () => {
  const result = await fulfill(
    source("Bench 185 lb for 8 reps for 3 sets today."),
    trainingNode({
      exercises: { value: ["bench press"], state: "RESOLVED", certainty: "HIGH", sourceSpans: ["Bench"] },
      reps: { value: 8, state: "RESOLVED", certainty: "HIGH", sourceSpans: ["8 reps"] },
      load: { value: 185, state: "RESOLVED", certainty: "HIGH", sourceSpans: ["185"] },
      loadUnit: { value: "lb", state: "RESOLVED", certainty: "HIGH", sourceSpans: ["lb"] },
      setCount: { value: 3, state: "RESOLVED", certainty: "HIGH", sourceSpans: ["3 sets"] }
    }, { localDate: "2026-09-19", precision: "RELATIVE", certainty: "HIGH" })
  );
  const payload = result.items[0].normalizedPayload as { sets: Array<{ exerciseKey?: string; reps?: number; loadValue?: number; loadUnit?: string }> };
  assert(payload.sets.length === 3, "set count should expand to three canonical sets");
  assert(payload.sets.every((set) => set.exerciseKey === "barbell_bench_press"), "bench should resolve canonically");
  assert(payload.sets.every((set) => set.reps === 8 && set.loadValue === 185 && set.loadUnit === "LB"), "set detail should survive exactly");
});

Deno.test("missing occurrence asks instead of silently assuming today", async () => {
  const result = await fulfill(source("I worked out."), trainingNode());
  assert(result.items[0].disposition === "NEEDS_CLARIFICATION", "unknown occurrence day must clarify");
  assert(result.items[0].reason === "TRAINING_OCCURRENCE_REQUIRED", "time gap should be explicit");
});

Deno.test("unresolved exercise identity fails closed at owning-domain admission", async () => {
  const result = await fulfill(
    source("I did mystery press today."),
    trainingNode({
      exercises: { value: ["mystery press"], state: "RESOLVED", certainty: "HIGH", sourceSpans: ["mystery press"] }
    }, { localDate: "2026-09-19", precision: "RELATIVE", certainty: "HIGH" })
  );
  assert(result.items[0].disposition === "NEEDS_CLARIFICATION", "unknown exercise must not become a canonical exercise key");
  assert(result.items[0].reason.startsWith("UNRESOLVED_EXERCISE:"), "exercise identity gap should be explicit");
});

Deno.test("authorized staged fulfillment reruns Training Admission and uses the server-staged command id", async () => {
  const initial = await fulfill(
    source("Bench 185 lb for 8 reps today."),
    trainingNode({
      exercises: { value: ["bench"], state: "RESOLVED", certainty: "HIGH", sourceSpans: ["Bench"] },
      reps: { value: 8, state: "RESOLVED", certainty: "HIGH", sourceSpans: ["8 reps"] },
      load: { value: 185, state: "RESOLVED", certainty: "HIGH", sourceSpans: ["185"] },
      loadUnit: { value: "lb", state: "RESOLVED", certainty: "HIGH", sourceSpans: ["lb"] }
    }, { localDate: "2026-09-19", precision: "RELATIVE", certainty: "HIGH" })
  );
  const item = initial.items[0];
  assert(item.disposition === "READY_FOR_CONFIRMATION" && item.normalizedPayload && item.sourceContext && item.summary, "staged material should exist");

  const envelope: StagedAdmissionEnvelope = {
    proposalId: "11111111-1111-4111-8111-111111111111",
    plannerProposalId: item.proposalId,
    episodeId: "episode-1",
    turnId: "turn-1",
    candidateId: item.candidateId,
    owner: item.owner,
    claimType: item.claimType,
    normalizedPayload: item.normalizedPayload,
    sourceContext: item.sourceContext,
    summary: item.summary,
    commandId: "22222222-2222-4222-8222-222222222222"
  };
  const decision = await authorizeStagedFulfillment(envelope);
  assert(decision.disposition === "ACCEPT", "explicit server-staged authorization should reach Training acceptance");
  assert(decision.command?.module === "training", "Training remains the command owner");
  assert(decision.command?.args.p_command_id === envelope.commandId, "fixed envelope command id must control idempotency");
});

Deno.test("Fulfillment itself never executes canonical commands", async () => {
  const result = await fulfill(
    source("I worked out today."),
    trainingNode({}, { localDate: "2026-09-19", precision: "RELATIVE", certainty: "HIGH" })
  );
  assert(result.invariants.executesCommands === false, "fulfillment may not execute commands");
  assert(result.invariants.persistsCanonicalReality === false, "fulfillment may not persist canonical reality");
  assert(result.invariants.requiresServerStagingBeforeConfirmation === true, "browser-returned proposals must not be trusted");
});
