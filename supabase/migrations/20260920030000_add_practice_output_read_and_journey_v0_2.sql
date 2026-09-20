begin;

create or replace function public.wf_practice_outputs_v0(
  p_as_of timestamptz default pg_catalog.clock_timestamp(),
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
  v_outputs jsonb;
begin
  v_owner := wf_system.require_authenticated_owner();

  if p_as_of is null then
    raise exception using errcode='22023', message='AS_OF_REQUIRED';
  end if;

  if p_limit is null or p_limit < 1 or p_limit > 200 then
    raise exception using errcode='22023', message='INVALID_OUTPUT_LIMIT';
  end if;

  with current_outputs as (
    select
      o.id as output_id,
      ov.id as output_version_id,
      ov.version_no,
      ov.output_kind,
      ov.title,
      ov.external_url,
      ov.lifecycle_status as output_lifecycle_status,
      ov.recorded_at,
      ov.practice_id as recorded_practice_id,
      op.name as recorded_practice_name,
      op.lifecycle_status as recorded_practice_lifecycle_status,
      ov.source_session_id,
      ov.source_session_version_id as captured_source_session_version_id,
      s.current_version_id as current_source_session_version_id,
      csv.lifecycle_status as current_source_session_lifecycle_status,
      csv.practice_id as current_source_practice_id,
      cp.name as current_source_practice_name,
      cp.lifecycle_status as current_source_practice_lifecycle_status,
      csv.occurred_from as current_source_occurred_from,
      csv.occurred_to as current_source_occurred_to,
      csv.focus as current_source_focus,
      case
        when ov.lifecycle_status='RETRACTED' then 'OUTPUT_RETRACTED'
        when s.id is null or s.current_version_id is null or csv.id is null then 'SOURCE_SESSION_UNRESOLVED'
        when csv.lifecycle_status<>'ACTIVE' then 'SOURCE_SESSION_NOT_ACTIVE'
        when cp.id is null or cp.lifecycle_status<>'ACTIVE' then 'SOURCE_PRACTICE_NOT_ACTIVE'
        when coalesce(csv.occurred_to,csv.occurred_from)>p_as_of then 'SOURCE_OCCURRENCE_AFTER_AS_OF'
        when csv.practice_id is distinct from ov.practice_id then 'PRACTICE_MISMATCH'
        when op.lifecycle_status<>'ACTIVE' then 'RECORDED_PRACTICE_NOT_ACTIVE'
        when s.current_version_id is distinct from ov.source_session_version_id then 'SOURCE_VERSION_ADVANCED'
        else 'CURRENT'
      end as alignment_state,
      (
        ov.lifecycle_status='ACTIVE'
        and csv.lifecycle_status='ACTIVE'
        and op.lifecycle_status='ACTIVE'
        and csv.practice_id=ov.practice_id
        and coalesce(csv.occurred_to,csv.occurred_from)<=p_as_of
      ) as capability_eligible,
      (
        ov.lifecycle_status='ACTIVE'
        and csv.lifecycle_status='ACTIVE'
        and cp.lifecycle_status='ACTIVE'
        and csv.practice_id is distinct from ov.practice_id
        and coalesce(csv.occurred_to,csv.occurred_from)<=p_as_of
      ) as can_rebase,
      (
        ov.lifecycle_status='ACTIVE'
        and csv.lifecycle_status='ACTIVE'
        and cp.lifecycle_status='ACTIVE'
      ) as can_correct
    from wf_practice.outputs o
    join wf_practice.output_versions ov
      on ov.id=o.current_version_id
     and ov.output_id=o.id
     and ov.owner_id=o.owner_id
    join wf_practice.practices op
      on op.id=ov.practice_id
     and op.owner_id=ov.owner_id
    left join wf_practice.sessions s
      on s.id=ov.source_session_id
     and s.owner_id=ov.owner_id
    left join wf_practice.session_versions csv
      on csv.id=s.current_version_id
     and csv.session_id=s.id
     and csv.owner_id=s.owner_id
    left join wf_practice.practices cp
      on cp.id=csv.practice_id
     and cp.owner_id=csv.owner_id
    where o.owner_id=v_owner
  ),
  ranked as (
    select x.*, pg_catalog.count(*) over () as total_count
    from current_outputs x
  ),
  limited as (
    select *
    from ranked
    order by recorded_at desc, output_id
    limit p_limit
  )
  select
    coalesce(pg_catalog.max(total_count),0),
    coalesce(
      pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'id',output_id,
          'version',output_version_id,
          'version_no',version_no,
          'output_kind',output_kind,
          'title',title,
          'external_url',external_url,
          'lifecycle_status',output_lifecycle_status,
          'recorded_at',recorded_at,
          'recorded_practice',pg_catalog.jsonb_build_object(
            'id',recorded_practice_id,
            'name',recorded_practice_name,
            'lifecycle_status',recorded_practice_lifecycle_status
          ),
          'source_session',pg_catalog.jsonb_build_object(
            'id',source_session_id,
            'captured_version',captured_source_session_version_id,
            'current_version',current_source_session_version_id,
            'current_lifecycle_status',current_source_session_lifecycle_status,
            'current_practice',case
              when current_source_practice_id is null then null
              else pg_catalog.jsonb_build_object(
                'id',current_source_practice_id,
                'name',current_source_practice_name,
                'lifecycle_status',current_source_practice_lifecycle_status
              )
            end,
            'current_occurrence',case
              when current_source_occurred_from is null then null
              else pg_catalog.jsonb_build_object(
                'from',current_source_occurred_from,
                'to',current_source_occurred_to,
                'interval_semantics',case
                  when current_source_occurred_to is null then 'POINT'
                  else '[start,end)'
                end
              )
            end,
            'current_focus',current_source_focus
          ),
          'alignment_state',alignment_state,
          'source_version_is_current',
            current_source_session_version_id is not distinct from captured_source_session_version_id,
          'capability_eligible',capability_eligible,
          'needs_attention',
            output_lifecycle_status='ACTIVE' and not capability_eligible,
          'can_rebase',can_rebase,
          'can_correct',can_correct
        )
        order by recorded_at desc, output_id
      ),
      '[]'::jsonb
    )
  into v_total,v_outputs
  from limited;

  return pg_catalog.jsonb_build_object(
    'outputs',v_outputs,
    'returned_count',pg_catalog.jsonb_array_length(v_outputs),
    'matching_record_count',v_total,
    'result_coverage',pg_catalog.jsonb_build_object(
      'phenomenon','current_wayfinder_practice_outputs',
      'completeness',case when v_total<=p_limit then 'COMPLETE' else 'PARTIAL' end,
      'reason',case when v_total>p_limit then 'RESULT_LIMIT' else null end,
      'evaluated_at',p_as_of
    ),
    'epistemic_coverage',pg_catalog.jsonb_build_object(
      'phenomenon','completed_outputs_in_lived_reality',
      'source','wayfinder_practice_output_records',
      'completeness','UNKNOWN',
      'reason','UNRECORDED_OUTPUTS_MAY_EXIST'
    ),
    'does_not_assert',pg_catalog.jsonb_build_array(
      'that every completed output is recorded',
      'creative quality',
      'Mastery',
      'Skill Level',
      'that an ineligible output never happened'
    )
  );
end;
$$;

revoke all on function public.wf_practice_outputs_v0(timestamptz,integer)
  from public,anon;
grant execute on function public.wf_practice_outputs_v0(timestamptz,integer)
  to authenticated;

create or replace function public.wf_journey_v1(
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
  v_base jsonb;
  v_base_total bigint;
  v_output_total bigint;
  v_total bigint;
  v_items jsonb;
begin
  v_owner := wf_system.require_authenticated_owner();

  if p_from is null or p_to is null or p_to<=p_from then
    raise exception using errcode='22023',message='INVALID_JOURNEY_RANGE';
  end if;
  if p_limit is null or p_limit<1 or p_limit>200 then
    raise exception using errcode='22023',message='INVALID_JOURNEY_LIMIT';
  end if;

  -- The existing v0 projection can safely supply its top 200 legacy items because
  -- the public Journey limit is also capped at 200. Any legacy item that could
  -- enter the final top-N is therefore present in this base set.
  v_base := public.wf_journey_v0(p_from,p_to,200);
  v_base_total := coalesce((v_base->>'matching_item_count')::bigint,0);

  select pg_catalog.count(*)
    into v_output_total
  from (
    select firstv.recorded_at as timeline_at
      from wf_practice.outputs o
      join wf_practice.output_versions firstv
        on firstv.output_id=o.id
       and firstv.owner_id=o.owner_id
       and firstv.version_no=1
     where o.owner_id=v_owner
       and firstv.recorded_at>=p_from
       and firstv.recorded_at<p_to

    union all

    select newv.recorded_at
      from wf_practice.output_versions newv
      join wf_practice.output_versions prev
        on prev.superseded_by_version_id=newv.id
       and prev.output_id=newv.output_id
       and prev.owner_id=newv.owner_id
     where newv.owner_id=v_owner
       and newv.version_no>1
       and newv.recorded_at>=p_from
       and newv.recorded_at<p_to
  ) output_timeline;

  v_total := v_base_total + v_output_total;

  with base_items as (
    select
      item->>'item_key' as item_key,
      item->>'kind' as kind,
      item->>'layer' as layer,
      (item->>'timeline_at')::timestamptz as timeline_at,
      item->>'time_basis' as time_basis,
      item->'payload' as payload
    from pg_catalog.jsonb_array_elements(coalesce(v_base->'items','[]'::jsonb)) item
  ),
  output_items as (
    -- Recording an Output is canonical result evidence, but v0.1 does not claim
    -- an independent completion instant. Journey therefore anchors it to record
    -- time and carries source-session occurrence separately in lineage.
    select
      'practice-output-recorded:' || o.id::text || ':' || firstv.id::text as item_key,
      'PRACTICE_OUTPUT_RECORDED'::text as kind,
      'RESULT'::text as layer,
      firstv.recorded_at as timeline_at,
      'RECORDED'::text as time_basis,
      pg_catalog.jsonb_build_object(
        'primary_ref',pg_catalog.jsonb_build_object(
          'namespace','practice','type','output','id',o.id,'version',firstv.id
        ),
        'output',pg_catalog.jsonb_build_object(
          'kind',firstv.output_kind,
          'title',firstv.title,
          'external_url',firstv.external_url,
          'practice',pg_catalog.jsonb_build_object(
            'id',fp.id,'name',fp.name
          ),
          'lifecycle_status_of_recorded_version',firstv.lifecycle_status,
          'recorded_at',firstv.recorded_at
        ),
        'source_session',pg_catalog.jsonb_build_object(
          'ref',pg_catalog.jsonb_build_object(
            'namespace','practice','type','session',
            'id',firstv.source_session_id,
            'version',firstv.source_session_version_id
          ),
          'occurred_from',fsv.occurred_from,
          'occurred_to',fsv.occurred_to,
          'focus',fsv.focus,
          'is_exact_version_current',
            fs.current_version_id is not distinct from firstv.source_session_version_id
        ),
        'current_state',case
          when currentv.id is null then null
          else pg_catalog.jsonb_build_object(
            'version',currentv.id,
            'title',currentv.title,
            'external_url',currentv.external_url,
            'lifecycle_status',currentv.lifecycle_status,
            'practice',pg_catalog.jsonb_build_object(
              'id',cp.id,'name',cp.name
            ),
            'source_session_version',currentv.source_session_version_id,
            'source_session_current_version',cs.current_version_id,
            'source_session_current_practice',case
              when csp.id is null then null
              else pg_catalog.jsonb_build_object('id',csp.id,'name',csp.name)
            end
          )
        end
      ) as payload
    from wf_practice.outputs o
    join wf_practice.output_versions firstv
      on firstv.output_id=o.id
     and firstv.owner_id=o.owner_id
     and firstv.version_no=1
    join wf_practice.practices fp
      on fp.id=firstv.practice_id
     and fp.owner_id=firstv.owner_id
    join wf_practice.sessions fs
      on fs.id=firstv.source_session_id
     and fs.owner_id=firstv.owner_id
    join wf_practice.session_versions fsv
      on fsv.id=firstv.source_session_version_id
     and fsv.session_id=firstv.source_session_id
     and fsv.owner_id=firstv.owner_id
    left join wf_practice.output_versions currentv
      on currentv.id=o.current_version_id
     and currentv.output_id=o.id
     and currentv.owner_id=o.owner_id
    left join wf_practice.practices cp
      on cp.id=currentv.practice_id
     and cp.owner_id=currentv.owner_id
    left join wf_practice.sessions cs
      on cs.id=currentv.source_session_id
     and cs.owner_id=currentv.owner_id
    left join wf_practice.session_versions csv
      on csv.id=cs.current_version_id
     and csv.session_id=cs.id
     and csv.owner_id=cs.owner_id
    left join wf_practice.practices csp
      on csp.id=csv.practice_id
     and csp.owner_id=csv.owner_id
    where o.owner_id=v_owner
      and firstv.recorded_at>=p_from
      and firstv.recorded_at<p_to

    union all

    -- Output correction is a change to the record, not a second completed work.
    select
      'practice-output-correction:' || newv.output_id::text || ':' || newv.id::text,
      'PRACTICE_OUTPUT_CORRECTED',
      'CORRECTION',
      newv.recorded_at,
      'RECORDED',
      pg_catalog.jsonb_build_object(
        'primary_ref',pg_catalog.jsonb_build_object(
          'namespace','practice','type','output',
          'id',newv.output_id,'version',newv.id
        ),
        'previous_ref',pg_catalog.jsonb_build_object(
          'namespace','practice','type','output',
          'id',prev.output_id,'version',prev.id
        ),
        'changed_fields',pg_catalog.to_jsonb(pg_catalog.array_remove(array[
          case when prev.title is distinct from newv.title then 'title' end,
          case when prev.external_url is distinct from newv.external_url then 'external_url' end,
          case when prev.practice_id is distinct from newv.practice_id then 'practice' end,
          case when prev.source_session_id is distinct from newv.source_session_id then 'source_session' end,
          case when prev.source_session_version_id is distinct from newv.source_session_version_id then 'source_session_version' end
        ],null)),
        'before',pg_catalog.jsonb_build_object(
          'title',prev.title,
          'external_url',prev.external_url,
          'practice',pg_catalog.jsonb_build_object('id',pp.id,'name',pp.name),
          'source_session',pg_catalog.jsonb_build_object(
            'id',prev.source_session_id,
            'version',prev.source_session_version_id
          ),
          'version_no',prev.version_no
        ),
        'after',pg_catalog.jsonb_build_object(
          'title',newv.title,
          'external_url',newv.external_url,
          'practice',pg_catalog.jsonb_build_object('id',np.id,'name',np.name),
          'source_session',pg_catalog.jsonb_build_object(
            'id',newv.source_session_id,
            'version',newv.source_session_version_id
          ),
          'version_no',newv.version_no
        )
      )
    from wf_practice.output_versions newv
    join wf_practice.output_versions prev
      on prev.superseded_by_version_id=newv.id
     and prev.output_id=newv.output_id
     and prev.owner_id=newv.owner_id
    join wf_practice.practices pp
      on pp.id=prev.practice_id
     and pp.owner_id=prev.owner_id
    join wf_practice.practices np
      on np.id=newv.practice_id
     and np.owner_id=newv.owner_id
    where newv.owner_id=v_owner
      and newv.version_no>1
      and newv.recorded_at>=p_from
      and newv.recorded_at<p_to
  ),
  combined as (
    select * from base_items
    union all
    select * from output_items
  ),
  limited as (
    select *
    from combined
    order by timeline_at desc,item_key desc
    limit p_limit
  )
  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'item_key',item_key,
        'kind',kind,
        'layer',layer,
        'timeline_at',timeline_at,
        'time_basis',time_basis,
        'payload',payload
      )
      order by timeline_at desc,item_key desc
    ),
    '[]'::jsonb
  )
  into v_items
  from limited;

  return pg_catalog.jsonb_build_object(
    'projection_type','journey',
    'rule_version','journey_v0.2',
    'computed_at',pg_catalog.clock_timestamp(),
    'scope',pg_catalog.jsonb_build_object(
      'from',p_from,
      'to',p_to,
      'interval_semantics','[start,end)',
      'timeline_rule',
        'Each item is scoped by its own timeline_at. Lived PracticeSession items use occurred_from; Direction/Evidence/Correction and PracticeOutput record items use recorded_at.'
    ),
    'items',v_items,
    'returned_count',pg_catalog.jsonb_array_length(v_items),
    'matching_item_count',v_total,
    'result_coverage',pg_catalog.jsonb_build_object(
      'completeness',case when v_total<=p_limit then 'COMPLETE' else 'PARTIAL' end,
      'reason',case when v_total>p_limit then 'RESULT_LIMIT' else null end
    ),
    'epistemic_coverage',pg_catalog.jsonb_build_object(
      'phenomenon','person_life_and_change_over_time',
      'source','selected_wayfinder_direction_practice_output_evidence_and_correction_records',
      'completeness','UNKNOWN',
      'reason','JOURNEY_IS_A_PROJECTION_OF_SELECTED_WAYFINDER_RECORDS_NOT_A_COMPLETE_RECORD_OF_LIVED_REALITY'
    ),
    'included_kinds',pg_catalog.jsonb_build_array(
      'PRACTICE_SESSION',
      'PRACTICE_OUTPUT_RECORDED',
      'DIRECTION_RECORDED',
      'DIRECTION_RELATION_RECORDED',
      'EVIDENCE_RECORDED',
      'PRACTICE_SESSION_CORRECTED',
      'PRACTICE_OUTPUT_CORRECTED'
    ),
    'does_not_assert',pg_catalog.jsonb_build_array(
      'complete_life_history',
      'complete_capture_of_all_lived_events',
      'exact_output_completion_time',
      'creative_quality',
      'causal_explanation',
      'personal_growth_score',
      'chronological_equivalence_of_occurred_time_and_recorded_time'
    )
  );
end;
$$;

revoke all on function public.wf_journey_v1(timestamptz,timestamptz,integer)
  from public,anon;
grant execute on function public.wf_journey_v1(timestamptz,timestamptz,integer)
  to authenticated;

comment on function public.wf_journey_v1(timestamptz,timestamptz,integer) is
  'Derived Journey v0.2 projection. Extends Journey v0.1 with Practice Output creation/correction while preserving explicit occurred-vs-recorded time semantics and exact lineage.';

commit;
