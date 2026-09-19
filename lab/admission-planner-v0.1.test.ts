import {
  AdmissionPlanningPolicyRegistry,
  createTrainingAdmissionPlanningPolicy,
  createWayfinderAdmissionPlanningRegistryV0,
  planSemanticAdmission
} from "../supabase/functions/_shared/intelligence/admission-planner.ts";
import { createCoreLifeConceptRegistryV0 } from "../supabase/functions/_shared/intelligence/concept-registry.ts";
import {
  compileLifeExpression,
  type CandidateLifeGraph,
  type CandidateLifeNode,
  type SemanticReasoner,
  type SemanticReasonerInput,
  type SemanticReasonerOutput
} from "../supabase/functions/_shared/intelligence/semantic-compiler.ts";
import type { SourceEnvelope } from "../supabase/functions/_shared/intelligence/semantic-admission.ts";
import {
  createWayfinderCapacityV0,
  WayfinderCapacityRegistry
} from "../supabase/functions/_shared/intelligence/wayfinder-capacity.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function source(
  content: string,
  overrides: Partial<SourceEnvelope> = {}
): SourceEnvelope {
  return {
    sourceId: `source:${content}`,
    sourceType: "PLAYER_TEXT",
    content,
    receivedAt: "2026-09-19T19:00:00.000Z",
    interactionIntent: "CONVERSATION",
    authorizesCanonicalWrite: false,
    zoneId: "America/New_York",
    ...overrides
  };
}

function node(
  candidateId: string,
  concept: string,
  realityMode: CandidateLifeNode["realityMode"],
  extras: Partial<CandidateLifeNode> = {}
): CandidateLifeNode {
  return {
    candidateId,
    nodeType: "EVENT",
    concept,
    subject: { kind: "SELF" },
    realityMode,
    attributes: {},
    certainty: "HIGH",
    sourceSpans: [candidateId],
    ...extras
  };
}

function graph(sourceId: string, nodes: CandidateLifeNode[]): CandidateLifeGraph {
  return {
    sourceId,
    nodes,
    edges: [],
    references: [],
    alternateInterpretations: [],
    trace: []
  };
}

class FixtureReasoner implements SemanticReasoner {
  readonly id = "admission-planner-fixture";
  readonly version = "0.1";

  propose(input: SemanticReasonerInput): SemanticReasonerOutput {
    switch (input.source.content) {
      case "workout-no-claim":
        return { graph: graph(input.source.sourceId, [node("training", "STRENGTH_TRAINING", "OCCURRED")]) };
      case "workout-conflicting-claim":
        return {
          graph: graph(input.source.sourceId, [
            node("training", "STRENGTH_TRAINING", "OCCURRED", { claimType: "FINANCE_EXPENSE" })
          ])
        };
      case "did-not-workout":
        return { graph: graph(input.source.sourceId, [node("training", "STRENGTH_TRAINING", "NEGATED")]) };
      case "john-worked-out":
        return {
          graph: graph(input.source.sourceId, [
            node("training", "STRENGTH_TRAINING", "REPORTED_ABOUT_OTHER", {
              subject: { kind: "KNOWN_OTHER", entityRef: "person:john", label: "John" }
            })
          ])
        };
      case "ambiguous-workout":
        return {
          graph: graph(input.source.sourceId, [
            node("training", "STRENGTH_TRAINING", "OCCURRED", {
              unresolved: [{
                code: "TRAINING_KIND_AMBIGUOUS",
                description: "The workout kind is ambiguous.",
                blocking: true
              }]
            })
          ])
        };
      case "workout-and-gas":
        return {
          graph: graph(input.source.sourceId, [
            node("training", "STRENGTH_TRAINING", "OCCURRED"),
            node("expense", "EXPENSE", "OCCURRED", {
              attributes: {
                amount: {
                  value: 40,
                  state: "PARTIAL",
                  precision: "APPROXIMATE",
                  certainty: "MEDIUM",
                  sourceSpans: ["40"]
                }
              }
            })
          ])
        };
      default:
        throw new Error(`UNKNOWN_FIXTURE:${input.source.content}`);
    }
  }
}

const concepts = createCoreLifeConceptRegistryV0();
const reasoner = new FixtureReasoner();
const emptyContext = { asOf: "2026-09-19T19:00:00.000Z", items: [] };

async function compile(inputSource: SourceEnvelope, capacity = createWayfinderCapacityV0()) {
  return await compileLifeExpression({
    source: inputSource,
    context: emptyContext,
    reasoner,
    concepts,
    capacity
  });
}

Deno.test("Capacity deterministically supplies Training owner + claim type when model leaves claimType null", async () => {
  const result = await compile(source("workout-no-claim"));
  const route = result.routing[0];

  assert(result.graph.nodes[0].claimType === undefined, "semantic graph should remain untouched");
  assert(result.capacity[0].declaredPersistRoutes.length === 1, "Training should declare one persistence route");
  assert(route.route === "ROUTE_TO_DOMAIN", "known Training occurrence should route to domain");
  assert(route.owner === "training", "capacity should choose Training, not the model");
  assert(route.claimType === "TRAINING_STRENGTH_SESSION", "capacity should supply the declared claim type");
  assert(route.reason === "DETERMINISTIC_DECLARED_CLAIM_ROUTE", "route should expose deterministic derivation");
});

Deno.test("conflicting model claim type cannot override the declared capacity route", async () => {
  const result = await compile(source("workout-conflicting-claim"));
  const route = result.routing[0];

  assert(route.route === "SESSION_ONLY", "undeclared model claim must fail closed");
  assert(route.owner === undefined, "conflicting model claim must not gain an owner");
  assert(route.reason === "UNDECLARED_CLAIM_TYPE:FINANCE_EXPENSE", "conflict reason should be explicit");
});

Deno.test("conversation produces a transient Training proposal that still requires authorization", async () => {
  const inputSource = source("workout-no-claim");
  const compilation = await compile(inputSource);
  const plan = planSemanticAdmission(compilation, createWayfinderAdmissionPlanningRegistryV0());

  assert(plan.proposals.length === 1, "one eligible Training proposal expected");
  assert(plan.items[0].disposition === "NEEDS_AUTHORIZATION", "conversation must not authorize persistence");
  assert(plan.proposals[0].authorization === "REQUIRED", "proposal must expose missing authorization");
  assert(plan.proposals[0].owner === "training", "proposal owner must come from capacity");
  assert(plan.proposals[0].claimType === "TRAINING_STRENGTH_SESSION", "proposal claim must be deterministic");
  assert(plan.proposals[0].transient === true, "proposal must remain transient");
  assert(plan.invariants.executesCommands === false, "planner must never execute commands");
  assert(plan.invariants.persistsCandidates === false, "planner must never persist candidates");
  assert(plan.invariants.modelChoosesOwner === false, "model must not choose canonical owner");
});

Deno.test("explicit RECORD authorization only makes a proposal ready for domain admission, not accepted or executed", async () => {
  const inputSource = source("workout-no-claim", {
    interactionIntent: "RECORD",
    authorizesCanonicalWrite: true
  });
  const compilation = await compile(inputSource);
  const plan = planSemanticAdmission(compilation, createWayfinderAdmissionPlanningRegistryV0());

  assert(plan.proposals.length === 1, "one Training proposal expected");
  assert(plan.items[0].disposition === "READY_FOR_DOMAIN_ADMISSION", "authorized proposal should be ready for domain admission");
  assert(plan.proposals[0].authorization === "PRESENT", "authorization state should be present");
  assert(!("command" in (plan.proposals[0] as unknown as Record<string, unknown>)), "planner proposal must not contain a domain command");
});

Deno.test("negated Training meaning never becomes a Training admission proposal", async () => {
  const compilation = await compile(source("did-not-workout"));
  const plan = planSemanticAdmission(compilation, createWayfinderAdmissionPlanningRegistryV0());

  assert(compilation.routing[0].route === "SESSION_ONLY", "negated meaning must be stopped before canonical ownership routing");
  assert(compilation.routing[0].owner === undefined, "negated meaning must carry no canonical owner");
  assert(plan.proposals.length === 0, "negated event must not produce a persistence proposal");
  assert(plan.items[0].disposition === "SESSION_ONLY", "negation should remain session-only");
  assert(plan.items[0].reason === "REALITY_MODE_NOT_CANONICAL_OCCURRENCE:NEGATED", "compiler should explain why canonical routing was blocked");
});

Deno.test("third-party Training report never becomes player Training reality", async () => {
  const compilation = await compile(source("john-worked-out"));
  const plan = planSemanticAdmission(compilation, createWayfinderAdmissionPlanningRegistryV0());

  assert(plan.proposals.length === 0, "third-party workout must not become a player Training proposal");
  assert(plan.items[0].disposition === "SESSION_ONLY", "third-party report should remain conversational");
  assert(plan.items[0].reason === "TRAINING_SUBJECT_NOT_PLAYER:KNOWN_OTHER", "subject boundary should be explicit");
});

Deno.test("blocking semantic ambiguity prevents proposal creation before authorization is considered", async () => {
  const compilation = await compile(source("ambiguous-workout"));
  const plan = planSemanticAdmission(compilation, createWayfinderAdmissionPlanningRegistryV0());

  assert(compilation.routing[0].route === "CLARIFY", "blocking ambiguity should remain a compiler clarification");
  assert(plan.proposals.length === 0, "ambiguous candidate must not get a proposal");
  assert(plan.items[0].disposition === "NEEDS_CLARIFICATION", "planner should preserve clarification state");
  assert(plan.items[0].blockingUnresolved?.[0].code === "TRAINING_KIND_AMBIGUOUS", "blocking reason should survive");
});

Deno.test("one utterance yields only currently governed proposals while other understood claims remain transient", async () => {
  const compilation = await compile(source("workout-and-gas"));
  const plan = planSemanticAdmission(compilation, createWayfinderAdmissionPlanningRegistryV0());
  const training = plan.items.find((item) => item.candidateId === "training");
  const expense = plan.items.find((item) => item.candidateId === "expense");

  assert(compilation.graph.nodes.length === 2, "semantic decomposition should preserve both claims");
  assert(plan.proposals.length === 1 && plan.proposals[0].candidateId === "training", "only Training has current governed persistence");
  assert(training?.disposition === "NEEDS_AUTHORIZATION", "Training should become a proposal");
  assert(expense?.disposition === "SESSION_ONLY", "Expense should remain understood but unpersisted");
  assert(expense?.reason === "UNDERSTOOD_BEYOND_CURRENT_PERSISTENCE_CAPACITY", "Finance gap should remain explicit");
});

Deno.test("multiple declared persistence routes clarify instead of choosing registration order", async () => {
  const capacity = new WayfinderCapacityRegistry()
    .register({
      domainId: "a",
      version: "0.1",
      concepts: [{ concept: "STRENGTH_TRAINING", facets: ["PERSIST"], claimTypes: ["CLAIM_A"] }],
      claimTypesOwned: ["CLAIM_A"]
    })
    .register({
      domainId: "b",
      version: "0.1",
      concepts: [{ concept: "STRENGTH_TRAINING", facets: ["PERSIST"], claimTypes: ["CLAIM_B"] }],
      claimTypesOwned: ["CLAIM_B"]
    });

  const result = await compile(source("workout-no-claim"), capacity);
  assert(result.routing[0].route === "CLARIFY", "ambiguous persistence route must clarify");
  assert(result.routing[0].reason.startsWith("MULTIPLE_PERSIST_ROUTES:"), "multiple routes should be explicit");
});

Deno.test("model claim type cannot break a tie between multiple declared persistence routes", async () => {
  class ExplicitClaimReasoner implements SemanticReasoner {
    readonly id = "explicit-claim-multi-route";
    readonly version = "0.1";
    propose(input: SemanticReasonerInput): SemanticReasonerOutput {
      return {
        graph: graph(input.source.sourceId, [
          node("training", "STRENGTH_TRAINING", "OCCURRED", { claimType: "CLAIM_A" })
        ])
      };
    }
  }

  const capacity = new WayfinderCapacityRegistry()
    .register({
      domainId: "a",
      version: "0.1",
      concepts: [{ concept: "STRENGTH_TRAINING", facets: ["PERSIST"], claimTypes: ["CLAIM_A"] }],
      claimTypesOwned: ["CLAIM_A"]
    })
    .register({
      domainId: "b",
      version: "0.1",
      concepts: [{ concept: "STRENGTH_TRAINING", facets: ["PERSIST"], claimTypes: ["CLAIM_B"] }],
      claimTypesOwned: ["CLAIM_B"]
    });

  const result = await compileLifeExpression({
    source: source("explicit multi route"),
    context: emptyContext,
    reasoner: new ExplicitClaimReasoner(),
    concepts,
    capacity
  });

  assert(result.routing[0].route === "CLARIFY", "model claim type must not select one of multiple canonical routes");
  assert(result.routing[0].owner === undefined, "no owner should be selected under route ambiguity");
  assert(result.routing[0].reason.startsWith("MULTIPLE_PERSIST_ROUTES:"), "ambiguity should remain explicit");
});

Deno.test("invalid semantic graph globally fails closed with zero admission proposals", async () => {
  const inputSource = source("workout-no-claim");
  const compilation = await compile(inputSource);
  compilation.validationErrors.push("EDGE_TARGET_MISSING:bad-edge:missing");

  const plan = planSemanticAdmission(compilation, createWayfinderAdmissionPlanningRegistryV0());

  assert(plan.proposals.length === 0, "invalid graph must never emit a partial admission proposal");
  assert(plan.items.every((item) => item.disposition === "REJECT"), "all candidates should fail closed when graph integrity is invalid");
  assert(plan.items.every((item) => item.reason.startsWith("INVALID_SEMANTIC_GRAPH:")), "graph-integrity failure should be explicit");
});

Deno.test("planner rejects missing domain planning policy rather than routing by owner name alone", async () => {
  const compilation = await compile(source("workout-no-claim"));
  const plan = planSemanticAdmission(compilation, new AdmissionPlanningPolicyRegistry());

  assert(plan.proposals.length === 0, "missing policy must produce no proposal");
  assert(plan.items[0].disposition === "REJECT", "missing policy is an architecture error");
  assert(plan.validationErrors.some((item) => item.startsWith("NO_ADMISSION_PLANNING_POLICY:training:")), "architecture error should be visible");
});

Deno.test("planner detects duplicate policies for the same owner and claim", async () => {
  const compilation = await compile(source("workout-no-claim"));
  const policy = createTrainingAdmissionPlanningPolicy();
  const duplicate = {
    ...policy,
    id: "training.admission-planning.duplicate"
  };
  const registry = new AdmissionPlanningPolicyRegistry().register(policy).register(duplicate);
  const plan = planSemanticAdmission(compilation, registry);

  assert(plan.proposals.length === 0, "duplicate policies must not race");
  assert(plan.items[0].disposition === "REJECT", "duplicate policy ownership is an architecture error");
  assert(plan.validationErrors.some((item) => item.startsWith("MULTIPLE_ADMISSION_PLANNING_POLICIES:training:")), "duplicate routing must be explicit");
});
