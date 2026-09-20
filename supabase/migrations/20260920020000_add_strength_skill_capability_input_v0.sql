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
  v_frontiers jsonb;
begin
  v_owner := wf_system.require_authenticated_owner();

  if p_as_of is null then
    raise exception using errcode = '22023', message = 'AS_OF_REQUIRED';
  end if;

  if p_recent_limit is null or p_recent_limit < 1 or p_recent_limit > 100 then
    raise exception using errcode = '22023', message = 'INVALID_RECENT_LIMIT';
  end if;

  with observations as (
    select
      s.id as session_id,
      sv.id as session_version_id,
      sv.occurred_from,
      es.id as set_id,
      pg_catalog.btrim(es.exercise_key) as exercise_key,
      pg_catalog.btrim(es.exercise_label) as exercise_label,
      es.reps,
      es.load_value,
      es.load_unit,
      es.rpe,
      case
        when es.load_unit = 'KG'
          then pg_catalog.round(es.load_value / 0.5) * 0.5
        when es.load_unit = 'LB'
          then pg_catalog.round((es.load_value * 0.45359237) / 0.5) * 0.5
      end as normalized_load_kg
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
      and coalesce(sv.occurred_to, sv.occurred_from) <= p_as_of
      and es.exercise_key is not null
      and pg_catalog.btrim(es.exercise_key) <> ''
      and es.exercise_label is not null
      and pg_catalog.btrim(es.exercise_label) <> ''
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
  from observations;

  with observations as (
    select
      s.id as session_id,
      sv.id as session_version_id,
      sv.occurred_from,
      es.id as set_id,
      pg_catalog.btrim(es.exercise_key) as exercise_key,
      pg_catalog.btrim(es.exercise_label) as exercise_label,
      es.reps,
      es.load_value,
      es.load_unit,
      es.rpe,
      case
        when es.load_unit = 'KG'
          then pg_catalog.round(es.load_value / 0.5) * 0.5
        when es.load_unit = 'LB'
          then pg_catalog.round((es.load_value * 0.45359237) / 0.5) * 0.5
      end as normalized_load_kg
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
      and coalesce(sv.occurred_to, sv.occurred_from) <= p_as_of
      and es.exercise_key is not null
      and pg_catalog.btrim(es.exercise_key) <> ''
      and es.exercise_label is not null
      and pg_catalog.btrim(es.exercise_label) <> ''
      and es.reps is not null
      and es.reps > 0
      and es.load_value is not null
      and es.load_value > 0
      and es.load_unit in ('LB','KG')
  ),
  ranked as (
    select
      o.*,
      pg_catalog.count(*) over (
        partition by o.exercise_key, o.normalized_load_kg, o.reps
      ) as matching_observation_count,
      pg_catalog.row_number() over (
        partition by o.exercise_key, o.normalized_load_kg, o.reps
        order by o.occurred_from desc, o.session_id, o.set_id
      ) as pair_rank
    from observations o
  ),
  representatives as (
    select *
    from ranked
    where pair_rank = 1
  ),
  frontier as (
    select r.*
    from representatives r
    where not exists (
      select 1
      from representatives stronger
      where stronger.exercise_key = r.exercise_key
        and stronger.normalized_load_kg >= r.normalized_load_kg
        and stronger.reps >= r.reps
        and (
          stronger.normalized_load_kg > r.normalized_load_kg
          or stronger.reps > r.reps
        )
    )
  ),
  grouped as (
    select
      exercise_key,
      (pg_catalog.array_agg(
        exercise_label
        order by occurred_from desc, session_id, set_id
      ))[1] as exercise_label,
      pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'reps', reps,
          'load_value', load_value,
          'load_unit', load_unit,
          'normalized_load_kg', normalized_load_kg,
          'rpe', rpe,
          'occurred_at', occurred_from,
          'session_id', session_id,
          'session_version', session_version_id,
          'set_id', set_id,
          'matching_observation_count', matching_observation_count
        )
        order by normalized_load_kg desc, reps desc, occurred_from desc, session_id, set_id
      ) as points
    from frontier
    group by exercise_key
  )
  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'exercise_key', exercise_key,
        'exercise_label', exercise_label,
        'points', points
      )
      order by exercise_key
    ),
    '[]'::jsonb
  )
  into v_frontiers
  from grouped;

  select coalesce(
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
        'exercise_key', pg_catalog.btrim(es.exercise_key),
        'exercise_label', pg_catalog.btrim(es.exercise_label),
        'reps', es.reps,
        'load_value', es.load_value,
        'load_unit', es.load_unit,
        'normalized_load_kg',
          case
            when es.load_unit = 'KG'
              then pg_catalog.round(es.load_value / 0.5) * 0.5
            when es.load_unit = 'LB'
              then pg_catalog.round((es.load_value * 0.45359237) / 0.5) * 0.5
          end,
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
      and coalesce(sv.occurred_to, sv.occurred_from) <= p_as_of
      and es.exercise_key is not null
      and pg_catalog.btrim(es.exercise_key) <> ''
      and es.exercise_label is not null
      and pg_catalog.btrim(es.exercise_label) <> ''
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
    'performance_model', 'LOAD_REPS_PARETO_FRONTIER',
    'load_normalization', pg_catalog.jsonb_build_object(
      'canonical_unit', 'KG',
      'quantum_kg', 0.5,
      'kg_per_lb', 0.45359237
    ),
    'demonstrated_observation_count', v_observation_count,
    'demonstrated_session_count', v_session_count,
    'demonstrated_exercise_count', v_exercise_count,
    'first_demonstrated_at', v_first,
    'last_demonstrated_at', v_last,
    'exercise_frontiers', v_frontiers,
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
      'that performances across different exercises are directly comparable',
      'that a one-repetition maximum was measured or estimated',
      'that capability evidence establishes growth'
    )
  );
end;
$$;

revoke all on function public.wf_training_strength_skill_capability_input_v0(timestamptz, integer) from public, anon;
grant execute on function public.wf_training_strength_skill_capability_input_v0(timestamptz, integer) to authenticated;

commit;
