begin;

create or replace function public.wf_training_strength_skill_input_v0(
  p_as_of timestamptz default pg_catalog.clock_timestamp(),
  p_recent_limit integer default 25
)
returns jsonb
language plpgsql
security definer
stable
set search_path = pg_catalog
as $$
declare
  v_owner uuid;
  v_count bigint;
  v_first timestamptz;
  v_last timestamptz;
  v_cadence_samples bigint;
  v_typical_interval_seconds numeric;
  v_recent jsonb;
begin
  v_owner := wf_system.require_authenticated_owner();

  if p_as_of is null then
    raise exception using errcode = '22023', message = 'AS_OF_REQUIRED';
  end if;

  if p_recent_limit is null or p_recent_limit < 1 or p_recent_limit > 100 then
    raise exception using errcode = '22023', message = 'INVALID_RECENT_LIMIT';
  end if;

  with eligible as (
    select
      s.id as session_id,
      v.id as version_id,
      v.label,
      v.occurred_from,
      v.recorded_at
    from wf_training.sessions s
    join wf_training.session_versions v
      on v.id = s.current_version_id
     and v.session_id = s.id
     and v.owner_id = s.owner_id
    where s.owner_id = v_owner
      and v.lifecycle_status = 'ACTIVE'
      and v.session_kind = 'STRENGTH'
      and coalesce(v.occurred_to, v.occurred_from) <= p_as_of
  ),
  ordered as (
    select
      e.*,
      lag(e.occurred_from) over (order by e.occurred_from, e.session_id) as previous_occurred_from
    from eligible e
  ),
  gaps as (
    select
      extract(epoch from (occurred_from - previous_occurred_from))::numeric as gap_seconds
    from ordered
    where previous_occurred_from is not null
      and occurred_from > previous_occurred_from
  )
  select
    (select count(*) from eligible),
    (select min(occurred_from) from eligible),
    (select max(occurred_from) from eligible),
    (select count(*) from gaps),
    (select percentile_cont(0.5) within group (order by gap_seconds) from gaps)
  into
    v_count,
    v_first,
    v_last,
    v_cadence_samples,
    v_typical_interval_seconds;

  select coalesce(
    pg_catalog.jsonb_agg(x.payload order by x.occurred_from desc, x.session_id),
    '[]'::jsonb
  )
  into v_recent
  from (
    select
      s.id as session_id,
      v.occurred_from,
      pg_catalog.jsonb_build_object(
        'id', s.id,
        'version', v.id,
        'kind', v.session_kind,
        'label', v.label,
        'occurred_at', v.occurred_from,
        'recorded_at', v.recorded_at
      ) as payload
    from wf_training.sessions s
    join wf_training.session_versions v
      on v.id = s.current_version_id
     and v.session_id = s.id
     and v.owner_id = s.owner_id
    where s.owner_id = v_owner
      and v.lifecycle_status = 'ACTIVE'
      and v.session_kind = 'STRENGTH'
      and coalesce(v.occurred_to, v.occurred_from) <= p_as_of
    order by v.occurred_from desc, s.id
    limit p_recent_limit
  ) x;

  return pg_catalog.jsonb_build_object(
    'provider', 'training.strength-skill-provider.v0.1',
    'skill_key', 'physical.strength_training',
    'skill_label', 'Strength Training',
    'as_of', p_as_of,
    'eligible_encounter_count', v_count,
    'first_evidenced_at', v_first,
    'last_evidenced_at', v_last,
    'cadence_sample_count', v_cadence_samples,
    'typical_interval_seconds', v_typical_interval_seconds,
    'recent_encounters', v_recent,
    'count_coverage', pg_catalog.jsonb_build_object(
      'completeness', 'COMPLETE',
      'phenomenon', 'current_active_strength_training_sessions_through_as_of'
    ),
    'cadence_coverage', pg_catalog.jsonb_build_object(
      'completeness', 'COMPLETE',
      'phenomenon', 'positive_intervals_between_current_active_strength_training_sessions_through_as_of'
    ),
    'epistemic_coverage', pg_catalog.jsonb_build_object(
      'completeness', 'UNKNOWN',
      'reason', 'Stored Training sessions do not establish complete lived Strength Training practice coverage.'
    ),
    'does_not_assert', pg_catalog.jsonb_build_array(
      'that one Training session contributes more than one Experience unit to Strength Training',
      'that Skill Experience proves capability',
      'that Sharpness decline proves capability loss',
      'that no unrecorded Strength Training occurred'
    )
  );
end;
$$;

revoke all on function public.wf_training_strength_skill_input_v0(timestamptz, integer) from public, anon;
grant execute on function public.wf_training_strength_skill_input_v0(timestamptz, integer) to authenticated;

commit;
