import type {
  KnowledgeAttempt,
  KnowledgeProviderContext,
  KnowledgeQuery,
  KnowledgeResolution,
  KnowledgeRouteResult,
  KnowledgeSourceClass,
  KnowledgeStatus
} from "./contracts.ts";
import { KnowledgeProviderRegistry } from "./knowledge-registry.ts";

const DEFAULT_TERMINAL_STATUSES = new Set<KnowledgeStatus>([
  "RESOLVED",
  "AMBIGUOUS",
  "CONFLICTING"
]);

function validateResolution(query: KnowledgeQuery, resolution: KnowledgeResolution) {
  if (resolution.capability !== query.capability) {
    throw new Error(
      `KNOWLEDGE_PROVIDER_CAPABILITY_MISMATCH:${resolution.providerId}:${query.capability}:${resolution.capability}`
    );
  }
  if (resolution.confidence != null && (resolution.confidence < 0 || resolution.confidence > 1)) {
    throw new Error(`KNOWLEDGE_CONFIDENCE_OUT_OF_RANGE:${resolution.providerId}`);
  }
  if (resolution.status === "RESOLVED" && resolution.value === undefined) {
    throw new Error(`KNOWLEDGE_RESOLVED_VALUE_REQUIRED:${resolution.providerId}`);
  }
  if (
    resolution.status === "AMBIGUOUS" &&
    (!resolution.candidates || resolution.candidates.length < 2)
  ) {
    throw new Error(`KNOWLEDGE_AMBIGUOUS_CANDIDATES_REQUIRED:${resolution.providerId}`);
  }
}

function attemptFrom(resolution: KnowledgeResolution): KnowledgeAttempt {
  return {
    providerId: resolution.providerId,
    providerVersion: resolution.providerVersion,
    sourceClass: resolution.sourceClass,
    status: resolution.status,
    limitation: resolution.limitation
  };
}

function degradedRank(status: KnowledgeStatus) {
  switch (status) {
    case "PARTIAL":
      return 3;
    case "STALE":
      return 2;
    case "UNKNOWN":
      return 1;
    default:
      return 0;
  }
}

export interface KnowledgeRouteOptions {
  sourceClasses?: readonly KnowledgeSourceClass[];
  terminalStatuses?: readonly KnowledgeStatus[];
}

export class KnowledgeRouter {
  private readonly registry: KnowledgeProviderRegistry;

  constructor(registry: KnowledgeProviderRegistry) {
    this.registry = registry;
  }

  async resolve<TValue = unknown>(
    query: KnowledgeQuery,
    context: KnowledgeProviderContext,
    options: KnowledgeRouteOptions = {}
  ): Promise<KnowledgeRouteResult<TValue>> {
    const terminal = options.terminalStatuses
      ? new Set(options.terminalStatuses)
      : DEFAULT_TERMINAL_STATUSES;
    const providers = this.registry.providersFor(query.capability, options.sourceClasses);
    const attempts: KnowledgeAttempt[] = [];
    let bestDegraded: KnowledgeResolution | undefined;

    for (const provider of providers) {
      const readiness = provider.readiness
        ? await provider.readiness(query.capability, context)
        : { status: "READY" as const };

      if (readiness.status === "UNAVAILABLE") {
        attempts.push({
          providerId: provider.id,
          providerVersion: provider.version,
          sourceClass: provider.sourceClass,
          status: "UNAVAILABLE",
          limitation: readiness.reason
        });
        continue;
      }

      const resolution = await provider.resolve(query, context);
      validateResolution(query, resolution);

      if (resolution.providerId !== provider.id || resolution.providerVersion !== provider.version) {
        throw new Error(`KNOWLEDGE_PROVIDER_IDENTITY_MISMATCH:${provider.id}`);
      }
      if (resolution.sourceClass !== provider.sourceClass) {
        throw new Error(`KNOWLEDGE_PROVIDER_SOURCE_CLASS_MISMATCH:${provider.id}`);
      }

      attempts.push(attemptFrom(resolution));

      if (terminal.has(resolution.status)) {
        return {
          capability: query.capability,
          status: resolution.status,
          resolution: resolution as KnowledgeResolution<TValue>,
          attempts
        };
      }

      if (
        degradedRank(resolution.status) >
        degradedRank(bestDegraded?.status ?? "NOT_APPLICABLE")
      ) {
        bestDegraded = resolution;
      }
    }

    if (bestDegraded) {
      return {
        capability: query.capability,
        status: bestDegraded.status,
        resolution: bestDegraded as KnowledgeResolution<TValue>,
        attempts
      };
    }

    return {
      capability: query.capability,
      status: "UNKNOWN",
      attempts
    };
  }
}
