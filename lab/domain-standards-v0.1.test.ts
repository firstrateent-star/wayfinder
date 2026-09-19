import { createCoreLifeConceptRegistryV0 } from "../supabase/functions/_shared/intelligence/concept-registry.ts";
import { createWayfinderCapacityV0 } from "../supabase/functions/_shared/intelligence/wayfinder-capacity.ts";
import { createWayfinderAdmissionPlanningRegistryV0, planSemanticAdmission } from "../supabase/functions/_shared/intelligence/admission-planner.ts";
import {
  authorizeStagedFulfillment,
  createWayfinderFulfillmentRegistryV0,
  fulfillAdmissionPlan,
  type StagedAdmissionEnvelope
} from "../supabase/functions/_shared/intelligence/admission-fulfillment.ts";
import type { CandidateLifeGraph, CandidateLifeNode, SemanticCompilation } from "../supabase/functions/_shared/intelligence/semantic-compiler.ts";
import type { SourceEnvelope } from "../supabase/functions/_shared/intelligence/semantic-admission.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const concepts = createCoreLifeConceptRegistryV0();
const capacity = createWayfinderCapacityV0();

function source(content: string): SourceEnvelope {
  return {
    sourceId: "standard:" + content,
    sourceType: "PLAYER_TEXT",
    content,
    receivedAt: "2026-09-19T23:15:00.000Z",
    interactionIntent: "CONVERSATION",
    authorizesCanonicalWrite: false,
    zoneId: "America/New_York"
  };
}

function compile(inputSource: SourceEnvelope, node: CandidateLifeNode): SemanticCompilation {
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

function standardNode(
  concept: "STRENGTH_SESSION_STANDARD" | "PROTEIN_STANDARD",
  attributes: CandidateLifeNode["attributes"],
  realityMode: CandidateLifeNode["realityMode"] = "CURRENT_STATE",
  subject: CandidateLifeNode["subject"] = { kind: "SELF" }
): CandidateLifeNode {
  return {
    candidateId: concept.toLowerCase(),
    nodeType: "CLAIM",
    concept,
    subject,
    realityMode,
    attributes,
    certainty: "HIGH"
  };
}

Deno.test("Standard semantic concepts are registered explicitly", () => {
  assert(concepts.get("STRENGTH_SESSION_STANDARD")?.kind === "ABSTRACT", "Training Standard concept missing");
  assert(concepts.get("PROTEIN_STANDARD")?.kind === "ABSTRACT", "Protein Standard concept missing");
});

Deno.test("weekly strength Standard routes to Training and lowers to confirmation", async () => {
  const { plan, fulfillment } = await run(
    source("I want at least 3 strength sessions per week."),
    standardNode("STRENGTH_SESSION_STANDARD", {
      targetSessions: { value: 3, state: "RESOLVED", certainty: "HIGH", sourceSpans: ["3 strength sessions per week"] }
    }, "INTENDED")
  );
  assert(plan.proposals.length === 1, "training Standard should produce one proposal");
  assert(plan.proposals[0].owner === "training", "Training must own the strength Standard");
  assert(plan.proposals[0].claimType === "TRAINING_STRENGTH_STANDARD", "claim type should be deterministic");
  const item = fulfillment.items[0];
  assert(item.disposition === "READY_FOR_CONFIRMATION", "valid training Standard should be confirmable");
  const payload = item.normalizedPayload as { targetSessions: number; zoneId: string };
  assert(payload.targetSessions === 3, "weekly session target should survive");
  assert(payload.zoneId === "America/New_York", "player timezone should survive");
});

Deno.test("daily protein Standard routes to Nutrition and lowers to confirmation", async () => {
  const { plan, fulfillment } = await run(
    source("My daily protein target is 150 grams."),
    standardNode("PROTEIN_STANDARD", {
      targetGrams: { value: 150, state: "RESOLVED", certainty: "HIGH", sourceSpans: ["150 grams"] }
    })
  );
  assert(plan.proposals.length === 1, "protein Standard should produce one proposal");
  assert(plan.proposals[0].owner === "nutrition", "Nutrition must own the protein Standard");
  assert(plan.proposals[0].claimType === "NUTRITION_PROTEIN_STANDARD", "claim type should be deterministic");
  const item = fulfillment.items[0];
  assert(item.disposition === "READY_FOR_CONFIRMATION", "valid protein Standard should be confirmable");
  const payload = item.normalizedPayload as { targetGrams: number; zoneId: string };
  assert(payload.targetGrams === 150, "protein target should survive");
});

Deno.test("missing Standard target clarifies instead of installing a default", async () => {
  const { fulfillment } = await run(
    source("I want a daily protein target."),
    standardNode("PROTEIN_STANDARD", {})
  );
  assert(fulfillment.items[0]?.disposition === "NEEDS_CLARIFICATION", "missing protein target must clarify");
  assert(fulfillment.items[0]?.reason === "PROTEIN_STANDARD_TARGET_REQUIRED", "missing target reason should be explicit");
});

Deno.test("occurred or third-party Standard-shaped nodes cannot create player Standards", async () => {
  const cases: CandidateLifeNode[] = [
    standardNode("PROTEIN_STANDARD", { targetGrams: { value: 150, state: "RESOLVED" } }, "OCCURRED"),
    standardNode("STRENGTH_SESSION_STANDARD", { targetSessions: { value: 3, state: "RESOLVED" } }, "CURRENT_STATE", { kind: "KNOWN_OTHER", label: "Greg" })
  ];
  for (const node of cases) {
    const { plan } = await run(source("standard-shaped negative case"), node);
    assert(plan.proposals.length === 0, "non-player or occurred Standard must not create canonical proposal");
  }
});

Deno.test("authorized Standard envelopes rerun owning AdmissionContracts with staged command id", async () => {
  const cases: Array<{ envelope: StagedAdmissionEnvelope; module: string; commandType: string }> = [
    {
      envelope: {
        proposalId: "11111111-aaaa-4aaa-8aaa-111111111111",
        plannerProposalId: "p:training-standard",
        episodeId: "e",
        turnId: "t",
        candidateId: "training-standard",
        owner: "training",
        claimType: "TRAINING_STRENGTH_STANDARD",
        normalizedPayload: { targetSessions: 3, zoneId: "America/New_York" },
        sourceContext: { sourceId: "s", receivedAt: "2026-09-19T23:15:00Z", zoneId: "America/New_York" },
        summary: "training standard",
        commandId: "22222222-bbbb-4bbb-8bbb-222222222222"
      },
      module: "training",
      commandType: "training.set_strength_standard"
    },
    {
      envelope: {
        proposalId: "33333333-cccc-4ccc-8ccc-333333333333",
        plannerProposalId: "p:protein-standard",
        episodeId: "e",
        turnId: "t",
        candidateId: "protein-standard",
        owner: "nutrition",
        claimType: "NUTRITION_PROTEIN_STANDARD",
        normalizedPayload: { targetGrams: 150, zoneId: "America/New_York" },
        sourceContext: { sourceId: "s", receivedAt: "2026-09-19T23:15:00Z", zoneId: "America/New_York" },
        summary: "protein standard",
        commandId: "44444444-dddd-4ddd-8ddd-444444444444"
      },
      module: "nutrition",
      commandType: "nutrition.set_protein_standard"
    }
  ];

  for (const { envelope, module, commandType } of cases) {
    const decision = await authorizeStagedFulfillment(envelope);
    assert(decision.disposition === "ACCEPT", module + " Standard should accept explicit authorization");
    assert(decision.command?.module === module, "owning module must survive");
    assert(decision.command?.commandType === commandType, "typed Standard command must survive");
    assert(decision.command?.args.p_command_id === envelope.commandId, "staged command id must control idempotency");
  }
});
