import type {
  AcquisitionStage,
  CanonicalResolution,
  CanonicalResolver,
  InformationNeed,
  InformationResolutionAttempt,
  InformationResolutionRequest,
  InformationResolutionResult,
  InformationResolutionStatus,
  KnowledgeQuery,
  KnowledgeSourceClass,
  KnowledgeStatus
} from "./contracts.ts";
import { KnowledgeRouter } from "./knowledge-router.ts";

type KnowledgeStage = "DETERMINISTIC" | "REFERENCE_DATA" | "LIVE_EXTERNAL";

type RouteOption =
  | "CANONICAL_READ"
  | KnowledgeStage
  | "PLAYER"
  | "PRESERVE_UNKNOWN";

const KNOWLEDGE_STAGE_CLASS: Record<KnowledgeStage, KnowledgeSourceClass> = {
  DETERMINISTIC: "DETERMINISTIC",
  REFERENCE_DATA: "REFERENCE_DATA",
  LIVE_EXTERNAL: "LIVE_EXTERNAL"
};

const TERMINAL_STATUSES = new Set<KnowledgeStatus>([
  "RESOLVED",
  "AMBIGUOUS",
  "CONFLICTING"
]);

function canonicalSort(a: CanonicalResolver, b: CanonicalResolver) {
  const byPriority = (b.priority ?? 0) - (a.priority ?? 0);
  if (byPriority !== 0) return byPriority;
  return a.id.localeCompare(b.id);
}

function canonicalMatches(resolver: CanonicalResolver, need: InformationNeed) {
  return resolver.concepts === "*" || resolver.concepts.includes(need.concept);
}

function knowledgeAttempt(
  stage: AcquisitionStage,
  resolution: { providerId: string; status: InformationResolutionStatus; limitation?: string }
): InformationResolutionAttempt {
  return {
    stage,
    resolverId: resolution.providerId,
    status: resolution.status,
    limitation: resolution.limitation
  };
}

export interface InformationResolutionRouterContext {
  now: string;
  signal?: AbortSignal;
}

export class InformationResolutionRouter {
  private readonly canonicalResolvers: CanonicalResolver[] = [];
  private readonly knowledgeRouter: KnowledgeRouter;

  constructor(knowledgeRouter: KnowledgeRouter) {
    this.knowledgeRouter = knowledgeRouter;
  }

  registerCanonicalResolver(resolver: CanonicalResolver) {
    if (this.canonicalResolvers.some((item) => item.id === resolver.id)) {
      throw new Error(`CANONICAL_RESOLVER_ALREADY_REGISTERED:${resolver.id}`);
    }
    this.canonicalResolvers.push(resolver);
    this.canonicalResolvers.sort(canonicalSort);
    return this;
  }

  async resolve<TValue = unknown>(
    request: InformationResolutionRequest,
    context: InformationResolutionRouterContext
  ): Promise<InformationResolutionResult<TValue>> {
    const attempts: InformationResolutionAttempt[] = [];
    const options = new Set<RouteOption>(request.need.resolutionOptions as readonly RouteOption[]);

    if (options.has("CANONICAL_READ")) {
      for (const resolver of this.canonicalResolvers.filter((item) => canonicalMatches(item, request.need))) {
        const resolution = await resolver.resolve(request.need, {
          now: context.now,
          signal: context.signal,
          context: request.context
        });

        attempts.push({
          stage: "CANONICAL",
          resolverId: resolution.resolverId,
          status: resolution.status,
          limitation: resolution.limitation
        });

        if (TERMINAL_STATUSES.has(resolution.status)) {
          return {
            need: request.need,
            status: resolution.status,
            stage: "CANONICAL",
            value: resolution.value as TValue | undefined,
            candidates: resolution.candidates as TValue[] | undefined,
            canonical: resolution as CanonicalResolution<TValue>,
            attempts,
            limitation: resolution.limitation
          };
        }
      }
    }

    for (const stage of ["DETERMINISTIC", "REFERENCE_DATA", "LIVE_EXTERNAL"] as const) {
      if (!options.has(stage)) continue;
      const query = request.knowledgeQueries?.[stage] as KnowledgeQuery | undefined;
      if (!query) continue;

      const routed = await this.knowledgeRouter.resolve<TValue>(
        query,
        { now: context.now, signal: context.signal },
        { sourceClasses: [KNOWLEDGE_STAGE_CLASS[stage]] }
      );

      attempts.push(
        ...routed.attempts.map((attempt) =>
          knowledgeAttempt(stage, {
            providerId: attempt.providerId,
            status: attempt.status,
            limitation: attempt.limitation
          })
        )
      );

      if (TERMINAL_STATUSES.has(routed.status) && routed.resolution) {
        return {
          need: request.need,
          status: routed.status,
          stage,
          value: routed.resolution.value as TValue | undefined,
          candidates: routed.resolution.candidates as TValue[] | undefined,
          knowledge: routed.resolution,
          attempts,
          limitation: routed.resolution.limitation
        };
      }
    }

    if (options.has("PLAYER")) {
      return {
        need: request.need,
        status: "NEEDS_PLAYER",
        stage: "PLAYER",
        attempts,
        limitation: "Player input is the next authorized resolver for this information need."
      };
    }

    return {
      need: request.need,
      status: "UNKNOWN",
      stage: "PRESERVE_UNKNOWN",
      attempts,
      limitation: "No authorized resolver produced a sufficiently useful result. Unknown is preserved."
    };
  }
}
