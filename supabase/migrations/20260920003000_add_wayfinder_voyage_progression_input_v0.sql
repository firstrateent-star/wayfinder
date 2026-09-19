begin;

create or replace function public.wf_training_voyage_progression_input_v0(
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
  v_recent jsonb;
begin
  v_owner := wf_system.require_authenticated_owner();

  if p_as_of is null then
    raise exception using errcode = '22023', message = 'AS_OF_REQUIRED';
  end if;

  if p_recent_limit is null or p_recent_limit < 1 or p_recent_limit > 100 then
    raise exception using errcode = '22023', message = 'INVALID_RECENT_LIMIT';
  end if;

  select count(*)
    into v_count
  from wf_training.sessions s
  join wf_training.session_versions v
    on v.id = s.current_version_id
   and v.session_id = s.id
   and v.owner_id = s.owner_id
  where s.owner_id = v_owner
    and v.lifecycle_status = 'ACTIVE'
    and v.session_kind = 'STRENGTH'
    and coalesce(v.occurred_to, v.occurred_from) <= p_as_of;

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
    'provider', 'training.strength-session-encounter.v0.1',
    'as_of', p_as_of,
    'eligible_encounter_count', v_count,
    'recent_encounters', v_recent,
    'count_coverage', pg_catalog.jsonb_build_object(
      'completeness', 'COMPLETE',
      'phenomenon', 'current_active_strength_training_sessions_through_as_of'
    ),
    'epistemic_coverage', pg_catalog.jsonb_build_object(
      'completeness', 'UNKNOWN',
      'reason', 'Stored Training sessions do not establish complete coverage of all meaningful lived experience.'
    ),
    'does_not_assert', pg_catalog.jsonb_build_array(
      'that multiple sets inside one session are multiple encounters',
      'that participation proves Character growth',
      'that a canonical session cannot duplicate another separately recorded description of the same lived workout'
    )
  );
end;
$$;

revoke all on function public.wf_training_voyage_progression_input_v0(timestamptz, integer) from public, anon;
grant execute on function public.wf_training_voyage_progression_input_v0(timestamptz, integer) to authenticated;

commit;
