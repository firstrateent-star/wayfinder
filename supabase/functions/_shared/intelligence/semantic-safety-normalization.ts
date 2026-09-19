import type { SourceEnvelope } from "./semantic-admission.ts";
import type {
  CandidateLifeEdge,
  CandidateLifeGraph,
  CandidateLifeNode,
  SemanticReasonerOutput,
  SemanticTraceEntry
} from "./semantic-compiler.ts";

const SARCASM_RISK = /sarcasm|irony|ironic|contrast.*literal|literal.*contrast/i;
const LEADING_CORRECTION = /^\s*(actually\b|no\b|wait\b|sorry\b|i mean\b)/i;
const INLINE_CORRECTION = /\b(actually|i mean|rather|correction|wait)\b|\bnot\b[^.!?—-]{0,60}[—-]/i;

export function applySemanticSafetyNormalization(
  output: SemanticReasonerOutput,
  source: SourceEnvelope
): SemanticReasonerOutput {
  let graph = downgradeSarcasmRisk(output.graph);
  graph = normalizeInlineCorrections(graph, source.content);
  return { ...output, graph };
}

export function downgradeSarcasmRisk(graph: CandidateLifeGraph): CandidateLifeGraph {
  const trace = [...graph.trace];
  const nodes = graph.nodes.map((node) => {
    if (node.realityMode !== "OCCURRED" || !node.unresolved?.some((item) => SARCASM_RISK.test(`${item.code} ${item.description}`))) {
      return node;
    }

    const unresolved = node.unresolved.map((item) =>
      SARCASM_RISK.test(`${item.code} ${item.description}`)
        ? { ...item, blocking: true }
        : item
    );

    trace.push({
      traceId: `safety:sarcasm:${node.candidateId}`,
      stage: "RECOGNITION",
      candidateId: node.candidateId,
      claim: node.concept,
      support: node.sourceSpans,
      result: "Occurrence downgraded to POSSIBLE because the reasoner itself flagged unresolved sarcasm/irony."
    });

    return { ...node, realityMode: "POSSIBLE" as const, unresolved };
  });

  return { ...graph, nodes, trace };
}

export function normalizeInlineCorrections(graph: CandidateLifeGraph, sourceText: string): CandidateLifeGraph {
  const hasLeadingCorrection = LEADING_CORRECTION.test(sourceText);
  const hasInlineCorrection = INLINE_CORRECTION.test(sourceText);
  if (!hasLeadingCorrection && !hasInlineCorrection) return graph;

  const nodes = [...graph.nodes];
  const edges = [...graph.edges];
  const trace = [...graph.trace];
  const groups = groupOccurredNodes(nodes);
  let changed = false;

  for (const group of groups) {
    if (group.length >= 2 && hasInlineCorrection) {
      const ordered = [...group].sort((a, b) => sourceOrder(a, sourceText) - sourceOrder(b, sourceText));
      const finalNode = ordered[ordered.length - 1];

      for (const earlier of ordered.slice(0, -1)) {
        const index = nodes.findIndex((node) => node.candidateId === earlier.candidateId);
        if (index < 0) continue;
        nodes[index] = { ...nodes[index], realityMode: "CORRECTION" };
        addCorrectionEdge(edges, finalNode, nodes[index]);
        trace.push(correctionTrace(nodes[index], "Earlier competing occurrence marked as superseded by an inline self-correction."));
        changed = true;
      }
      continue;
    }

    if (group.length === 1) {
      const node = group[0];

      if (hasLeadingCorrection) {
        const index = nodes.findIndex((item) => item.candidateId === node.candidateId);
        nodes[index] = {
          ...nodes[index],
          realityMode: "CORRECTION",
          unresolved: ensureCorrectionTarget(nodes[index].unresolved)
        };
        trace.push(correctionTrace(nodes[index], "Leading correction cue preserved as CORRECTION rather than a new standalone occurrence."));
        changed = true;
        continue;
      }

      if (hasInlineCorrection) {
        const correctionId = uniqueId(nodes, `inline-correction:${node.candidateId}`);
        const correctionNode: CandidateLifeNode = {
          candidateId: correctionId,
          nodeType: "CLAIM",
          concept: node.concept,
          subject: node.subject,
          realityMode: "CORRECTION",
          attributes: {
            corrected_candidate_id: {
              value: node.candidateId,
              state: "RESOLVED",
              precision: "EXACT",
              certainty: "HIGH",
              sourceSpans: [sourceText]
            }
          },
          certainty: "HIGH",
          sourceSpans: [sourceText]
        };
        nodes.push(correctionNode);
        edges.push({
          edgeId: `correction-edge:${correctionId}:${node.candidateId}`,
          fromCandidateId: correctionId,
          relation: "CORRECTS",
          toCandidateId: node.candidateId,
          certainty: "HIGH",
          sourceSpans: [sourceText]
        });
        trace.push(correctionTrace(correctionNode, "Inline correction cue retained explicitly even though the reasoner emitted only the final event."));
        changed = true;
      }
    }
  }

  return changed ? { ...graph, nodes, edges, trace } : graph;
}

function groupOccurredNodes(nodes: CandidateLifeNode[]) {
  const groups = new Map<string, CandidateLifeNode[]>();
  for (const node of nodes) {
    if (node.realityMode !== "OCCURRED") continue;
    if (node.nodeType === "ENTITY") continue;
    const key = `${node.concept}::${node.subject.kind}::${node.subject.entityRef ?? node.subject.label ?? ""}`;
    const current = groups.get(key) ?? [];
    current.push(node);
    groups.set(key, current);
  }
  return [...groups.values()];
}

function sourceOrder(node: CandidateLifeNode, sourceText: string) {
  const indexes = (node.sourceSpans ?? [])
    .map((span) => sourceText.toLowerCase().indexOf(span.toLowerCase()))
    .filter((index) => index >= 0);
  return indexes.length ? Math.min(...indexes) : Number.MAX_SAFE_INTEGER;
}

function addCorrectionEdge(edges: CandidateLifeEdge[], finalNode: CandidateLifeNode, earlier: CandidateLifeNode) {
  if (edges.some((edge) => edge.relation === "CORRECTS" && edge.fromCandidateId === finalNode.candidateId && edge.toCandidateId === earlier.candidateId)) {
    return;
  }
  edges.push({
    edgeId: `correction-edge:${finalNode.candidateId}:${earlier.candidateId}`,
    fromCandidateId: finalNode.candidateId,
    relation: "CORRECTS",
    toCandidateId: earlier.candidateId,
    certainty: "HIGH",
    sourceSpans: [...new Set([...(finalNode.sourceSpans ?? []), ...(earlier.sourceSpans ?? [])])]
  });
}

function ensureCorrectionTarget(unresolved: CandidateLifeNode["unresolved"]) {
  if (unresolved?.some((item) => /target|antecedent|referent/i.test(`${item.code} ${item.description}`))) return unresolved;
  return [
    ...(unresolved ?? []),
    {
      code: "CORRECTION_TARGET_UNRESOLVED",
      description: "The player is correcting prior meaning, but the exact prior target is not resolved in this source alone.",
      blocking: true,
      field: "correction_target"
    }
  ];
}

function correctionTrace(node: CandidateLifeNode, result: string): SemanticTraceEntry {
  return {
    traceId: `safety:correction:${node.candidateId}`,
    stage: "RELATION_RESOLUTION",
    candidateId: node.candidateId,
    claim: node.concept,
    support: node.sourceSpans,
    result
  };
}

function uniqueId(nodes: CandidateLifeNode[], base: string) {
  const ids = new Set(nodes.map((node) => node.candidateId));
  if (!ids.has(base)) return base;
  let index = 2;
  while (ids.has(`${base}:${index}`)) index++;
  return `${base}:${index}`;
}
