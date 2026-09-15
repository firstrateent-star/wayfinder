begin;

create or replace function public.wf_direction_current()
returns jsonb
language plpgsql
security definer
stable
set search_path = pg_catalog
as $$
declare
  v_owner uuid;
  v_nodes jsonb;
  v_edges jsonb;
begin
  v_owner := wf_system.require_authenticated_owner();

  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'id',n.id,'version',v.id,'kind',n.kind,'title',v.title,'description',v.description,
    'intent_state',v.intent_state,'lifecycle_status',v.lifecycle_status,'recorded_at',v.recorded_at
  ) order by v.recorded_at,n.id),'[]'::jsonb)
  into v_nodes
  from wf_direction.nodes n
  join wf_direction.node_versions v
    on v.id=n.current_version_id and v.node_id=n.id and v.owner_id=n.owner_id
  where n.owner_id=v_owner and v.lifecycle_status='ACTIVE';

  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'id',e.id,'version',e.version_id,'from_node_id',e.from_node_id,'to_node_id',e.to_node_id,
    'relation',e.relation,'lifecycle_status',e.lifecycle_status,'recorded_at',e.recorded_at
  ) order by e.recorded_at,e.id),'[]'::jsonb)
  into v_edges
  from wf_direction.edges e
  join wf_direction.nodes fn on fn.id=e.from_node_id and fn.owner_id=e.owner_id
  join wf_direction.node_versions fv on fv.id=fn.current_version_id and fv.node_id=fn.id and fv.owner_id=fn.owner_id
  join wf_direction.nodes tn on tn.id=e.to_node_id and tn.owner_id=e.owner_id
  join wf_direction.node_versions tv on tv.id=tn.current_version_id and tv.node_id=tn.id and tv.owner_id=tn.owner_id
  where e.owner_id=v_owner and e.lifecycle_status='ACTIVE'
    and fv.lifecycle_status='ACTIVE' and tv.lifecycle_status='ACTIVE';

  return pg_catalog.jsonb_build_object(
    'nodes',v_nodes,
    'edges',v_edges,
    'record_coverage',pg_catalog.jsonb_build_object(
      'phenomenon','current_wayfinder_direction_records',
      'completeness','COMPLETE',
      'does_not_assert','complete_capture_of_all_lived_intentions',
      'evaluated_at',pg_catalog.clock_timestamp()
    )
  );
end;
$$;

create or replace function public.wf_practice_recent(
  p_from timestamptz,
  p_to timestamptz,
  p_limit integer default 50
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
  v_sessions jsonb;
  v_result_completeness text;
begin
  v_owner := wf_system.require_authenticated_owner();
  if p_from is null or p_to is null or p_to <= p_from then
    raise exception using errcode='22023',message='INVALID_READ_RANGE';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 200 then
    raise exception using errcode='22023',message='INVALID_READ_LIMIT';
  end if;

  select count(*) into v_total
  from wf_practice.sessions s
  join wf_practice.session_versions sv
    on sv.id=s.current_version_id and sv.session_id=s.id and sv.owner_id=s.owner_id
  where s.owner_id=v_owner and sv.lifecycle_status='ACTIVE'
    and ((sv.occurred_to is null and sv.occurred_from >= p_from and sv.occurred_from < p_to)
      or (sv.occurred_to is not null and sv.occurred_from < p_to and sv.occurred_to > p_from));

  select coalesce(pg_catalog.jsonb_agg(x.payload order by x.occurred_from desc,x.session_id),'[]'::jsonb)
  into v_sessions
  from (
    select s.id session_id,sv.occurred_from,
      pg_catalog.jsonb_build_object(
        'id',s.id,'version',sv.id,
        'practice',pg_catalog.jsonb_build_object('id',p.id,'name',p.name,'lifecycle_status',p.lifecycle_status),
        'occurrence',pg_catalog.jsonb_build_object(
          'from',sv.occurred_from,'to',sv.occurred_to,
          'from_precision',sv.occurred_from_precision,'to_precision',sv.occurred_to_precision,
          'zone_id',sv.occurred_zone_id,
          'interval_semantics',case when sv.occurred_to is null then 'POINT' else '[start,end)' end),
        'duration_seconds',sv.duration_seconds,'focus',sv.focus,'recorded_at',sv.recorded_at
      ) payload
    from wf_practice.sessions s
    join wf_practice.session_versions sv
      on sv.id=s.current_version_id and sv.session_id=s.id and sv.owner_id=s.owner_id
    join wf_practice.practices p on p.id=sv.practice_id and p.owner_id=sv.owner_id
    where s.owner_id=v_owner and sv.lifecycle_status='ACTIVE'
      and ((sv.occurred_to is null and sv.occurred_from >= p_from and sv.occurred_from < p_to)
        or (sv.occurred_to is not null and sv.occurred_from < p_to and sv.occurred_to > p_from))
    order by sv.occurred_from desc,s.id
    limit p_limit
  ) x;

  v_result_completeness := case when v_total <= p_limit then 'COMPLETE' else 'PARTIAL' end;

  return pg_catalog.jsonb_build_object(
    'sessions',v_sessions,
    'returned_count',pg_catalog.jsonb_array_length(v_sessions),
    'matching_record_count',v_total,
    'result_coverage',pg_catalog.jsonb_build_object(
      'scope',pg_catalog.jsonb_build_object('from',p_from,'to',p_to,'interval_semantics','[start,end)'),
      'completeness',v_result_completeness,
      'reason',case when v_total > p_limit then 'RESULT_LIMIT' else null end
    ),
    'epistemic_coverage',pg_catalog.jsonb_build_object(
      'phenomenon','lived_practice_activity',
      'source','wayfinder_practice_session_records',
      'scope',pg_catalog.jsonb_build_object('from',p_from,'to',p_to,'interval_semantics','[start,end)'),
      'completeness','UNKNOWN',
      'reason','WAYFINDER_RECORDS_DO_NOT_ASSERT_COMPLETE_LIVED_REALITY',
      'evaluated_at',pg_catalog.clock_timestamp()
    )
  );
end;
$$;

create or replace function public.wf_evidence_for_target(
  p_target_action_id uuid,
  p_target_version_id uuid,
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
  v_target_lifecycle text;
  v_target_current boolean;
  v_total bigint;
  v_links jsonb;
  v_result_completeness text;
begin
  v_owner := wf_system.require_authenticated_owner();
  if p_target_action_id is null or p_target_version_id is null then
    raise exception using errcode='22023',message='TARGET_REF_REQUIRED';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 200 then
    raise exception using errcode='22023',message='INVALID_READ_LIMIT';
  end if;

  select v.lifecycle_status,(n.current_version_id=v.id and v.lifecycle_status='ACTIVE')
    into v_target_lifecycle,v_target_current
  from wf_direction.nodes n
  join wf_direction.node_versions v on v.node_id=n.id and v.owner_id=n.owner_id
  where n.id=p_target_action_id and n.owner_id=v_owner and n.kind='action' and v.id=p_target_version_id;
  if not found then raise exception using errcode='P0001',message='TARGET_NOT_FOUND'; end if;

  select count(*) into v_total
  from wf_evidence.links l
  where l.owner_id=v_owner and l.target_namespace='direction' and l.target_type='action'
    and l.target_record_id=p_target_action_id and l.target_version_id=p_target_version_id
    and l.lifecycle_status='ACTIVE';

  select coalesce(pg_catalog.jsonb_agg(x.payload order by x.recorded_at desc,x.link_id),'[]'::jsonb)
  into v_links
  from (
    select l.id link_id,l.recorded_at,
      pg_catalog.jsonb_build_object(
        'id',l.id,'version',l.version_id,
        'source',pg_catalog.jsonb_build_object('namespace',l.source_namespace,'type',l.source_type,'id',l.source_record_id,'version',l.source_version_id),
        'target',pg_catalog.jsonb_build_object('namespace',l.target_namespace,'type',l.target_type,'id',l.target_record_id,'version',l.target_version_id,'aspect',l.target_aspect),
        'relation',l.relation,'reason',l.reason,'recorded_at',l.recorded_at,
        'source_current',case when l.source_namespace='practice' and l.source_type='session' then exists(
          select 1 from wf_practice.sessions s join wf_practice.session_versions sv
            on sv.id=s.current_version_id and sv.session_id=s.id and sv.owner_id=s.owner_id
          where s.id=l.source_record_id and s.owner_id=l.owner_id and s.current_version_id=l.source_version_id and sv.lifecycle_status='ACTIVE'
        ) else false end,
        'target_current',v_target_current,
        'currently_usable',(v_target_current and l.source_namespace='practice' and l.source_type='session' and exists(
          select 1 from wf_practice.sessions s join wf_practice.session_versions sv
            on sv.id=s.current_version_id and sv.session_id=s.id and sv.owner_id=s.owner_id
          where s.id=l.source_record_id and s.owner_id=l.owner_id and s.current_version_id=l.source_version_id and sv.lifecycle_status='ACTIVE'
        ))
      ) payload
    from wf_evidence.links l
    where l.owner_id=v_owner and l.target_namespace='direction' and l.target_type='action'
      and l.target_record_id=p_target_action_id and l.target_version_id=p_target_version_id
      and l.lifecycle_status='ACTIVE'
    order by l.recorded_at desc,l.id
    limit p_limit
  ) x;

  v_result_completeness := case when v_total <= p_limit then 'COMPLETE' else 'PARTIAL' end;

  return pg_catalog.jsonb_build_object(
    'target',pg_catalog.jsonb_build_object('namespace','direction','type','action','id',p_target_action_id,'version',p_target_version_id,'lifecycle_status',v_target_lifecycle,'current',v_target_current),
    'links',v_links,
    'returned_count',pg_catalog.jsonb_array_length(v_links),
    'matching_record_count',v_total,
    'result_coverage',pg_catalog.jsonb_build_object(
      'completeness',v_result_completeness,
      'reason',case when v_total > p_limit then 'RESULT_LIMIT' else null end
    ),
    'epistemic_coverage',pg_catalog.jsonb_build_object(
      'phenomenon','evidence_bearing_on_action_fulfillment',
      'source','wayfinder_recorded_evidence_links',
      'completeness','UNKNOWN',
      'reason','RECORDED_LINKS_DO_NOT_ASSERT_COMPLETE_EVIDENCE_CAPTURE',
      'evaluated_at',pg_catalog.clock_timestamp()
    )
  );
end;
$$;

commit;
