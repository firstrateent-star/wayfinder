import { createCoreLifeConceptRegistryV0 } from "../supabase/functions/_shared/intelligence/concept-registry.ts";
import {
  InMemorySemanticContextProvider,
  SemanticContextProviderRegistry,
  runReadOnlySemanticLoop
} from "../supabase/functions/_shared/intelligence/context-assembler.ts";
import {
  LiveSemanticReasoner,
  type SemanticModelProvider,
  type StructuredModelRequest,
  type StructuredModelResponse
} from "../supabase/functions/_shared/intelligence/live-semantic-reasoner.ts";
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

function source(content: string, authorize = false): SourceEnvelope {
  return {
    sourceId: `live-runtime:${content}`,
    sourceType: "PLAYER_TEXT",
    content,
    receivedAt: "2026-09-17T23:00:00.000Z",
    interactionIntent: "CONVERSATION",
    authorizesCanonicalWrite: authorize,
    zoneId: "America/New_York"
  };
}

const emptyContext: SemanticContextBundle = {
  asOf: "2026-09-17T23:00:00.000Z",
  items: []
};

class FakeStructuredProvider implements SemanticModelProvider {
  readonly id = "fake-provider";
  lastRequest?: StructuredModelRequest;
  constructor(private readonly payload: unknown) {}

  async generateStructured<T>(request: StructuredModelRequest): Promise<StructuredModelResponse<T>> {
    this.lastRequest = request;
    return { provider: this.id, model: request.model, data: this.payload as T };
  }
}

const emptyTemporal = {
  present: false,
  instant: null,
  intervalFrom: null,
  intervalTo: null,
  localDate: null,
  daypart: null,
  relativeText: null,
  relationToNodeId: null,
  relation: null,
  precision: "UNKNOWN",
  certainty: "UNKNOWN"
} as const;

Deno.test("LiveSemanticReasoner is provider-neutral and normalizes structured model output into CandidateLifeGraph", async () => {
  const provider = new FakeStructuredProvider({
    nodes: [{
      candidateId: "run",
      nodeType: "EVENT",
      concept: "RUNNING",
      claimType: null,
      subject: { kind: "SELF", entityRef: null, label: null },
      realityMode: "OCCURRED",
      attributes: [{
        name: "distance",
        valueJson: "2",
        state: "RESOLVED",
        precision: "EXACT",
        certainty: "HIGH",
        sourceSpans: ["2 miles"],
        contextRefs: []
      }],
      temporal: emptyTemporal,
      certainty: "HIGH",
      sourceSpans: ["I ran 2 miles"],
      proposedOwners: [],
      unresolved: [],
      parentConcepts: ["PHYSICAL_ACTIVITY", "ACTIVITY"]
    }],
    edges: [],
    references: [],
    alternateInterpretations: [],
    trace: [{
      traceId: "trace:run",
      stage: "RECOGNITION",
      candidateId: "run",
      claim: "running activity occurred",
      support: ["I ran 2 miles"],
      contextRefs: [],
      result: "RUNNING/OCCURRED"
    }],
    contextRequests: []
  });

  const reasoner = new LiveSemanticReasoner({ provider, model: "test-model" });
  const output = await reasoner.propose({ source: source("I ran 2 miles"), context: emptyContext, concepts: createCoreLifeConceptRegistryV0() });
  assert(output.graph.nodes[0].concept === "RUNNING", "concept should normalize");
  assert(output.graph.nodes[0].attributes.distance.value === 2, "wire JSON value should normalize to typed value");
  assert(provider.lastRequest?.schemaName === "wayfinder_candidate_life_graph_v0_1", "provider must receive strict semantic schema");
  assert(provider.lastRequest?.system.includes("do NOT decide truth"), "provider prompt must preserve authority boundary");
});

class ContextSeekingReasoner implements SemanticReasoner {
  readonly id = "context-seeking";
  readonly version = "0.1";

  propose(input: SemanticReasonerInput): SemanticReasonerOutput {
    const previous = input.context.items.find((item) => item.ref === "training:run:yesterday");
    if (!previous) {
      return {
        graph: blankGraph(input.source.sourceId),
        contextRequests: [{
          requestId: "recent-run",
          kind: "RECENT_EVENTS",
          concepts: ["RUNNING"],
          purpose: "Resolve same-as-yesterday reference",
          limit: 4
        }]
      };
    }

    return {
      graph: {
        ...blankGraph(input.source.sourceId),
        nodes: [{
          candidateId: "run",
          nodeType: "EVENT",
          concept: "RUNNING",
          subject: { kind: "SELF" },
          realityMode: "OCCURRED",
          attributes: {
            comparison: { value: "greater_than_previous", state: "PARTIAL", precision: "RELATIVE", certainty: "HIGH", contextRefs: [previous.ref] }
          },
          certainty: "HIGH",
          parentConcepts: ["PHYSICAL_ACTIVITY", "ACTIVITY"]
        }],
        references: [{
          referenceId: "yesterday",
          phrase: "same as yesterday",
          candidateRefs: [previous.ref],
          status: "RESOLVED",
          resolvedRef: previous.ref,
          certainty: "HIGH"
        }]
      },
      contextRequests: []
    };
  }
}

Deno.test("bounded Context Assembler performs a second reasoner pass with only requested relevant context", async () => {
  const providers = new SemanticContextProviderRegistry().register(new InMemorySemanticContextProvider([
    { ref: "training:run:yesterday", kind: "event", summary: "Yesterday run: 2 miles", concepts: ["RUNNING"], occurredAt: "2026-09-16T21:00:00.000Z", attributes: { distance_miles: 2 } },
    { ref: "nutrition:meal:yesterday", kind: "event", summary: "Yesterday dinner", concepts: ["MEAL"] }
  ]));

  const result = await runReadOnlySemanticLoop({
    source: source("Did basically the same thing as yesterday but a little longer."),
    initialContext: emptyContext,
    reasoner: new ContextSeekingReasoner(),
    concepts: createCoreLifeConceptRegistryV0(),
    capacity: createWayfinderCapacityV0(),
    providers,
    limits: { maxReasonerPasses: 2, maxRequestsPerPass: 2, maxContextItems: 8, maxItemsPerRequest: 4 }
  });

  assert(result.reasonerPasses === 2, "expected exactly two reasoner passes");
  assert(result.executedRequests.length === 1, "expected one bounded context request");
  assert(result.context.items.length === 1 && result.context.items[0].ref === "training:run:yesterday", "only RUNNING context should be assembled");
  assert(result.compilation.graph.references[0].resolvedRef === "training:run:yesterday", "second pass should resolve reference from assembled context");
  assert(result.compilation.routing[0].route === "SESSION_ONLY", "running remains understood beyond current persistence capacity");
});

Deno.test("read-only semantic loop rejects write-authorizing sources", async () => {
  let message = "";
  try {
    await runReadOnlySemanticLoop({
      source: source("I worked out today", true),
      initialContext: emptyContext,
      reasoner: new ContextSeekingReasoner(),
      concepts: createCoreLifeConceptRegistryV0(),
      capacity: createWayfinderCapacityV0(),
      providers: new SemanticContextProviderRegistry()
    });
  } catch (error) {
    message = error instanceof Error ? error.message : String(error);
  }
  assert(message === "READ_ONLY_SEMANTIC_LOOP_REQUIRES_NON_AUTHORIZING_SOURCE", "live semantic lab must fail closed against canonical authorization");
});

Deno.test("Context Assembler clamps model-requested breadth to configured budgets", async () => {
  class GreedyReasoner implements SemanticReasoner {
    id = "greedy";
    version = "0.1";
    propose(input: SemanticReasonerInput): SemanticReasonerOutput {
      return {
        graph: blankGraph(input.source.sourceId),
        contextRequests: [1, 2, 3, 4, 5].map((n) => ({
          requestId: `request-${n}`,
          kind: "RECENT_EVENTS" as const,
          concepts: ["ACTIVITY"],
          purpose: `request ${n}`,
          limit: 99
        }))
      };
    }
  }

  const result = await runReadOnlySemanticLoop({
    source: source("same again"),
    initialContext: emptyContext,
    reasoner: new GreedyReasoner(),
    concepts: createCoreLifeConceptRegistryV0(),
    capacity: createWayfinderCapacityV0(),
    providers: new SemanticContextProviderRegistry().register(new InMemorySemanticContextProvider([])),
    limits: { maxReasonerPasses: 2, maxRequestsPerPass: 2, maxContextItems: 3, maxItemsPerRequest: 1, maxPersonalAliases: 2 }
  });

  assert(result.executedRequests.length === 2, "only maxRequestsPerPass requests may execute");
  assert(result.executedRequests.every((request) => request.limit === 1), "per-request item limit must be clamped");
});

function blankGraph(sourceId: string): CandidateLifeGraph {
  return {
    sourceId,
    nodes: [],
    edges: [],
    references: [],
    alternateInterpretations: [],
    trace: []
  };
}
