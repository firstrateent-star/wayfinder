begin;

create or replace function public.wf_practice_skill_input_v0(
  p_normalized_practice_names text[],
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
  v_aliases text[];
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

  select pg_catalog.array_agg(alias order by alias)
    into v_aliases
  from (
    select distinct pg_catalog.lower(
      pg_catalog.regexp_replace(pg_catalog.btrim(value), '\s+', ' ', 'g')
    ) as alias
    from pg_catalog.unnest(p_normalized_practice_names) as u(value)
    where value is not null
      and pg_catalog.btrim(value) <> ''
  ) x
  where alias <> '';

  if v_aliases is null
     or pg_catalog.array_length(v_aliases, 1) is null
     or pg_catalog.array_length(v_aliases, 1) < 1
     or pg_catalog.array_length(v_aliases, 1) > 32 then
    raise exception using errcode = '22023', message = 'INVALID_PRACTICE_ALIAS_SET';
  end if;

  with eligible as (
    select
      s.id as session_id,
      sv.id as version_id,
      p.id as practice_id,
      p.name as practice_name,
      sv.focus,
      sv.duration_seconds,
      sv.occurred_from,
      sv.recorded_at
    from wf_practice.sessions s
    join wf_practice.session_versions sv
      on sv.id = s.current_version_id
     and sv.session_id = s.id
     and sv.owner_id = s.owner_id
    join wf_practice.practices p
      on p.id = sv.practice_id
     and p.owner_id = sv.owner_id
    where s.owner_id = v_owner
      and sv.lifecycle_status = 'ACTIVE'
      and p.lifecycle_status = 'ACTIVE'
      and pg_catalog.lower(
        pg_catalog.regexp_replace(pg_catalog.btrim(p.name), '\s+', ' ', 'g')
      ) = any(v_aliases)
      and pg_catalog.coalesce(sv.occurred_to, sv.occurred_from) <= p_as_of
  ),
  ordered as (
    select
      e.*,
      pg_catalog.lag(e.occurred_from)
        over (order by e.occurred_from, e.session_id) as previous_occurred_from
    from eligible e
  ),
  gaps as (
    select
      pg_catalog.extract(epoch from (occurred_from - previous_occurred_from))::numeric as gap_seconds
    from ordered
    where previous_occurred_from is not null
      and occurred_from > previous_occurred_from
  )
  select
    (select pg_catalog.count(*) from eligible),
    (select pg_catalog.min(occurred_from) from eligible),
    (select pg_catalog.max(occurred_from) from eligible),
    (select pg_catalog.count(*) from gaps),
    (select pg_catalog.percentile_cont(0.5) within group (order by gap_seconds) from gaps)
  into
    v_count,
    v_first,
    v_last,
    v_cadence_samples,
    v_typical_interval_seconds;

  select pg_catalog.coalesce(
    pg_catalog.jsonb_agg(x.payload order by x.occurred_from desc, x.session_id),
    '[]'::jsonb
  )
  into v_recent
  from (
    select
      s.id as session_id,
      sv.occurred_from,
      pg_catalog.jsonb_build_object(
        'id', s.id,
        'version', sv.id,
        'practice_id', p.id,
        'practice_name', p.name,
        'label', sv.focus,
        'occurred_at', sv.occurred_from,
        'recorded_at', sv.recorded_at
      ) as payload
    from wf_practice.sessions s
    join wf_practice.session_versions sv
      on sv.id = s.current_version_id
     and sv.session_id = s.id
     and sv.owner_id = s.owner_id
    join wf_practice.practices p
      on p.id = sv.practice_id
     and p.owner_id = sv.owner_id
    where s.owner_id = v_owner
      and sv.lifecycle_status = 'ACTIVE'
      and p.lifecycle_status = 'ACTIVE'
      and pg_catalog.lower(
        pg_catalog.regexp_replace(pg_catalog.btrim(p.name), '\s+', ' ', 'g')
      ) = any(v_aliases)
      and pg_catalog.coalesce(sv.occurred_to, sv.occurred_from) <= p_as_of
    order by sv.occurred_from desc, s.id
    limit p_recent_limit
  ) x;

  return pg_catalog.jsonb_build_object(
    'provider', 'practice.name-skill-provider.v0.1',
    'as_of', p_as_of,
    'normalized_practice_names', pg_catalog.to_jsonb(v_aliases),
    'eligible_encounter_count', v_count,
    'first_evidenced_at', v_first,
    'last_evidenced_at', v_last,
    'cadence_sample_count', v_cadence_samples,
    'typical_interval_seconds', v_typical_interval_seconds,
    'recent_encounters', v_recent,
    'count_coverage', pg_catalog.jsonb_build_object(
      'completeness', 'COMPLETE',
      'phenomenon', 'current_active_practice_sessions_matching_governed_aliases_through_as_of'
    ),
    'cadence_coverage', pg_catalog.jsonb_build_object(
      'completeness', 'COMPLETE',
      'phenomenon', 'positive_intervals_between_matching_current_active_practice_sessions'
    ),
    'epistemic_coverage', pg_catalog.jsonb_build_object(
      'completeness', 'UNKNOWN',
      'reason', 'Stored Practice sessions do not establish complete lived practice coverage.'
    ),
    'does_not_assert', pg_catalog.jsonb_build_array(
      'that matched Practice records are the same canonical Practice identity',
      'that semantic similarity outside the supplied governed aliases is accepted',
      'that Skill Experience proves capability or mastery',
      'that no unrecorded practice occurred'
    )
  );
end;
$$;

revoke all on function public.wf_practice_skill_input_v0(text[], timestamptz, integer) from public, anon;
grant execute on function public.wf_practice_skill_input_v0(text[], timestamptz, integer) to authenticated;

commit;
