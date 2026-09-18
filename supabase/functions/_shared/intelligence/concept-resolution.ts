import type { ConceptDefinition, ConceptRegistry } from "./concept-registry.ts";
import type {
  CandidateLifeGraph,
  CandidateLifeNode,
  SemanticReasonerOutput,
  SemanticTraceEntry
} from "./semantic-compiler.ts";

function normalizePhrase(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function phrasesFor(concept: ConceptDefinition) {
  return [concept.id, concept.label, ...(concept.aliases ?? [])]
    .map(normalizePhrase)
    .filter(Boolean);
}

function boundaryContains(haystack: string, needle: string) {
  return ` ${haystack} `.includes(` ${needle} `);
}

export interface ConceptResolution {
  rawConcept: string;
  conceptId?: string;
  match: "EXACT" | "PHRASE" | "NONE";
  matchedPhrase?: string;
}

export function resolveConceptPhrase(rawConcept: string, registry: ConceptRegistry): ConceptResolution {
  const exact = registry.resolveExact(rawConcept);
  if (exact.length === 1) {
    return { rawConcept, conceptId: exact[0].id, match: "EXACT", matchedPhrase: rawConcept };
  }
  if (exact.length > 1) {
    return { rawConcept, match: "NONE" };
  }

  const raw = normalizePhrase(rawConcept);
  const candidates: Array<{ concept: ConceptDefinition; phrase: string; score: number }> = [];

  for (const concept of registry.list()) {
    for (const phrase of phrasesFor(concept)) {
      if (!phrase || !boundaryContains(raw, phrase)) continue;
      const score = phrase.length * 100 + registry.ancestors(concept.id).length;
      candidates.push({ concept, phrase, score });
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];
  if (!best) return { rawConcept, match: "NONE" };

  const tied = candidates.filter((item) => item.score === best.score && item.concept.id !== best.concept.id);
  if (tied.length) return { rawConcept, match: "NONE" };

  return {
    rawConcept,
    conceptId: best.concept.id,
    match: "PHRASE",
    matchedPhrase: best.phrase
  };
}

export function normalizeCandidateConcepts(graph: CandidateLifeGraph, registry: ConceptRegistry): CandidateLifeGraph {
  const trace: SemanticTraceEntry[] = [...graph.trace];
  const nodes = graph.nodes.map((node) => normalizeNode(node, registry, trace));
  return { ...graph, nodes, trace };
}

export function normalizeSemanticReasonerOutput(output: SemanticReasonerOutput, registry: ConceptRegistry): SemanticReasonerOutput {
  return {
    ...output,
    graph: normalizeCandidateConcepts(output.graph, registry)
  };
}

function normalizeNode(node: CandidateLifeNode, registry: ConceptRegistry, trace: SemanticTraceEntry[]): CandidateLifeNode {
  const resolution = resolveConceptPhrase(node.concept, registry);
  const canonical = resolution.conceptId ?? node.concept;
  const parentConcepts = new Set<string>();

  for (const parent of node.parentConcepts ?? []) {
    const resolvedParent = resolveConceptPhrase(parent, registry).conceptId;
    parentConcepts.add(resolvedParent ?? parent);
  }

  if (resolution.conceptId) {
    for (const ancestor of registry.ancestors(resolution.conceptId)) parentConcepts.add(ancestor.id);
  }

  if (canonical !== node.concept) {
    trace.push({
      traceId: `concept-normalization:${node.candidateId}`,
      stage: "CONCEPT_RESOLUTION",
      candidateId: node.candidateId,
      claim: node.concept,
      support: node.sourceSpans,
      result: `${node.concept} -> ${canonical} (${resolution.match})`
    });
  }

  return {
    ...node,
    concept: canonical,
    ...(parentConcepts.size ? { parentConcepts: [...parentConcepts] } : {})
  };
}

export function conceptMatchesRequested(
  itemConcept: string,
  requestedConcept: string,
  registry: ConceptRegistry
) {
  const itemResolved = resolveConceptPhrase(itemConcept, registry).conceptId ?? itemConcept;
  const requestedResolved = resolveConceptPhrase(requestedConcept, registry).conceptId ?? requestedConcept;

  if (itemResolved === requestedResolved) return true;
  return registry.ancestors(itemResolved).some((ancestor) => ancestor.id === requestedResolved);
}
