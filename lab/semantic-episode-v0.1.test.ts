import { createCoreLifeConceptRegistryV0 } from "../supabase/functions/_shared/intelligence/concept-registry.ts";
import { SemanticContextProviderRegistry } from "../supabase/functions/_shared/intelligence/context-assembler.ts";
import {
  closeSemanticEpisode,
  rewindSemanticEpisode,
  runSemanticEpisodeTurn,
  semanticEpisodeContextItems,
  semanticEpisodeNodeRef,
  type SemanticEpisode
} from "../supabase/functions/_shared/intelligence/semantic-episode.ts";
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
const capacity = createWayfinderCapacityV0();
const providers = new SemanticContextProviderRegistry();
const emptyContext: SemanticContextBundle = {
  asOf: "2026-09-19T14:00:00.000Z",
  items: []
};

function source(id: string, content: string, receivedAt: string, authorize = false): SourceEnvelope {
  return {
    sourceId: id,
    sourceType: "PLAYER_TEXT",
    content,
    receivedAt,
    interactionIntent: "CONVERSATION",
    authorizesCanonicalWrite: authorize,
    zoneId: "America/New_York"
  };
}

function graph(sourceId: string, nodes: CandidateLifeGraph["nodes"]): CandidateLifeGraph {
  return {
    sourceId,
    nodes,
    edges: [],
    references: [],
    alternateInterpretations: [],
    trace: []
  };
}

class WorkoutScopeEpisodeReasoner implements SemanticReasoner {
  readonly id = "workout-scope-episode";
  readonly version = "0.1";

  propose(input: SemanticReasonerInput): SemanticReasonerOutput {
    if (/worked out/i.test(input.source.content)) {
      return {
        graph: graph(input.source.sourceId, [{
          candidateId: "workout",
          nodeType: "EVENT",
          concept: "STRENGTH_TRAINING",
          subject: { kind: "SELF" },
          realityMode: "OCCURRED",
          attributes: {},
          certainty: "HIGH",
          sourceSpans: ["worked out"],
          unresolved: [{
            code: "TRAINING_SCOPE_UNKNOWN",
            description: "The trained body area is not stated.",
            blocking: false,
            field: "focus"
          }],
          parentConcepts: ["PHYSICAL_ACTIVITY", "ACTIVITY"]
        }]),
        contextRequests: []
      };
    }

    const prior = input.context.items.find((item) =>
      item.kind === "semantic_episode_candidate" &&
      item.concepts?.includes("STRENGTH_TRAINING")
    );

    if (/legs/i.test(input.source.content) && prior) {
      return {
        graph: graph(input.source.sourceId, [{
          candidateId: "workout-refinement",
          nodeType: "EVENT",
          concept: "STRENGTH_TRAINING",
          subject: { kind: "SELF" },
          realityMode: "OCCURRED",
          attributes: {
            focus: {
              value: "LEGS",
              state: "RESOLVED",
              precision: "EXACT",
              certainty: "HIGH",
              sourceSpans: ["Legs"],
              contextRefs: [prior.ref]
            }
          },
          certainty: "HIGH",
          sourceSpans: ["Legs"],
          parentConcepts: ["PHYSICAL_ACTIVITY", "ACTIVITY"]
        }]),
        contextRequests: []
      };
    }

    return { graph: graph(input.source.sourceId, []), contextRequests: [] };
  }
}

Deno.test("semantic episode carries unresolved prior-turn meaning into the next semantic pass", async () => {
  const reasoner = new WorkoutScopeEpisodeReasoner();

  const first = await runSemanticEpisodeTurn({
    episodeId: "workout-episode",
    source: source("turn-1", "I worked out today.", "2026-09-19T14:00:00.000Z"),
    initialContext: emptyContext,
    reasoner,
    concepts,
    capacity,
    providers
  });

  assert(first.episode.turns.length === 1, "first turn should be retained transiently");
  assert(first.episode.turns[0].graph.nodes[0].unresolved?.some((item) => item.code === "TRAINING_SCOPE_UNKNOWN"), "first turn should preserve unresolved scope");

  const second = await runSemanticEpisodeTurn({
    episode: first.episode,
    source: source("turn-2", "Legs.", "2026-09-19T14:01:00.000Z"),
    initialContext: emptyContext,
    reasoner,
    concepts,
    capacity,
    providers
  });

  const node = second.result.compilation.graph.nodes[0];
  const expectedRef = semanticEpisodeNodeRef("workout-episode", 1, "workout");
  assert(second.episode.turns.length === 2, "episode should contain both transient turns");
  assert(node.concept === "STRENGTH_TRAINING", "elliptical follow-up should refine the prior workout concept");
  assert(node.attributes.focus.value === "LEGS", "follow-up should resolve the missing focus");
  assert(node.attributes.focus.contextRefs?.includes(expectedRef), "refinement must cite the transient prior-turn candidate");
});

class CorrectionEpisodeReasoner implements SemanticReasoner {
  readonly id = "correction-episode";
  readonly version = "0.1";

  propose(input: SemanticReasonerInput): SemanticReasonerOutput {
    if (/two miles/i.test(input.source.content)) {
      return {
        graph: graph(input.source.sourceId, [{
          candidateId: "run",
          nodeType: "EVENT",
          concept: "RUNNING",
          subject: { kind: "SELF" },
          realityMode: "OCCURRED",
          attributes: {
            distance: { value: 2, state: "RESOLVED", precision: "EXACT", certainty: "HIGH" }
          },
          certainty: "HIGH",
          parentConcepts: ["PHYSICAL_ACTIVITY", "ACTIVITY"]
        }]),
        contextRequests: []
      };
    }

    const prior = input.context.items.find((item) =>
      item.kind === "semantic_episode_candidate" &&
      item.concepts?.includes("RUNNING")
    );

    return {
      graph: {
        ...graph(input.source.sourceId, [{
          candidateId: "distance-correction",
          nodeType: "CLAIM",
          concept: "RUNNING",
          subject: { kind: "SELF" },
          realityMode: "CORRECTION",
          attributes: {
            distance: {
              value: 2.5,
              state: "RESOLVED",
              precision: "EXACT",
              certainty: "HIGH",
              sourceSpans: ["2.5"],
              ...(prior ? { contextRefs: [prior.ref] } : {})
            }
          },
          certainty: "HIGH",
          sourceSpans: ["Actually 2.5"],
          unresolved: prior ? [] : [{
            code: "CORRECTION_TARGET_UNRESOLVED",
            description: "Prior target unavailable.",
            blocking: true
          }]
        }]),
        references: prior ? [{
          referenceId: "corrected-prior-run",
          phrase: "Actually",
          candidateRefs: [prior.ref],
          status: "RESOLVED",
          resolvedRef: prior.ref,
          certainty: "HIGH"
        }] : []
      },
      contextRequests: []
    };
  }
}

Deno.test("cross-turn correction remains a correction and never becomes a fresh occurrence", async () => {
  const reasoner = new CorrectionEpisodeReasoner();
  const first = await runSemanticEpisodeTurn({
    episodeId: "correction-episode",
    source: source("run-1", "I ran two miles earlier.", "2026-09-19T14:00:00.000Z"),
    initialContext: emptyContext,
    reasoner,
    concepts,
    capacity,
    providers
  });
  const second = await runSemanticEpisodeTurn({
    episode: first.episode,
    source: source("run-2", "Actually 2.5.", "2026-09-19T14:01:00.000Z"),
    initialContext: emptyContext,
    reasoner,
    concepts,
    capacity,
    providers
  });

  const correction = second.result.compilation.graph.nodes[0];
  assert(correction.realityMode === "CORRECTION", "follow-up must remain correction semantics");
  assert(!second.result.compilation.graph.nodes.some((node) => node.realityMode === "OCCURRED"), "correction turn must not create a second run occurrence");
  assert(second.result.compilation.graph.references[0]?.resolvedRef?.includes("turn:1:node:run"), "correction should resolve against the transient prior run");
});

Deno.test("episode context is bounded newest-first and explicitly noncanonical", () => {
  const episode: SemanticEpisode = {
    episodeId: "bounded",
    status: "OPEN",
    startedAt: "2026-09-19T14:00:00.000Z",
    updatedAt: "2026-09-19T14:02:00.000Z",
    turns: [1, 2, 3].map((sequence) => ({
      turnId: `bounded:turn:${sequence}`,
      sequence,
      sourceId: `source-${sequence}`,
      receivedAt: `2026-09-19T14:0${sequence}:00.000Z`,
      graph: graph(`source-${sequence}`, [{
        candidateId: `node-${sequence}`,
        nodeType: "EVENT",
        concept: sequence === 3 ? "RUNNING" : "ACTIVITY",
        subject: { kind: "SELF" },
        realityMode: "OCCURRED",
        attributes: {},
        certainty: "HIGH"
      }]),
      routing: [],
      executedContextRequests: [],
      reasonerPasses: 1
    }))
  };

  const items = semanticEpisodeContextItems(episode, 2);
  assert(items.length === 2, "episode context must obey maxContextNodes");
  assert(items[0].attributes?.sequence === 3 && items[1].attributes?.sequence === 2, "most recent turns must be preferred");
  assert(items.every((item) => item.attributes?.canonical === false), "episode context must declare itself noncanonical");
});

Deno.test("rewinding an open episode removes later working meaning without touching earlier turns", () => {
  const episode: SemanticEpisode = {
    episodeId: "rewind",
    status: "OPEN",
    startedAt: "2026-09-19T14:00:00.000Z",
    updatedAt: "2026-09-19T14:02:00.000Z",
    turns: [1, 2].map((sequence) => ({
      turnId: `rewind:turn:${sequence}`,
      sequence,
      sourceId: `source-${sequence}`,
      receivedAt: `2026-09-19T14:0${sequence}:00.000Z`,
      graph: graph(`source-${sequence}`, []),
      routing: [],
      executedContextRequests: [],
      reasonerPasses: 1
    }))
  };
  const rewound = rewindSemanticEpisode(episode, 1);
  assert(rewound.turns.length === 1 && rewound.turns[0].sequence === 1, "rewind should discard only later transient turns");
});

Deno.test("closed episodes and write-authorizing sources fail closed", async () => {
  let writeError = "";
  try {
    await runSemanticEpisodeTurn({
      episodeId: "write",
      source: source("write-1", "I ran.", "2026-09-19T14:00:00.000Z", true),
      initialContext: emptyContext,
      reasoner: new WorkoutScopeEpisodeReasoner(),
      concepts,
      capacity,
      providers
    });
  } catch (error) {
    writeError = error instanceof Error ? error.message : String(error);
  }
  assert(writeError === "SEMANTIC_EPISODE_REQUIRES_NON_AUTHORIZING_SOURCE", "semantic episodes must never become an implicit write path");

  const closed = closeSemanticEpisode({
    episodeId: "closed",
    status: "OPEN",
    startedAt: "2026-09-19T14:00:00.000Z",
    updatedAt: "2026-09-19T14:00:00.000Z",
    turns: []
  }, "2026-09-19T14:05:00.000Z");

  let closedError = "";
  try {
    await runSemanticEpisodeTurn({
      episode: closed,
      source: source("closed-1", "Legs.", "2026-09-19T14:06:00.000Z"),
      initialContext: emptyContext,
      reasoner: new WorkoutScopeEpisodeReasoner(),
      concepts,
      capacity,
      providers
    });
  } catch (error) {
    closedError = error instanceof Error ? error.message : String(error);
  }
  assert(closedError === "SEMANTIC_EPISODE_CLOSED", "closed transient episodes must not accept new turns");
});


class EpisodeBoundaryArtifactReasoner implements SemanticReasoner {
  readonly id = "episode-boundary-artifact";
  readonly version = "0.1";

  propose(input: SemanticReasonerInput): SemanticReasonerOutput {
    if (/two miles earlier/i.test(input.source.content)) {
      return {
        graph: graph(input.source.sourceId, [{
          candidateId: "c1",
          nodeType: "EVENT",
          concept: "RUNNING",
          subject: { kind: "SELF" },
          realityMode: "OCCURRED",
          attributes: {
            distance: {
              value: 2,
              state: "RESOLVED",
              precision: "EXACT",
              certainty: "HIGH",
              sourceSpans: ["two miles"]
            }
          },
          certainty: "HIGH",
          sourceSpans: ["I ran two miles earlier."]
        }]),
        contextRequests: []
      };
    }

    const prior = input.context.items.find((item) =>
      item.kind === "semantic_episode_candidate" && item.concepts?.includes("RUNNING")
    );
    if (!prior) return { graph: graph(input.source.sourceId, []), contextRequests: [] };

    return {
      graph: {
        ...graph(input.source.sourceId, [
          {
            candidateId: "c1",
            nodeType: "EVENT",
            concept: "RUNNING",
            subject: { kind: "SELF" },
            realityMode: "OCCURRED",
            attributes: {
              distance: {
                value: 2,
                state: "RESOLVED",
                precision: "EXACT",
                certainty: "HIGH",
                contextRefs: [prior.ref]
              }
            },
            certainty: "HIGH"
          },
          {
            candidateId: "c2",
            nodeType: "CLAIM",
            concept: "RUNNING",
            subject: { kind: "SELF" },
            realityMode: "CORRECTION",
            attributes: {
              distance: {
                value: 2.5,
                state: "RESOLVED",
                precision: "EXACT",
                certainty: "HIGH",
                sourceSpans: ["2.5"]
              }
            },
            certainty: "HIGH",
            sourceSpans: ["Actually 2.5."],
            unresolved: [{
              code: "CORRECTION_TARGET_UNRESOLVED",
              description: "Prior target was represented as a local candidate id.",
              blocking: true,
              field: "correction_target"
            }]
          }
        ]),
        edges: [{
          edgeId: "e1",
          fromCandidateId: "c2",
          relation: "CORRECTS",
          toCandidateId: "c1",
          certainty: "HIGH",
          contextRefs: [prior.ref]
        }]
      },
      contextRequests: []
    };
  }
}

Deno.test("episode boundary collapses context-only correction replays into one source-supported correction", async () => {
  const reasoner = new EpisodeBoundaryArtifactReasoner();
  const first = await runSemanticEpisodeTurn({
    episodeId: "artifact-correction",
    source: source("artifact-run-1", "I ran two miles earlier.", "2026-09-19T14:00:00.000Z"),
    initialContext: emptyContext,
    reasoner,
    concepts,
    capacity,
    providers
  });

  const second = await runSemanticEpisodeTurn({
    episode: first.episode,
    source: source("artifact-run-2", "Actually 2.5.", "2026-09-19T14:01:00.000Z"),
    initialContext: emptyContext,
    reasoner,
    concepts,
    capacity,
    providers
  });

  const runs = second.result.compilation.graph.nodes.filter((node) => node.concept === "RUNNING");
  const expectedRef = semanticEpisodeNodeRef("artifact-correction", 1, "c1");
  assert(runs.length === 1, "context-only replay should not survive as a second RUNNING correction");
  assert(runs[0].realityMode === "CORRECTION", "remaining node must preserve correction semantics");
  assert(runs[0].attributes.distance.value === 2.5, "remaining correction must preserve the current-source distance");
  assert(runs[0].attributes.distance.contextRefs?.includes(expectedRef), "correction must retain the prior transient target ref");
  assert(!(runs[0].unresolved ?? []).some((item) => item.code === "CORRECTION_TARGET_UNRESOLVED"), "exact episode target should resolve correction-target ambiguity");
  assert(second.result.compilation.validationErrors.length === 0, "normalized correction graph must validate");
});

class CrossTurnRelationArtifactReasoner implements SemanticReasoner {
  readonly id = "cross-turn-relation-artifact";
  readonly version = "0.1";

  propose(input: SemanticReasonerInput): SemanticReasonerOutput {
    if (/squats yesterday/i.test(input.source.content)) {
      return {
        graph: graph(input.source.sourceId, [{
          candidateId: "c1",
          nodeType: "EVENT",
          concept: "STRENGTH_TRAINING",
          subject: { kind: "SELF" },
          realityMode: "OCCURRED",
          attributes: {
            exercises: {
              value: ["squats"],
              state: "RESOLVED",
              precision: "EXACT",
              certainty: "HIGH",
              sourceSpans: ["squats"]
            }
          },
          certainty: "HIGH",
          sourceSpans: ["I did squats yesterday."]
        }]),
        contextRequests: []
      };
    }

    const prior = input.context.items.find((item) =>
      item.kind === "semantic_episode_candidate" && item.concepts?.includes("STRENGTH_TRAINING")
    );
    if (!prior) return { graph: graph(input.source.sourceId, []), contextRequests: [] };

    return {
      graph: {
        ...graph(input.source.sourceId, [{
          candidateId: "c2",
          nodeType: "EVENT",
          concept: "STRENGTH_TRAINING",
          subject: { kind: "SELF" },
          realityMode: "OCCURRED",
          attributes: {
            exercises: {
              value: ["squats"],
              state: "RESOLVED",
              precision: "EXACT",
              certainty: "HIGH",
              sourceSpans: ["Same thing today."],
              contextRefs: [prior.ref]
            }
          },
          certainty: "HIGH",
          sourceSpans: ["Same thing today."]
        }]),
        references: [{
          referenceId: "r1",
          phrase: "Same thing",
          candidateRefs: ["c1"],
          status: "RESOLVED",
          resolvedRef: "c1",
          certainty: "HIGH"
        }],
        edges: [{
          edgeId: "e1",
          fromCandidateId: "c2",
          relation: "REPEATS",
          toCandidateId: "c1",
          certainty: "HIGH",
          sourceSpans: ["Same thing"],
          contextRefs: [prior.ref]
        }]
      },
      contextRequests: []
    };
  }
}

Deno.test("episode boundary converts dangling cross-turn edges into transient episode references", async () => {
  const reasoner = new CrossTurnRelationArtifactReasoner();
  const first = await runSemanticEpisodeTurn({
    episodeId: "artifact-repeat",
    source: source("artifact-repeat-1", "I did squats yesterday.", "2026-09-19T14:00:00.000Z"),
    initialContext: emptyContext,
    reasoner,
    concepts,
    capacity,
    providers
  });
  const second = await runSemanticEpisodeTurn({
    episode: first.episode,
    source: source("artifact-repeat-2", "Same thing today.", "2026-09-19T14:01:00.000Z"),
    initialContext: emptyContext,
    reasoner,
    concepts,
    capacity,
    providers
  });

  const expectedRef = semanticEpisodeNodeRef("artifact-repeat", 1, "c1");
  const currentGraph = second.result.compilation.graph;
  assert(currentGraph.edges.length === 0, "cross-turn relation must not remain as a dangling current-graph edge");
  assert(currentGraph.references.some((reference) =>
    reference.resolvedRef === expectedRef && reference.candidateRefs.includes("c2")
  ), "cross-turn relation must resolve to the full transient episode ref");
  assert(second.result.compilation.validationErrors.length === 0, "normalized cross-turn relation graph must validate");
});


class EquivalentCorrectionReasoner implements SemanticReasoner {
  readonly id = "equivalent-correction";
  readonly version = "0.1";

  propose(input: SemanticReasonerInput): SemanticReasonerOutput {
    if (/two miles earlier/i.test(input.source.content)) {
      return {
        graph: graph(input.source.sourceId, [{
          candidateId: "prior-run",
          nodeType: "EVENT",
          concept: "RUNNING",
          subject: { kind: "SELF" },
          realityMode: "OCCURRED",
          attributes: {
            distance: {
              value: 2,
              state: "RESOLVED",
              precision: "EXACT",
              certainty: "HIGH",
              sourceSpans: ["two miles"]
            }
          },
          certainty: "HIGH"
        }]),
        contextRequests: []
      };
    }

    const prior = input.context.items.find((item) =>
      item.kind === "semantic_episode_candidate" && item.concepts?.includes("RUNNING")
    );
    if (!prior) return { graph: graph(input.source.sourceId, []), contextRequests: [] };

    return {
      graph: {
        ...graph(input.source.sourceId, [
          {
            candidateId: "correction-a",
            nodeType: "CLAIM",
            concept: "RUNNING",
            subject: { kind: "SELF" },
            realityMode: "CORRECTION",
            attributes: {
              correctedDistance: {
                value: 2.5,
                state: "RESOLVED",
                precision: "EXACT",
                certainty: "HIGH",
                sourceSpans: ["Actually 2.5."],
                contextRefs: [prior.ref]
              },
              unit: {
                value: "miles",
                state: "RESOLVED",
                precision: "EXACT",
                certainty: "HIGH",
                contextRefs: [prior.ref]
              }
            },
            certainty: "HIGH"
          },
          {
            candidateId: "correction-b",
            nodeType: "CLAIM",
            concept: "RUNNING",
            subject: { kind: "SELF" },
            realityMode: "CORRECTION",
            attributes: {
              distance: {
                value: 2.5,
                state: "RESOLVED",
                precision: "EXACT",
                certainty: "HIGH",
                sourceSpans: ["Actually 2.5."],
                contextRefs: [prior.ref]
              },
              unit: {
                value: "miles",
                state: "RESOLVED",
                precision: "EXACT",
                certainty: "HIGH",
                contextRefs: [prior.ref]
              }
            },
            certainty: "HIGH",
            unresolved: [{
              code: "CORRECTION_TARGET_UNRESOLVED",
              description: "Target should resolve through episode context.",
              blocking: true,
              field: "correction_target"
            }]
          }
        ]),
        references: [{
          referenceId: "r1",
          phrase: "Actually",
          candidateRefs: ["correction-b"],
          status: "RESOLVED",
          resolvedRef: prior.ref,
          certainty: "HIGH"
        }],
        edges: [{
          edgeId: "e1",
          fromCandidateId: "correction-a",
          relation: "CORRECTS",
          toCandidateId: "correction-b",
          certainty: "HIGH",
          contextRefs: [prior.ref]
        }]
      },
      contextRequests: []
    };
  }
}

Deno.test("episode boundary merges equivalent source-supported correction candidates for one prior target", async () => {
  const reasoner = new EquivalentCorrectionReasoner();
  const first = await runSemanticEpisodeTurn({
    episodeId: "equivalent-correction",
    source: source("equivalent-1", "I ran two miles earlier.", "2026-09-19T14:00:00.000Z"),
    initialContext: emptyContext,
    reasoner,
    concepts,
    capacity,
    providers
  });
  const second = await runSemanticEpisodeTurn({
    episode: first.episode,
    source: source("equivalent-2", "Actually 2.5.", "2026-09-19T14:01:00.000Z"),
    initialContext: emptyContext,
    reasoner,
    concepts,
    capacity,
    providers
  });

  const graphNow = second.result.compilation.graph;
  const corrections = graphNow.nodes.filter((node) =>
    node.concept === "RUNNING" && node.realityMode === "CORRECTION"
  );
  const expectedRef = semanticEpisodeNodeRef("equivalent-correction", 1, "prior-run");
  assert(corrections.length === 1, "equivalent corrections for one target should merge into one node");
  assert(corrections[0].attributes.distance?.value === 2.5, "merged correction should canonicalize correctedDistance to distance");
  assert(corrections[0].attributes.distance?.contextRefs?.includes(expectedRef), "merged correction should retain the prior episode target");
  assert(!(corrections[0].unresolved ?? []).some((item) => item.code === "CORRECTION_TARGET_UNRESOLVED"), "resolved episode target should clear target ambiguity");
  assert(graphNow.edges.length === 0, "self-edge created by correction merge should be removed");
  assert(graphNow.references.some((reference) =>
    reference.resolvedRef === expectedRef && reference.candidateRefs.includes(corrections[0].candidateId)
  ), "reference should be remapped to the surviving correction node");
  assert(second.result.compilation.validationErrors.length === 0, "merged correction graph must validate");
});
