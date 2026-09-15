begin;

create or replace function public.wf_journey_v0(
  p_from timestamptz,
  p_to timestamptz,
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
  v_items jsonb;
  v_result_completeness text;
begin
  v_owner := wf_system.require_authenticated_owner();

  if p_from is null or p_to is null or p_to <= p_from then
    raise exception using errcode='22023', message='INVALID_JOURNEY_RANGE';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 200 then
    raise exception using errcode='22023', message='INVALID_JOURNEY_LIMIT';
  end if;

  with journey_items as (
    -- Currently asserted lived PracticeSessions appear once, anchored to occurrence.
    -- Historical versions are not emitted as additional lived events; correction
    -- transitions are represented separately below.
    select
      'practice-session:' || s.id::text || ':' || sv.id::text as item_key,
      'PRACTICE_SESSION'::text as kind,
      'REALITY'::text as layer,
      sv.occurred_from as timeline_at,
      'OCCURRED'::text as time_basis,
      pg_catalog.jsonb_build_object(
        'primary_ref', pg_catalog.jsonb_build_object(
          'namespace','practice','type','session','id',s.id,'version',sv.id
        ),
        'practice', pg_catalog.jsonb_build_object(
          'id',p.id,'name',p.name,'lifecycle_status',p.lifecycle_status
        ),
        'focus',sv.focus,
        'duration_seconds',sv.duration_seconds,
        'occurrence',pg_catalog.jsonb_build_object(
          'from',sv.occurred_from,
          'to',sv.occurred_to,
          'from_precision',sv.occurred_from_precision,
          'to_precision',sv.occurred_to_precision,
          'zone_id',sv.occurred_zone_id,
          'interval_semantics',case when sv.occurred_to is null then 'POINT' else '[start,end)' end
        ),
        'recorded_at',sv.recorded_at
      ) as payload
    from wf_practice.sessions s
    join wf_practice.session_versions sv
      on sv.id=s.current_version_id and sv.session_id=s.id and sv.owner_id=s.owner_id
    join wf_practice.practices p
      on p.id=sv.practice_id and p.owner_id=sv.owner_id
    where s.owner_id=v_owner
      and sv.lifecycle_status='ACTIVE'
      and sv.occurred_from >= p_from and sv.occurred_from < p_to

    union all

    -- A Direction node is an intention record, not a lived event. Journey anchors
    -- its creation to record time and keeps the exact first version in lineage.
    select
      'direction-recorded:' || n.id::text || ':' || firstv.id::text,
      'DIRECTION_RECORDED',
      'DIRECTION',
      firstv.recorded_at,
      'RECORDED',
      pg_catalog.jsonb_build_object(
        'primary_ref',pg_catalog.jsonb_build_object(
          'namespace','direction','type',n.kind,'id',n.id,'version',firstv.id
        ),
        'node',pg_catalog.jsonb_build_object(
          'id',n.id,
          'version',firstv.id,
          'kind',n.kind,
          'title',firstv.title,
          'description',firstv.description,
          'intent_state_at_recording',firstv.intent_state,
          'lifecycle_status_of_recorded_version',firstv.lifecycle_status
        ),
        'current_state',case when currentv.id is null then null else pg_catalog.jsonb_build_object(
          'version',currentv.id,
          'title',currentv.title,
          'intent_state',currentv.intent_state,
          'lifecycle_status',currentv.lifecycle_status
        ) end
      )
    from wf_direction.nodes n
    join wf_direction.node_versions firstv
      on firstv.node_id=n.id and firstv.owner_id=n.owner_id and firstv.version_no=1
    left join wf_direction.node_versions currentv
      on currentv.id=n.current_version_id and currentv.node_id=n.id and currentv.owner_id=n.owner_id
    where n.owner_id=v_owner
      and firstv.recorded_at >= p_from and firstv.recorded_at < p_to

    union all

    -- Direction relationships are semantic artifacts between logical Direction
    -- identities. Display titles come from first versions rather than silently
    -- substituting a future rewritten title.
    select
      'direction-relation:' || e.id::text || ':' || e.version_id::text,
      'DIRECTION_RELATION_RECORDED',
      'DIRECTION',
      e.recorded_at,
      'RECORDED',
      pg_catalog.jsonb_build_object(
        'primary_ref',pg_catalog.jsonb_build_object(
          'namespace','direction','type','edge','id',e.id,'version',e.version_id
        ),
        'relation',e.relation,
        'lifecycle_status',e.lifecycle_status,
        'from',pg_catalog.jsonb_build_object(
          'namespace','direction','type',fn.kind,'id',fn.id,'title',fv.title
        ),
        'to',pg_catalog.jsonb_build_object(
          'namespace','direction','type',tn.kind,'id',tn.id,'title',tv.title
        )
      )
    from wf_direction.edges e
    join wf_direction.nodes fn on fn.id=e.from_node_id and fn.owner_id=e.owner_id
    join wf_direction.node_versions fv on fv.node_id=fn.id and fv.owner_id=fn.owner_id and fv.version_no=1
    join wf_direction.nodes tn on tn.id=e.to_node_id and tn.owner_id=e.owner_id
    join wf_direction.node_versions tv on tv.node_id=tn.id and tv.owner_id=tn.owner_id and tv.version_no=1
    where e.owner_id=v_owner
      and e.recorded_at >= p_from and e.recorded_at < p_to

    union all

    -- Evidence is shown as the exact historical relationship that was recorded.
    -- Whether source/target versions are still current is computed, not rewritten.
    select
      'evidence-recorded:' || l.id::text || ':' || l.version_id::text,
      'EVIDENCE_RECORDED',
      'EVIDENCE',
      l.recorded_at,
      'RECORDED',
      pg_catalog.jsonb_build_object(
        'primary_ref',pg_catalog.jsonb_build_object(
          'namespace','evidence','type','link','id',l.id,'version',l.version_id
        ),
        'relation',l.relation,
        'target_aspect',l.target_aspect,
        'reason',l.reason,
        'lifecycle_status',l.lifecycle_status,
        'source',pg_catalog.jsonb_build_object(
          'ref',pg_catalog.jsonb_build_object(
            'namespace','practice','type','session','id',l.source_record_id,'version',l.source_version_id
          ),
          'practice',pg_catalog.jsonb_build_object('id',sp.id,'name',sp.name),
          'focus',ssv.focus,
          'duration_seconds',ssv.duration_seconds,
          'is_current',exists(
            select 1 from wf_practice.sessions cs
            where cs.id=l.source_record_id and cs.owner_id=l.owner_id and cs.current_version_id=l.source_version_id
          )
        ),
        'target',pg_catalog.jsonb_build_object(
          'ref',pg_catalog.jsonb_build_object(
            'namespace','direction','type','action','id',l.target_record_id,'version',l.target_version_id
          ),
          'title',tnv.title,
          'is_current',exists(
            select 1 from wf_direction.nodes cn
            where cn.id=l.target_record_id and cn.owner_id=l.owner_id and cn.current_version_id=l.target_version_id
          )
        )
      )
    from wf_evidence.links l
    join wf_practice.session_versions ssv
      on ssv.id=l.source_version_id and ssv.session_id=l.source_record_id and ssv.owner_id=l.owner_id
    join wf_practice.practices sp
      on sp.id=ssv.practice_id and sp.owner_id=ssv.owner_id
    join wf_direction.node_versions tnv
      on tnv.id=l.target_version_id and tnv.node_id=l.target_record_id and tnv.owner_id=l.owner_id
    join wf_direction.nodes tn
      on tn.id=tnv.node_id and tn.owner_id=tnv.owner_id and tn.kind='action'
    where l.owner_id=v_owner
      and l.source_namespace='practice' and l.source_type='session'
      and l.target_namespace='direction' and l.target_type='action'
      and l.target_aspect='fulfillment'
      and l.recorded_at >= p_from and l.recorded_at < p_to

    union all

    -- A correction is a change to Wayfinder's record, not a second lived session.
    -- It is therefore anchored to the new version's recorded_at.
    select
      'practice-correction:' || newv.session_id::text || ':' || newv.id::text,
      'PRACTICE_SESSION_CORRECTED',
      'CORRECTION',
      newv.recorded_at,
      'RECORDED',
      pg_catalog.jsonb_build_object(
        'primary_ref',pg_catalog.jsonb_build_object(
          'namespace','practice','type','session','id',newv.session_id,'version',newv.id
        ),
        'previous_ref',pg_catalog.jsonb_build_object(
          'namespace','practice','type','session','id',prev.session_id,'version',prev.id
        ),
        'changed_fields',pg_catalog.to_jsonb(pg_catalog.array_remove(array[
          case when prev.practice_id is distinct from newv.practice_id then 'practice' end,
          case when prev.occurred_from is distinct from newv.occurred_from or prev.occurred_to is distinct from newv.occurred_to then 'occurrence' end,
          case when prev.duration_seconds is distinct from newv.duration_seconds then 'duration' end,
          case when prev.focus is distinct from newv.focus then 'focus' end,
          case when prev.occurred_zone_id is distinct from newv.occurred_zone_id then 'timezone' end
        ],null)),
        'before',pg_catalog.jsonb_build_object(
          'practice',pg_catalog.jsonb_build_object('id',pp.id,'name',pp.name),
          'focus',prev.focus,
          'duration_seconds',prev.duration_seconds,
          'occurred_from',prev.occurred_from,
          'occurred_to',prev.occurred_to,
          'version_no',prev.version_no
        ),
        'after',pg_catalog.jsonb_build_object(
          'practice',pg_catalog.jsonb_build_object('id',np.id,'name',np.name),
          'focus',newv.focus,
          'duration_seconds',newv.duration_seconds,
          'occurred_from',newv.occurred_from,
          'occurred_to',newv.occurred_to,
          'version_no',newv.version_no
        )
      )
    from wf_practice.session_versions newv
    join wf_practice.session_versions prev
      on prev.superseded_by_version_id=newv.id
     and prev.session_id=newv.session_id and prev.owner_id=newv.owner_id
    join wf_practice.practices pp on pp.id=prev.practice_id and pp.owner_id=prev.owner_id
    join wf_practice.practices np on np.id=newv.practice_id and np.owner_id=newv.owner_id
    where newv.owner_id=v_owner
      and newv.version_no > 1
      and newv.recorded_at >= p_from and newv.recorded_at < p_to
  ), ranked as (
    select ji.*, count(*) over () as total_count
    from journey_items ji
  ), limited as (
    select * from ranked
    order by timeline_at desc, item_key desc
    limit p_limit
  )
  select
    coalesce(max(total_count),0),
    coalesce(pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'item_key',item_key,
        'kind',kind,
        'layer',layer,
        'timeline_at',timeline_at,
        'time_basis',time_basis,
        'payload',payload
      ) order by timeline_at desc,item_key desc
    ),'[]'::jsonb)
  into v_total,v_items
  from limited;

  v_result_completeness := case when v_total <= p_limit then 'COMPLETE' else 'PARTIAL' end;

  return pg_catalog.jsonb_build_object(
    'projection_type','journey',
    'rule_version','journey_v0.1',
    'computed_at',pg_catalog.clock_timestamp(),
    'scope',pg_catalog.jsonb_build_object(
      'from',p_from,
      'to',p_to,
      'interval_semantics','[start,end)',
      'timeline_rule','Each item is scoped by its own timeline_at. Lived PracticeSession items use occurred_from; intention/evidence/correction items use recorded_at.'
    ),
    'items',v_items,
    'returned_count',pg_catalog.jsonb_array_length(v_items),
    'matching_item_count',v_total,
    'result_coverage',pg_catalog.jsonb_build_object(
      'completeness',v_result_completeness,
      'reason',case when v_total > p_limit then 'RESULT_LIMIT' else null end
    ),
    'epistemic_coverage',pg_catalog.jsonb_build_object(
      'phenomenon','person_life_and_change_over_time',
      'source','selected_wayfinder_direction_practice_evidence_and_correction_records',
      'completeness','UNKNOWN',
      'reason','JOURNEY_IS_A_PROJECTION_OF_SELECTED_WAYFINDER_RECORDS_NOT_A_COMPLETE_RECORD_OF_LIVED_REALITY'
    ),
    'included_kinds',pg_catalog.jsonb_build_array(
      'PRACTICE_SESSION','DIRECTION_RECORDED','DIRECTION_RELATION_RECORDED','EVIDENCE_RECORDED','PRACTICE_SESSION_CORRECTED'
    ),
    'does_not_assert',pg_catalog.jsonb_build_array(
      'complete_life_history','complete_capture_of_all_lived_events','causal_explanation','personal_growth_score','chronological_equivalence_of_occurred_time_and_recorded_time'
    )
  );
end;
$$;

revoke all on function public.wf_journey_v0(timestamptz,timestamptz,integer) from public, anon;
grant execute on function public.wf_journey_v0(timestamptz,timestamptz,integer) to authenticated;

comment on function public.wf_journey_v0(timestamptz,timestamptz,integer) is
  'Derived Journey v0.1 timeline. Mixes lived occurrence-time items with record-time intention/evidence/correction items while preserving explicit time_basis and lineage. Not canonical history or complete lived reality.';

commit;