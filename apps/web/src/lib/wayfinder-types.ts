export type CommandStatus = "APPLIED" | "REJECTED" | "NOOP";

export interface RecordRef {
  namespace: string;
  type: string;
  id: string;
  version?: string;
}

export interface CommandResponse {
  command_id: string;
  status: CommandStatus;
  affected_refs: RecordRef[];
  error_code: string | null;
  replayed: boolean;
}

export interface DirectionNodeRead {
  id: string;
  version: string;
  kind: "value" | "direction" | "outcome" | "commitment" | "quest" | "plan" | "action";
  title: string;
  description: string | null;
  intent_state: "ACTIVE" | "PAUSED" | "WITHDRAWN";
  lifecycle_status: "ACTIVE";
  recorded_at: string;
}

export interface DirectionEdgeRead {
  id: string;
  version: string;
  from_node_id: string;
  to_node_id: string;
  relation: string;
  lifecycle_status: "ACTIVE";
  recorded_at: string;
}

export interface DirectionRead {
  nodes: DirectionNodeRead[];
  edges: DirectionEdgeRead[];
  record_coverage: {
    phenomenon: string;
    completeness: "COMPLETE";
    does_not_assert: string;
    evaluated_at: string;
  };
}

export type EvidenceState =
  | "CURRENT_EVIDENCE_PRESENT"
  | "STALE_RECORDED_EVIDENCE_ONLY"
  | "NO_RECORDED_EVIDENCE";

export interface BearingTarget {
  id: string;
  version: string;
  kind: string;
  title: string;
  intent_state: "ACTIVE";
}

export interface EvidenceLineageItem {
  evidence_link: RecordRef & { version: string };
  source: RecordRef & { version: string };
}

export interface BearingAction {
  id: string;
  version: string;
  title: string;
  intent_state: "ACTIVE";
  evidence_state: EvidenceState;
  current_qualifying_evidence_count: number;
  stale_recorded_evidence_count: number;
  qualifying_lineage: EvidenceLineageItem[];
  supports_targets: BearingTarget[];
}

export interface BearingRead {
  projection_type: "bearing";
  rule_version: string;
  computed_at: string;
  state:
    | "NO_ACTIVE_ACTIONS"
    | "RECORDED_EVIDENCE_OF_MOVEMENT"
    | "NO_RECORDED_EVIDENCE_OF_MOVEMENT";
  active_action_count: number;
  evidenced_active_action_count: number;
  stale_evidence_only_action_count: number;
  actions: BearingAction[];
  epistemic_coverage: {
    phenomenon: string;
    source: string;
    completeness: "UNKNOWN";
    reason: string;
  };
  does_not_assert: string[];
}

export interface PracticeCatalogItem {
  id: string;
  name: string;
  description: string | null;
  lifecycle_status: "ACTIVE";
  created_at: string;
  active_session_count: number;
  same_name_active_count: number;
  capture_preferred: boolean;
}

export interface PracticeCatalogRead {
  practices: PracticeCatalogItem[];
  active_record_count: number;
  duplicate_active_name_group_count: number;
  record_coverage: {
    phenomenon: "active_wayfinder_practice_records";
    completeness: "COMPLETE";
    evaluated_at: string;
  };
  epistemic_coverage: {
    phenomenon: "practices_in_lived_reality";
    source: "wayfinder_practice_records";
    completeness: "UNKNOWN";
    reason: string;
  };
}

export interface PracticeSessionRead {
  id: string;
  version: string;
  practice: {
    id: string;
    name: string;
    lifecycle_status: "ACTIVE" | "RETRACTED";
  };
  occurrence: {
    from: string;
    to: string | null;
    from_precision: string;
    to_precision: string | null;
    zone_id: string | null;
    interval_semantics: "POINT" | "[start,end)";
  };
  duration_seconds: number | null;
  focus: string | null;
  recorded_at: string;
}

export interface PracticeRead {
  sessions: PracticeSessionRead[];
  returned_count: number;
  matching_record_count: number;
  result_coverage: {
    scope: {
      from: string;
      to: string;
      interval_semantics: "[start,end)";
    };
    completeness: "COMPLETE" | "PARTIAL";
    reason: "RESULT_LIMIT" | null;
  };
  epistemic_coverage: {
    phenomenon: "lived_practice_activity";
    source: "wayfinder_practice_session_records";
    scope: {
      from: string;
      to: string;
      interval_semantics: "[start,end)";
    };
    completeness: "UNKNOWN";
    reason: string;
    evaluated_at: string;
  };
}

export interface HelmRead {
  projection_type: "helm";
  rule_version: string;
  computed_at: string;
  scope: {
    from: string;
    to: string;
    interval_semantics: "[start,end)";
  };
  direction: DirectionRead;
  bearing: BearingRead;
  practice_catalog: PracticeCatalogRead;
  practice: PracticeRead;
  composition_note: string;
}

export interface OwnerBootstrap {
  owner_id: string;
  timezone: string;
}
