import { createWayfinderProjectionProviderRegistryV0 } from "./projection-provider-registry.ts";

export type RecomputeTarget =
  | "POSITION"
  | "BEARING"
  | "REQUIREMENTS"
  | "CHARACTER"
  | "PROGRESSION"
  | "SKILLS"
  | "HELM"
  | "NAVIGATOR_CONTEXT";

export interface ModuleChangeCursor {
  committed_at: string;
  id: string;
}

export interface ModuleChangeItem {
  id: string;
  module_id: string;
  change_type: string;
  command_id?: string | null;
  affected?: unknown;
  correlation_id?: string | null;
  committed_at: string;
}

export interface ModuleChangeRead {
  cursor: ModuleChangeCursor | null;
  changes: ModuleChangeItem[];
  matching_change_count: number;
  result_coverage: {
    completeness: "COMPLETE" | "PARTIAL";
    reason?: string | null;
  };
  initial_cursor: boolean;
}

export interface RecomputePlan {
  reason: "INITIAL_LOAD" | "NO_CHANGE" | "MODULE_CHANGE" | "COALESCED_PARTIAL_CHANGE_WINDOW";
  changedModules: string[];
  invalidated: RecomputeTarget[];
  recomputeNow: Array<"POSITION" | "BEARING" | "REQUIREMENTS" | "CHARACTER" | "PROGRESSION" | "SKILLS" | "HELM">;
  deferred: Array<{ target: never; reason: string }>;
  navigatorContextInvalidated: boolean;
  cursor: ModuleChangeCursor | null;
  sourceChangeCount: number;
  resultCoverage: "COMPLETE" | "PARTIAL";
}

const impactMap: Record<string, readonly RecomputeTarget[]> = {
  person: ["POSITION", "HELM", "NAVIGATOR_CONTEXT"],
  body: ["POSITION", "HELM", "NAVIGATOR_CONTEXT"],
  direction: ["POSITION", "BEARING", "HELM", "NAVIGATOR_CONTEXT"],
  schedule: ["POSITION", "HELM", "NAVIGATOR_CONTEXT"],
  training: ["HELM", "NAVIGATOR_CONTEXT"],
  nutrition: ["HELM", "NAVIGATOR_CONTEXT"],
  practice: ["BEARING", "HELM", "NAVIGATOR_CONTEXT"],
  evidence: ["BEARING", "HELM", "NAVIGATOR_CONTEXT"]
};

const projectionProviders = createWayfinderProjectionProviderRegistryV0();

const liveNow = new Set<RecomputeTarget>(["POSITION", "BEARING", "REQUIREMENTS", "CHARACTER", "PROGRESSION", "SKILLS", "HELM"]);

function uniqueTargets(values: RecomputeTarget[]) {
  return [...new Set(values)];
}

function impactsForModule(moduleId: string): readonly RecomputeTarget[] {
  const base = impactMap[moduleId];
  if (!base) return ["POSITION", "BEARING", "REQUIREMENTS", "CHARACTER", "PROGRESSION", "SKILLS", "HELM", "NAVIGATOR_CONTEXT"];
  const providerTargets = projectionProviders.affectedProjectionTargets([moduleId]);
  return uniqueTargets([...base, ...providerTargets]);
}

export function planRecomputation(read: ModuleChangeRead): RecomputePlan {
  if (read.initial_cursor) {
    return {
      reason: "INITIAL_LOAD",
      changedModules: [],
      invalidated: ["POSITION", "BEARING", "REQUIREMENTS", "CHARACTER", "PROGRESSION", "SKILLS", "HELM", "NAVIGATOR_CONTEXT"],
      recomputeNow: ["POSITION", "BEARING", "REQUIREMENTS", "CHARACTER", "PROGRESSION", "SKILLS", "HELM"],
      deferred: [],
      navigatorContextInvalidated: true,
      cursor: read.cursor,
      sourceChangeCount: 0,
      resultCoverage: read.result_coverage.completeness
    };
  }

  if (read.changes.length === 0) {
    return {
      reason: "NO_CHANGE",
      changedModules: [],
      invalidated: [],
      recomputeNow: [],
      deferred: [],
      navigatorContextInvalidated: false,
      cursor: read.cursor,
      sourceChangeCount: 0,
      resultCoverage: read.result_coverage.completeness
    };
  }

  if (read.result_coverage.completeness === "PARTIAL") {
    return {
      reason: "COALESCED_PARTIAL_CHANGE_WINDOW",
      changedModules: [...new Set(read.changes.map((change) => change.module_id))],
      invalidated: ["POSITION", "BEARING", "REQUIREMENTS", "CHARACTER", "PROGRESSION", "SKILLS", "HELM", "NAVIGATOR_CONTEXT"],
      recomputeNow: ["POSITION", "BEARING", "REQUIREMENTS", "CHARACTER", "PROGRESSION", "SKILLS", "HELM"],
      deferred: [],
      navigatorContextInvalidated: true,
      cursor: read.cursor,
      sourceChangeCount: read.matching_change_count,
      resultCoverage: "PARTIAL"
    };
  }

  const changedModules = [...new Set(read.changes.map((change) => change.module_id))];
  const invalidated = uniqueTargets(changedModules.flatMap((moduleId) => [...impactsForModule(moduleId)]));
  const recomputeNow = invalidated.filter((target): target is "POSITION" | "BEARING" | "REQUIREMENTS" | "CHARACTER" | "PROGRESSION" | "SKILLS" | "HELM" => liveNow.has(target)) as Array<"POSITION" | "BEARING" | "REQUIREMENTS" | "CHARACTER" | "PROGRESSION" | "SKILLS" | "HELM">;
  const deferred: RecomputePlan["deferred"] = [];

  return {
    reason: "MODULE_CHANGE",
    changedModules,
    invalidated,
    recomputeNow,
    deferred,
    navigatorContextInvalidated: invalidated.includes("NAVIGATOR_CONTEXT"),
    cursor: read.cursor,
    sourceChangeCount: read.matching_change_count,
    resultCoverage: "COMPLETE"
  };
}
