begin;

create or replace function public.wf_module_changes_v0(
  p_after_committed_at timestamptz default null,
  p_after_id uuid default null,
  p_limit integer default 100
)
returns jsonb
language plpgsql
security definer
stable
set search_path = pg_catalog
as $$
declare
  v_owner uuid;
  v_total bigint;
  v_changes jsonb;
  v_head_committed_at timestamptz;
  v_head_id uuid;
  v_completeness text;
begin
  v_owner := wf_system.require_authenticated_owner();

  if (p_after_committed_at is null) <> (p_after_id is null) then
    raise exception using errcode='22023', message='MODULE_CHANGE_CURSOR_PAIR_REQUIRED';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 500 then
    raise exception using errcode='22023', message='INVALID_MODULE_CHANGE_LIMIT';
  end if;

  select o.committed_at,o.id
    into v_head_committed_at,v_head_id
  from wf_system.module_change_outbox o
  where o.owner_id=v_owner
  order by o.committed_at desc,o.id desc
  limit 1;

  if p_after_committed_at is null then
    return pg_catalog.jsonb_build_object(
      'cursor',case when v_head_id is null then null else pg_catalog.jsonb_build_object('committed_at',v_head_committed_at,'id',v_head_id) end,
      'changes','[]'::jsonb,
      'matching_change_count',0,
      'result_coverage',pg_catalog.jsonb_build_object('completeness','COMPLETE'),
      'initial_cursor',true
    );
  end if;

  select count(*) into v_total
  from wf_system.module_change_outbox o
  where o.owner_id=v_owner
    and (o.committed_at,o.id) > (p_after_committed_at,p_after_id);

  select coalesce(pg_catalog.jsonb_agg(x.payload order by x.committed_at,x.id),'[]'::jsonb)
    into v_changes
  from (
    select o.id,o.committed_at,
      pg_catalog.jsonb_build_object(
        'id',o.id,
        'module_id',o.module_id,
        'change_type',o.change_type,
        'command_id',o.command_id,
        'affected',o.affected,
        'correlation_id',o.correlation_id,
        'committed_at',o.committed_at
      ) payload
    from wf_system.module_change_outbox o
    where o.owner_id=v_owner
      and (o.committed_at,o.id) > (p_after_committed_at,p_after_id)
    order by o.committed_at,o.id
    limit p_limit
  ) x;

  v_completeness:=case when v_total<=p_limit then 'COMPLETE' else 'PARTIAL' end;

  return pg_catalog.jsonb_build_object(
    'cursor',case when v_head_id is null then null else pg_catalog.jsonb_build_object('committed_at',v_head_committed_at,'id',v_head_id) end,
    'changes',v_changes,
    'matching_change_count',v_total,
    'result_coverage',pg_catalog.jsonb_build_object(
      'completeness',v_completeness,
      'reason',case when v_total>p_limit then 'RESULT_LIMIT_COALESCED_BY_CURRENT_STATE_RECOMPUTE' else null end
    ),
    'initial_cursor',false,
    'operational_note','ModuleChange is an invalidation signal. Current projections must be recomputed from canonical reads rather than replayed from this outbox.'
  );
end;
$$;

revoke all on function public.wf_module_changes_v0(timestamptz,uuid,integer) from public,anon;
grant execute on function public.wf_module_changes_v0(timestamptz,uuid,integer) to authenticated;

commit;
