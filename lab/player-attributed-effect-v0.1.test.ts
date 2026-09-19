import { createCoreLifeConceptRegistryV0 } from "../supabase/functions/_shared/intelligence/concept-registry.ts";
import {
  InMemorySemanticContextProvider,
  SemanticContextProviderRegistry,
  runReadOnlySemanticLoop
} from "../supabase/functions/_shared/intelligence/context-assembler.ts";
import {
  preserveExplicitPlayerAttributedEffect
} from "../supabase/functions/_shared/intelligence/semantic-safety-normalization.ts";
import type {
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

function source(content: string): SourceEnvelope {
  return {
    sourceId: `effect:${content}`,
    sourceType: "PLAYER_TEXT",
    content,
    receivedAt: "2026-09-19T19:05:00.000Z",
    interactionIntent: "CONVERSATION",
    authorizesCanonicalWrite: false,
    zoneId: "America/New_York"
  };
}

class AmbiguousEffectReasoner implements SemanticReasoner {
  readonly id = "ambiguous-effect";
  readonly version = "0.1";

  propose(input: SemanticReasonerInput): SemanticReasonerOutput {
    return {
      graph: {
        sourceId: input.source.sourceId,
        nodes: [{
          candidateId: "feeling",
          nodeType: "STATE",
          concept: "EMOTIONAL_STATE",
          subject: { kind: "SELF" },
          realityMode: "CURRENT_STATE",
          attributes: {
            comparativeChange: {
              value: "way better",
              state: "RESOLVED",
              precision: "RELATIVE",
              certainty: "HIGH",
              sourceSpans: ["feel way better"]
            }
          },
          certainty: "HIGH",
          sourceSpans: ["feel way better"],
          unresolved: [{
            code: "AMBIGUOUS_REFERENCE",
            description: "The phrase that run could refer to more than one recent run.",
            blocking: true,
            field: "attributes.attributed_to"
          }]
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

Deno.test("explicit player-attributed effect survives ambiguous activity reference without fabricating an occurrence", async () => {
  const providers = new SemanticContextProviderRegistry().register(
    new InMemorySemanticContextProvider([
      {
        ref: "training:run:yesterday",
        kind: "event",
        summary: "Yesterday the player completed a two-mile run.",
        concepts: ["RUNNING"],
        occurredAt: "2026-09-18T21:00:00.000Z"
      },
      {
        ref: "training:run:tuesday",
        kind: "event",
        summary: "Tuesday the player completed a three-mile run.",
        concepts: ["RUNNING"],
        occurredAt: "2026-09-16T21:00:00.000Z"
      }
    ], [], concepts)
  );

  const inputSource = source("That run made me feel way better.");
  const result = await runReadOnlySemanticLoop({
    source: inputSource,
    initialContext: { asOf: inputSource.receivedAt, items: [] },
    reasoner: new AmbiguousEffectReasoner(),
    concepts,
    capacity: createWayfinderCapacityV0(),
    providers
  });

  assert(result.reasonerPasses === 2, "explicit attributed effect should deterministically request matching recent activity context");
  assert(result.executedRequests.some((request) =>
    request.kind === "RECENT_EVENTS" && request.concepts?.includes("RUNNING")
  ), "the referenced run should trigger a bounded RUNNING context request");

  const referenceNode = result.compilation.graph.nodes.find((node) =>
    node.nodeType === "REFERENCE" && node.concept === "RUNNING"
  );
  assert(referenceNode, "ambiguous referenced activity should remain explicitly represented");
  assert(referenceNode.realityMode === "REFLECTION", "reference representation must not fabricate a new occurred run");
  assert(referenceNode.subject.kind === "GENERAL", "unresolved referent must not be silently assigned to the player");
  assert(referenceNode.unresolved?.some((item) => item.code === "AMBIGUOUS_REFERENCE" && item.blocking), "referent ambiguity must remain blocking");
  assert(!result.compilation.graph.nodes.some((node) =>
    node.concept === "RUNNING" && node.realityMode === "OCCURRED"
  ), "normalization must not invent a run occurrence");

  const effect = result.compilation.graph.edges.find((edge) =>
    edge.relation === "PLAYER_ATTRIBUTES_EFFECT" &&
    edge.fromCandidateId === referenceNode.candidateId &&
    edge.toCandidateId === "feeling"
  );
  assert(effect, "explicit player-attributed effect relation must survive");
  assert(effect.contextRefs?.includes("training:run:yesterday"), "candidate context lineage should be retained");
  assert(effect.contextRefs?.includes("training:run:tuesday"), "all compatible ambiguous candidates should remain visible");

  const ref = result.compilation.graph.references.find((item) =>
    item.candidateRefs.includes(referenceNode.candidateId)
  );
  assert(ref?.status === "PARTIAL", "ambiguous reference must not be marked resolved");
  assert(!ref?.resolvedRef, "deterministic normalizer must not choose one context candidate");
});

Deno.test("existing attributed-effect relation is not duplicated", () => {
  const inputSource = source("That run made me feel better.");
  const output: SemanticReasonerOutput = {
    graph: {
      sourceId: inputSource.sourceId,
      nodes: [
        {
          candidateId: "run",
          nodeType: "REFERENCE",
          concept: "RUNNING",
          subject: { kind: "GENERAL" },
          realityMode: "REFLECTION",
          attributes: {},
          certainty: "HIGH"
        },
        {
          candidateId: "feeling",
          nodeType: "STATE",
          concept: "EMOTIONAL_STATE",
          subject: { kind: "SELF" },
          realityMode: "CURRENT_STATE",
          attributes: {},
          certainty: "HIGH"
        }
      ],
      edges: [{
        edgeId: "existing-effect",
        fromCandidateId: "run",
        relation: "PLAYER_ATTRIBUTES_EFFECT",
        toCandidateId: "feeling",
        certainty: "HIGH"
      }],
      references: [],
      alternateInterpretations: [],
      trace: []
    },
    contextRequests: []
  };

  const normalized = preserveExplicitPlayerAttributedEffect(
    output,
    inputSource,
    { asOf: inputSource.receivedAt, items: [] },
    concepts
  );
  assert(normalized.graph.edges.length === 1, "existing explicit effect relation must not be duplicated");
});

Deno.test("unknown referent concept is not invented merely because an effect phrase exists", () => {
  const inputSource = source("That joke made me feel better.");
  const output = new AmbiguousEffectReasoner().propose({
    source: inputSource,
    context: { asOf: inputSource.receivedAt, items: [] },
    concepts
  }) as SemanticReasonerOutput;

  const normalized = preserveExplicitPlayerAttributedEffect(
    output,
    inputSource,
    { asOf: inputSource.receivedAt, items: [] },
    concepts
  );
  assert(normalized.graph.nodes.length === 1, "unknown referent must not create a synthetic concept");
  assert(normalized.graph.edges.length === 0, "unknown referent must not create an unsupported effect edge");
});
