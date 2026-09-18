import { createCoreLifeConceptRegistryV0 } from "../supabase/functions/_shared/intelligence/concept-registry.ts";
import {
  conceptMatchesRequested,
  normalizeCandidateConcepts,
  resolveConceptPhrase
} from "../supabase/functions/_shared/intelligence/concept-resolution.ts";
import { inferDeterministicContextRequests } from "../supabase/functions/_shared/intelligence/context-needs.ts";
import {
  InMemorySemanticContextProvider,
  SemanticContextProviderRegistry,
  runReadOnlySemanticLoop
} from "../supabase/functions/_shared/intelligence/context-assembler.ts";
import type {
  CandidateLifeGraph,
  SemanticContextBundle,
  SemanticReasoner,
  SemanticReasonerInput,
  SemanticReasonerOutput
} from "../supabase/functions/_shared/intelligence/semantic-compiler.ts";
import type { SourceEnvelope } from "../supabase/functions/_shared/intelligence/semantic-admission.ts";
import { createWayfinderCapacityV0 } from "../supabase/functions/_shared/intelligence/wayfinder-capacity.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const concepts = createCoreLifeConceptRegistryV0();

Deno.test("compound free-form model concepts normalize into Wayfinder concepts without changing source meaning", () => {
  assert(resolveConceptPhrase("gas expense", concepts).conceptId === "EXPENSE", "gas expense should normalize to EXPENSE");
  assert(resolveConceptPhrase("Chipotle meal", concepts).conceptId === "MEAL", "merchant meal phrase should normalize to MEAL");
  assert(resolveConceptPhrase("less stressed", concepts).conceptId === "EMOTIONAL_STATE", "stress phrase should normalize to EMOTIONAL_STATE");
  assert(resolveConceptPhrase("felt like crap", concepts).conceptId === "ENERGY_STATE", "colloquial poor-energy phrase should normalize to ENERGY_STATE");
  assert(resolveConceptPhrase("running", concepts).conceptId === "RUNNING", "known labels should normalize case-insensitively");
});

Deno.test("normalizer preserves unknown leaf concepts while enriching known concepts with ancestry", () => {
  const graph: CandidateLifeGraph = {
    sourceId: "source",
    nodes: [
      node("expense", "gas expense"),
      node("foil", "WING_FOILING", ["PHYSICAL_ACTIVITY"])
    ],
    edges: [],
    references: [],
    alternateInterpretations: [],
    trace: []
  };
  const normalized = normalizeCandidateConcepts(graph, concepts);
  assert(normalized.nodes[0].concept === "EXPENSE", "compound known concept should canonicalize");
  assert(normalized.nodes[1].concept === "WING_FOILING", "unknown leaf must not be fabricated into a known leaf");
  assert(normalized.nodes[1].parentConcepts?.includes("PHYSICAL_ACTIVITY"), "supported parent meaning must survive");
  assert(normalized.trace.some((entry) => entry.stage === "CONCEPT_RESOLUTION"), "concept normalization must expose semantic lineage");
});

Deno.test("hierarchical context matching lets broad ACTIVITY requests retrieve specific RUNNING events", () => {
  assert(conceptMatchesRequested("RUNNING", "ACTIVITY", concepts), "RUNNING should satisfy broad ACTIVITY context request");
  assert(conceptMatchesRequested("MEAL", "ACTIVITY", concepts), "MEAL should satisfy ACTIVITY through FOOD_INTAKE ancestry");
  assert(!conceptMatchesRequested("EXPENSE", "ACTIVITY", concepts), "EXPENSE must not leak into ACTIVITY retrieval");
});

Deno.test("usual-language cue deterministically requests matching personal history even when model forgets", () => {
  const graph: CandidateLifeGraph = {
    sourceId: "source",
    nodes: [node("meal", "MEAL")],
    edges: [],
    references: [],
    alternateInterpretations: [],
    trace: []
  };
  const requests = inferDeterministicContextRequests(source("Had my usual breakfast."), graph, concepts);
  assert(requests.some((request) => request.kind === "DOMAIN_READ" && request.concepts?.includes("MEAL")), "usual breakfast should force bounded MEAL history request");
});

Deno.test("bounded loop uses deterministic usual-pattern request and returns for a second semantic pass", async () => {
  class UsualBreakfastReasoner implements SemanticReasoner {
    id = "usual-breakfast";
    version = "0.2";
    propose(input: SemanticReasonerInput): SemanticReasonerOutput {
      const prior = input.context.items.find((item) => item.ref === "nutrition:breakfast:recent");
      return {
        graph: {
          sourceId: input.source.sourceId,
          nodes: [{
            candidateId: "meal",
            nodeType: "EVENT",
            concept: "meal",
            subject: { kind: "SELF" },
            realityMode: "OCCURRED",
            attributes: prior
              ? { pattern: { value: prior.summary, state: "RESOLVED", certainty: "HIGH", contextRefs: [prior.ref] } }
              : { pattern: { value: "usual breakfast", state: "UNRESOLVED", certainty: "HIGH" } },
            certainty: "HIGH"
          }],
          edges: [],
          references: [],
          alternateInterpretations: [],
          trace: []
        },
        contextRequests: []
      };
    }
  }

  const providers = new SemanticContextProviderRegistry().register(new InMemorySemanticContextProvider([
    { ref: "nutrition:breakfast:recent", kind: "event", summary: "Three eggs and toast", concepts: ["MEAL"] },
    { ref: "training:run:recent", kind: "event", summary: "Two-mile run", concepts: ["RUNNING"] }
  ], [], concepts));

  const result = await runReadOnlySemanticLoop({
    source: source("Had my usual breakfast."),
    initialContext: { asOf: "2026-09-18T04:00:00.000Z", items: [] },
    reasoner: new UsualBreakfastReasoner(),
    concepts,
    capacity: createWayfinderCapacityV0(),
    providers
  });

  assert(result.reasonerPasses === 2, "deterministic context need should cause second reasoner pass");
  assert(result.context.items.length === 1 && result.context.items[0].ref === "nutrition:breakfast:recent", "only matching MEAL history should be retrieved");
  assert(result.compilation.graph.nodes[0].attributes.pattern.contextRefs?.[0] === "nutrition:breakfast:recent", "second pass should ground the pattern in retrieved context");
});

Deno.test("broad ACTIVITY model request retrieves descendants through the bounded provider", async () => {
  class BroadActivityReasoner implements SemanticReasoner {
    id = "broad-activity";
    version = "0.2";
    propose(input: SemanticReasonerInput): SemanticReasonerOutput {
      const run = input.context.items.find((item) => item.ref === "training:run:yesterday");
      return {
        graph: {
          sourceId: input.source.sourceId,
          nodes: [{
            candidateId: "activity",
            nodeType: "EVENT",
            concept: run ? "running" : "activity",
            subject: { kind: "SELF" },
            realityMode: "OCCURRED",
            attributes: {},
            certainty: "HIGH"
          }],
          edges: [],
          references: run ? [{
            referenceId: "yesterday",
            phrase: "same as yesterday",
            candidateRefs: [run.ref],
            status: "RESOLVED",
            resolvedRef: run.ref,
            certainty: "HIGH"
          }] : [],
          alternateInterpretations: [],
          trace: []
        },
        contextRequests: run ? [] : [{
          requestId: "recent-activity",
          kind: "RECENT_EVENTS",
          concepts: ["ACTIVITY"],
          purpose: "Resolve same-as-yesterday activity.",
          limit: 6
        }]
      };
    }
  }

  const providers = new SemanticContextProviderRegistry().register(new InMemorySemanticContextProvider([
    { ref: "training:run:yesterday", kind: "event", summary: "Yesterday run, 2 miles", concepts: ["RUNNING"] }
  ], [], concepts));

  const result = await runReadOnlySemanticLoop({
    source: source("Did basically the same thing as yesterday."),
    initialContext: { asOf: "2026-09-18T04:00:00.000Z", items: [] },
    reasoner: new BroadActivityReasoner(),
    concepts,
    capacity: createWayfinderCapacityV0(),
    providers
  });

  assert(result.reasonerPasses === 2, "broad request should get a context-informed second pass");
  assert(result.compilation.graph.nodes[0].concept === "RUNNING", "free-form running concept should normalize after context");
  assert(result.compilation.graph.references[0].resolvedRef === "training:run:yesterday", "yesterday reference should resolve");
});

function node(id: string, concept: string, parentConcepts: string[] = []) {
  return {
    candidateId: id,
    nodeType: "EVENT" as const,
    concept,
    subject: { kind: "SELF" as const },
    realityMode: "OCCURRED" as const,
    attributes: {},
    certainty: "HIGH" as const,
    ...(parentConcepts.length ? { parentConcepts } : {})
  };
}

function source(content: string): SourceEnvelope {
  return {
    sourceId: `test:${content}`,
    sourceType: "PLAYER_TEXT",
    content,
    receivedAt: "2026-09-18T04:00:00.000Z",
    interactionIntent: "CONVERSATION",
    authorizesCanonicalWrite: false,
    zoneId: "America/New_York"
  };
}
