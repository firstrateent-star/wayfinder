import type { ConceptRegistry } from "./concept-registry.ts";
import type {
  CandidateLifeGraph,
  ContextRequest
} from "./semantic-compiler.ts";
import type { SourceEnvelope } from "./semantic-admission.ts";

const REPEAT_PATTERN = /\b(again|same as|same thing|like yesterday|yesterday|last time|like before|as before)\b/i;
const USUAL_PATTERN = /\b(usual|normal|same as usual|what i normally|what I normally)\b/i;
const ENTITY_REFERENCE_PATTERN = /\b(that|this)\s+(install|project|job|wedding|edit)\b/i;

export function inferDeterministicContextRequests(
  source: SourceEnvelope,
  graph: CandidateLifeGraph,
  concepts: ConceptRegistry
): ContextRequest[] {
  const text = source.content;
  const requests: ContextRequest[] = [];
  const graphConcepts = canonicalGraphConcepts(graph, concepts);

  if (USUAL_PATTERN.test(text)) {
    const preferred = graphConcepts.filter((concept) => ["MEAL", "FOOD_INTAKE", "ACTIVITY"].includes(concept));
    requests.push({
      requestId: "deterministic:usual-pattern",
      kind: "DOMAIN_READ",
      concepts: preferred.length ? preferred : graphConcepts,
      purpose: "Resolve a player-specific usual/normal pattern from recent matching history.",
      limit: 8
    });
  }

  if (REPEAT_PATTERN.test(text)) {
    const preferred = graphConcepts.length ? graphConcepts : ["ACTIVITY"];
    requests.push({
      requestId: "deterministic:repeat-reference",
      kind: "RECENT_EVENTS",
      concepts: preferred,
      purpose: "Resolve a repeated/comparative reference against recent semantically compatible events.",
      limit: 8
    });
  }

  if (ENTITY_REFERENCE_PATTERN.test(text)) {
    const entityConcepts = graphConcepts.filter((concept) => ["PROJECT", "PERSON"].includes(concept));
    requests.push({
      requestId: "deterministic:entity-reference",
      kind: "KNOWN_ENTITIES",
      concepts: entityConcepts.length ? entityConcepts : ["PROJECT"],
      query: text.match(ENTITY_REFERENCE_PATTERN)?.[2],
      purpose: "Resolve a demonstrative entity reference without inventing identity.",
      limit: 6
    });
  }

  return requests;
}

function canonicalGraphConcepts(graph: CandidateLifeGraph, concepts: ConceptRegistry) {
  const result = new Set<string>();
  for (const node of graph.nodes) {
    if (concepts.get(node.concept)) result.add(node.concept);
    for (const parent of node.parentConcepts ?? []) {
      if (concepts.get(parent)) result.add(parent);
    }
  }
  return [...result];
}
