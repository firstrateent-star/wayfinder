begin;

-- Live-use Flower hardening:
-- 1) one user intent -> one atomic command transaction;
-- 2) exact normalized Practice-name reuse prevents accidental duplicate creation;
-- 3) Practice catalog is read directly rather than inferred from recent sessions;
-- 4) Direction node + optional SUPPORTS edge are atomic;
-- 5) Helm composes the catalog without turning it into canonical truth.

create or replace function public.wf_practice_create(
  p_command_id uuid,
  p_name text,
  p_description text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_owner uuid;
  v_name text;
  v_description text;
  v_hash text;
  v_claim record;
  v_practice uuid;
  v_ref jsonb;
  v_refs jsonb;
begin
  v_owner := wf_system.require_authenticated_owner();
  v_name := btrim(p_name);
  v_description := nullif(btrim(p_description),'');
  v_hash := wf_system.command_hash(pg_catalog.jsonb_build_object(
    'contract','practice.create.v1','name',v_name,'description',v_description
  ));
  select * into v_claim
    from wf_system.claim_command(v_owner,p_command_id,'practice','practice.create',v_hash);
  if not v_claim.is_new then return wf_system.command_response(v_owner,p_command_id,true); end if;

  if v_name is null or v_name='' then
    perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'NAME_REQUIRED');
    return wf_system.command_response(v_owner,p_command_id,false);
  end if;

  -- Serialize resolve-or-create for the same owner + exact normalized name.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_owner::text || '|' || pg_catalog.lower(v_name),0)
  );

  select p.id into v_practice
    from wf_practice.practices p
   where p.owner_id=v_owner
     and p.lifecycle_status='ACTIVE'
     and pg_catalog.lower(pg_catalog.btrim(p.name))=pg_catalog.lower(v_name)
   order by exists(
     select 1
       from wf_practice.sessions s
       join wf_practice.session_versions sv
         on sv.id=s.current_version_id and sv.session_id=s.id and sv.owner_id=s.owner_id
      where s.owner_id=v_owner and sv.practice_id=p.id and sv.lifecycle_status='ACTIVE'
   ) desc,
   p.created_at,
   p.id
   limit 1;

  if v_practice is not null then
    v_ref := pg_catalog.jsonb_build_object('namespace','practice','type','practice','id',v_practice);
    perform wf_system.complete_command(v_owner,p_command_id,'NOOP',pg_catalog.jsonb_build_array(v_ref),null);
    return wf_system.command_response(v_owner,p_command_id,false);
  end if;

  v_practice := gen_random_uuid();
  insert into wf_practice.practices(id,owner_id,name,description)
  values (v_practice,v_owner,v_name,v_description);

  v_ref := pg_catalog.jsonb_build_object('namespace','practice','type','practice','id',v_practice);
  v_refs := pg_catalog.jsonb_build_array(v_ref);
  perform wf_system.complete_command(v_owner,p_command_id,'APPLIED',v_refs,null);
  insert into wf_system.module_change_outbox(owner_id,module_id,change_type,command_id,affected)
  values (v_owner,'practice','practice.created',p_command_id,
    pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('operation','CREATED','ref',v_ref)));
  return wf_system.command_response(v_owner,p_command_id,false);
end;
$$;

create or replace function public.wf_practice_capture_session(
  p_command_id uuid,
  p_practice_id uuid default null,
  p_new_practice_name text default null,
  p_new_practice_description text default null,
  p_occurred_from timestamptz default null,
  p_occurred_to timestamptz default null,
  p_from_precision text default 'INSTANT',
  p_to_precision text default null,
  p_zone_id text default null,
  p_duration_seconds integer default null,
  p_focus text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_owner uuid;
  v_name text;
  v_description text;
  v_from_precision text;
  v_to_precision text;
  v_zone text;
  v_focus text;
  v_hash text;
  v_claim record;
  v_practice uuid;
  v_practice_created boolean := false;
  v_session uuid;
  v_version uuid;
  v_practice_ref jsonb;
  v_session_ref jsonb;
  v_refs jsonb;
begin
  v_owner := wf_system.require_authenticated_owner();
  v_name := nullif(btrim(p_new_practice_name),'');
  v_description := nullif(btrim(p_new_practice_description),'');
  v_from_precision := upper(btrim(p_from_precision));
  v_to_precision := case when p_to_precision is null then null else upper(btrim(p_to_precision)) end;
  v_zone := nullif(btrim(p_zone_id),'');
  v_focus := nullif(btrim(p_focus),'');

  v_hash := wf_system.command_hash(pg_catalog.jsonb_build_object(
    'contract','practice.capture_session.v1',
    'practice_id',p_practice_id,
    'new_practice_name',v_name,
    'new_practice_description',v_description,
    'occurred_from',p_occurred_from,
    'occurred_to',p_occurred_to,
    'from_precision',v_from_precision,
    'to_precision',v_to_precision,
    'zone_id',v_zone,
    'duration_seconds',p_duration_seconds,
    'focus',v_focus
  ));

  select * into v_claim
    from wf_system.claim_command(v_owner,p_command_id,'practice','practice.capture_session',v_hash);
  if not v_claim.is_new then return wf_system.command_response(v_owner,p_command_id,true); end if;

  -- Validate the entire session intent before creating any new Practice row.
  if (p_practice_id is null and v_name is null) then
    perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'PRACTICE_REQUIRED');
    return wf_system.command_response(v_owner,p_command_id,false);
  end if;
  if (p_practice_id is not null and v_name is not null) then
    perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'AMBIGUOUS_PRACTICE_SELECTOR');
    return wf_system.command_response(v_owner,p_command_id,false);
  end if;
  if p_occurred_from is null then
    perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'OCCURRENCE_REQUIRED');
    return wf_system.command_response(v_owner,p_command_id,false);
  end if;
  if p_occurred_to is not null and p_occurred_to<=p_occurred_from then
    perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'INVALID_OCCURRENCE_RANGE');
    return wf_system.command_response(v_owner,p_command_id,false);
  end if;
  if v_from_precision is null or v_from_precision not in ('INSTANT','MINUTE','HOUR','DAY','MONTH','YEAR')
     or (p_occurred_to is null and v_to_precision is not null)
     or (p_occurred_to is not null and (v_to_precision is null or v_to_precision not in ('INSTANT','MINUTE','HOUR','DAY','MONTH','YEAR'))) then
    perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'INVALID_TEMPORAL_PRECISION');
    return wf_system.command_response(v_owner,p_command_id,false);
  end if;
  if p_duration_seconds is not null and p_duration_seconds<=0 then
    perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'INVALID_DURATION');
    return wf_system.command_response(v_owner,p_command_id,false);
  end if;
  if p_occurred_to is not null and v_from_precision='INSTANT' and v_to_precision='INSTANT'
     and p_duration_seconds is not null
     and extract(epoch from (p_occurred_to-p_occurred_from))<>p_duration_seconds::numeric then
    perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'DURATION_INTERVAL_MISMATCH');
    return wf_system.command_response(v_owner,p_command_id,false);
  end if;
  if v_zone is not null and not exists(select 1 from pg_catalog.pg_timezone_names z where z.name=v_zone) then
    perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'INVALID_TIMEZONE');
    return wf_system.command_response(v_owner,p_command_id,false);
  end if;

  if p_practice_id is not null then
    select p.id into v_practice
      from wf_practice.practices p
     where p.id=p_practice_id and p.owner_id=v_owner and p.lifecycle_status='ACTIVE';
    if v_practice is null then
      perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'PRACTICE_NOT_FOUND');
      return wf_system.command_response(v_owner,p_command_id,false);
    end if;
  else
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(v_owner::text || '|' || pg_catalog.lower(v_name),0)
    );

    select p.id into v_practice
      from wf_practice.practices p
     where p.owner_id=v_owner
       and p.lifecycle_status='ACTIVE'
       and pg_catalog.lower(pg_catalog.btrim(p.name))=pg_catalog.lower(v_name)
     order by exists(
       select 1
         from wf_practice.sessions s
         join wf_practice.session_versions sv
           on sv.id=s.current_version_id and sv.session_id=s.id and sv.owner_id=s.owner_id
        where s.owner_id=v_owner and sv.practice_id=p.id and sv.lifecycle_status='ACTIVE'
     ) desc,
     p.created_at,
     p.id
     limit 1;

    if v_practice is null then
      v_practice := gen_random_uuid();
      insert into wf_practice.practices(id,owner_id,name,description)
      values(v_practice,v_owner,v_name,v_description);
      v_practice_created := true;
    end if;
  end if;

  v_session := gen_random_uuid();
  v_version := gen_random_uuid();
  insert into wf_practice.sessions(id,owner_id) values(v_session,v_owner);
  insert into wf_practice.session_versions(
    id,session_id,owner_id,version_no,practice_id,
    occurred_from,occurred_to,occurred_from_precision,occurred_to_precision,occurred_zone_id,
    duration_seconds,focus,lifecycle_status,provenance_source_type,actor_owner_id
  ) values(
    v_version,v_session,v_owner,1,v_practice,
    p_occurred_from,p_occurred_to,v_from_precision,v_to_precision,v_zone,
    p_duration_seconds,v_focus,'ACTIVE','USER_ENTRY',v_owner
  );
  update wf_practice.sessions set current_version_id=v_version where id=v_session and owner_id=v_owner;

  v_practice_ref := pg_catalog.jsonb_build_object('namespace','practice','type','practice','id',v_practice);
  v_session_ref := pg_catalog.jsonb_build_object('namespace','practice','type','session','id',v_session,'version',v_version);
  v_refs := pg_catalog.jsonb_build_array(v_practice_ref,v_session_ref);

  perform wf_system.complete_command(v_owner,p_command_id,'APPLIED',v_refs,null);

  if v_practice_created then
    insert into wf_system.module_change_outbox(owner_id,module_id,change_type,command_id,affected)
    values(v_owner,'practice','practice.created',p_command_id,
      pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('operation','CREATED','ref',v_practice_ref)));
  end if;
  insert into wf_system.module_change_outbox(owner_id,module_id,change_type,command_id,affected)
  values(v_owner,'practice','practice.session.created',p_command_id,
    pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('operation','CREATED','ref',v_session_ref)));

  return wf_system.command_response(v_owner,p_command_id,false);
end;
$$;

create or replace function public.wf_direction_capture_node(
  p_command_id uuid,
  p_kind text,
  p_title text,
  p_description text default null,
  p_intent_state text default 'ACTIVE',
  p_supports_target_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_owner uuid;
  v_kind text;
  v_title text;
  v_description text;
  v_intent text;
  v_hash text;
  v_claim record;
  v_target_kind text;
  v_target_intent text;
  v_node uuid;
  v_version uuid;
  v_edge uuid;
  v_edge_version uuid;
  v_node_ref jsonb;
  v_edge_ref jsonb;
  v_refs jsonb;
begin
  v_owner := wf_system.require_authenticated_owner();
  v_kind := lower(btrim(p_kind));
  v_title := btrim(p_title);
  v_description := nullif(btrim(p_description),'');
  v_intent := upper(btrim(p_intent_state));

  v_hash := wf_system.command_hash(pg_catalog.jsonb_build_object(
    'contract','direction.capture_node.v1',
    'kind',v_kind,
    'title',v_title,
    'description',v_description,
    'intent_state',v_intent,
    'supports_target_id',p_supports_target_id
  ));
  select * into v_claim
    from wf_system.claim_command(v_owner,p_command_id,'direction','direction.capture_node',v_hash);
  if not v_claim.is_new then return wf_system.command_response(v_owner,p_command_id,true); end if;

  if v_kind is null or v_kind not in ('value','direction','outcome','commitment','quest','plan','action') then
    perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'INVALID_KIND');
    return wf_system.command_response(v_owner,p_command_id,false);
  end if;
  if v_title is null or v_title='' then
    perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'TITLE_REQUIRED');
    return wf_system.command_response(v_owner,p_command_id,false);
  end if;
  if v_intent is null or v_intent not in ('ACTIVE','PAUSED','WITHDRAWN') then
    perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'INVALID_INTENT_STATE');
    return wf_system.command_response(v_owner,p_command_id,false);
  end if;

  if p_supports_target_id is not null then
    if v_kind<>'action' then
      perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'SUPPORTS_TARGET_REQUIRES_ACTION');
      return wf_system.command_response(v_owner,p_command_id,false);
    end if;
    select n.kind,v.intent_state into v_target_kind,v_target_intent
      from wf_direction.nodes n
      join wf_direction.node_versions v
        on v.id=n.current_version_id and v.node_id=n.id and v.owner_id=n.owner_id
     where n.id=p_supports_target_id and n.owner_id=v_owner and v.lifecycle_status='ACTIVE';
    if v_target_kind is null or v_target_kind not in ('direction','outcome','quest') or v_target_intent<>'ACTIVE' then
      perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'INVALID_SUPPORTS_TARGET');
      return wf_system.command_response(v_owner,p_command_id,false);
    end if;
  end if;

  v_node := gen_random_uuid();
  v_version := gen_random_uuid();
  insert into wf_direction.nodes(id,owner_id,kind) values(v_node,v_owner,v_kind);
  insert into wf_direction.node_versions(
    id,node_id,owner_id,version_no,title,description,intent_state,lifecycle_status,
    provenance_source_type,actor_owner_id
  ) values(
    v_version,v_node,v_owner,1,v_title,v_description,v_intent,'ACTIVE','USER_ENTRY',v_owner
  );
  update wf_direction.nodes set current_version_id=v_version where id=v_node and owner_id=v_owner;

  v_node_ref := pg_catalog.jsonb_build_object('namespace','direction','type',v_kind,'id',v_node,'version',v_version);
  v_refs := pg_catalog.jsonb_build_array(v_node_ref);

  if p_supports_target_id is not null then
    v_edge := gen_random_uuid();
    v_edge_version := gen_random_uuid();
    insert into wf_direction.edges(
      id,version_id,owner_id,from_node_id,to_node_id,relation,
      provenance_source_type,actor_owner_id
    ) values(
      v_edge,v_edge_version,v_owner,v_node,p_supports_target_id,'SUPPORTS','USER_ENTRY',v_owner
    );
    v_edge_ref := pg_catalog.jsonb_build_object('namespace','direction','type','edge','id',v_edge,'version',v_edge_version);
    v_refs := v_refs || pg_catalog.jsonb_build_array(v_edge_ref);
  end if;

  perform wf_system.complete_command(v_owner,p_command_id,'APPLIED',v_refs,null);
  insert into wf_system.module_change_outbox(owner_id,module_id,change_type,command_id,affected)
  values(v_owner,'direction','direction.node.created',p_command_id,
    pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('operation','CREATED','ref',v_node_ref)));

  if v_edge_ref is not null then
    insert into wf_system.module_change_outbox(owner_id,module_id,change_type,command_id,affected)
    values(v_owner,'direction','direction.edge.created',p_command_id,
      pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('operation','CREATED','ref',v_edge_ref)));
  end if;

  return wf_system.command_response(v_owner,p_command_id,false);
end;
$$;

create or replace function public.wf_practice_catalog_v0()
returns jsonb
language plpgsql
security definer
stable
set search_path = pg_catalog
as $$
declare
  v_owner uuid;
  v_practices jsonb;
  v_duplicate_groups bigint;
begin
  v_owner := wf_system.require_authenticated_owner();

  with base as (
    select p.id,p.name,p.description,p.lifecycle_status,p.created_at,
      pg_catalog.lower(pg_catalog.btrim(p.name)) as normalized_name,
      coalesce(sc.active_session_count,0) as active_session_count
    from wf_practice.practices p
    left join lateral (
      select count(*) as active_session_count
      from wf_practice.sessions s
      join wf_practice.session_versions sv
        on sv.id=s.current_version_id and sv.session_id=s.id and sv.owner_id=s.owner_id
      where s.owner_id=v_owner and sv.practice_id=p.id and sv.lifecycle_status='ACTIVE'
    ) sc on true
    where p.owner_id=v_owner and p.lifecycle_status='ACTIVE'
  ), ranked as (
    select b.*,
      count(*) over(partition by normalized_name) as same_name_active_count,
      row_number() over(
        partition by normalized_name
        order by (active_session_count>0) desc,created_at,id
      ) as name_rank
    from base b
  )
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'id',id,
    'name',name,
    'description',description,
    'lifecycle_status',lifecycle_status,
    'created_at',created_at,
    'active_session_count',active_session_count,
    'same_name_active_count',same_name_active_count,
    'capture_preferred',(name_rank=1)
  ) order by pg_catalog.lower(name),created_at,id),'[]'::jsonb)
  into v_practices
  from ranked;

  select count(*) into v_duplicate_groups
  from (
    select pg_catalog.lower(pg_catalog.btrim(p.name))
    from wf_practice.practices p
    where p.owner_id=v_owner and p.lifecycle_status='ACTIVE'
    group by pg_catalog.lower(pg_catalog.btrim(p.name))
    having count(*)>1
  ) d;

  return pg_catalog.jsonb_build_object(
    'practices',v_practices,
    'active_record_count',pg_catalog.jsonb_array_length(v_practices),
    'duplicate_active_name_group_count',v_duplicate_groups,
    'record_coverage',pg_catalog.jsonb_build_object(
      'phenomenon','active_wayfinder_practice_records',
      'completeness','COMPLETE',
      'evaluated_at',pg_catalog.clock_timestamp()
    ),
    'epistemic_coverage',pg_catalog.jsonb_build_object(
      'phenomenon','practices_in_lived_reality',
      'source','wayfinder_practice_records',
      'completeness','UNKNOWN',
      'reason','WAYFINDER_DOES_NOT_ASSERT_COMPLETE_CAPTURE_OF_ALL_LIVED_PRACTICES'
    )
  );
end;
$$;

create or replace function public.wf_helm_v0(
  p_from timestamptz,
  p_to timestamptz,
  p_session_limit integer default 10
)
returns jsonb
language plpgsql
security definer
stable
set search_path = pg_catalog
as $$
begin
  perform wf_system.require_authenticated_owner();
  return pg_catalog.jsonb_build_object(
    'projection_type','helm',
    'rule_version','helm_v0.2',
    'computed_at',pg_catalog.clock_timestamp(),
    'scope',pg_catalog.jsonb_build_object('from',p_from,'to',p_to,'interval_semantics','[start,end)'),
    'direction',public.wf_direction_current(),
    'bearing',public.wf_bearing_v0(),
    'practice_catalog',public.wf_practice_catalog_v0(),
    'practice',public.wf_practice_recent(p_from,p_to,p_session_limit),
    'composition_note','Helm composes current reads; it is not canonical life history and does not flatten component coverage.'
  );
end;
$$;

revoke all on function public.wf_practice_capture_session(uuid,uuid,text,text,timestamptz,timestamptz,text,text,text,integer,text) from public,anon;
revoke all on function public.wf_direction_capture_node(uuid,text,text,text,text,uuid) from public,anon;
revoke all on function public.wf_practice_catalog_v0() from public,anon;

grant execute on function public.wf_practice_capture_session(uuid,uuid,text,text,timestamptz,timestamptz,text,text,text,integer,text) to authenticated;
grant execute on function public.wf_direction_capture_node(uuid,text,text,text,text,uuid) to authenticated;
grant execute on function public.wf_practice_catalog_v0() to authenticated;

comment on function public.wf_practice_capture_session(uuid,uuid,text,text,timestamptz,timestamptz,text,text,text,integer,text) is
  'Atomic Practice capture boundary: resolve/create Practice and record one PracticeSession in the same command transaction.';
comment on function public.wf_direction_capture_node(uuid,text,text,text,text,uuid) is
  'Atomic Direction capture boundary: create one Direction node and optional Action SUPPORTS edge in the same command transaction.';
comment on function public.wf_practice_catalog_v0() is
  'Complete read of stored active Practice records; does not assert complete capture of lived practices.';

notify pgrst, 'reload schema';
commit;