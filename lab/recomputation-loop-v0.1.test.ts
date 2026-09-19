import { planRecomputation, type ModuleChangeRead } from "../supabase/functions/_shared/intelligence/recomputation-planner.ts";
import { deriveFocusBranch, type DirectionGraphRead } from "../supabase/functions/_shared/intelligence/wayfinder-state-service.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function changeRead(input: Partial<ModuleChangeRead> = {}): ModuleChangeRead {
  return {
    cursor: { committed_at: "2026-09-19T22:00:00.000Z", id: "11111111-1111-4111-8111-111111111111" },
    changes: [],
    matching_change_count: 0,
    result_coverage: { completeness: "COMPLETE" },
    initial_cursor: false,
    ...input
  };
}

Deno.test("initial state load recomputes live projections without persisting them", () => {
  const plan = planRecomputation(changeRead({ initial_cursor: true }));
  assert(plan.reason === "INITIAL_LOAD", "initial read should identify initial load");
  assert(plan.recomputeNow.join(",") === "POSITION,BEARING,HELM", "live projections should recompute");
  assert(plan.deferred.some((item) => item.target === "REQUIREMENTS"), "Requirements should be explicitly deferred");
  assert(plan.deferred.some((item) => item.target === "CHARACTER"), "Character should be explicitly deferred");
});

Deno.test("Direction change invalidates Position Bearing Helm Character and Navigator context", () => {
  const plan = planRecomputation(changeRead({
    changes: [{
      id: "22222222-2222-4222-8222-222222222222",
      module_id: "direction",
      change_type: "direction.node.created",
      committed_at: "2026-09-19T22:01:00.000Z"
    }],
    matching_change_count: 1
  }));
  for (const target of ["POSITION","BEARING","CHARACTER","HELM","NAVIGATOR_CONTEXT"] as const) {
    assert(plan.invalidated.includes(target), `${target} should be invalidated by Direction`);
  }
  assert(!plan.invalidated.includes("REQUIREMENTS"), "Direction alone should not imply Requirement recomputation");
});

Deno.test("Nutrition change invalidates Requirements and Character but not Bearing", () => {
  const plan = planRecomputation(changeRead({
    changes: [{
      id: "33333333-3333-4333-8333-333333333333",
      module_id: "nutrition",
      change_type: "nutrition.intake_captured",
      committed_at: "2026-09-19T22:02:00.000Z"
    }],
    matching_change_count: 1
  }));
  assert(plan.invalidated.includes("REQUIREMENTS"), "Nutrition should invalidate Requirement evaluation");
  assert(plan.invalidated.includes("CHARACTER"), "Nutrition should invalidate Character projection");
  assert(plan.invalidated.includes("HELM"), "Nutrition should invalidate Helm");
  assert(!plan.invalidated.includes("BEARING"), "Nutrition does not directly change current Direction evidence Bearing");
});

Deno.test("partial ModuleChange window conservatively invalidates every projection", () => {
  const plan = planRecomputation(changeRead({
    changes: [{
      id: "44444444-4444-4444-8444-444444444444",
      module_id: "schedule",
      change_type: "schedule.allocation_created",
      committed_at: "2026-09-19T22:03:00.000Z"
    }],
    matching_change_count: 200,
    result_coverage: { completeness: "PARTIAL", reason: "RESULT_LIMIT_COALESCED_BY_CURRENT_STATE_RECOMPUTE" }
  }));
  assert(plan.reason === "COALESCED_PARTIAL_CHANGE_WINDOW", "partial windows should fail safely");
  assert(plan.invalidated.length === 6, "partial invalidation window should invalidate every projection target");
});

Deno.test("focus branch follows canonical SUPPORTS lineage and excludes unrelated actions", () => {
  const direction: DirectionGraphRead = {
    nodes: [
      { id:"d",version:"dv",kind:"direction",title:"Make Wayfinder work",description:null,intent_state:"ACTIVE",lifecycle_status:"ACTIVE",recorded_at:"2026-09-19T22:00:00Z" },
      { id:"o",version:"ov",kind:"outcome",title:"Close living loop",description:null,intent_state:"ACTIVE",lifecycle_status:"ACTIVE",recorded_at:"2026-09-19T22:01:00Z" },
      { id:"a",version:"av",kind:"action",title:"Build recomputation",description:null,intent_state:"ACTIVE",lifecycle_status:"ACTIVE",recorded_at:"2026-09-19T22:02:00Z" },
      { id:"x",version:"xv",kind:"action",title:"Unrelated action",description:null,intent_state:"ACTIVE",lifecycle_status:"ACTIVE",recorded_at:"2026-09-19T22:03:00Z" }
    ],
    edges: [
      { id:"e1",version:"e1v",from_node_id:"o",to_node_id:"d",relation:"SUPPORTS",lifecycle_status:"ACTIVE",recorded_at:"2026-09-19T22:01:30Z" },
      { id:"e2",version:"e2v",from_node_id:"a",to_node_id:"o",relation:"SUPPORTS",lifecycle_status:"ACTIVE",recorded_at:"2026-09-19T22:02:30Z" }
    ]
  };
  const branch = deriveFocusBranch(direction, "d");
  assert(branch.outcomes.map((node) => node.id).join(",") === "o", "supporting outcome should be included");
  assert(branch.actions.map((node) => node.id).join(",") === "a", "only lineage-backed action should be included");
  assert(!branch.nodes.some((node) => node.id === "x"), "unrelated active action must not be treated as current focus");
});

Deno.test("paused supporting nodes are excluded from the focus branch", () => {
  const direction: DirectionGraphRead = {
    nodes: [
      { id:"d",version:"dv",kind:"direction",title:"Focus",description:null,intent_state:"ACTIVE",lifecycle_status:"ACTIVE",recorded_at:"2026-09-19T22:00:00Z" },
      { id:"a",version:"av",kind:"action",title:"Paused action",description:null,intent_state:"PAUSED",lifecycle_status:"ACTIVE",recorded_at:"2026-09-19T22:02:00Z" }
    ],
    edges: [
      { id:"e",version:"ev",from_node_id:"a",to_node_id:"d",relation:"SUPPORTS",lifecycle_status:"ACTIVE",recorded_at:"2026-09-19T22:02:30Z" }
    ]
  };
  assert(deriveFocusBranch(direction, "d").actions.length === 0, "paused actions should not surface as current focus work");
});
