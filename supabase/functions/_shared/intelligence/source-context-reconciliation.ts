import type {
  CandidateLifeGraph,
  CandidateLifeNode,
  SemanticField,
  SemanticTraceEntry
} from "./semantic-compiler.ts";

export interface SourceContextReconciliation {
  graph: CandidateLifeGraph;
  conflicts: number;
}

/**
 * Context can fill missing meaning, but it cannot silently overwrite a detail
 * the player expressed in the current source. The first semantic pass is the
 * source-only baseline for a bounded context loop; later passes may enrich it.
 */
export function reconcileSourceAuthority(
  sourceGraph: CandidateLifeGraph,
  enrichedGraph: CandidateLifeGraph
): SourceContextReconciliation {
  const trace: SemanticTraceEntry[] = [...enrichedGraph.trace];
  let conflicts = 0;

  const nodes = enrichedGraph.nodes.map((enriched) => {
    const source = findSourceCounterpart(sourceGraph.nodes, enriched);
    if (!source) return enriched;

    const attributes = { ...enriched.attributes };
    const unresolved = [...(enriched.unresolved ?? [])];

    for (const [name, sourceField] of Object.entries(source.attributes)) {
      if (!isDirectSourceField(sourceField)) continue;
      const enrichedField = attributes[name];

      if (!enrichedField) {
        attributes[name] = sourceField;
        trace.push(sourcePreservedTrace(enriched.candidateId, name, "Context pass omitted an explicit source field; source field restored."));
        continue;
      }

      if (!semanticFieldEquivalent(sourceField, enrichedField)) {
        conflicts++;
        attributes[name] = mergeSourceField(sourceField, enrichedField);
        unresolved.push({
          code: "CONTEXT_ENRICHMENT_CONFLICT",
          description: `Context-enriched meaning for "${name}" conflicted with an explicit current-source detail; the current source was preserved.`,
          blocking: false,
          field: `attributes.${name}`
        });
        trace.push(sourcePreservedTrace(
          enriched.candidateId,
          name,
          "Context-enriched value conflicted with explicit current source; source value and precision preserved."
        ));
        continue;
      }

      // Equal value still cannot become more precise/certain than the player's
      // wording. Preserve source epistemics while carrying useful context refs.
      attributes[name] = mergeSourceField(sourceField, enrichedField);
    }

    return {
      ...enriched,
      attributes,
      ...(unresolved.length ? { unresolved: dedupeUnresolved(unresolved) } : {})
    };
  });

  return {
    graph: { ...enrichedGraph, nodes, trace },
    conflicts
  };
}

function findSourceCounterpart(sourceNodes: CandidateLifeNode[], enriched: CandidateLifeNode) {
  const sameId = sourceNodes.find((node) => node.candidateId === enriched.candidateId);
  if (sameId) return sameId;

  const sameConceptSubject = sourceNodes.filter((node) =>
    node.concept === enriched.concept &&
    node.subject.kind === enriched.subject.kind
  );
  if (sameConceptSubject.length === 1) return sameConceptSubject[0];

  const overlap = sameConceptSubject.find((node) => spansOverlap(node.sourceSpans, enriched.sourceSpans));
  return overlap;
}

function isDirectSourceField(field: SemanticField) {
  return Boolean(field.sourceSpans?.length) && !field.contextRefs?.length;
}

function semanticFieldEquivalent(a: SemanticField, b: SemanticField) {
  return stableStringify(a.value) === stableStringify(b.value);
}

function mergeSourceField(source: SemanticField, enriched: SemanticField): SemanticField {
  const contextRefs = [...new Set([...(source.contextRefs ?? []), ...(enriched.contextRefs ?? [])])];
  const sourceSpans = [...new Set([...(source.sourceSpans ?? []), ...(enriched.sourceSpans ?? [])])];
  return {
    ...enriched,
    value: source.value,
    state: source.state,
    ...(source.precision ? { precision: source.precision } : {}),
    ...(source.certainty ? { certainty: source.certainty } : {}),
    ...(sourceSpans.length ? { sourceSpans } : {}),
    ...(contextRefs.length ? { contextRefs } : {})
  };
}

function sourcePreservedTrace(candidateId: string, field: string, result: string): SemanticTraceEntry {
  return {
    traceId: `source-authority:${candidateId}:${field}`,
    stage: "RELATION_RESOLUTION",
    candidateId,
    claim: field,
    result
  };
}

function dedupeUnresolved(items: NonNullable<CandidateLifeNode["unresolved"]>) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.code}::${item.field ?? ""}::${item.description}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function spansOverlap(a?: string[], b?: string[]) {
  if (!a?.length || !b?.length) return false;
  const aa = a.map(normalize);
  const bb = b.map(normalize);
  return aa.some((left) => bb.some((right) => left.includes(right) || right.includes(left)));
}

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function stableStringify(value: unknown): string {
  if (value === undefined) return "__undefined__";
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(",")}}`;
}
