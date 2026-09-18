import type { ConceptRegistry } from "./concept-registry.ts";
import type {
  ContextRequest,
  SemanticCompilation,
  SemanticContextBundle,
  SemanticContextItem,
  SemanticReasoner,
  SemanticReasonerOutput
} from "./semantic-compiler.ts";
import { compileLifeExpression } from "./semantic-compiler.ts";
import type { SourceEnvelope } from "./semantic-admission.ts";
import type { WayfinderCapacityRegistry } from "./wayfinder-capacity.ts";

export interface ContextResolution {
  items?: SemanticContextItem[];
  personalAliases?: NonNullable<SemanticContextBundle["personalAliases"]>;
  notes?: string[];
}

export interface SemanticContextProvider {
  id: string;
  supports(kind: ContextRequest["kind"]): boolean;
  resolve(request: ContextRequest, current: SemanticContextBundle, source: SourceEnvelope): Promise<ContextResolution>;
}

export class SemanticContextProviderRegistry {
  private readonly providers: SemanticContextProvider[] = [];

  register(provider: SemanticContextProvider) {
    if (this.providers.some((item) => item.id === provider.id)) throw new Error(`DUPLICATE_CONTEXT_PROVIDER:${provider.id}`);
    this.providers.push(provider);
    return this;
  }

  matching(kind: ContextRequest["kind"]) {
    return this.providers.filter((provider) => provider.supports(kind));
  }
}

export interface BoundedContextLimits {
  maxReasonerPasses: number;
  maxRequestsPerPass: number;
  maxContextItems: number;
  maxItemsPerRequest: number;
  maxPersonalAliases: number;
}

export const DEFAULT_BOUNDED_CONTEXT_LIMITS: BoundedContextLimits = {
  maxReasonerPasses: 2,
  maxRequestsPerPass: 3,
  maxContextItems: 24,
  maxItemsPerRequest: 8,
  maxPersonalAliases: 12
};

export interface ContextAssemblyTraceEntry {
  pass: number;
  requestId: string;
  kind: ContextRequest["kind"];
  providerIds: string[];
  addedItemRefs: string[];
  addedAliasPhrases: string[];
  notes: string[];
}

export interface ReadOnlySemanticLoopResult {
  compilation: SemanticCompilation;
  context: SemanticContextBundle;
  reasonerPasses: number;
  executedRequests: ContextRequest[];
  trace: ContextAssemblyTraceEntry[];
  exhausted: boolean;
}

export interface RunReadOnlySemanticLoopInput {
  source: SourceEnvelope;
  initialContext: SemanticContextBundle;
  reasoner: SemanticReasoner;
  concepts: ConceptRegistry;
  capacity: WayfinderCapacityRegistry;
  providers: SemanticContextProviderRegistry;
  limits?: Partial<BoundedContextLimits>;
}

class FrozenSemanticReasoner implements SemanticReasoner {
  readonly id = "frozen-semantic-proposal";
  readonly version = "0.1";
  constructor(private readonly output: SemanticReasonerOutput) {}
  propose(): SemanticReasonerOutput {
    return this.output;
  }
}

export async function runReadOnlySemanticLoop(input: RunReadOnlySemanticLoopInput): Promise<ReadOnlySemanticLoopResult> {
  if (input.source.authorizesCanonicalWrite) throw new Error("READ_ONLY_SEMANTIC_LOOP_REQUIRES_NON_AUTHORIZING_SOURCE");

  const limits: BoundedContextLimits = { ...DEFAULT_BOUNDED_CONTEXT_LIMITS, ...(input.limits ?? {}) };
  validateLimits(limits);

  let context = clampContext(input.initialContext, limits);
  const executedRequests: ContextRequest[] = [];
  const trace: ContextAssemblyTraceEntry[] = [];
  const executedKeys = new Set<string>();
  let finalOutput: SemanticReasonerOutput | undefined;
  let exhausted = false;
  let reasonerPasses = 0;

  for (let pass = 1; pass <= limits.maxReasonerPasses; pass++) {
    reasonerPasses = pass;
    finalOutput = await input.reasoner.propose({ source: input.source, context, concepts: input.concepts });
    const requests = dedupeRequests(finalOutput.contextRequests ?? [], executedKeys)
      .slice(0, limits.maxRequestsPerPass)
      .map((request) => ({ ...request, limit: Math.min(request.limit ?? limits.maxItemsPerRequest, limits.maxItemsPerRequest) }));

    if (requests.length === 0) break;
    if (pass === limits.maxReasonerPasses) {
      exhausted = true;
      break;
    }

    let addedAnything = false;
    for (const request of requests) {
      executedKeys.add(requestKey(request));
      executedRequests.push(request);
      const providers = input.providers.matching(request.kind);
      const beforeItems = new Set(context.items.map((item) => item.ref));
      const beforeAliases = new Set((context.personalAliases ?? []).map((item) => aliasKey(item)));
      const notes: string[] = [];

      for (const provider of providers) {
        const resolution = await provider.resolve(request, context, input.source);
        context = mergeContext(context, resolution, limits);
        notes.push(...(resolution.notes ?? []));
      }

      const addedItemRefs = context.items.map((item) => item.ref).filter((ref) => !beforeItems.has(ref));
      const addedAliasPhrases = (context.personalAliases ?? [])
        .filter((item) => !beforeAliases.has(aliasKey(item)))
        .map((item) => item.phrase);
      if (addedItemRefs.length || addedAliasPhrases.length) addedAnything = true;

      trace.push({
        pass,
        requestId: request.requestId,
        kind: request.kind,
        providerIds: providers.map((provider) => provider.id),
        addedItemRefs,
        addedAliasPhrases,
        notes
      });
    }

    if (!addedAnything) break;
  }

  if (!finalOutput) throw new Error("SEMANTIC_REASONER_PRODUCED_NO_OUTPUT");

  const compilation = await compileLifeExpression({
    source: input.source,
    context,
    reasoner: new FrozenSemanticReasoner(finalOutput),
    concepts: input.concepts,
    capacity: input.capacity
  });

  return { compilation, context, reasonerPasses, executedRequests, trace, exhausted };
}

function validateLimits(limits: BoundedContextLimits) {
  for (const [key, value] of Object.entries(limits)) {
    if (!Number.isInteger(value) || value < 1) throw new Error(`INVALID_CONTEXT_LIMIT:${key}`);
  }
}

function dedupeRequests(requests: ContextRequest[], executed: Set<string>) {
  const seen = new Set<string>();
  return requests.filter((request) => {
    const key = requestKey(request);
    if (executed.has(key) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function requestKey(request: ContextRequest) {
  return JSON.stringify({
    kind: request.kind,
    concepts: [...(request.concepts ?? [])].sort(),
    query: request.query ?? null,
    from: request.from ?? null,
    to: request.to ?? null,
    purpose: request.purpose
  });
}

function aliasKey(alias: NonNullable<SemanticContextBundle["personalAliases"]>[number]) {
  return `${alias.phrase.trim().toLowerCase()}::${alias.targetRef}::${alias.contextHint ?? ""}`;
}

function mergeContext(current: SemanticContextBundle, addition: ContextResolution, limits: BoundedContextLimits): SemanticContextBundle {
  const itemMap = new Map(current.items.map((item) => [item.ref, item]));
  for (const item of addition.items ?? []) {
    if (!itemMap.has(item.ref) && itemMap.size >= limits.maxContextItems) break;
    itemMap.set(item.ref, item);
  }

  const aliases = new Map((current.personalAliases ?? []).map((alias) => [aliasKey(alias), alias]));
  for (const alias of addition.personalAliases ?? []) {
    const key = aliasKey(alias);
    if (!aliases.has(key) && aliases.size >= limits.maxPersonalAliases) break;
    aliases.set(key, alias);
  }

  return {
    asOf: current.asOf,
    items: [...itemMap.values()],
    personalAliases: [...aliases.values()]
  };
}

function clampContext(context: SemanticContextBundle, limits: BoundedContextLimits): SemanticContextBundle {
  return {
    asOf: context.asOf,
    items: context.items.slice(0, limits.maxContextItems),
    personalAliases: (context.personalAliases ?? []).slice(0, limits.maxPersonalAliases)
  };
}

export class InMemorySemanticContextProvider implements SemanticContextProvider {
  readonly id = "in-memory-semantic-context";
  constructor(
    private readonly catalog: SemanticContextItem[],
    private readonly aliases: NonNullable<SemanticContextBundle["personalAliases"]> = []
  ) {}

  supports() {
    return true;
  }

  async resolve(request: ContextRequest): Promise<ContextResolution> {
    const concepts = new Set(request.concepts ?? []);
    const query = request.query?.trim().toLowerCase();
    const limit = request.limit ?? DEFAULT_BOUNDED_CONTEXT_LIMITS.maxItemsPerRequest;

    const items = this.catalog.filter((item) => {
      const conceptMatch = concepts.size === 0 || item.concepts?.some((concept) => concepts.has(concept));
      const queryMatch = !query || item.summary.toLowerCase().includes(query) || item.ref.toLowerCase().includes(query);
      return conceptMatch && queryMatch;
    }).slice(0, limit);

    const personalAliases = request.kind === "PERSONAL_ALIASES"
      ? this.aliases.filter((alias) => !query || alias.phrase.toLowerCase().includes(query)).slice(0, limit)
      : [];

    return { items, personalAliases };
  }
}
