import { createCoreLifeConceptRegistryV0 } from "../supabase/functions/_shared/intelligence/concept-registry.ts";
import { createWayfinderCapacityV0 } from "../supabase/functions/_shared/intelligence/wayfinder-capacity.ts";
import { createWayfinderAdmissionPlanningRegistryV0, planSemanticAdmission } from "../supabase/functions/_shared/intelligence/admission-planner.ts";
import {
  authorizeStagedFulfillment,
  createWayfinderFulfillmentRegistryV0,
  fulfillAdmissionPlan,
  type StagedAdmissionEnvelope
} from "../supabase/functions/_shared/intelligence/admission-fulfillment.ts";
import { normalizeSemanticReasonerOutput } from "../supabase/functions/_shared/intelligence/concept-resolution.ts";
import type {
  CandidateLifeGraph,
  CandidateLifeNode,
  SemanticCompilation,
  SemanticReasonerOutput
} from "../supabase/functions/_shared/intelligence/semantic-compiler.ts";
import type { SourceEnvelope } from "../supabase/functions/_shared/intelligence/semantic-admission.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const concepts = createCoreLifeConceptRegistryV0();
const capacity = createWayfinderCapacityV0();

function source(content: string): SourceEnvelope {
  return {
    sourceId: "nutrition:" + content,
    sourceType: "PLAYER_TEXT",
    content,
    receivedAt: "2026-09-19T19:30:00.000Z",
    interactionIntent: "CONVERSATION",
    authorizesCanonicalWrite: false,
    zoneId: "America/New_York"
  };
}

function normalizeNode(node: CandidateLifeNode) {
  const output: SemanticReasonerOutput = {
    graph: {
      sourceId: "normalize",
      nodes: [node],
      edges: [],
      references: [],
      alternateInterpretations: [],
      trace: []
    },
    contextRequests: []
  };
  return normalizeSemanticReasonerOutput(output, concepts).graph.nodes[0];
}

function compile(inputSource: SourceEnvelope, rawNode: CandidateLifeNode): SemanticCompilation {
  const node = normalizeNode(rawNode);
  const graph: CandidateLifeGraph = {
    sourceId: inputSource.sourceId,
    nodes: [node],
    edges: [],
    references: [],
    alternateInterpretations: [],
    trace: []
  };
  const assessment = capacity.assessNode(node);
  const routes = assessment.declaredPersistRoutes;
  return {
    source: inputSource,
    graph,
    capacity: [assessment],
    routing: [routes.length === 1 ? {
      candidateId: node.candidateId,
      route: "ROUTE_TO_DOMAIN",
      owner: routes[0].owner,
      claimType: routes[0].claimType,
      reason: "DETERMINISTIC_DECLARED_CLAIM_ROUTE",
      capacity: assessment
    } : {
      candidateId: node.candidateId,
      route: assessment.supportedFacets.length ? "SESSION_ONLY" : "DROP",
      reason: routes.length ? "MULTIPLE_ROUTES" : assessment.supportedFacets.length ? "NO_PERSIST_ROUTE" : "NO_CAPACITY",
      capacity: assessment
    }],
    contextRequests: [],
    validationErrors: []
  };
}

async function run(inputSource: SourceEnvelope, node: CandidateLifeNode) {
  const compilation = compile(inputSource, node);
  const plan = planSemanticAdmission(compilation, createWayfinderAdmissionPlanningRegistryV0());
  const fulfillment = await fulfillAdmissionPlan(
    compilation,
    plan,
    { asOf: inputSource.receivedAt, items: [] },
    createWayfinderFulfillmentRegistryV0()
  );
  return { compilation, plan, fulfillment };
}

function meal(attributes: CandidateLifeNode["attributes"] = {}, realityMode: CandidateLifeNode["realityMode"] = "OCCURRED", subject: CandidateLifeNode["subject"] = { kind: "SELF" }): CandidateLifeNode {
  return {
    candidateId: "meal",
    nodeType: "EVENT",
    concept: "MEAL",
    subject,
    realityMode,
    attributes,
    temporal: { localDate: "2026-09-19", precision: "RELATIVE", certainty: "HIGH" },
    certainty: "HIGH",
    sourceSpans: ["meal"]
  };
}

Deno.test("MEAL inherits FOOD_INTAKE persistence and routes only to Nutrition", async () => {
  const { compilation, plan } = await run(
    source("I ate a turkey sandwich today."),
    meal({ food: { value: "turkey sandwich", state: "RESOLVED", certainty: "HIGH", sourceSpans: ["turkey sandwich"] } })
  );
  const node = compilation.graph.nodes[0];
  assert(node.parentConcepts?.includes("FOOD_INTAKE"), "MEAL should inherit FOOD_INTAKE");
  assert(plan.proposals.length === 1, "consumed meal should produce one proposal");
  assert(plan.proposals[0].owner === "nutrition", "Nutrition must be the sole canonical owner");
  assert(plan.proposals[0].claimType === "NUTRITION_INTAKE", "Nutrition claim type should be deterministic");
});

Deno.test("simple consumed meal lowers with item detail and unknown macros", async () => {
  const { fulfillment } = await run(
    source("I ate a turkey sandwich today."),
    meal({ food: { value: "turkey sandwich", state: "RESOLVED", certainty: "HIGH", sourceSpans: ["turkey sandwich"] } })
  );
  const item = fulfillment.items[0];
  assert(item.disposition === "READY_FOR_CONFIRMATION", "consumed meal should be confirmable");
  const payload = item.normalizedPayload as {
    intakeKind: string;
    items: Array<{ itemLabel: string }>;
    nutrition: Record<string, unknown>;
  };
  assert(payload.intakeKind === "MEAL", "MEAL kind should survive");
  assert(payload.items.length === 1 && payload.items[0].itemLabel === "turkey sandwich", "explicit food item should survive");
  assert(Object.keys(payload.nutrition).length === 0, "missing macros must remain unknown rather than estimated");
});

Deno.test("explicit nutrition totals preserve numeric precision", async () => {
  const { fulfillment } = await run(
    source("I ate a chicken bowl today, about 650 calories and exactly 40 grams of protein."),
    meal({
      food: { value: "chicken bowl", state: "RESOLVED", certainty: "HIGH", sourceSpans: ["chicken bowl"] },
      calories: { value: 650, state: "RESOLVED", precision: "APPROXIMATE", certainty: "HIGH", sourceSpans: ["about 650 calories"] },
      protein: { value: 40, state: "RESOLVED", precision: "EXACT", certainty: "HIGH", sourceSpans: ["exactly 40 grams of protein"] }
    })
  );
  const payload = fulfillment.items[0].normalizedPayload as {
    nutrition: {
      caloriesKcal?: number;
      caloriesPrecision?: string;
      proteinG?: number;
      proteinPrecision?: string;
      carbsG?: number;
      fatG?: number;
    }
  };
  assert(payload.nutrition.caloriesKcal === 650 && payload.nutrition.caloriesPrecision === "APPROXIMATE", "approximate calories must stay approximate");
  assert(payload.nutrition.proteinG === 40 && payload.nutrition.proteinPrecision === "EXACT", "exact protein should stay exact");
  assert(payload.nutrition.carbsG === undefined && payload.nutrition.fatG === undefined, "unstated macros must stay unknown");
});

Deno.test("generic consumed meal can persist partially without inventing food detail", async () => {
  const { fulfillment } = await run(source("I ate lunch today."), meal({ mealType: { value: "lunch", state: "RESOLVED" } }));
  const payload = fulfillment.items[0].normalizedPayload as { items: unknown[]; genericIntake?: boolean; label?: string };
  assert(fulfillment.items[0].disposition === "READY_FOR_CONFIRMATION", "generic consumed meal should still be confirmable");
  assert(payload.items.length === 0 && payload.genericIntake === true, "unknown item detail must remain explicitly partial");
  assert(payload.label === "Lunch", "explicit meal type should survive");
});

Deno.test("food acquisition has no Nutrition persistence route", async () => {
  const acquisition: CandidateLifeNode = {
    candidateId: "food",
    nodeType: "EVENT",
    concept: "FOOD_ACQUISITION",
    subject: { kind: "SELF" },
    realityMode: "OCCURRED",
    attributes: { food: { value: "sandwich", state: "RESOLVED" } },
    temporal: { localDate: "2026-09-19", precision: "RELATIVE", certainty: "HIGH" },
    certainty: "HIGH"
  };
  const { plan } = await run(source("I bought a sandwich today."), acquisition);
  assert(plan.proposals.length === 0, "buying food must not become consumed Nutrition reality");
});

Deno.test("skipped meals and third-party meals never create player Nutrition proposals", async () => {
  for (const [node, label] of [
    [meal({}, "NEGATED"), "negated meal"],
    [meal({}, "OCCURRED", { kind: "KNOWN_OTHER", label: "Greg" }), "third-party meal"]
  ] as const) {
    const { plan } = await run(source(label), node);
    assert(plan.proposals.length === 0, label + " must not create player Nutrition proposal");
  }
});

Deno.test("missing occurrence clarifies instead of assuming today", async () => {
  const node = meal({ food: { value: "sandwich", state: "RESOLVED" } });
  delete node.temporal;
  const { fulfillment } = await run(source("I ate a sandwich."), node);
  assert(fulfillment.items[0]?.disposition === "NEEDS_CLARIFICATION", "unknown occurrence should clarify");
  assert(fulfillment.items[0]?.reason === "NUTRITION_OCCURRENCE_REQUIRED", "time gap should be explicit");
});

Deno.test("authorized Nutrition envelope reruns the owning AdmissionContract and preserves staged command id", async () => {
  const initial = await run(
    source("I ate a turkey sandwich today."),
    meal({ food: { value: "turkey sandwich", state: "RESOLVED" } })
  );
  const item = initial.fulfillment.items[0];
  assert(item.disposition === "READY_FOR_CONFIRMATION" && item.normalizedPayload && item.sourceContext && item.summary, "staged Nutrition material should exist");

  const envelope: StagedAdmissionEnvelope = {
    proposalId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    plannerProposalId: item.proposalId,
    episodeId: "episode-nutrition",
    turnId: "turn-nutrition",
    candidateId: item.candidateId,
    owner: item.owner,
    claimType: item.claimType,
    normalizedPayload: item.normalizedPayload,
    sourceContext: item.sourceContext,
    summary: item.summary,
    commandId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
  };
  const decision = await authorizeStagedFulfillment(envelope);
  assert(["ACCEPT", "ACCEPT_PARTIAL"].includes(decision.disposition), "explicit staged Nutrition authorization should be accepted");
  assert(decision.command?.module === "nutrition", "Nutrition must remain command owner");
  assert(decision.command?.commandType === "nutrition.capture_intake", "typed Nutrition command should be used");
  assert(decision.command?.args.p_command_id === envelope.commandId, "fixed staged command id must control idempotency");
});

Deno.test("Nutrition Fulfillment never estimates missing nutrition facts", async () => {
  const { fulfillment } = await run(
    source("I ate three eggs today."),
    meal({ items: { value: [{ itemLabel: "eggs", quantityValue: 3, quantityUnit: "count", quantityPrecision: "EXACT" }], state: "RESOLVED", certainty: "HIGH" } })
  );
  const payload = fulfillment.items[0].normalizedPayload as { nutrition: Record<string, unknown>; items: Array<Record<string, unknown>> };
  assert(Object.keys(payload.nutrition).length === 0, "egg calories/macros must not be inferred from general knowledge");
  assert(payload.items[0].quantityValue === 3, "explicit quantity may survive without any nutrition estimation");
});
