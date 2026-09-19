import {
  runReadOnlySemanticLoop,
  type BoundedContextLimits,
  type ReadOnlySemanticLoopResult,
  type SemanticContextProviderRegistry
} from "./context-assembler.ts";
import type { ConceptRegistry } from "./concept-registry.ts";
import { routeCandidate, validateCandidateLifeGraph } from "./semantic-compiler.ts";
import type {
  CandidateLifeGraph,
  CandidateLifeNode,
  CandidateReference,
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

  const rawResult = await runReadOnlySemanticLoop({
    source: input.source,
    initialContext,
    reasoner: input.reasoner,
    concepts: input.concepts,
    capacity: input.capacity,
    providers: input.providers,
    limits: input.semanticLimits
  });
  const result = normalizeEpisodeTurnResult(rawResult, episodeContext, input.capacity);

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


function normalizeEpisodeTurnResult(
  result: ReadOnlySemanticLoopResult,
  episodeContext: SemanticContextItem[],
  capacityRegistry: WayfinderCapacityRegistry
): ReadOnlySemanticLoopResult {
  if (episodeContext.length === 0) return result;

  const graph = normalizeEpisodeGraph(result.compilation.graph, episodeContext);
  const capacity = graph.nodes.map((node) => capacityRegistry.assessNode(node));
  const routing = graph.nodes.map((node, index) => routeCandidate(node, capacity[index]));

  return {
    ...result,
    compilation: {
      ...result.compilation,
      graph,
      capacity,
      routing,
      validationErrors: validateCandidateLifeGraph(graph)
    }
  };
}

function normalizeEpisodeGraph(
  graph: CandidateLifeGraph,
  episodeContext: SemanticContextItem[]
): CandidateLifeGraph {
  const episodeRefs = new Set(episodeContext.map((item) => item.ref));
  const contextByRef = new Map(episodeContext.map((item) => [item.ref, item]));
  const refsByCandidateId = new Map<string, string[]>();

  for (const item of episodeContext) {
    const candidateId = item.attributes?.candidate_id;
    if (typeof candidateId !== "string") continue;
    const refs = refsByCandidateId.get(candidateId) ?? [];
    refs.push(item.ref);
    refsByCandidateId.set(candidateId, refs);
  }

  let nodes = [...graph.nodes];
  let edges = [...graph.edges];
  let references = [...graph.references];
  const trace = [...graph.trace];
  const removedIds = new Set<string>();

  const correctionGroups = new Map<string, CandidateLifeNode[]>();
  for (const node of nodes) {
    if (node.realityMode !== "CORRECTION") continue;
    const key = episodeNodeIdentity(node);
    const group = correctionGroups.get(key) ?? [];
    group.push(node);
    correctionGroups.set(key, group);
  }

  for (const group of correctionGroups.values()) {
    if (group.length < 2) continue;

    const replays = group.filter((node) => isContextOnlyEpisodeReplay(node, episodeRefs));
    const sourceSupported = group.filter((node) => hasDirectSourceEvidence(node));

    if (replays.length === 0 || sourceSupported.length !== 1) continue;

    const target = sourceSupported[0];
    const targetIndex = nodes.findIndex((node) => node.candidateId === target.candidateId);
    if (targetIndex < 0) continue;

    const refs = uniqueStrings([
      ...replays.flatMap((node) => collectEpisodeRefsFromNode(node, episodeRefs)),
      ...edges
        .filter((edge) => replays.some((node) =>
          edge.fromCandidateId === node.candidateId || edge.toCandidateId === node.candidateId
        ))
        .flatMap((edge) => (edge.contextRefs ?? []).filter((ref) => episodeRefs.has(ref)))
    ]);

    nodes[targetIndex] = attachEpisodeRefs(target, refs, refs.length === 1);
    for (const replay of replays) {
      removedIds.add(replay.candidateId);
      trace.push({
        traceId: `episode:collapse-replay:${target.candidateId}:${replay.candidateId}`,
        stage: "RELATION_RESOLUTION",
        candidateId: target.candidateId,
        claim: target.concept,
        contextRefs: refs,
        result: "Removed a context-only replay of prior episode meaning; the current-source correction remains the single active candidate."
      });
    }

    if (refs.length === 1 && !references.some((reference) =>
      reference.resolvedRef === refs[0] && reference.candidateRefs.includes(target.candidateId)
    )) {
      references.push({
        referenceId: uniqueReferenceId(references, `episode-correction-target:${target.candidateId}`),
        phrase: firstDirectSourceSpan(target) ?? "correction target",
        candidateRefs: [target.candidateId],
        status: "RESOLVED",
        resolvedRef: refs[0],
        certainty: target.certainty
      });
    }
  }

  if (removedIds.size > 0) {
    nodes = nodes.filter((node) => !removedIds.has(node.candidateId));
    edges = edges.filter((edge) =>
      !removedIds.has(edge.fromCandidateId) && !removedIds.has(edge.toCandidateId)
    );
  }

  const currentIds = new Set(nodes.map((node) => node.candidateId));
  const normalizedEdges: CandidateLifeGraph["edges"] = [];

  for (const edge of edges) {
    const fromCurrent = currentIds.has(edge.fromCandidateId);
    const toCurrent = currentIds.has(edge.toCandidateId);

    if (fromCurrent && toCurrent) {
      normalizedEdges.push(edge);
      continue;
    }

    if (fromCurrent === toCurrent) {
      normalizedEdges.push(edge);
      continue;
    }

    const currentCandidateId = fromCurrent ? edge.fromCandidateId : edge.toCandidateId;
    const missingCandidateId = fromCurrent ? edge.toCandidateId : edge.fromCandidateId;
    const edgeEpisodeRefs = (edge.contextRefs ?? []).filter((ref) => episodeRefs.has(ref));
    const priorRef = resolvePriorEpisodeRef(
      missingCandidateId,
      edgeEpisodeRefs,
      refsByCandidateId,
      contextByRef
    );

    if (!priorRef) {
      normalizedEdges.push(edge);
      continue;
    }

    const currentIndex = nodes.findIndex((node) => node.candidateId === currentCandidateId);
    if (currentIndex >= 0) {
      nodes[currentIndex] = attachEpisodeRefs(nodes[currentIndex], [priorRef], false);
    }

    let rewroteReference = false;
    references = references.map((reference) => {
      const mentionsMissing =
        reference.resolvedRef === missingCandidateId ||
        reference.candidateRefs.includes(missingCandidateId);
      if (!mentionsMissing) return reference;

      rewroteReference = true;
      return {
        ...reference,
        candidateRefs: uniqueStrings([
          ...reference.candidateRefs.filter((id) => currentIds.has(id)),
          currentCandidateId
        ]),
        status: "RESOLVED",
        resolvedRef: priorRef
      };
    });

    if (!rewroteReference) {
      references.push({
        referenceId: uniqueReferenceId(references, `episode-relation:${edge.edgeId}`),
        phrase: edge.sourceSpans?.[0] ?? edge.relation,
        candidateRefs: [currentCandidateId],
        status: "RESOLVED",
        resolvedRef: priorRef,
        certainty: edge.certainty
      });
    }

    trace.push({
      traceId: `episode:external-relation:${edge.edgeId}`,
      stage: "RELATION_RESOLUTION",
      candidateId: currentCandidateId,
      claim: edge.relation,
      support: edge.sourceSpans,
      contextRefs: [priorRef],
      result: `Cross-turn ${edge.relation} relation preserved through a transient episode reference instead of an invalid current-graph edge.`
    });
  }

  return {
    ...graph,
    nodes,
    edges: normalizedEdges,
    references,
    trace
  };
}

function episodeNodeIdentity(node: CandidateLifeNode) {
  return [
    node.concept,
    node.subject.kind,
    node.subject.entityRef ?? node.subject.label ?? ""
  ].join("::");
}

function isContextOnlyEpisodeReplay(node: CandidateLifeNode, episodeRefs: Set<string>) {
  return !hasDirectSourceEvidence(node) && collectEpisodeRefsFromNode(node, episodeRefs).length > 0;
}

function hasDirectSourceEvidence(node: CandidateLifeNode) {
  return Boolean(node.sourceSpans?.length) ||
    Object.values(node.attributes).some((field) => Boolean(field.sourceSpans?.length));
}

function firstDirectSourceSpan(node: CandidateLifeNode) {
  if (node.sourceSpans?.length) return node.sourceSpans[0];
  for (const field of Object.values(node.attributes)) {
    if (field.sourceSpans?.length) return field.sourceSpans[0];
  }
  return undefined;
}

function collectEpisodeRefsFromNode(node: CandidateLifeNode, episodeRefs: Set<string>) {
  const refs = Object.values(node.attributes)
    .flatMap((field) => field.contextRefs ?? [])
    .filter((ref) => episodeRefs.has(ref));
  if (node.subject.entityRef && episodeRefs.has(node.subject.entityRef)) refs.push(node.subject.entityRef);
  return uniqueStrings(refs);
}

function attachEpisodeRefs(
  node: CandidateLifeNode,
  refs: string[],
  resolveTarget: boolean
): CandidateLifeNode {
  if (refs.length === 0) return node;

  const attributes = { ...node.attributes };
  const sourceBacked = Object.entries(attributes)
    .filter(([, field]) => field.sourceSpans?.length)
    .map(([name]) => name);
  const targetFields = sourceBacked.length
    ? sourceBacked
    : Object.keys(attributes).slice(0, 1);

  if (targetFields.length > 0) {
    for (const name of targetFields) {
      const field = attributes[name];
      attributes[name] = {
        ...field,
        contextRefs: uniqueStrings([...(field.contextRefs ?? []), ...refs])
      };
    }
  } else {
    attributes.episode_target = {
      state: "RESOLVED",
      precision: "EXACT",
      certainty: node.certainty,
      contextRefs: refs
    };
  }

  const unresolved = resolveTarget
    ? (node.unresolved ?? []).filter((item) =>
        !/target|antecedent|referent/i.test(`${item.code} ${item.description} ${item.field ?? ""}`)
      )
    : (node.unresolved ?? []);

  return {
    ...node,
    attributes,
    ...(unresolved.length ? { unresolved } : { unresolved: [] })
  };
}

function resolvePriorEpisodeRef(
  missingCandidateId: string,
  edgeRefs: string[],
  refsByCandidateId: Map<string, string[]>,
  contextByRef: Map<string, SemanticContextItem>
) {
  const edgeMatches = edgeRefs.filter((ref) =>
    contextByRef.get(ref)?.attributes?.candidate_id === missingCandidateId
  );
  if (edgeMatches.length === 1) return edgeMatches[0];

  const known = refsByCandidateId.get(missingCandidateId) ?? [];
  const intersecting = known.filter((ref) => edgeRefs.includes(ref));
  if (intersecting.length === 1) return intersecting[0];
  if (edgeRefs.length === 1) return edgeRefs[0];
  if (known.length === 1) return known[0];
  return undefined;
}

function uniqueReferenceId(references: CandidateReference[], base: string) {
  const ids = new Set(references.map((reference) => reference.referenceId));
  if (!ids.has(base)) return base;
  let index = 2;
  while (ids.has(`${base}:${index}`)) index++;
  return `${base}:${index}`;
}

function uniqueStrings(values: string[]) {
  return [...new Set(values)];
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
