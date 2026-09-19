import {
  runReadOnlySemanticLoop,
  type BoundedContextLimits,
  type ReadOnlySemanticLoopResult,
  type SemanticContextProviderRegistry
} from "./context-assembler.ts";
import type { ConceptRegistry } from "./concept-registry.ts";
import type {
  CandidateLifeGraph,
  CompilerRoutingDecision,
  ContextRequest,
  SemanticContextBundle,
  SemanticContextItem,
  SemanticReasoner
} from "./semantic-compiler.ts";
import type { SourceEnvelope } from "./semantic-admission.ts";
import type { WayfinderCapacityRegistry } from "./wayfinder-capacity.ts";

export type SemanticEpisodeStatus = "OPEN" | "CLOSED";

export interface SemanticEpisodeTurn {
  turnId: string;
  sequence: number;
  sourceId: string;
  receivedAt: string;
  graph: CandidateLifeGraph;
  routing: CompilerRoutingDecision[];
  executedContextRequests: ContextRequest[];
  reasonerPasses: number;
}

export interface SemanticEpisode {
  episodeId: string;
  status: SemanticEpisodeStatus;
  startedAt: string;
  updatedAt: string;
  turns: SemanticEpisodeTurn[];
}

export interface SemanticEpisodeLimits {
  maxTurns: number;
  maxContextNodes: number;
}

export const DEFAULT_SEMANTIC_EPISODE_LIMITS: SemanticEpisodeLimits = {
  maxTurns: 12,
  maxContextNodes: 12
};

export interface RunSemanticEpisodeTurnInput {
  episode?: SemanticEpisode;
  episodeId?: string;
  source: SourceEnvelope;
  initialContext: SemanticContextBundle;
  reasoner: SemanticReasoner;
  concepts: ConceptRegistry;
  capacity: WayfinderCapacityRegistry;
  providers: SemanticContextProviderRegistry;
  episodeLimits?: Partial<SemanticEpisodeLimits>;
  semanticLimits?: Partial<BoundedContextLimits>;
}

export interface RunSemanticEpisodeTurnResult {
  episode: SemanticEpisode;
  result: ReadOnlySemanticLoopResult;
}

export async function runSemanticEpisodeTurn(
  input: RunSemanticEpisodeTurnInput
): Promise<RunSemanticEpisodeTurnResult> {
  if (input.source.authorizesCanonicalWrite) {
    throw new Error("SEMANTIC_EPISODE_REQUIRES_NON_AUTHORIZING_SOURCE");
  }

  const limits = validateEpisodeLimits({
    ...DEFAULT_SEMANTIC_EPISODE_LIMITS,
    ...(input.episodeLimits ?? {})
  });
  const existing = input.episode ?? createEmptyEpisode(
    input.episodeId ?? `episode:${input.source.sourceId}`,
    input.source.receivedAt
  );

  if (existing.status !== "OPEN") throw new Error("SEMANTIC_EPISODE_CLOSED");

  const episodeContext = semanticEpisodeContextItems(existing, limits.maxContextNodes);
  const initialContext = mergeEpisodeContext(input.initialContext, episodeContext);

  const result = await runReadOnlySemanticLoop({
    source: input.source,
    initialContext,
    reasoner: input.reasoner,
    concepts: input.concepts,
    capacity: input.capacity,
    providers: input.providers,
    limits: input.semanticLimits
  });

  const sequence = (existing.turns.at(-1)?.sequence ?? 0) + 1;
  const turn: SemanticEpisodeTurn = {
    turnId: `${existing.episodeId}:turn:${sequence}`,
    sequence,
    sourceId: input.source.sourceId,
    receivedAt: input.source.receivedAt,
    graph: result.compilation.graph,
    routing: result.compilation.routing,
    executedContextRequests: result.executedRequests,
    reasonerPasses: result.reasonerPasses
  };

  const turns = [...existing.turns, turn].slice(-limits.maxTurns);
  return {
    result,
    episode: {
      ...existing,
      updatedAt: input.source.receivedAt,
      turns
    }
  };
}

export function semanticEpisodeContextItems(
  episode: SemanticEpisode | undefined,
  maxNodes = DEFAULT_SEMANTIC_EPISODE_LIMITS.maxContextNodes
): SemanticContextItem[] {
  if (!episode || episode.turns.length === 0 || maxNodes <= 0) return [];

  const items: SemanticContextItem[] = [];
  for (const turn of [...episode.turns].reverse()) {
    for (const node of [...turn.graph.nodes].reverse()) {
      if (items.length >= maxNodes) return items;
      const ref = semanticEpisodeNodeRef(episode.episodeId, turn.sequence, node.candidateId);
      const unresolvedCodes = (node.unresolved ?? []).map((item) => item.code);
      const subjectLabel = node.subject.label ?? node.subject.entityRef ?? node.subject.kind;
      items.push({
        ref,
        kind: "semantic_episode_candidate",
        summary: [
          "Transient prior-turn candidate; not canonical reality.",
          `concept=${node.concept}`,
          `subject=${subjectLabel}`,
          `realityMode=${node.realityMode}`,
          `certainty=${node.certainty}`,
          unresolvedCodes.length ? `unresolved=${unresolvedCodes.join(",")}` : "unresolved=none"
        ].join(" "),
        concepts: [...new Set([node.concept, ...(node.parentConcepts ?? [])])],
        ...(node.temporal?.instant ? { occurredAt: node.temporal.instant } : {}),
        attributes: {
          semantic_episode: true,
          canonical: false,
          episode_id: episode.episodeId,
          turn_id: turn.turnId,
          sequence: turn.sequence,
          source_id: turn.sourceId,
          candidate_id: node.candidateId,
          node_type: node.nodeType,
          subject: node.subject,
          reality_mode: node.realityMode,
          certainty: node.certainty,
          semantic_attributes: node.attributes,
          temporal: node.temporal ?? null,
          unresolved: node.unresolved ?? [],
          source_spans: node.sourceSpans ?? []
        }
      });
    }
  }
  return items;
}

export function rewindSemanticEpisode(episode: SemanticEpisode, toSequence: number): SemanticEpisode {
  if (episode.status !== "OPEN") throw new Error("SEMANTIC_EPISODE_CLOSED");
  if (!Number.isInteger(toSequence) || toSequence < 0) throw new Error("INVALID_EPISODE_REWIND_SEQUENCE");
  const latest = episode.turns.at(-1)?.sequence ?? 0;
  if (toSequence > latest) throw new Error("EPISODE_REWIND_BEYOND_LATEST_TURN");

  const turns = episode.turns.filter((turn) => turn.sequence <= toSequence);
  return {
    ...episode,
    turns,
    updatedAt: turns.at(-1)?.receivedAt ?? episode.startedAt
  };
}

export function closeSemanticEpisode(episode: SemanticEpisode, closedAt: string): SemanticEpisode {
  return {
    ...episode,
    status: "CLOSED",
    updatedAt: closedAt
  };
}

export function semanticEpisodeNodeRef(episodeId: string, sequence: number, candidateId: string) {
  return `episode:${encodeURIComponent(episodeId)}:turn:${sequence}:node:${encodeURIComponent(candidateId)}`;
}

function createEmptyEpisode(episodeId: string, startedAt: string): SemanticEpisode {
  if (!episodeId.trim()) throw new Error("SEMANTIC_EPISODE_ID_REQUIRED");
  return {
    episodeId,
    status: "OPEN",
    startedAt,
    updatedAt: startedAt,
    turns: []
  };
}

function mergeEpisodeContext(
  current: SemanticContextBundle,
  episodeItems: SemanticContextItem[]
): SemanticContextBundle {
  const seen = new Set<string>();
  const items: SemanticContextItem[] = [];

  // Immediate conversational meaning is placed first so bounded context cannot
  // evict the turn needed to understand an ellipsis or correction.
  for (const item of [...episodeItems, ...current.items]) {
    if (seen.has(item.ref)) continue;
    seen.add(item.ref);
    items.push(item);
  }

  return {
    ...current,
    items
  };
}

function validateEpisodeLimits(limits: SemanticEpisodeLimits) {
  if (!Number.isInteger(limits.maxTurns) || limits.maxTurns < 1) {
    throw new Error("INVALID_SEMANTIC_EPISODE_LIMIT:maxTurns");
  }
  if (!Number.isInteger(limits.maxContextNodes) || limits.maxContextNodes < 1) {
    throw new Error("INVALID_SEMANTIC_EPISODE_LIMIT:maxContextNodes");
  }
  return limits;
}
