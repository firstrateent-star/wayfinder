import { supabase } from "@/lib/supabase";
import type { CommandResponse } from "@/lib/wayfinder-types";
import type { ScheduleKind, ScheduleRead, ScheduleState } from "@/lib/schedule-types";

function rpcErrorMessage(error: { message?: string; details?: string; hint?: string; code?: string }) {
  return [error.message, error.details, error.hint ? `Hint: ${error.hint}` : null, error.code ? `Code: ${error.code}` : null]
    .filter((value, index, values): value is string => Boolean(value) && values.indexOf(value) === index)
    .join(" · ") || "Wayfinder Schedule RPC failed.";
}

async function rpc<T>(name: string, args: Record<string, unknown>) {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error(rpcErrorMessage(error));
  return data as T;
}

export interface ScheduleAllocationInput {
  label: string;
  kind: ScheduleKind;
  state?: ScheduleState;
  startsAt?: string | null;
  endsAt?: string | null;
  windowStartsAt?: string | null;
  windowEndsAt?: string | null;
  dueAt?: string | null;
  expectedDurationSeconds?: number | null;
  zoneId?: string | null;
  target?: {
    namespace: string;
    type: string;
    id: string;
    version?: string | null;
  } | null;
}

export async function createScheduleAllocation(input: ScheduleAllocationInput & { commandId?: string }) {
  return rpc<CommandResponse>("wf_schedule_create_allocation", {
    p_command_id: input.commandId ?? crypto.randomUUID(),
    p_label: input.label,
    p_allocation_kind: input.kind,
    p_starts_at: input.startsAt ?? null,
    p_ends_at: input.endsAt ?? null,
    p_window_starts_at: input.windowStartsAt ?? null,
    p_window_ends_at: input.windowEndsAt ?? null,
    p_due_at: input.dueAt ?? null,
    p_expected_duration_seconds: input.expectedDurationSeconds ?? null,
    p_zone_id: input.zoneId ?? null,
    p_target_namespace: input.target?.namespace ?? null,
    p_target_type: input.target?.type ?? null,
    p_target_record_id: input.target?.id ?? null,
    p_target_version_id: input.target?.version ?? null
  });
}

export async function reviseScheduleAllocation(
  input: ScheduleAllocationInput & { allocationId: string; expectedVersionId: string; commandId?: string }
) {
  return rpc<CommandResponse>("wf_schedule_revise_allocation", {
    p_command_id: input.commandId ?? crypto.randomUUID(),
    p_allocation_id: input.allocationId,
    p_expected_version_id: input.expectedVersionId,
    p_label: input.label,
    p_allocation_kind: input.kind,
    p_allocation_state: input.state ?? "PLANNED",
    p_starts_at: input.startsAt ?? null,
    p_ends_at: input.endsAt ?? null,
    p_window_starts_at: input.windowStartsAt ?? null,
    p_window_ends_at: input.windowEndsAt ?? null,
    p_due_at: input.dueAt ?? null,
    p_expected_duration_seconds: input.expectedDurationSeconds ?? null,
    p_zone_id: input.zoneId ?? null,
    p_target_namespace: input.target?.namespace ?? null,
    p_target_type: input.target?.type ?? null,
    p_target_record_id: input.target?.id ?? null,
    p_target_version_id: input.target?.version ?? null
  });
}

export async function getSchedule(input: { from?: string | null; to?: string | null; limit?: number } = {}) {
  return rpc<ScheduleRead>("wf_schedule_current_v0", {
    p_from: input.from ?? null,
    p_to: input.to ?? null,
    p_limit: input.limit ?? 100
  });
}
