import type { SourceEnvelope } from "./semantic-admission.ts";
import type { ConceptRegistry } from "./concept-registry.ts";
import { conceptMatchesRequested, resolveConceptPhrase } from "./concept-resolution.ts";
import type {
  CandidateLifeEdge,
  CandidateLifeGraph,
  CandidateLifeNode,
  CandidateReference,
  SemanticContextBundle,
  SemanticReasonerOutput,
  SemanticTraceEntry
} from "./semantic-compiler.ts";

const SARCASM_RISK = /sarcasm|irony|ironic|contrast.*literal|literal.*contrast/i;
const LEADING_CORRECTION = /^\s*(actually\b|no\b|wait\b|sorry\b|i mean\b)/i;
const INLINE_CORRECTION = /\b(actually|i mean|rather|correction|wait)\b|\bnot\b[^.!?—-]{0,60}[—-]/i;
const CONSUMPTION_UNCLEAR = /consumption[_\s-]*unclear|not.*(?:eat|eaten|consum)|does not establish.*(?:eat|consum)|unclear.*(?:eat|consum)/i;
const FOOD_ACQUISITION_CUE = /\b(grabbed|picked\s+up|got|bought|ordered)\b/i;
const FOOD_CONSUMPTION_CUE = /\b(ate|eaten|eating|consumed|finished|drank|drunk|had)\b/i;
const PLAYER_ATTRIBUTED_EFFECT_CUE = /\b((?:that|this)\s+([a-z][a-z'-]*(?:\s+[a-z][a-z'-]*){0,3}))\s+(?:made|makes|helped|helps|caused|causes|left|leaves)\s+me\b/i;

export function applySemanticSafetyNormalization(
  output: SemanticReasonerOutput,
  source: SourceEnvelope
): SemanticReasonerOutput {
  let graph = downgradeSarcasmRisk(output.graph);
  graph = normalizeInlineCorrections(graph, source.content);
  graph = normalizeFoodAcquisitionVsConsumption(graph, source.content);
  graph = normalizeBareRunningQuantity(graph, source.content);
  graph = preserveExplicitClauseFinalChronology(graph, source.content);
  return { ...output, graph };
}

export function preserveExplicitPlayerAttributedEffect(
  output: SemanticReasonerOutput,
  source: SourceEnvelope,
  context: SemanticContextBundle,
  concepts: ConceptRegistry
): SemanticReasonerOutput {
  const match = source.content.match(PLAYER_ATTRIBUTED_EFFECT_CUE);
  if (!match) return output;

  const referencePhrase = match[1];
  const rawReferent = match[2];
  const resolved = resolveConceptPhrase(rawReferent, concepts).conceptId;
  if (!resolved || concepts.get(resolved)?.kind !== "ACTIVITY") return output;

  const graph = output.graph;
  const targets = graph.nodes.filter((node) =>
    node.subject.kind === "SELF" &&
    (
      node.nodeType === "STATE" ||
      node.concept === "EMOTIONAL_STATE" ||
      node.concept === "ENERGY_STATE"
    ) &&
    !["QUESTION", "HYPOTHETICAL", "POSSIBLE", "NEGATED"].includes(node.realityMode)
  );
  if (targets.length !== 1) return output;

  const target = targets[0];
  if (graph.edges.some((edge) =>
    edge.toCandidateId === target.candidateId &&
    (edge.relation === "PLAYER_ATTRIBUTES_EFFECT" || edge.relation === "RELATED_TO")
  )) return output;

  const matchingNodes = graph.nodes.filter((node) =>
    node.candidateId !== target.candidateId &&
    conceptMatchesRequested(node.concept, resolved, concepts)
  );
  const contextRefs = context.items
    .filter((item) => item.concepts?.some((concept) =>
      conceptMatchesRequested(concept, resolved, concepts)
    ))
    .map((item) => item.ref)
    .slice(0, 8);

  const nodes = [...graph.nodes];
  const references = [...graph.references];
  let referent = matchingNodes.length === 1 ? matchingNodes[0] : undefined;

  if (!referent) {
    const candidateId = uniqueId(nodes, `source-effect-reference:${target.candidateId}`);
    const unresolved = [{
      code: contextRefs.length > 1 ? "AMBIGUOUS_REFERENCE" : "REFERENCE_TARGET_UNRESOLVED",
      description: contextRefs.length > 1
        ? `The explicit reference "${referencePhrase}" has multiple semantically compatible context candidates; the attribution is preserved without choosing one.`
        : `The explicit reference "${referencePhrase}" is preserved, but its unique real-world target is not established.`,
      blocking: true,
      field: "reference"
    }];

    referent = {
      candidateId,
      nodeType: "REFERENCE",
      concept: resolved,
      subject: { kind: "GENERAL" },
      realityMode: "REFLECTION",
      attributes: {
        referencePhrase: {
          value: referencePhrase,
          state: contextRefs.length ? "PARTIAL" : "UNRESOLVED",
          precision: "EXACT",
          certainty: "HIGH",
          sourceSpans: [referencePhrase],
          ...(contextRefs.length ? { contextRefs } : {})
        }
      },
      certainty: "HIGH",
      sourceSpans: [referencePhrase],
      unresolved,
      parentConcepts: concepts.ancestors(resolved).map((item) => item.id)
    };
    nodes.push(referent);

    const reference: CandidateReference = {
      referenceId: `source-effect-reference:${target.candidateId}`,
      phrase: referencePhrase,
      candidateRefs: [candidateId],
      status: "PARTIAL",
      certainty: "HIGH"
    };
    references.push(reference);
  }

  const edge: CandidateLifeEdge = {
    edgeId: `source-effect-edge:${referent.candidateId}:${target.candidateId}`,
    fromCandidateId: referent.candidateId,
    relation: "PLAYER_ATTRIBUTES_EFFECT",
    toCandidateId: target.candidateId,
    certainty: "HIGH",
    sourceSpans: [source.content],
    ...(contextRefs.length ? { contextRefs } : {})
  };

  const trace = [...graph.trace, {
    traceId: `safety:player-attributed-effect:${target.candidateId}`,
    stage: "RELATION_RESOLUTION" as const,
    candidateId: target.candidateId,
    claim: "PLAYER_ATTRIBUTES_EFFECT",
    support: [source.content],
    ...(contextRefs.length ? { contextRefs } : {}),
    result: "Preserved the player's explicit attributed-effect relation without resolving an ambiguous referenced activity."
  }];

  return {
    ...output,
    graph: {
      ...graph,
      nodes,
      edges: [...graph.edges, edge],
      references,
      trace
    }
  };
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

export function normalizeFoodAcquisitionVsConsumption(graph: CandidateLifeGraph, sourceText: string): CandidateLifeGraph {
  const sourceSuggestsAcquisitionOnly = FOOD_ACQUISITION_CUE.test(sourceText) && !FOOD_CONSUMPTION_CUE.test(sourceText);
  const trace = [...graph.trace];
  let changed = false;

  const nodes = graph.nodes.map((node) => {
    if (node.realityMode !== "OCCURRED" || !["FOOD_INTAKE", "MEAL"].includes(node.concept)) return node;

    const reasonerFlaggedConsumptionUnclear = node.unresolved?.some((item) =>
      CONSUMPTION_UNCLEAR.test(`${item.code} ${item.description}`)
    ) ?? false;

    if (!reasonerFlaggedConsumptionUnclear && !sourceSuggestsAcquisitionOnly) return node;

    const unresolved = node.unresolved?.length
      ? node.unresolved
      : [{
          code: "CONSUMPTION_NOT_ESTABLISHED",
          description: "The source establishes obtaining food, but not that the food was consumed.",
          blocking: false,
          field: "consumption"
        }];

    const parentConcepts = [...new Set([
      ...(node.parentConcepts ?? []).filter((id) => id !== "FOOD_INTAKE" && id !== "MEAL"),
      "FOOD_EVENT"
    ])];

    trace.push({
      traceId: `safety:food-acquisition:${node.candidateId}`,
      stage: "CONCEPT_RESOLUTION",
      candidateId: node.candidateId,
      claim: node.concept,
      support: node.sourceSpans,
      result: "Consumptive meaning reduced to FOOD_ACQUISITION because the source did not establish eating or drinking."
    });

    const { claimType: _claimType, proposedOwners: _proposedOwners, ...rest } = node;
    changed = true;
    return {
      ...rest,
      concept: "FOOD_ACQUISITION",
      parentConcepts,
      unresolved
    };
  });

  return changed ? { ...graph, nodes, trace } : graph;
}

export function normalizeBareRunningQuantity(graph: CandidateLifeGraph, sourceText: string): CandidateLifeGraph {
  const match = sourceText.match(/\b(?:i\s+)?ran\s+(\d+(?:\.\d+)?)\b/i);
  if (!match) return graph;

  const explicitUnit = /\b(?:mile|miles|mi|kilometer|kilometers|kilometre|kilometres|km|meter|meters|metre|metres|m|minute|minutes|min|hour|hours|hr|hrs|lap|laps)\b/i.test(sourceText);
  if (explicitUnit) return graph;

  const numericValue = Number(match[1]);
  if (!Number.isFinite(numericValue)) return graph;

  const nodes = graph.nodes.map((node) => {
    if (node.concept !== "RUNNING" || node.subject.kind !== "SELF") return node;

    const attributes = { ...node.attributes };
    let changed = false;
    for (const key of ["distance", "duration", "laps", "count"]) {
      if (key in attributes) {
        delete attributes[key];
        changed = true;
      }
    }
    if (!changed && attributes.unqualifiedQuantity) return node;

    attributes.unqualifiedQuantity = {
      value: numericValue,
      state: "PARTIAL",
      precision: "UNKNOWN",
      certainty: node.certainty,
      sourceSpans: [match[1]]
    };

    const unresolved = [
      ...(node.unresolved ?? []).filter((item) => item.code !== "RUNNING_QUANTITY_MEANING_UNRESOLVED"),
      {
        code: "RUNNING_QUANTITY_MEANING_UNRESOLVED",
        description: `The source gives the quantity ${match[1]} for the run but does not establish whether it means distance, duration, laps, or another measure.`,
        blocking: true,
        field: "unqualifiedQuantity"
      }
    ];

    return { ...node, attributes, unresolved };
  });

  const changed = nodes.some((node, index) => node !== graph.nodes[index]);
  if (!changed) return graph;

  return {
    ...graph,
    nodes,
    trace: [...graph.trace, {
      traceId: "safety:bare-running-quantity",
      stage: "CONCEPT_RESOLUTION",
      claim: "RUNNING_QUANTITY_MEANING_UNRESOLVED",
      support: [match[0]],
      result: "Preserved the explicit numeric quantity while removing any unsupported inferred running unit or measurement type."
    }]
  };
}

export function preserveExplicitClauseFinalChronology(graph: CandidateLifeGraph, sourceText: string): CandidateLifeGraph {
  const cues = [...sourceText.matchAll(/\b(after|before)\s*(?=,|;|\.|!|\?|$)/gi)];
  if (!cues.length) return graph;

  const positioned = graph.nodes
    .filter((node) => node.nodeType !== "ENTITY" && !["QUESTION", "HYPOTHETICAL", "POSSIBLE", "NEGATED"].includes(node.realityMode))
    .map((node) => ({ node, order: sourceOrder(node, sourceText) }))
    .filter((item) => Number.isFinite(item.order) && item.order !== Number.MAX_SAFE_INTEGER)
    .sort((a, b) => a.order - b.order);

  if (positioned.length < 2) return graph;

  const edges = [...graph.edges];
  const trace = [...graph.trace];
  let changed = false;

  for (const cue of cues) {
    const cueIndex = cue.index ?? -1;
    if (cueIndex < 0) continue;

    const beforeCue = positioned.filter((item) => item.order < cueIndex);
    if (beforeCue.length < 2) continue;

    const current = beforeCue[beforeCue.length - 1].node;
    const prior = beforeCue[beforeCue.length - 2].node;
    const relation = cue[1].toLowerCase() === "before" ? "BEFORE" as const : "AFTER" as const;

    if (edges.some((edge) =>
      edge.fromCandidateId === current.candidateId &&
      edge.toCandidateId === prior.candidateId &&
      edge.relation === relation
    )) continue;

    edges.push({
      edgeId: `source-chronology:${current.candidateId}:${relation}:${prior.candidateId}`,
      fromCandidateId: current.candidateId,
      relation,
      toCandidateId: prior.candidateId,
      certainty: "HIGH",
      sourceSpans: [cue[0]]
    });
    trace.push({
      traceId: `safety:explicit-chronology:${current.candidateId}:${prior.candidateId}`,
      stage: "RELATION_RESOLUTION",
      candidateId: current.candidateId,
      claim: relation,
      support: [cue[0]],
      result: `Preserved explicit clause-final ${cue[1].toLowerCase()} chronology between adjacent source-grounded meanings.`
    });
    changed = true;
  }

  return changed ? { ...graph, edges, trace } : graph;
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
