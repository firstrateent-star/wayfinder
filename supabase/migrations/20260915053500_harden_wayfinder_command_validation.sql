begin;

-- Command envelope must carry a retry identity before a receipt can exist.
create or replace function wf_system.claim_command(
  p_owner_id uuid,
  p_command_id uuid,
  p_module_id text,
  p_command_type text,
  p_request_hash text
)
returns table (
  is_new boolean,
  status text,
  affected_refs jsonb,
  error_code text
)
language plpgsql
set search_path = pg_catalog
as $$
declare
  v_rows integer;
  v_existing record;
begin
  if p_command_id is null then
    raise exception using errcode = '22023', message = 'COMMAND_ID_REQUIRED';
  end if;

  insert into wf_system.command_receipts (
    command_id, owner_id, module_id, command_type, request_hash, requested_at, status
  ) values (
    p_command_id, p_owner_id, p_module_id, p_command_type, p_request_hash,
    pg_catalog.clock_timestamp(), 'PROCESSING'
  )
  on conflict (command_id) do nothing;

  get diagnostics v_rows = row_count;

  if v_rows = 1 then
    is_new := true;
    status := 'PROCESSING';
    affected_refs := null;
    error_code := null;
    return next;
    return;
  end if;

  select r.owner_id, r.module_id, r.command_type, r.request_hash,
         r.status, r.affected_refs, r.error_code
    into v_existing
    from wf_system.command_receipts r
   where r.command_id = p_command_id
   for update;

  if v_existing.owner_id is distinct from p_owner_id
     or v_existing.module_id is distinct from p_module_id
     or v_existing.command_type is distinct from p_command_type
     or v_existing.request_hash is distinct from p_request_hash then
    raise exception using errcode = '23505', message = 'COMMAND_ID_CONFLICT';
  end if;

  if v_existing.status = 'PROCESSING' then
    raise exception using errcode = '55000', message = 'COMMAND_IN_PROGRESS';
  end if;

  is_new := false;
  status := v_existing.status;
  affected_refs := v_existing.affected_refs;
  error_code := v_existing.error_code;
  return next;
end;
$$;

create or replace function public.wf_practice_log_session(
  p_command_id uuid,
  p_practice_id uuid,
  p_occurred_from timestamptz,
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
  v_from_precision text;
  v_to_precision text;
  v_zone text;
  v_focus text;
  v_hash text;
  v_claim record;
  v_session uuid;
  v_version uuid;
  v_ref jsonb;
  v_refs jsonb;
begin
  v_owner := wf_system.require_authenticated_owner();
  v_from_precision := upper(btrim(p_from_precision));
  v_to_precision := case when p_to_precision is null then null else upper(btrim(p_to_precision)) end;
  v_zone := nullif(btrim(p_zone_id),'');
  v_focus := nullif(btrim(p_focus),'');

  v_hash := wf_system.command_hash(pg_catalog.jsonb_build_object(
    'contract','practice.log_session.v1',
    'practice_id',p_practice_id,
    'occurred_from',p_occurred_from,
    'occurred_to',p_occurred_to,
    'from_precision',v_from_precision,
    'to_precision',v_to_precision,
    'zone_id',v_zone,
    'duration_seconds',p_duration_seconds,
    'focus',v_focus
  ));
  select * into v_claim
    from wf_system.claim_command(v_owner,p_command_id,'practice','practice.log_session',v_hash);
  if not v_claim.is_new then return wf_system.command_response(v_owner,p_command_id,true); end if;

  if p_practice_id is null or not exists (
    select 1 from wf_practice.practices p
     where p.id=p_practice_id and p.owner_id=v_owner and p.lifecycle_status='ACTIVE'
  ) then
    perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'PRACTICE_NOT_FOUND');
    return wf_system.command_response(v_owner,p_command_id,false);
  end if;
  if p_occurred_from is null then
    perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'OCCURRENCE_REQUIRED');
    return wf_system.command_response(v_owner,p_command_id,false);
  end if;
  if p_occurred_to is not null and p_occurred_to <= p_occurred_from then
    perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'INVALID_OCCURRENCE_RANGE');
    return wf_system.command_response(v_owner,p_command_id,false);
  end if;
  if v_from_precision is null
     or v_from_precision not in ('INSTANT','MINUTE','HOUR','DAY','MONTH','YEAR')
     or (p_occurred_to is null and v_to_precision is not null)
     or (p_occurred_to is not null and (v_to_precision is null or v_to_precision not in ('INSTANT','MINUTE','HOUR','DAY','MONTH','YEAR'))) then
    perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'INVALID_TEMPORAL_PRECISION');
    return wf_system.command_response(v_owner,p_command_id,false);
  end if;
  if p_duration_seconds is not null and p_duration_seconds <= 0 then
    perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'INVALID_DURATION');
    return wf_system.command_response(v_owner,p_command_id,false);
  end if;
  if p_occurred_to is not null
     and v_from_precision = 'INSTANT'
     and v_to_precision = 'INSTANT'
     and p_duration_seconds is not null
     and extract(epoch from (p_occurred_to - p_occurred_from)) <> p_duration_seconds::numeric then
    perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'DURATION_INTERVAL_MISMATCH');
    return wf_system.command_response(v_owner,p_command_id,false);
  end if;
  if v_zone is not null and not exists (select 1 from pg_catalog.pg_timezone_names z where z.name=v_zone) then
    perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'INVALID_TIMEZONE');
    return wf_system.command_response(v_owner,p_command_id,false);
  end if;

  v_session := gen_random_uuid();
  v_version := gen_random_uuid();
  insert into wf_practice.sessions(id,owner_id) values (v_session,v_owner);
  insert into wf_practice.session_versions(
    id,session_id,owner_id,version_no,practice_id,
    occurred_from,occurred_to,occurred_from_precision,occurred_to_precision,occurred_zone_id,
    duration_seconds,focus,lifecycle_status,provenance_source_type,actor_owner_id
  ) values (
    v_version,v_session,v_owner,1,p_practice_id,
    p_occurred_from,p_occurred_to,v_from_precision,v_to_precision,v_zone,
    p_duration_seconds,v_focus,'ACTIVE','USER_ENTRY',v_owner
  );
  update wf_practice.sessions set current_version_id=v_version where id=v_session and owner_id=v_owner;

  v_ref := pg_catalog.jsonb_build_object('namespace','practice','type','session','id',v_session,'version',v_version);
  v_refs := pg_catalog.jsonb_build_array(v_ref);
  perform wf_system.complete_command(v_owner,p_command_id,'APPLIED',v_refs,null);
  insert into wf_system.module_change_outbox(owner_id,module_id,change_type,command_id,affected)
  values (v_owner,'practice','practice.session.created',p_command_id,
    pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('operation','CREATED','ref',v_ref)));
  return wf_system.command_response(v_owner,p_command_id,false);
end;
$$;

create or replace function public.wf_practice_correct_session(
  p_command_id uuid,
  p_session_id uuid,
  p_expected_version_id uuid,
  p_practice_id uuid,
  p_occurred_from timestamptz,
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
  v_from_precision text;
  v_to_precision text;
  v_zone text;
  v_focus text;
  v_hash text;
  v_claim record;
  v_current uuid;
  v_old_no bigint;
  v_old_status text;
  v_new uuid;
  v_old_ref jsonb;
  v_new_ref jsonb;
  v_refs jsonb;
begin
  v_owner := wf_system.require_authenticated_owner();
  v_from_precision := upper(btrim(p_from_precision));
  v_to_precision := case when p_to_precision is null then null else upper(btrim(p_to_precision)) end;
  v_zone := nullif(btrim(p_zone_id),'');
  v_focus := nullif(btrim(p_focus),'');
  v_hash := wf_system.command_hash(pg_catalog.jsonb_build_object(
    'contract','practice.correct_session.v1',
    'session_id',p_session_id,
    'expected_version_id',p_expected_version_id,
    'practice_id',p_practice_id,
    'occurred_from',p_occurred_from,
    'occurred_to',p_occurred_to,
    'from_precision',v_from_precision,
    'to_precision',v_to_precision,
    'zone_id',v_zone,
    'duration_seconds',p_duration_seconds,
    'focus',v_focus
  ));
  select * into v_claim
    from wf_system.claim_command(v_owner,p_command_id,'practice','practice.correct_session',v_hash);
  if not v_claim.is_new then return wf_system.command_response(v_owner,p_command_id,true); end if;

  select s.current_version_id into v_current
    from wf_practice.sessions s
   where s.id=p_session_id and s.owner_id=v_owner
   for update;
  if not found then
    perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'SESSION_NOT_FOUND');
    return wf_system.command_response(v_owner,p_command_id,false);
  end if;
  if v_current is distinct from p_expected_version_id then
    perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'STALE_VERSION');
    return wf_system.command_response(v_owner,p_command_id,false);
  end if;

  select v.version_no,v.lifecycle_status into v_old_no,v_old_status
    from wf_practice.session_versions v
   where v.id=v_current and v.session_id=p_session_id and v.owner_id=v_owner;
  if v_old_status <> 'ACTIVE' then
    perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'SESSION_NOT_ACTIVE');
    return wf_system.command_response(v_owner,p_command_id,false);
  end if;

  if p_practice_id is null or not exists (
    select 1 from wf_practice.practices p where p.id=p_practice_id and p.owner_id=v_owner and p.lifecycle_status='ACTIVE'
  ) then
    perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'PRACTICE_NOT_FOUND');
    return wf_system.command_response(v_owner,p_command_id,false);
  end if;
  if p_occurred_from is null or (p_occurred_to is not null and p_occurred_to <= p_occurred_from) then
    perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'INVALID_OCCURRENCE_RANGE');
    return wf_system.command_response(v_owner,p_command_id,false);
  end if;
  if v_from_precision is null
     or v_from_precision not in ('INSTANT','MINUTE','HOUR','DAY','MONTH','YEAR')
     or (p_occurred_to is null and v_to_precision is not null)
     or (p_occurred_to is not null and (v_to_precision is null or v_to_precision not in ('INSTANT','MINUTE','HOUR','DAY','MONTH','YEAR'))) then
    perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'INVALID_TEMPORAL_PRECISION');
    return wf_system.command_response(v_owner,p_command_id,false);
  end if;
  if p_duration_seconds is not null and p_duration_seconds <= 0 then
    perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'INVALID_DURATION');
    return wf_system.command_response(v_owner,p_command_id,false);
  end if;
  if p_occurred_to is not null
     and v_from_precision = 'INSTANT'
     and v_to_precision = 'INSTANT'
     and p_duration_seconds is not null
     and extract(epoch from (p_occurred_to - p_occurred_from)) <> p_duration_seconds::numeric then
    perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'DURATION_INTERVAL_MISMATCH');
    return wf_system.command_response(v_owner,p_command_id,false);
  end if;
  if v_zone is not null and not exists (select 1 from pg_catalog.pg_timezone_names z where z.name=v_zone) then
    perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'INVALID_TIMEZONE');
    return wf_system.command_response(v_owner,p_command_id,false);
  end if;

  v_new := gen_random_uuid();
  update wf_practice.session_versions
     set lifecycle_status='SUPERSEDED', superseded_by_version_id=v_new
   where id=v_current and session_id=p_session_id and owner_id=v_owner;

  insert into wf_practice.session_versions(
    id,session_id,owner_id,version_no,practice_id,
    occurred_from,occurred_to,occurred_from_precision,occurred_to_precision,occurred_zone_id,
    duration_seconds,focus,lifecycle_status,provenance_source_type,actor_owner_id
  ) values (
    v_new,p_session_id,v_owner,v_old_no+1,p_practice_id,
    p_occurred_from,p_occurred_to,v_from_precision,v_to_precision,v_zone,
    p_duration_seconds,v_focus,'ACTIVE','USER_ENTRY',v_owner
  );
  update wf_practice.sessions set current_version_id=v_new where id=p_session_id and owner_id=v_owner;

  v_old_ref := pg_catalog.jsonb_build_object('namespace','practice','type','session','id',p_session_id,'version',v_current);
  v_new_ref := pg_catalog.jsonb_build_object('namespace','practice','type','session','id',p_session_id,'version',v_new);
  v_refs := pg_catalog.jsonb_build_array(v_old_ref,v_new_ref);
  perform wf_system.complete_command(v_owner,p_command_id,'APPLIED',v_refs,null);
  insert into wf_system.module_change_outbox(owner_id,module_id,change_type,command_id,affected)
  values (v_owner,'practice','practice.session.corrected',p_command_id,
    pg_catalog.jsonb_build_array(
      pg_catalog.jsonb_build_object('operation','SUPERSEDED','ref',v_old_ref),
      pg_catalog.jsonb_build_object('operation','CREATED','ref',v_new_ref)
    ));
  return wf_system.command_response(v_owner,p_command_id,false);
end;
$$;

revoke all on function wf_system.claim_command(uuid, uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.wf_practice_log_session(uuid,uuid,timestamptz,timestamptz,text,text,text,integer,text) from public, anon;
revoke all on function public.wf_practice_correct_session(uuid,uuid,uuid,uuid,timestamptz,timestamptz,text,text,text,integer,text) from public, anon;
grant execute on function public.wf_practice_log_session(uuid,uuid,timestamptz,timestamptz,text,text,text,integer,text) to authenticated;
grant execute on function public.wf_practice_correct_session(uuid,uuid,uuid,uuid,timestamptz,timestamptz,text,text,text,integer,text) to authenticated;

commit;
