import type { ConceptRegistry } from "./concept-registry.ts";
import type {
  CandidateLifeGraph,
  CandidateLifeNode,
  ContextRequest,
  SemanticContextBundle,
  SemanticField,
  SemanticReasoner,
  SemanticReasonerInput,
  SemanticReasonerOutput,
  SemanticTemporalMeaning
} from "./semantic-compiler.ts";

export interface StructuredModelRequest {
  model: string;
  system: string;
  user: string;
  schemaName: string;
  schema: Record<string, unknown>;
  maxOutputTokens?: number;
}

export interface StructuredModelResponse<T> {
  provider: string;
  model: string;
  requestId?: string;
  data: T;
  usage?: Record<string, unknown>;
}

export interface SemanticModelProvider {
  id: string;
  generateStructured<T>(request: StructuredModelRequest): Promise<StructuredModelResponse<T>>;
}

export interface OpenAIResponsesProviderOptions {
  apiKey: string;
  baseUrl?: string;
  fetcher?: typeof fetch;
  maxAttempts?: number;
  retryDelayMs?: number;
}

export class OpenAIResponsesProvider implements SemanticModelProvider {
  readonly id = "openai-responses";
  private readonly baseUrl: string;
  private readonly fetcher: typeof fetch;

  constructor(private readonly options: OpenAIResponsesProviderOptions) {
    if (!options.apiKey.trim()) throw new Error("OPENAI_API_KEY_REQUIRED");
    this.baseUrl = (options.baseUrl ?? "https://api.openai.com").replace(/\/$/, "");
    this.fetcher = options.fetcher ?? fetch;
  }

  async generateStructured<T>(request: StructuredModelRequest): Promise<StructuredModelResponse<T>> {
    const maxAttempts = Math.max(1, this.options.maxAttempts ?? 3);
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await this.generateStructuredOnce<T>(request);
      } catch (error) {
        lastError = error;
        if (attempt >= maxAttempts || !isRetryableProviderError(error)) throw error;
        const delayMs = Math.max(0, this.options.retryDelayMs ?? 250) * attempt;
        if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    throw lastError instanceof Error ? lastError : new Error("MODEL_PROVIDER_FAILED");
  }

  private async generateStructuredOnce<T>(request: StructuredModelRequest): Promise<StructuredModelResponse<T>> {
    let response: Response;
    try {
      response = await this.fetcher(`${this.baseUrl}/v1/responses`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.options.apiKey}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          model: request.model,
          input: [
            { role: "system", content: request.system },
            { role: "user", content: request.user }
          ],
          text: {
            format: {
              type: "json_schema",
              name: request.schemaName,
              strict: true,
              schema: request.schema
            }
          },
          max_output_tokens: request.maxOutputTokens ?? 5000
        })
      });
    } catch (error) {
      throw new Error(`MODEL_PROVIDER_NETWORK:${error instanceof Error ? error.message : String(error)}`);
    }

    const rawText = await response.text();
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(rawText) as Record<string, unknown>;
    } catch {
      throw new Error(`MODEL_PROVIDER_INVALID_JSON:${response.status}`);
    }

    if (!response.ok) {
      const error = payload.error;
      const message = typeof error === "object" && error !== null && "message" in error
        ? String((error as Record<string, unknown>).message)
        : rawText.slice(0, 800);
      throw new Error(`MODEL_PROVIDER_HTTP_${response.status}:${message}`);
    }

    const outputText = extractResponseOutputText(payload);
    if (!outputText) throw new Error("MODEL_PROVIDER_NO_STRUCTURED_OUTPUT");

    let data: T;
    try {
      data = JSON.parse(outputText) as T;
    } catch {
      throw new Error("MODEL_PROVIDER_STRUCTURED_OUTPUT_INVALID_JSON");
    }

    return {
      provider: this.id,
      model: String(payload.model ?? request.model),
      requestId: typeof payload.id === "string" ? payload.id : undefined,
      data,
      usage: typeof payload.usage === "object" && payload.usage ? payload.usage as Record<string, unknown> : undefined
    };
  }
}

function isRetryableProviderError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (message.startsWith("MODEL_PROVIDER_NETWORK:")) return true;
  if (message === "MODEL_PROVIDER_NO_STRUCTURED_OUTPUT" || message === "MODEL_PROVIDER_STRUCTURED_OUTPUT_INVALID_JSON") return true;

  const statusMatch = message.match(/^MODEL_PROVIDER_(?:HTTP_|INVALID_JSON:)(\\d{3})/);
  if (!statusMatch) return false;
  const status = Number(statusMatch[1]);
  return status === 408 || status === 409 || status === 429 || status >= 500;
}

function extractResponseOutputText(payload: Record<string, unknown>): string | undefined {
  if (typeof payload.output_text === "string" && payload.output_text.trim()) return payload.output_text;
  if (!Array.isArray(payload.output)) return undefined;
  for (const item of payload.output) {
    if (!item || typeof item !== "object") continue;
    const content = (item as Record<string, unknown>).content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (!part || typeof part !== "object") continue;
      const record = part as Record<string, unknown>;
      if (record.type === "output_text" && typeof record.text === "string") return record.text;
    }
  }
  return undefined;
}

type WireField = {
  name: string;
  valueJson: string | null;
  state: SemanticField["state"];
  precision: SemanticField["precision"] | null;
  certainty: SemanticField["certainty"] | null;
  sourceSpans: string[];
  contextRefs: string[];
};

type WireNode = {
  candidateId: string;
  nodeType: CandidateLifeNode["nodeType"];
  concept: string;
  claimType: string | null;
  subject: {
    kind: CandidateLifeNode["subject"]["kind"];
    entityRef: string | null;
    label: string | null;
  };
  realityMode: CandidateLifeNode["realityMode"];
  attributes: WireField[];
  temporal: {
    present: boolean;
    instant: string | null;
    intervalFrom: string | null;
    intervalTo: string | null;
    localDate: string | null;
    daypart: SemanticTemporalMeaning["daypart"] | null;
    relativeText: string | null;
    relationToNodeId: string | null;
    relation: SemanticTemporalMeaning["relation"] | null;
    precision: SemanticTemporalMeaning["precision"];
    certainty: SemanticTemporalMeaning["certainty"];
  };
  certainty: CandidateLifeNode["certainty"];
  sourceSpans: string[];
  proposedOwners: string[];
  unresolved: Array<{ code: string; description: string; blocking: boolean; field: string | null }>;
  parentConcepts: string[];
};

type WireProposal = {
  nodes: WireNode[];
  edges: Array<{
    edgeId: string;
    fromCandidateId: string;
    relation: CandidateLifeGraph["edges"][number]["relation"];
    toCandidateId: string;
    certainty: CandidateLifeGraph["edges"][number]["certainty"];
    sourceSpans: string[];
    contextRefs: string[];
  }>;
  references: Array<{
    referenceId: string;
    phrase: string;
    candidateRefs: string[];
    status: CandidateLifeGraph["references"][number]["status"];
    resolvedRef: string | null;
    certainty: CandidateLifeGraph["references"][number]["certainty"];
  }>;
  alternateInterpretations: Array<{
    interpretationId: string;
    summary: string;
    affectedCandidateIds: string[];
    certainty: CandidateLifeGraph["alternateInterpretations"][number]["certainty"];
  }>;
  trace: Array<{
    traceId: string;
    stage: CandidateLifeGraph["trace"][number]["stage"];
    candidateId: string | null;
    claim: string | null;
    support: string[];
    contextRefs: string[];
    result: string;
  }>;
  contextRequests: Array<{
    requestId: string;
    kind: ContextRequest["kind"];
    concepts: string[];
    query: string | null;
    from: string | null;
    to: string | null;
    limit: number | null;
    purpose: string;
  }>;
};

const enumSchema = (values: readonly string[]) => ({ type: "string", enum: [...values] });
const nullableString = { type: ["string", "null"] };
const stringArray = { type: "array", items: { type: "string" } };

export function semanticReasonerStructuredSchema(): Record<string, unknown> {
  const certainty = enumSchema(["HIGH", "MEDIUM", "LOW", "UNKNOWN"]);
  const precision = enumSchema(["EXACT", "APPROXIMATE", "RANGE", "RELATIVE", "UNKNOWN"]);
  const nullablePrecision = { anyOf: [precision, { type: "null" }] };
  const nullableCertainty = { anyOf: [certainty, { type: "null" }] };
  const resolution = enumSchema(["RESOLVED", "PARTIAL", "UNRESOLVED", "PLAYER_DECLINED", "NOT_OBSERVED", "NOT_APPLICABLE"]);

  return {
    type: "object",
    additionalProperties: false,
    properties: {
      nodes: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            candidateId: { type: "string" },
            nodeType: enumSchema(["ENTITY", "EVENT", "STATE", "OBSERVATION", "QUANTITY", "INTENTION", "PLAN", "REFLECTION", "REFERENCE", "CLAIM"]),
            concept: { type: "string" },
            claimType: nullableString,
            subject: {
              type: "object",
              additionalProperties: false,
              properties: {
                kind: enumSchema(["SELF", "KNOWN_OTHER", "UNKNOWN_OTHER", "GENERAL"]),
                entityRef: nullableString,
                label: nullableString
              },
              required: ["kind", "entityRef", "label"]
            },
            realityMode: enumSchema(["OCCURRED", "CURRENT_STATE", "INTENDED", "PLANNED", "EXPECTED", "POSSIBLE", "HYPOTHETICAL", "QUESTION", "REFLECTION", "REPORTED_ABOUT_OTHER", "NEGATED", "CORRECTION"]),
            attributes: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  name: { type: "string" },
                  valueJson: nullableString,
                  state: resolution,
                  precision: nullablePrecision,
                  certainty: nullableCertainty,
                  sourceSpans: stringArray,
                  contextRefs: stringArray
                },
                required: ["name", "valueJson", "state", "precision", "certainty", "sourceSpans", "contextRefs"]
              }
            },
            temporal: {
              type: "object",
              additionalProperties: false,
              properties: {
                present: { type: "boolean" },
                instant: nullableString,
                intervalFrom: nullableString,
                intervalTo: nullableString,
                localDate: nullableString,
                daypart: { anyOf: [enumSchema(["MORNING", "AFTERNOON", "EVENING", "NIGHT"]), { type: "null" }] },
                relativeText: nullableString,
                relationToNodeId: nullableString,
                relation: { anyOf: [enumSchema(["BEFORE", "AFTER", "DURING", "AROUND"]), { type: "null" }] },
                precision,
                certainty
              },
              required: ["present", "instant", "intervalFrom", "intervalTo", "localDate", "daypart", "relativeText", "relationToNodeId", "relation", "precision", "certainty"]
            },
            certainty,
            sourceSpans: stringArray,
            proposedOwners: stringArray,
            unresolved: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  code: { type: "string" },
                  description: { type: "string" },
                  blocking: { type: "boolean" },
                  field: nullableString
                },
                required: ["code", "description", "blocking", "field"]
              }
            },
            parentConcepts: stringArray
          },
          required: ["candidateId", "nodeType", "concept", "claimType", "subject", "realityMode", "attributes", "temporal", "certainty", "sourceSpans", "proposedOwners", "unresolved", "parentConcepts"]
        }
      },
      edges: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            edgeId: { type: "string" },
            fromCandidateId: { type: "string" },
            relation: enumSchema(["INVOLVES", "ABOUT", "BEFORE", "AFTER", "DURING", "AT", "HAS_VALUE", "COMPARES_TO", "REPEATS", "CORRECTS", "NEGATES", "CONTRASTS_WITH", "RELATED_TO", "PLAYER_ATTRIBUTES_EFFECT"]),
            toCandidateId: { type: "string" },
            certainty,
            sourceSpans: stringArray,
            contextRefs: stringArray
          },
          required: ["edgeId", "fromCandidateId", "relation", "toCandidateId", "certainty", "sourceSpans", "contextRefs"]
        }
      },
      references: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            referenceId: { type: "string" },
            phrase: { type: "string" },
            candidateRefs: stringArray,
            status: resolution,
            resolvedRef: nullableString,
            certainty
          },
          required: ["referenceId", "phrase", "candidateRefs", "status", "resolvedRef", "certainty"]
        }
      },
      alternateInterpretations: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            interpretationId: { type: "string" },
            summary: { type: "string" },
            affectedCandidateIds: stringArray,
            certainty
          },
          required: ["interpretationId", "summary", "affectedCandidateIds", "certainty"]
        }
      },
      trace: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            traceId: { type: "string" },
            stage: enumSchema(["RECOGNITION", "CONTEXT_REQUEST", "CONCEPT_RESOLUTION", "ENTITY_RESOLUTION", "TEMPORAL_RESOLUTION", "RELATION_RESOLUTION", "CAPACITY_ASSESSMENT", "ROUTING"]),
            candidateId: nullableString,
            claim: nullableString,
            support: stringArray,
            contextRefs: stringArray,
            result: { type: "string" }
          },
          required: ["traceId", "stage", "candidateId", "claim", "support", "contextRefs", "result"]
        }
      },
      contextRequests: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            requestId: { type: "string" },
            kind: enumSchema(["RECENT_EVENTS", "KNOWN_ENTITIES", "PERSONAL_ALIASES", "ACTIVE_DIRECTION", "SCHEDULE", "DOMAIN_READ", "LIFE_GRAPH"]),
            concepts: stringArray,
            query: nullableString,
            from: nullableString,
            to: nullableString,
            limit: { type: ["integer", "null"], minimum: 1, maximum: 20 },
            purpose: { type: "string" }
          },
          required: ["requestId", "kind", "concepts", "query", "from", "to", "limit", "purpose"]
        }
      }
    },
    required: ["nodes", "edges", "references", "alternateInterpretations", "trace", "contextRequests"]
  };
}

export interface LiveSemanticReasonerOptions {
  provider: SemanticModelProvider;
  model: string;
  maxOutputTokens?: number;
}

export class LiveSemanticReasoner implements SemanticReasoner {
  readonly id: string;
  readonly version = "0.1";

  constructor(private readonly options: LiveSemanticReasonerOptions) {
    this.id = `live:${options.provider.id}`;
  }

  async propose(input: SemanticReasonerInput): Promise<SemanticReasonerOutput> {
    const response = await this.options.provider.generateStructured<WireProposal>({
      model: this.options.model,
      schemaName: "wayfinder_candidate_life_graph_v0_1",
      schema: semanticReasonerStructuredSchema(),
      system: semanticSystemPrompt(),
      user: semanticUserPrompt(input.source.content, input.source.receivedAt, input.source.zoneId, input.context, input.concepts),
      maxOutputTokens: this.options.maxOutputTokens ?? 5000
    });
    return normalizeWireProposal(input.source.sourceId, response.data);
  }
}

function semanticSystemPrompt() {
  return [
    "You are Wayfinder's Semantic Reasoner. Your only job is to propose structured meaning from human language.",
    "You do NOT decide truth, canonical ownership, database persistence, XP, Character growth, guidance, medical conclusions, or actions.",
    "Represent the smallest defensible meaning. Preserve ambiguity and approximation. Never fabricate specificity.",
    "Concept recognition does not establish occurrence: distinguish occurred, intended, planned, possible, hypothetical, question, negated, correction, reflection, and reports about other people.",
    "Keep the correct subject. A third party's event is never the player's event.",
    "Use context only when it actually supports resolution. If relevant context is missing, request bounded context rather than guessing.",
    "Prefer a supplied knownConcept id whenever it accurately describes the semantic class of the node. Keep specific people, merchants, places, foods, projects, or brands in attributes/references/entities rather than inventing them as the node concept when a known concept such as MEAL, EXPENSE, PERSON, PROJECT, RUNNING, or EMOTIONAL_STATE fits.",
    "Only when no supplied known concept describes the semantic class should you use the player's specific phrase as an unknown concept and include known broader parent concepts when defensible.",
    "Relationships matter. Represent explicit chronology, comparison, repetition, correction, contrast, and player-attributed effects without upgrading them into scientific causality.",
    "Trace entries are concise observable support/provenance only, never hidden reasoning or chain-of-thought.",
    "Do not emit table names, SQL, commands, XP, guidance, or persistence decisions."
  ].join("\n");
}

function semanticUserPrompt(content: string, receivedAt: string, zoneId: string | undefined, context: SemanticContextBundle, concepts: ConceptRegistry) {
  const conceptDigest = concepts.list().map((item) => ({ id: item.id, label: item.label, kind: item.kind, aliases: item.aliases ?? [], parents: item.parentIds ?? [] }));
  return JSON.stringify({
    source: { content, receivedAt, zoneId: zoneId ?? null },
    knownConcepts: conceptDigest,
    context: {
      asOf: context.asOf,
      items: context.items,
      personalAliases: context.personalAliases ?? []
    },
    instructions: {
      contextRequestRule: "Request context only when it could materially change interpretation. Prefer at most 3 focused requests.",
      contextReferenceRule: "If you use a context fact, include its ref in contextRefs.",
      unresolvedRule: "If meaning remains ambiguous, keep alternatives/unresolved fields instead of choosing arbitrarily.",
      claimTypeRule: "Only copy a claim type when the supplied context or known semantic convention makes it explicit; otherwise null.",
      proposedOwnerRule: "Do not invent canonical owners. Leave proposedOwners empty unless explicitly supplied by known context."
    }
  });
}

function normalizeWireProposal(sourceId: string, wire: WireProposal): SemanticReasonerOutput {
  const nodes: CandidateLifeNode[] = wire.nodes.map((item) => {
    const attributes: Record<string, SemanticField> = {};
    for (const field of item.attributes) {
      attributes[field.name] = {
        ...(field.valueJson === null ? {} : { value: parseWireValue(field.valueJson) }),
        state: field.state,
        ...(field.precision == null ? {} : { precision: field.precision }),
        ...(field.certainty == null ? {} : { certainty: field.certainty }),
        ...(field.sourceSpans.length ? { sourceSpans: field.sourceSpans } : {}),
        ...(field.contextRefs.length ? { contextRefs: field.contextRefs } : {})
      };
    }

    const temporal: SemanticTemporalMeaning | undefined = item.temporal.present ? {
      ...(item.temporal.instant ? { instant: item.temporal.instant } : {}),
      ...(item.temporal.intervalFrom || item.temporal.intervalTo ? { interval: { ...(item.temporal.intervalFrom ? { from: item.temporal.intervalFrom } : {}), ...(item.temporal.intervalTo ? { to: item.temporal.intervalTo } : {}) } } : {}),
      ...(item.temporal.localDate ? { localDate: item.temporal.localDate } : {}),
      ...(item.temporal.daypart ? { daypart: item.temporal.daypart } : {}),
      ...(item.temporal.relativeText ? { relativeText: item.temporal.relativeText } : {}),
      ...(item.temporal.relationToNodeId ? { relationToNodeId: item.temporal.relationToNodeId } : {}),
      ...(item.temporal.relation ? { relation: item.temporal.relation } : {}),
      precision: item.temporal.precision,
      certainty: item.temporal.certainty
    } : undefined;

    return {
      candidateId: item.candidateId,
      nodeType: item.nodeType,
      concept: item.concept,
      ...(item.claimType ? { claimType: item.claimType } : {}),
      subject: {
        kind: item.subject.kind,
        ...(item.subject.entityRef ? { entityRef: item.subject.entityRef } : {}),
        ...(item.subject.label ? { label: item.subject.label } : {})
      },
      realityMode: item.realityMode,
      attributes,
      ...(temporal ? { temporal } : {}),
      certainty: item.certainty,
      ...(item.sourceSpans.length ? { sourceSpans: item.sourceSpans } : {}),
      ...(item.proposedOwners.length ? { proposedOwners: item.proposedOwners } : {}),
      ...(item.unresolved.length ? { unresolved: item.unresolved.map((u) => ({ code: u.code, description: u.description, blocking: u.blocking, ...(u.field ? { field: u.field } : {}) })) } : {}),
      ...(item.parentConcepts.length ? { parentConcepts: item.parentConcepts } : {})
    };
  });

  return {
    graph: {
      sourceId,
      nodes,
      edges: wire.edges.map((edge) => ({
        edgeId: edge.edgeId,
        fromCandidateId: edge.fromCandidateId,
        relation: edge.relation,
        toCandidateId: edge.toCandidateId,
        certainty: edge.certainty,
        ...(edge.sourceSpans.length ? { sourceSpans: edge.sourceSpans } : {}),
        ...(edge.contextRefs.length ? { contextRefs: edge.contextRefs } : {})
      })),
      references: wire.references.map((reference) => ({
        referenceId: reference.referenceId,
        phrase: reference.phrase,
        candidateRefs: reference.candidateRefs,
        status: reference.status,
        ...(reference.resolvedRef ? { resolvedRef: reference.resolvedRef } : {}),
        certainty: reference.certainty
      })),
      alternateInterpretations: wire.alternateInterpretations,
      trace: wire.trace.map((entry) => ({
        traceId: entry.traceId,
        stage: entry.stage,
        ...(entry.candidateId ? { candidateId: entry.candidateId } : {}),
        ...(entry.claim ? { claim: entry.claim } : {}),
        ...(entry.support.length ? { support: entry.support } : {}),
        ...(entry.contextRefs.length ? { contextRefs: entry.contextRefs } : {}),
        result: entry.result
      }))
    },
    contextRequests: wire.contextRequests.map((request) => ({
      requestId: request.requestId,
      kind: request.kind,
      ...(request.concepts.length ? { concepts: request.concepts } : {}),
      ...(request.query ? { query: request.query } : {}),
      ...(request.from ? { from: request.from } : {}),
      ...(request.to ? { to: request.to } : {}),
      ...(request.limit ? { limit: request.limit } : {}),
      purpose: request.purpose
    }))
  };
}

function parseWireValue(valueJson: string): unknown {
  try {
    return JSON.parse(valueJson);
  } catch {
    return valueJson;
  }
}
