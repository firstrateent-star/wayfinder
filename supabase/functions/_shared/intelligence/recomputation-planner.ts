export type RecomputeTarget =
  | "POSITION"
  | "BEARING"
  | "REQUIREMENTS"
  | "CHARACTER"
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
  recomputeNow: Array<"POSITION" | "BEARING" | "HELM">;
  deferred: Array<{
    target: "REQUIREMENTS" | "CHARACTER";
    reason: string;
  }>;
  navigatorContextInvalidated: boolean;
  cursor: ModuleChangeCursor | null;
  sourceChangeCount: number;
  resultCoverage: "COMPLETE" | "PARTIAL";
}

const impactMap: Record<string, readonly RecomputeTarget[]> = {
  person: ["POSITION", "CHARACTER", "HELM", "NAVIGATOR_CONTEXT"],
  body: ["POSITION", "CHARACTER", "HELM", "NAVIGATOR_CONTEXT"],
  direction: ["POSITION", "BEARING", "CHARACTER", "HELM", "NAVIGATOR_CONTEXT"],
  schedule: ["POSITION", "HELM", "NAVIGATOR_CONTEXT"],
  training: ["REQUIREMENTS", "CHARACTER", "HELM", "NAVIGATOR_CONTEXT"],
  nutrition: ["REQUIREMENTS", "CHARACTER", "HELM", "NAVIGATOR_CONTEXT"],
  practice: ["BEARING", "CHARACTER", "HELM", "NAVIGATOR_CONTEXT"],
  evidence: ["BEARING", "CHARACTER", "HELM", "NAVIGATOR_CONTEXT"]
};

const liveNow = new Set<RecomputeTarget>(["POSITION", "BEARING", "HELM"]);

function uniqueTargets(values: RecomputeTarget[]) {
  return [...new Set(values)];
}

function impactsForModule(moduleId: string): readonly RecomputeTarget[] {
  return impactMap[moduleId] ?? ["POSITION", "BEARING", "REQUIREMENTS", "CHARACTER", "HELM", "NAVIGATOR_CONTEXT"];
}

export function planRecomputation(read: ModuleChangeRead): RecomputePlan {
  if (read.initial_cursor) {
    return {
      reason: "INITIAL_LOAD",
      changedModules: [],
      invalidated: ["POSITION", "BEARING", "REQUIREMENTS", "CHARACTER", "HELM", "NAVIGATOR_CONTEXT"],
      recomputeNow: ["POSITION", "BEARING", "HELM"],
      deferred: [
        { target: "REQUIREMENTS", reason: "Requirement specs/observations are not yet composed in the current-state runtime." },
        { target: "CHARACTER", reason: "Character remains a derived projection; recomputation has not yet been added to the current-state runtime." }
      ],
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
      invalidated: ["POSITION", "BEARING", "REQUIREMENTS", "CHARACTER", "HELM", "NAVIGATOR_CONTEXT"],
      recomputeNow: ["POSITION", "BEARING", "HELM"],
      deferred: [
        { target: "REQUIREMENTS", reason: "Partial invalidation window is conservatively treated as affecting Requirements." },
        { target: "CHARACTER", reason: "Partial invalidation window is conservatively treated as affecting Character." }
      ],
      navigatorContextInvalidated: true,
      cursor: read.cursor,
      sourceChangeCount: read.matching_change_count,
      resultCoverage: "PARTIAL"
    };
  }

  const changedModules = [...new Set(read.changes.map((change) => change.module_id))];
  const invalidated = uniqueTargets(changedModules.flatMap((moduleId) => [...impactsForModule(moduleId)]));
  const recomputeNow = invalidated.filter((target): target is "POSITION" | "BEARING" | "HELM" => liveNow.has(target)) as Array<"POSITION" | "BEARING" | "HELM">;
  const deferred: RecomputePlan["deferred"] = [];

  if (invalidated.includes("REQUIREMENTS")) {
    deferred.push({
      target: "REQUIREMENTS",
      reason: "Requirement evaluation is available as a contract but is not yet composed into the current-state runtime."
    });
  }
  if (invalidated.includes("CHARACTER")) {
    deferred.push({
      target: "CHARACTER",
      reason: "Character remains reconstructable and has no current recomputation composer yet."
    });
  }

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
