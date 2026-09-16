import type { KnowledgeResolution, QuestionMode } from "./contracts.ts";
import { createBirthContextRuntime, type BirthContextResolution, type PersonBirthFacts } from "./birth-context-service.ts";
import { KnowledgeProviderRegistry } from "./knowledge-registry.ts";
import { KnowledgeRouter } from "./knowledge-router.ts";
import {
  createAstronomyEngineNatalGeometryProvider,
  type NatalGeometry
} from "./natal-geometry.ts";

export type NatalGeometryReadiness =
  | "READY"
  | "BLOCKED_BY_BIRTH_CONTEXT"
  | "GEOMETRY_UNAVAILABLE";

export interface ResolveNatalGeometryRequest {
  person: PersonBirthFacts | null;
  now: string;
  locale?: string;
  questionMode?: QuestionMode;
  selectedPlaceId?: string;
  includeOptionalQuestions?: boolean;
}

export interface NatalGeometryResolution {
  projectionType: "natal_geometry_resolution";
  ruleVersion: "natal_geometry_resolution_v0.1";
  evaluatedAt: string;
  readiness: NatalGeometryReadiness;
  birthContext: BirthContextResolution;
  geometry?: NatalGeometry;
  geometryKnowledge?: KnowledgeResolution<NatalGeometry>;
  limitations: string[];
}

export interface NatalGeometryRuntimeOptions {
  fetchImpl?: typeof fetch;
}

export function createNatalGeometryRuntime(options: NatalGeometryRuntimeOptions = {}) {
  const birthContextRuntime = createBirthContextRuntime({ fetchImpl: options.fetchImpl });
  const registry = new KnowledgeProviderRegistry().register(
    createAstronomyEngineNatalGeometryProvider()
  );
  const knowledgeRouter = new KnowledgeRouter(registry);

  return {
    birthContextRuntime,
    registry,
    knowledgeRouter,
    async resolve(request: ResolveNatalGeometryRequest): Promise<NatalGeometryResolution> {
      const birthContext = await birthContextRuntime.resolve({
        person: request.person,
        now: request.now,
        locale: request.locale,
        purpose: "FULL_NATAL_CHART",
        questionMode: request.questionMode ?? "TASK_DRIVEN",
        selectedPlaceId: request.selectedPlaceId,
        includeOptionalQuestions: request.includeOptionalQuestions ?? false
      });

      if (
        birthContext.readiness !== "READY" ||
        !birthContext.resolvedPlace ||
        !birthContext.resolvedBirthInstant
      ) {
        return {
          projectionType: "natal_geometry_resolution",
          ruleVersion: "natal_geometry_resolution_v0.1",
          evaluatedAt: request.now,
          readiness: "BLOCKED_BY_BIRTH_CONTEXT",
          birthContext,
          limitations: [
            "Natal geometry requires a fully resolved UTC birth instant and geographic coordinates. Birth-context uncertainty is preserved rather than guessed."
          ]
        };
      }

      const routed = await knowledgeRouter.resolve<NatalGeometry>(
        {
          requestId: crypto.randomUUID(),
          capability: "astro.natal_geometry",
          domain: "astrology",
          input: {
            utcInstant: birthContext.resolvedBirthInstant.utcInstant,
            latitude: birthContext.resolvedPlace.latitude,
            longitude: birthContext.resolvedPlace.longitude,
            placeRef: {
              providerId: birthContext.knowledgeLineage[0]?.providerId,
              providerPlaceId: birthContext.resolvedPlace.providerPlaceId,
              label: birthContext.resolvedPlace.label
            }
          },
          asOf: birthContext.resolvedBirthInstant.utcInstant,
          purpose: "Calculate deterministic natal geometry from resolved birth context."
        },
        { now: request.now },
        { sourceClasses: ["DETERMINISTIC"], terminalStatuses: ["RESOLVED", "PARTIAL", "CONFLICTING"] }
      );

      if (
        (routed.status !== "RESOLVED" && routed.status !== "PARTIAL") ||
        !routed.resolution?.value
      ) {
        return {
          projectionType: "natal_geometry_resolution",
          ruleVersion: "natal_geometry_resolution_v0.1",
          evaluatedAt: request.now,
          readiness: "GEOMETRY_UNAVAILABLE",
          birthContext,
          geometryKnowledge: routed.resolution as KnowledgeResolution<NatalGeometry> | undefined,
          limitations: [
            routed.resolution?.limitation ??
              "The deterministic natal-geometry provider did not produce geometry."
          ]
        };
      }

      return {
        projectionType: "natal_geometry_resolution",
        ruleVersion: "natal_geometry_resolution_v0.1",
        evaluatedAt: request.now,
        readiness: "READY",
        birthContext,
        geometry: routed.resolution.value,
        geometryKnowledge: routed.resolution,
        limitations: [
          ...birthContext.limitations,
          ...routed.resolution.value.limitations
        ]
      };
    }
  };
}
