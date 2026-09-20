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

export interface PersonCurrentRead {
  person: {
    ref: {
      namespace: "person";
      type: "person";
      id: string;
      version: string;
    };
    display_name: string;
    birth_date: string | null;
    birth_time_local: string | null;
    birth_time_accuracy: "EXACT" | "APPROXIMATE" | null;
    birth_place_label: string | null;
    recorded_at: string;
  } | null;
  record_coverage: {
    completeness: "COMPLETE";
    evaluated_at: string;
  };
  epistemic_coverage: {
    completeness: "UNKNOWN";
    reason: string;
  };
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

export type PracticeOutputAlignmentState =
  | "CURRENT"
  | "SOURCE_VERSION_ADVANCED"
  | "PRACTICE_MISMATCH"
  | "SOURCE_SESSION_UNRESOLVED"
  | "SOURCE_SESSION_NOT_ACTIVE"
  | "SOURCE_PRACTICE_NOT_ACTIVE"
  | "RECORDED_PRACTICE_NOT_ACTIVE"
  | "SOURCE_OCCURRENCE_AFTER_AS_OF"
  | "OUTPUT_RETRACTED";

export interface PracticeOutputCatalogItem {
  id: string;
  version: string;
  version_no: number;
  output_kind: "COMPLETED_ARTIFACT";
  title: string;
  external_url: string | null;
  lifecycle_status: "ACTIVE" | "SUPERSEDED" | "RETRACTED";
  recorded_at: string;
  recorded_practice: {
    id: string;
    name: string;
    lifecycle_status: "ACTIVE" | "RETRACTED";
  };
  source_session: {
    id: string;
    captured_version: string;
    current_version: string | null;
    current_lifecycle_status: "ACTIVE" | "SUPERSEDED" | "RETRACTED" | null;
    current_practice: {
      id: string;
      name: string;
      lifecycle_status: "ACTIVE" | "RETRACTED";
    } | null;
    current_occurrence: {
      from: string;
      to: string | null;
      interval_semantics: "POINT" | "[start,end)";
    } | null;
    current_focus: string | null;
  };
  alignment_state: PracticeOutputAlignmentState;
  source_version_is_current: boolean;
  capability_eligible: boolean;
  needs_attention: boolean;
  can_rebase: boolean;
  can_correct: boolean;
}

export interface PracticeOutputsRead {
  outputs: PracticeOutputCatalogItem[];
  returned_count: number;
  matching_record_count: number;
  result_coverage: {
    phenomenon: "current_wayfinder_practice_outputs";
    completeness: "COMPLETE" | "PARTIAL";
    reason: "RESULT_LIMIT" | null;
    evaluated_at: string;
  };
  epistemic_coverage: {
    phenomenon: "completed_outputs_in_lived_reality";
    source: "wayfinder_practice_output_records";
    completeness: "UNKNOWN";
    reason: string;
  };
  does_not_assert: string[];
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

export type JourneyLayer = "REALITY" | "RESULT" | "DIRECTION" | "EVIDENCE" | "CORRECTION";
export type JourneyTimeBasis = "OCCURRED" | "RECORDED";
export type JourneyVersionRef = RecordRef & { version: string };

export interface JourneyPracticeSessionPayload {
  primary_ref: JourneyVersionRef;
  practice: {
    id: string;
    name: string;
    lifecycle_status: "ACTIVE" | "RETRACTED";
  };
  focus: string | null;
  duration_seconds: number | null;
  occurrence: {
    from: string;
    to: string | null;
    from_precision: string;
    to_precision: string | null;
    zone_id: string | null;
    interval_semantics: "POINT" | "[start,end)";
  };
  recorded_at: string;
}

export interface JourneyDirectionPayload {
  primary_ref: JourneyVersionRef;
  node: {
    id: string;
    version: string;
    kind: DirectionNodeRead["kind"];
    title: string;
    description: string | null;
    intent_state_at_recording: "ACTIVE" | "PAUSED" | "WITHDRAWN";
    lifecycle_status_of_recorded_version: "ACTIVE" | "SUPERSEDED" | "RETRACTED";
  };
  current_state: {
    version: string;
    title: string;
    intent_state: "ACTIVE" | "PAUSED" | "WITHDRAWN";
    lifecycle_status: "ACTIVE" | "SUPERSEDED" | "RETRACTED";
  } | null;
}

export interface JourneyDirectionRelationPayload {
  primary_ref: JourneyVersionRef;
  relation: string;
  lifecycle_status: "ACTIVE" | "RETRACTED";
  from: {
    namespace: "direction";
    type: string;
    id: string;
    title: string;
  };
  to: {
    namespace: "direction";
    type: string;
    id: string;
    title: string;
  };
}

export interface JourneyEvidencePayload {
  primary_ref: JourneyVersionRef;
  relation: string;
  target_aspect: string | null;
  reason: string | null;
  lifecycle_status: "ACTIVE" | "RETRACTED";
  source: {
    ref: JourneyVersionRef;
    practice: { id: string; name: string };
    focus: string | null;
    duration_seconds: number | null;
    is_current: boolean;
  };
  target: {
    ref: JourneyVersionRef;
    title: string;
    is_current: boolean;
  };
}

export interface JourneyPracticeOutputPayload {
  primary_ref: JourneyVersionRef;
  output: {
    kind: "COMPLETED_ARTIFACT";
    title: string;
    external_url: string | null;
    practice: { id: string; name: string };
    lifecycle_status_of_recorded_version: "ACTIVE" | "SUPERSEDED" | "RETRACTED";
    recorded_at: string;
  };
  source_session: {
    ref: JourneyVersionRef;
    occurred_from: string;
    occurred_to: string | null;
    focus: string | null;
    is_exact_version_current: boolean;
  };
  current_state: {
    version: string;
    title: string;
    external_url: string | null;
    lifecycle_status: "ACTIVE" | "SUPERSEDED" | "RETRACTED";
    practice: { id: string; name: string };
    source_session_version: string;
    source_session_current_version: string | null;
    source_session_current_practice: { id: string; name: string } | null;
  } | null;
}

export interface JourneyPracticeOutputCorrectionPayload {
  primary_ref: JourneyVersionRef;
  previous_ref: JourneyVersionRef;
  changed_fields: string[];
  before: {
    title: string;
    external_url: string | null;
    practice: { id: string; name: string };
    source_session: { id: string; version: string };
    version_no: number;
  };
  after: {
    title: string;
    external_url: string | null;
    practice: { id: string; name: string };
    source_session: { id: string; version: string };
    version_no: number;
  };
}

export interface JourneyCorrectionPayload {
  primary_ref: JourneyVersionRef;
  previous_ref: JourneyVersionRef;
  changed_fields: string[];
  before: {
    practice: { id: string; name: string };
    focus: string | null;
    duration_seconds: number | null;
    occurred_from: string;
    occurred_to: string | null;
    version_no: number;
  };
  after: {
    practice: { id: string; name: string };
    focus: string | null;
    duration_seconds: number | null;
    occurred_from: string;
    occurred_to: string | null;
    version_no: number;
  };
}

interface JourneyItemBase<K extends string, L extends JourneyLayer, T extends JourneyTimeBasis, P> {
  item_key: string;
  kind: K;
  layer: L;
  timeline_at: string;
  time_basis: T;
  payload: P;
}

export type JourneyItem =
  | JourneyItemBase<"PRACTICE_SESSION", "REALITY", "OCCURRED", JourneyPracticeSessionPayload>
  | JourneyItemBase<"PRACTICE_OUTPUT_RECORDED", "RESULT", "RECORDED", JourneyPracticeOutputPayload>
  | JourneyItemBase<"DIRECTION_RECORDED", "DIRECTION", "RECORDED", JourneyDirectionPayload>
  | JourneyItemBase<"DIRECTION_RELATION_RECORDED", "DIRECTION", "RECORDED", JourneyDirectionRelationPayload>
  | JourneyItemBase<"EVIDENCE_RECORDED", "EVIDENCE", "RECORDED", JourneyEvidencePayload>
  | JourneyItemBase<"PRACTICE_SESSION_CORRECTED", "CORRECTION", "RECORDED", JourneyCorrectionPayload>
  | JourneyItemBase<"PRACTICE_OUTPUT_CORRECTED", "CORRECTION", "RECORDED", JourneyPracticeOutputCorrectionPayload>;

export interface JourneyRead {
  projection_type: "journey";
  rule_version: string;
  computed_at: string;
  scope: {
    from: string;
    to: string;
    interval_semantics: "[start,end)";
    timeline_rule: string;
  };
  items: JourneyItem[];
  returned_count: number;
  matching_item_count: number;
  result_coverage: {
    completeness: "COMPLETE" | "PARTIAL";
    reason: "RESULT_LIMIT" | null;
  };
  epistemic_coverage: {
    phenomenon: "person_life_and_change_over_time";
    source: string;
    completeness: "UNKNOWN";
    reason: string;
  };
  included_kinds: JourneyItem["kind"][];
  does_not_assert: string[];
}

export interface OwnerBootstrap {
  owner_id: string;
  timezone: string;
}
