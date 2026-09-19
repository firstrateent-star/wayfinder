import type { InitialPositionProjection } from "./initial-position-service.ts";

export interface DirectionGraphNode {
  id: string;
  version: string;
  kind: "value" | "direction" | "outcome" | "commitment" | "quest" | "plan" | "action";
  title: string;
  description: string | null;
  intent_state: "ACTIVE" | "PAUSED" | "WITHDRAWN";
  lifecycle_status: "ACTIVE";
  recorded_at: string;
}

export interface DirectionGraphEdge {
  id: string;
  version: string;
  from_node_id: string;
  to_node_id: string;
  relation: "SUPPORTS";
  lifecycle_status: "ACTIVE";
  recorded_at: string;
}

export interface DirectionGraphRead {
  nodes: DirectionGraphNode[];
  edges: DirectionGraphEdge[];
}

export interface BearingAction {
  id: string;
  version: string;
  title: string;
  intent_state: string;
  evidence_state: "CURRENT_EVIDENCE_PRESENT" | "STALE_RECORDED_EVIDENCE_ONLY" | "NO_RECORDED_EVIDENCE";
  current_qualifying_evidence_count: number;
  stale_recorded_evidence_count: number;
  supports_targets?: Array<{
    id: string;
    version: string;
    kind: string;
    title: string;
    intent_state?: string;
  }>;
}

export interface BearingRead {
  projection_type: "bearing";
  rule_version: string;
  computed_at: string;
  state: "NO_ACTIVE_ACTIONS" | "RECORDED_EVIDENCE_OF_MOVEMENT" | "NO_RECORDED_EVIDENCE_OF_MOVEMENT";
  active_action_count: number;
  evidenced_active_action_count: number;
  stale_evidence_only_action_count: number;
  actions: BearingAction[];
  epistemic_coverage: unknown;
  does_not_assert: string[];
}

export interface FocusBranchNode extends DirectionGraphNode {
  depth_from_focus: number;
}

export interface FocusBranch {
  focus_id: string | null;
  nodes: FocusBranchNode[];
  edges: DirectionGraphEdge[];
  actions: FocusBranchNode[];
  outcomes: FocusBranchNode[];
}

export function deriveFocusBranch(direction: DirectionGraphRead, focusId: string | null): FocusBranch {
  if (!focusId) return { focus_id: null, nodes: [], edges: [], actions: [], outcomes: [] };

  const nodeById = new Map(direction.nodes.map((node) => [node.id, node]));
  const incoming = new Map<string, DirectionGraphEdge[]>();
  for (const edge of direction.edges) {
    if (edge.relation !== "SUPPORTS" || edge.lifecycle_status !== "ACTIVE") continue;
    const list = incoming.get(edge.to_node_id) ?? [];
    list.push(edge);
    incoming.set(edge.to_node_id, list);
  }

  const visited = new Set<string>([focusId]);
  const queue: Array<{ id: string; depth: number }> = [{ id: focusId, depth: 0 }];
  const nodes: FocusBranchNode[] = [];
  const edges: DirectionGraphEdge[] = [];

  while (queue.length) {
    const current = queue.shift()!;
    for (const edge of incoming.get(current.id) ?? []) {
      const child = nodeById.get(edge.from_node_id);
      if (!child || child.intent_state !== "ACTIVE") continue;
      edges.push(edge);
      if (visited.has(child.id)) continue;
      visited.add(child.id);
      const depth = current.depth + 1;
      nodes.push({ ...child, depth_from_focus: depth });
      queue.push({ id: child.id, depth });
    }
  }

  nodes.sort((a, b) =>
    a.depth_from_focus - b.depth_from_focus ||
    Date.parse(b.recorded_at) - Date.parse(a.recorded_at) ||
    a.id.localeCompare(b.id)
  );

  return {
    focus_id: focusId,
    nodes,
    edges,
    actions: nodes.filter((node) => node.kind === "action"),
    outcomes: nodes.filter((node) => node.kind === "outcome")
  };
}

export function buildHelmState(input: {
  position: InitialPositionProjection;
  bearing: BearingRead;
  direction: DirectionGraphRead;
}) {
  const focusId = input.position.direction.current_focus?.id ?? null;
  const focusBranch = deriveFocusBranch(input.direction, focusId);
  const actionIds = new Set(focusBranch.actions.map((node) => node.id));
  const bearingActions = input.bearing.actions.filter((action) => actionIds.has(action.id));

  return {
    projection_type: "helm_state" as const,
    rule_version: "helm_state_v0.1" as const,
    current_direction: input.position.direction.current_focus,
    focus_branch: focusBranch,
    bearing: {
      state: input.bearing.state,
      active_action_count: input.bearing.active_action_count,
      focus_branch_action_count: bearingActions.length,
      actions: bearingActions
    },
    primary_insight: input.position.insights[0] ?? null,
    note:
      focusId
        ? "Helm shows only Direction descendants supported by canonical Direction edges. It does not infer that unrelated active Actions belong to the current focus."
        : "No explicit current Direction exists, so Helm does not invent a focus branch.",
    does_not_assert: [
      "that an active action occurred",
      "that no recorded evidence means no movement",
      "that a Direction outcome has been achieved",
      "that the displayed focus branch is the player's entire life context"
    ]
  };
}
