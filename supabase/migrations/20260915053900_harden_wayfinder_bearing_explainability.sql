begin;

create or replace function public.wf_bearing_v0()
returns jsonb
language plpgsql
security definer
stable
set search_path = pg_catalog
as $$
declare
  v_owner uuid;
  v_actions jsonb;
  v_active_count bigint;
  v_evidenced_count bigint;
  v_stale_only_count bigint;
  v_state text;
begin
  v_owner := wf_system.require_authenticated_owner();

  with active_actions as (
    select n.id action_id,n.current_version_id version_id,v.title,v.intent_state
    from wf_direction.nodes n
    join wf_direction.node_versions v
      on v.id=n.current_version_id and v.node_id=n.id and v.owner_id=n.owner_id
    where n.owner_id=v_owner and n.kind='action'
      and v.lifecycle_status='ACTIVE' and v.intent_state='ACTIVE'
  ), evidence_stats as (
    select a.*,
      coalesce(es.current_count,0) current_count,
      coalesce(es.stale_count,0) stale_count,
      coalesce(es.qualifying_lineage,'[]'::jsonb) qualifying_lineage
    from active_actions a
    left join lateral (
      select
        count(*) filter(where q.source_current) current_count,
        count(*) filter(where not q.source_current) stale_count,
        coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'evidence_link',pg_catalog.jsonb_build_object('namespace','evidence','type','link','id',q.link_id,'version',q.link_version),
          'source',pg_catalog.jsonb_build_object('namespace','practice','type','session','id',q.source_record_id,'version',q.source_version_id)
        ) order by q.recorded_at) filter(where q.source_current),'[]'::jsonb) qualifying_lineage
      from (
        select l.id link_id,l.version_id link_version,l.source_record_id,l.source_version_id,l.recorded_at,
          exists(
            select 1 from wf_practice.sessions s
            join wf_practice.session_versions sv
              on sv.id=s.current_version_id and sv.session_id=s.id and sv.owner_id=s.owner_id
            where s.id=l.source_record_id and s.owner_id=l.owner_id
              and s.current_version_id=l.source_version_id and sv.lifecycle_status='ACTIVE'
          ) source_current
        from wf_evidence.links l
        where l.owner_id=v_owner
          and l.target_namespace='direction' and l.target_type='action'
          and l.target_record_id=a.action_id and l.target_version_id=a.version_id
          and l.target_aspect='fulfillment' and l.relation='SUPPORTS'
          and l.lifecycle_status='ACTIVE'
          and l.source_namespace='practice' and l.source_type='session'
      ) q
    ) es on true
  ), enriched as (
    select e.*,
      case when e.current_count>0 then 'CURRENT_EVIDENCE_PRESENT'
           when e.stale_count>0 then 'STALE_RECORDED_EVIDENCE_ONLY'
           else 'NO_RECORDED_EVIDENCE' end evidence_state,
      coalesce((
        select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'id',tn.id,'version',tv.id,'kind',tn.kind,'title',tv.title,'intent_state',tv.intent_state
        ) order by tv.recorded_at,tn.id)
        from wf_direction.edges de
        join wf_direction.nodes tn on tn.id=de.to_node_id and tn.owner_id=de.owner_id
        join wf_direction.node_versions tv
          on tv.id=tn.current_version_id and tv.node_id=tn.id and tv.owner_id=tn.owner_id
        where de.owner_id=v_owner and de.from_node_id=e.action_id and de.relation='SUPPORTS'
          and de.lifecycle_status='ACTIVE' and tv.lifecycle_status='ACTIVE' and tv.intent_state='ACTIVE'
      ),'[]'::jsonb) supports_targets
    from evidence_stats e
  )
  select count(*),
    count(*) filter(where current_count>0),
    count(*) filter(where current_count=0 and stale_count>0),
    coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'id',action_id,
      'version',version_id,
      'title',title,
      'intent_state',intent_state,
      'evidence_state',evidence_state,
      'current_qualifying_evidence_count',current_count,
      'stale_recorded_evidence_count',stale_count,
      'qualifying_lineage',qualifying_lineage,
      'supports_targets',supports_targets
    ) order by title,action_id),'[]'::jsonb)
  into v_active_count,v_evidenced_count,v_stale_only_count,v_actions
  from enriched;

  v_state := case
    when v_active_count=0 then 'NO_ACTIVE_ACTIONS'
    when v_evidenced_count>0 then 'RECORDED_EVIDENCE_OF_MOVEMENT'
    else 'NO_RECORDED_EVIDENCE_OF_MOVEMENT'
  end;

  return pg_catalog.jsonb_build_object(
    'projection_type','bearing',
    'rule_version','bearing_v0.2',
    'computed_at',pg_catalog.clock_timestamp(),
    'state',v_state,
    'active_action_count',v_active_count,
    'evidenced_active_action_count',v_evidenced_count,
    'stale_evidence_only_action_count',v_stale_only_count,
    'actions',v_actions,
    'epistemic_coverage',pg_catalog.jsonb_build_object(
      'phenomenon','movement_toward_current_intentions_in_lived_reality',
      'source','wayfinder_current_actions_and_recorded_fulfillment_evidence',
      'completeness','UNKNOWN',
      'reason','WAYFINDER_DOES_NOT_ASSERT_COMPLETE_CAPTURE_OF_ACTION_OR_MOVEMENT'
    ),
    'does_not_assert',pg_catalog.jsonb_build_array(
      'percentage_of_goal_progress','no_movement_if_no_evidence','outcome_achievement'
    )
  );
end;
$$;

commit;
