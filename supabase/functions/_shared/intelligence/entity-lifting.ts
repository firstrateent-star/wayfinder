import type {
  CandidateLifeEdge,
  CandidateLifeGraph,
  CandidateLifeNode,
  SemanticCertainty,
  SemanticContextBundle,
  SemanticField,
  SemanticReasonerOutput
} from "./semantic-compiler.ts";

const PARTICIPANT_FIELD = /(^|_)(co_?)?participants?$|(^|_)(companions?|people|persons?|with)$/i;
const SELF_LABELS = new Set(["i", "me", "myself", "self", "player", "the player"]);

export function liftExplicitPersonParticipantsInOutput(
  output: SemanticReasonerOutput,
  context: SemanticContextBundle
): SemanticReasonerOutput {
  return {
    ...output,
    graph: liftExplicitPersonParticipants(output.graph, context)
  };
}

export function liftExplicitPersonParticipants(
  graph: CandidateLifeGraph,
  context: SemanticContextBundle
): CandidateLifeGraph {
  const nodes = [...graph.nodes];
  const edges = [...graph.edges];
  const trace = [...graph.trace];
  const byId = new Map(nodes.map((node) => [node.candidateId, node]));

  // First resolve person nodes the model already emitted.
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (node.concept !== "PERSON" || node.subject.kind === "SELF") continue;
    const label = node.subject.label?.trim();
    if (!label || node.subject.entityRef) continue;
    const knownRef = resolveKnownPersonRef(label, context);
    if (!knownRef) continue;

    nodes[i] = {
      ...node,
      subject: { ...node.subject, kind: "KNOWN_OTHER", entityRef: knownRef },
      unresolved: filterResolvedPersonIdentity(node.unresolved, label)
    };
    byId.set(node.candidateId, nodes[i]);
    trace.push({
      traceId: `entity-resolution:${node.candidateId}`,
      stage: "ENTITY_RESOLUTION",
      candidateId: node.candidateId,
      claim: label,
      contextRefs: [knownRef],
      result: `${label} -> ${knownRef}`
    });
  }

  for (const sourceNode of [...nodes]) {
    if (!["EVENT", "STATE", "OBSERVATION", "CLAIM"].includes(sourceNode.nodeType)) continue;

    for (const [fieldName, field] of Object.entries(sourceNode.attributes)) {
      if (!PARTICIPANT_FIELD.test(fieldName)) continue;
      const labels = extractPersonLabels(field.value);
      for (const label of labels) {
        if (!label || SELF_LABELS.has(normalize(label))) continue;

        const existing = findExistingPerson(nodes, label);
        const knownRef = existing?.subject.entityRef ?? resolveKnownPersonRef(label, context);
        const personId = existing?.candidateId ?? uniquePersonId(sourceNode.candidateId, label, byId);
        const certainty = strongestCertainty(field.certainty, sourceNode.certainty);

        if (!existing) {
          const personNode: CandidateLifeNode = {
            candidateId: personId,
            nodeType: "ENTITY",
            concept: "PERSON",
            subject: {
              kind: knownRef ? "KNOWN_OTHER" : "UNKNOWN_OTHER",
              ...(knownRef ? { entityRef: knownRef } : {}),
              label
            },
            realityMode: "CURRENT_STATE",
            attributes: {
              participant_role: {
                value: fieldName,
                state: "RESOLVED",
                certainty,
                ...(field.sourceSpans?.length ? { sourceSpans: field.sourceSpans } : {}),
                ...(field.contextRefs?.length ? { contextRefs: field.contextRefs } : {})
              }
            },
            certainty,
            ...(field.sourceSpans?.length ? { sourceSpans: field.sourceSpans } : sourceNode.sourceSpans?.length ? { sourceSpans: sourceNode.sourceSpans } : {}),
            ...(!knownRef ? {
              unresolved: [{
                code: "ENTITY_IDENTITY_UNRESOLVED",
                description: `Participant "${label}" is explicit, but no unique known-person identity is resolved yet.`,
                blocking: false,
                field: "subject.entityRef"
              }]
            } : {})
          };
          nodes.push(personNode);
          byId.set(personId, personNode);
          trace.push({
            traceId: `entity-lift:${sourceNode.candidateId}:${safeId(label)}`,
            stage: "ENTITY_RESOLUTION",
            candidateId: personId,
            claim: label,
            ...(knownRef ? { contextRefs: [knownRef] } : {}),
            support: field.sourceSpans ?? sourceNode.sourceSpans,
            result: knownRef
              ? `Lifted explicit participant "${label}" as known PERSON ${knownRef}.`
              : `Lifted explicit participant "${label}" as unresolved PERSON.`
          });
        }

        if (!edges.some((edge) =>
          edge.fromCandidateId === sourceNode.candidateId &&
          edge.toCandidateId === personId &&
          edge.relation === "INVOLVES"
        )) {
          const edge: CandidateLifeEdge = {
            edgeId: `entity-involves:${sourceNode.candidateId}:${personId}`,
            fromCandidateId: sourceNode.candidateId,
            relation: "INVOLVES",
            toCandidateId: personId,
            certainty,
            ...(field.sourceSpans?.length ? { sourceSpans: field.sourceSpans } : sourceNode.sourceSpans?.length ? { sourceSpans: sourceNode.sourceSpans } : {}),
            ...(knownRef ? { contextRefs: [knownRef] } : field.contextRefs?.length ? { contextRefs: field.contextRefs } : {})
          };
          edges.push(edge);
        }
      }
    }
  }

  return { ...graph, nodes, edges, trace };
}

function findExistingPerson(nodes: CandidateLifeNode[], label: string) {
  const normalized = normalize(label);
  return nodes.find((node) =>
    node.concept === "PERSON" &&
    node.subject.kind !== "SELF" &&
    (node.subject.label ? normalize(node.subject.label) === normalized : false)
  );
}

function resolveKnownPersonRef(label: string, context: SemanticContextBundle) {
  const normalized = normalize(label);
  const aliasMatches = (context.personalAliases ?? [])
    .filter((alias) => normalize(alias.phrase) === normalized)
    .map((alias) => alias.targetRef);
  const uniqueAliases = [...new Set(aliasMatches)];
  if (uniqueAliases.length === 1) return uniqueAliases[0];

  const itemMatches = context.items
    .filter((item) => item.concepts?.includes("PERSON"))
    .filter((item) => tokenContains(item.summary, normalized) || tokenContains(item.ref, normalized))
    .map((item) => item.ref);
  const uniqueItems = [...new Set(itemMatches)];
  return uniqueItems.length === 1 ? uniqueItems[0] : undefined;
}

function filterResolvedPersonIdentity(unresolved: CandidateLifeNode["unresolved"], label: string) {
  if (!unresolved?.length) return unresolved;
  const normalized = normalize(label);
  const next = unresolved.filter((item) => {
    const haystack = normalize(`${item.code} ${item.description} ${item.field ?? ""}`);
    const identityCode = /identity|person|subject|entity/.test(haystack);
    return !(identityCode && (haystack.includes(normalized) || item.field?.includes("subject")));
  });
  return next.length ? next : undefined;
}

function extractPersonLabels(value: SemanticField["value"]): string[] {
  const raw: string[] = [];
  collectLabels(value, raw);
  return [...new Set(raw.flatMap(splitLabels).map((item) => item.trim()).filter(Boolean))];
}

function collectLabels(value: unknown, out: string[]) {
  if (typeof value === "string") {
    out.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectLabels(item, out);
    return;
  }
  if (!value || typeof value !== "object") return;
  const record = value as Record<string, unknown>;
  for (const key of ["name", "label", "person", "participant", "co_participant"]) {
    if (key in record) collectLabels(record[key], out);
  }
}

function splitLabels(value: string) {
  return value
    .split(/\s*(?:,|\band\b|&|\+)\s*/i)
    .map((item) => item.replace(/^(with|and)\s+/i, "").trim())
    .filter(Boolean);
}

function uniquePersonId(sourceCandidateId: string, label: string, byId: Map<string, CandidateLifeNode>) {
  const base = `lifted-person:${safeId(sourceCandidateId)}:${safeId(label)}`;
  if (!byId.has(base)) return base;
  let index = 2;
  while (byId.has(`${base}:${index}`)) index++;
  return `${base}:${index}`;
}

function safeId(value: string) {
  return normalize(value).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "unknown";
}

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function tokenContains(value: string, token: string) {
  const haystack = ` ${normalize(value)} `;
  return haystack.includes(` ${token} `);
}

function strongestCertainty(field: SemanticCertainty | undefined, fallback: SemanticCertainty): SemanticCertainty {
  return field ?? fallback;
}
