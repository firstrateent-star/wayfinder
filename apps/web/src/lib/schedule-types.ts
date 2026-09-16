export type ScheduleKind = "HARD" | "SOFT" | "WINDOWED" | "FLOATING";
export type ScheduleState = "PLANNED" | "CANCELLED";

export interface ScheduleAllocationRead {
  id: string;
  version: string;
  label: string;
  kind: ScheduleKind;
  state: ScheduleState;
  starts_at: string | null;
  ends_at: string | null;
  window_starts_at: string | null;
  window_ends_at: string | null;
  due_at: string | null;
  expected_duration_seconds: number | null;
  zone_id: string;
  target: {
    namespace: string;
    type: string;
    id: string;
    version: string | null;
  } | null;
  recorded_at: string;
}

export interface ScheduleRead {
  projection_type: "schedule";
  rule_version: "schedule_current_v0.1";
  computed_at: string;
  scope: {
    from: string;
    to: string;
    interval_semantics: "[start,end)";
  } | null;
  allocations: ScheduleAllocationRead[];
  returned_count: number;
  matching_record_count: number;
  result_coverage: {
    completeness: "COMPLETE" | "PARTIAL";
    reason: "RESULT_LIMIT" | null;
  };
  epistemic_coverage: {
    phenomenon: "planned_time_allocations";
    source: "wayfinder_schedule_records";
    completeness: "UNKNOWN";
    reason: string;
  };
  does_not_assert: string[];
}
