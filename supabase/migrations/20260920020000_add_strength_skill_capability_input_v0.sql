begin;

create or replace function public.wf_training_strength_skill_capability_input_v0(
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
  v_observation_count bigint;
  v_session_count bigint;
  v_exercise_count bigint;
  v_first timestamptz;
  v_last timestamptz;
  v_recent jsonb;
begin
  v_owner := wf_system.require_authenticated_owner();

  if p_as_of is null then
    raise exception using errcode = '22023', message = 'AS_OF_REQUIRED';
  end if;

  if p_recent_limit is null or p_recent_limit < 1 or p_recent_limit > 100 then
    raise exception using errcode = '22023', message = 'INVALID_RECENT_LIMIT';
  end if;

  with demonstrations as (
    select
      s.id as session_id,
      sv.id as session_version_id,
      sv.occurred_from,
      es.id as set_id,
      es.exercise_key,
      es.exercise_label,
      es.reps,
      es.load_value,
      es.load_unit,
      es.rpe
    from wf_training.sessions s
    join wf_training.session_versions sv
      on sv.id = s.current_version_id
     and sv.session_id = s.id
     and sv.owner_id = s.owner_id
    join wf_training.exercise_sets es
      on es.session_id = s.id
     and es.session_version_id = sv.id
     and es.owner_id = s.owner_id
    where s.owner_id = v_owner
      and sv.lifecycle_status = 'ACTIVE'
      and sv.session_kind = 'STRENGTH'
      and pg_catalog.coalesce(sv.occurred_to, sv.occurred_from) <= p_as_of
      and es.reps is not null
      and es.reps > 0
      and es.load_value is not null
      and es.load_value > 0
      and es.load_unit in ('LB','KG')
  )
  select
    pg_catalog.count(*),
    pg_catalog.count(distinct session_id),
    pg_catalog.count(distinct exercise_key),
    pg_catalog.min(occurred_from),
    pg_catalog.max(occurred_from)
  into
    v_observation_count,
    v_session_count,
    v_exercise_count,
    v_first,
    v_last
  from demonstrations;

  select pg_catalog.coalesce(
    pg_catalog.jsonb_agg(x.payload order by x.occurred_from desc, x.session_id, x.set_id),
    '[]'::jsonb
  )
  into v_recent
  from (
    select
      s.id as session_id,
      sv.occurred_from,
      es.id as set_id,
      pg_catalog.jsonb_build_object(
        'session_id', s.id,
        'session_version', sv.id,
        'set_id', es.id,
        'exercise_key', es.exercise_key,
        'exercise_label', es.exercise_label,
        'reps', es.reps,
        'load_value', es.load_value,
        'load_unit', es.load_unit,
        'rpe', es.rpe,
        'occurred_at', sv.occurred_from
      ) as payload
    from wf_training.sessions s
    join wf_training.session_versions sv
      on sv.id = s.current_version_id
     and sv.session_id = s.id
     and sv.owner_id = s.owner_id
    join wf_training.exercise_sets es
      on es.session_id = s.id
     and es.session_version_id = sv.id
     and es.owner_id = s.owner_id
    where s.owner_id = v_owner
      and sv.lifecycle_status = 'ACTIVE'
      and sv.session_kind = 'STRENGTH'
      and pg_catalog.coalesce(sv.occurred_to, sv.occurred_from) <= p_as_of
      and es.reps is not null
      and es.reps > 0
      and es.load_value is not null
      and es.load_value > 0
      and es.load_unit in ('LB','KG')
    order by sv.occurred_from desc, s.id, es.set_index
    limit p_recent_limit
  ) x;

  return pg_catalog.jsonb_build_object(
    'provider', 'training.strength-skill-capability-provider.v0.1',
    'skill_key', 'physical.strength_training',
    'skill_label', 'Strength Training',
    'as_of', p_as_of,
    'demonstrated_observation_count', v_observation_count,
    'demonstrated_session_count', v_session_count,
    'demonstrated_exercise_count', v_exercise_count,
    'first_demonstrated_at', v_first,
    'last_demonstrated_at', v_last,
    'recent_demonstrations', v_recent,
    'result_coverage', pg_catalog.jsonb_build_object(
      'completeness', 'COMPLETE',
      'phenomenon', 'current_canonical_loaded_repetition_demonstrations_through_as_of'
    ),
    'epistemic_coverage', pg_catalog.jsonb_build_object(
      'completeness', 'UNKNOWN',
      'reason', 'Stored loaded-repetition observations do not establish complete human capability.'
    ),
    'does_not_assert', pg_catalog.jsonb_build_array(
      'that loaded-repetition evidence is a complete measure of Strength Training capability',
      'that missing loaded-repetition evidence means zero ability',
      'that observation count establishes mastery',
      'that one exercise establishes whole-body strength',
      'that capability evidence establishes growth'
    )
  );
end;
$$;

revoke all on function public.wf_training_strength_skill_capability_input_v0(timestamptz, integer) from public, anon;
grant execute on function public.wf_training_strength_skill_capability_input_v0(timestamptz, integer) to authenticated;

commit;
