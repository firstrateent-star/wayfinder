begin;

-- Harden receipt response so a private helper can never resolve another owner's
-- command merely from a guessed command id.
drop function if exists wf_system.command_response(uuid, boolean);
create or replace function wf_system.command_response(
  p_owner_id uuid,
  p_command_id uuid,
  p_replayed boolean
)
returns jsonb
language sql
stable
set search_path = pg_catalog
as $$
  select pg_catalog.jsonb_build_object(
    'command_id', r.command_id,
    'status', r.status,
    'affected_refs', coalesce(r.affected_refs, '[]'::jsonb),
    'error_code', r.error_code,
    'replayed', p_replayed
  )
  from wf_system.command_receipts r
  where r.command_id = p_command_id
    and r.owner_id = p_owner_id;
$$;
revoke all on function wf_system.command_response(uuid, uuid, boolean) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- DIRECTION: create node
-- ---------------------------------------------------------------------------

create or replace function public.wf_direction_create_node(
  p_command_id uuid,
  p_kind text,
  p_title text,
  p_description text default null,
  p_intent_state text default 'ACTIVE'
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
  v_node uuid;
  v_version uuid;
  v_ref jsonb;
  v_refs jsonb;
begin
  v_owner := wf_system.require_authenticated_owner();
  v_kind := lower(btrim(p_kind));
  v_title := btrim(p_title);
  v_description := nullif(btrim(p_description), '');
  v_intent := upper(btrim(p_intent_state));

  v_hash := wf_system.command_hash(pg_catalog.jsonb_build_object(
    'contract','direction.create_node.v1',
    'kind',v_kind,
    'title',v_title,
    'description',v_description,
    'intent_state',v_intent
  ));

  select * into v_claim
    from wf_system.claim_command(v_owner, p_command_id, 'direction', 'direction.create_node', v_hash);
  if not v_claim.is_new then
    return wf_system.command_response(v_owner, p_command_id, true);
  end if;

  if v_kind is null or v_kind not in ('value','direction','outcome','commitment','quest','plan','action') then
    perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'INVALID_KIND');
    return wf_system.command_response(v_owner,p_command_id,false);
  end if;
  if v_title is null or v_title = '' then
    perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'TITLE_REQUIRED');
    return wf_system.command_response(v_owner,p_command_id,false);
  end if;
  if v_intent is null or v_intent not in ('ACTIVE','PAUSED','WITHDRAWN') then
    perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'INVALID_INTENT_STATE');
    return wf_system.command_response(v_owner,p_command_id,false);
  end if;

  v_node := gen_random_uuid();
  v_version := gen_random_uuid();

  insert into wf_direction.nodes(id,owner_id,kind)
  values (v_node,v_owner,v_kind);

  insert into wf_direction.node_versions(
    id,node_id,owner_id,version_no,title,description,intent_state,lifecycle_status,
    provenance_source_type,actor_owner_id
  ) values (
    v_version,v_node,v_owner,1,v_title,v_description,v_intent,'ACTIVE','USER_ENTRY',v_owner
  );

  update wf_direction.nodes set current_version_id=v_version where id=v_node and owner_id=v_owner;

  v_ref := pg_catalog.jsonb_build_object(
    'namespace','direction','type',v_kind,'id',v_node,'version',v_version
  );
  v_refs := pg_catalog.jsonb_build_array(v_ref);

  perform wf_system.complete_command(v_owner,p_command_id,'APPLIED',v_refs,null);
  insert into wf_system.module_change_outbox(owner_id,module_id,change_type,command_id,affected)
  values (
    v_owner,'direction','direction.node.created',p_command_id,
    pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('operation','CREATED','ref',v_ref))
  );

  return wf_system.command_response(v_owner,p_command_id,false);
end;
$$;

-- ---------------------------------------------------------------------------
-- DIRECTION: create edge (Slice 1A exposes SUPPORTS only)
-- ---------------------------------------------------------------------------

create or replace function public.wf_direction_create_edge(
  p_command_id uuid,
  p_from_node_id uuid,
  p_to_node_id uuid,
  p_relation text default 'SUPPORTS'
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_owner uuid;
  v_relation text;
  v_hash text;
  v_claim record;
  v_from_kind text;
  v_to_kind text;
  v_edge uuid;
  v_version uuid;
  v_existing record;
  v_ref jsonb;
  v_refs jsonb;
begin
  v_owner := wf_system.require_authenticated_owner();
  v_relation := upper(btrim(p_relation));
  v_hash := wf_system.command_hash(pg_catalog.jsonb_build_object(
    'contract','direction.create_edge.v1',
    'from_node_id',p_from_node_id,
    'to_node_id',p_to_node_id,
    'relation',v_relation
  ));

  select * into v_claim
    from wf_system.claim_command(v_owner,p_command_id,'direction','direction.create_edge',v_hash);
  if not v_claim.is_new then
    return wf_system.command_response(v_owner,p_command_id,true);
  end if;

  if p_from_node_id is null or p_to_node_id is null then
    perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'INVALID_REF');
    return wf_system.command_response(v_owner,p_command_id,false);
  end if;
  if p_from_node_id = p_to_node_id then
    perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'SELF_EDGE_NOT_ALLOWED');
    return wf_system.command_response(v_owner,p_command_id,false);
  end if;
  if v_relation <> 'SUPPORTS' then
    perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'RELATION_NOT_EXPOSED');
    return wf_system.command_response(v_owner,p_command_id,false);
  end if;

  select n.kind into v_from_kind
    from wf_direction.nodes n
    join wf_direction.node_versions v on v.id=n.current_version_id and v.node_id=n.id and v.owner_id=n.owner_id
   where n.id=p_from_node_id and n.owner_id=v_owner and v.lifecycle_status='ACTIVE';
  if v_from_kind is null then
    perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'INVALID_REF');
    return wf_system.command_response(v_owner,p_command_id,false);
  end if;

  select n.kind into v_to_kind
    from wf_direction.nodes n
    join wf_direction.node_versions v on v.id=n.current_version_id and v.node_id=n.id and v.owner_id=n.owner_id
   where n.id=p_to_node_id and n.owner_id=v_owner and v.lifecycle_status='ACTIVE';
  if v_to_kind is null then
    perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'INVALID_REF');
    return wf_system.command_response(v_owner,p_command_id,false);
  end if;

  select e.id,e.version_id into v_existing
    from wf_direction.edges e
   where e.owner_id=v_owner and e.from_node_id=p_from_node_id and e.to_node_id=p_to_node_id
     and e.relation=v_relation and e.lifecycle_status='ACTIVE';
  if found then
    v_ref := pg_catalog.jsonb_build_object('namespace','direction','type','edge','id',v_existing.id,'version',v_existing.version_id);
    perform wf_system.complete_command(v_owner,p_command_id,'NOOP',pg_catalog.jsonb_build_array(v_ref),null);
    return wf_system.command_response(v_owner,p_command_id,false);
  end if;

  v_edge := gen_random_uuid();
  v_version := gen_random_uuid();
  begin
    insert into wf_direction.edges(
      id,version_id,owner_id,from_node_id,to_node_id,relation,
      provenance_source_type,actor_owner_id
    ) values (
      v_edge,v_version,v_owner,p_from_node_id,p_to_node_id,v_relation,'USER_ENTRY',v_owner
    );
  exception when unique_violation then
    select e.id,e.version_id into v_existing
      from wf_direction.edges e
     where e.owner_id=v_owner and e.from_node_id=p_from_node_id and e.to_node_id=p_to_node_id
       and e.relation=v_relation and e.lifecycle_status='ACTIVE';
    if found then
      v_ref := pg_catalog.jsonb_build_object('namespace','direction','type','edge','id',v_existing.id,'version',v_existing.version_id);
      perform wf_system.complete_command(v_owner,p_command_id,'NOOP',pg_catalog.jsonb_build_array(v_ref),null);
      return wf_system.command_response(v_owner,p_command_id,false);
    end if;
    raise;
  end;

  v_ref := pg_catalog.jsonb_build_object('namespace','direction','type','edge','id',v_edge,'version',v_version);
  v_refs := pg_catalog.jsonb_build_array(v_ref);
  perform wf_system.complete_command(v_owner,p_command_id,'APPLIED',v_refs,null);
  insert into wf_system.module_change_outbox(owner_id,module_id,change_type,command_id,affected)
  values (v_owner,'direction','direction.edge.created',p_command_id,
    pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('operation','CREATED','ref',v_ref)));
  return wf_system.command_response(v_owner,p_command_id,false);
end;
$$;

-- ---------------------------------------------------------------------------
-- PRACTICE: create Practice
-- ---------------------------------------------------------------------------

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

-- ---------------------------------------------------------------------------
-- PRACTICE: log session
-- ---------------------------------------------------------------------------

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
  if v_from_precision not in ('INSTANT','MINUTE','HOUR','DAY','MONTH','YEAR')
     or (p_occurred_to is null and v_to_precision is not null)
     or (p_occurred_to is not null and (v_to_precision is null or v_to_precision not in ('INSTANT','MINUTE','HOUR','DAY','MONTH','YEAR'))) then
    perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'INVALID_TEMPORAL_PRECISION');
    return wf_system.command_response(v_owner,p_command_id,false);
  end if;
  if p_duration_seconds is not null and p_duration_seconds <= 0 then
    perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'INVALID_DURATION');
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

-- ---------------------------------------------------------------------------
-- PRACTICE: correct session
-- ---------------------------------------------------------------------------

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
  if v_from_precision not in ('INSTANT','MINUTE','HOUR','DAY','MONTH','YEAR')
     or (p_occurred_to is null and v_to_precision is not null)
     or (p_occurred_to is not null and (v_to_precision is null or v_to_precision not in ('INSTANT','MINUTE','HOUR','DAY','MONTH','YEAR'))) then
    perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'INVALID_TEMPORAL_PRECISION');
    return wf_system.command_response(v_owner,p_command_id,false);
  end if;
  if p_duration_seconds is not null and p_duration_seconds <= 0 then
    perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'INVALID_DURATION');
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

-- ---------------------------------------------------------------------------
-- EVIDENCE: exact current PracticeSession -> current Action fulfillment
-- ---------------------------------------------------------------------------

create or replace function public.wf_evidence_create_fulfillment_link(
  p_command_id uuid,
  p_source_session_id uuid,
  p_source_version_id uuid,
  p_target_action_id uuid,
  p_target_version_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_owner uuid;
  v_reason text;
  v_hash text;
  v_claim record;
  v_target_kind text;
  v_link uuid;
  v_version uuid;
  v_existing record;
  v_ref jsonb;
  v_refs jsonb;
begin
  v_owner := wf_system.require_authenticated_owner();
  v_reason := nullif(btrim(p_reason),'');
  v_hash := wf_system.command_hash(pg_catalog.jsonb_build_object(
    'contract','evidence.create_fulfillment_link.v1',
    'source_session_id',p_source_session_id,
    'source_version_id',p_source_version_id,
    'target_action_id',p_target_action_id,
    'target_version_id',p_target_version_id,
    'reason',v_reason
  ));
  select * into v_claim
    from wf_system.claim_command(v_owner,p_command_id,'evidence','evidence.create_fulfillment_link',v_hash);
  if not v_claim.is_new then return wf_system.command_response(v_owner,p_command_id,true); end if;

  if not exists (
    select 1
      from wf_practice.sessions s
      join wf_practice.session_versions v on v.id=s.current_version_id and v.session_id=s.id and v.owner_id=s.owner_id
     where s.id=p_source_session_id and s.owner_id=v_owner
       and s.current_version_id=p_source_version_id and v.lifecycle_status='ACTIVE'
  ) then
    perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'INVALID_SOURCE_REF');
    return wf_system.command_response(v_owner,p_command_id,false);
  end if;

  select n.kind into v_target_kind
    from wf_direction.nodes n
    join wf_direction.node_versions v on v.id=n.current_version_id and v.node_id=n.id and v.owner_id=n.owner_id
   where n.id=p_target_action_id and n.owner_id=v_owner
     and n.current_version_id=p_target_version_id and v.lifecycle_status='ACTIVE';
  if v_target_kind is distinct from 'action' then
    perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'INVALID_TARGET_REF');
    return wf_system.command_response(v_owner,p_command_id,false);
  end if;

  select l.id,l.version_id into v_existing
    from wf_evidence.links l
   where l.owner_id=v_owner
     and l.source_namespace='practice' and l.source_type='session'
     and l.source_record_id=p_source_session_id and l.source_version_id=p_source_version_id
     and l.target_namespace='direction' and l.target_type='action'
     and l.target_record_id=p_target_action_id and l.target_version_id=p_target_version_id
     and l.target_aspect='fulfillment' and l.relation='SUPPORTS'
     and l.lifecycle_status='ACTIVE';
  if found then
    v_ref := pg_catalog.jsonb_build_object('namespace','evidence','type','link','id',v_existing.id,'version',v_existing.version_id);
    perform wf_system.complete_command(v_owner,p_command_id,'NOOP',pg_catalog.jsonb_build_array(v_ref),null);
    return wf_system.command_response(v_owner,p_command_id,false);
  end if;

  v_link := gen_random_uuid();
  v_version := gen_random_uuid();
  begin
    insert into wf_evidence.links(
      id,version_id,owner_id,
      source_namespace,source_type,source_record_id,source_version_id,
      target_namespace,target_type,target_record_id,target_version_id,target_aspect,
      relation,reason,provenance_source_type,actor_owner_id
    ) values (
      v_link,v_version,v_owner,
      'practice','session',p_source_session_id,p_source_version_id,
      'direction','action',p_target_action_id,p_target_version_id,'fulfillment',
      'SUPPORTS',v_reason,'USER_ENTRY',v_owner
    );
  exception when unique_violation then
    select l.id,l.version_id into v_existing
      from wf_evidence.links l
     where l.owner_id=v_owner
       and l.source_namespace='practice' and l.source_type='session'
       and l.source_record_id=p_source_session_id and l.source_version_id=p_source_version_id
       and l.target_namespace='direction' and l.target_type='action'
       and l.target_record_id=p_target_action_id and l.target_version_id=p_target_version_id
       and l.target_aspect='fulfillment' and l.relation='SUPPORTS'
       and l.lifecycle_status='ACTIVE';
    if found then
      v_ref := pg_catalog.jsonb_build_object('namespace','evidence','type','link','id',v_existing.id,'version',v_existing.version_id);
      perform wf_system.complete_command(v_owner,p_command_id,'NOOP',pg_catalog.jsonb_build_array(v_ref),null);
      return wf_system.command_response(v_owner,p_command_id,false);
    end if;
    raise;
  end;

  v_ref := pg_catalog.jsonb_build_object('namespace','evidence','type','link','id',v_link,'version',v_version);
  v_refs := pg_catalog.jsonb_build_array(v_ref);
  perform wf_system.complete_command(v_owner,p_command_id,'APPLIED',v_refs,null);
  insert into wf_system.module_change_outbox(owner_id,module_id,change_type,command_id,affected)
  values (v_owner,'evidence','evidence.link.created',p_command_id,
    pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('operation','CREATED','ref',v_ref)));
  return wf_system.command_response(v_owner,p_command_id,false);
end;
$$;

-- Client grants: typed user RPCs only.
revoke all on function public.wf_direction_create_node(uuid,text,text,text,text) from public, anon;
revoke all on function public.wf_direction_create_edge(uuid,uuid,uuid,text) from public, anon;
revoke all on function public.wf_practice_create(uuid,text,text) from public, anon;
revoke all on function public.wf_practice_log_session(uuid,uuid,timestamptz,timestamptz,text,text,text,integer,text) from public, anon;
revoke all on function public.wf_practice_correct_session(uuid,uuid,uuid,uuid,timestamptz,timestamptz,text,text,text,integer,text) from public, anon;
revoke all on function public.wf_evidence_create_fulfillment_link(uuid,uuid,uuid,uuid,uuid,text) from public, anon;

grant execute on function public.wf_direction_create_node(uuid,text,text,text,text) to authenticated;
grant execute on function public.wf_direction_create_edge(uuid,uuid,uuid,text) to authenticated;
grant execute on function public.wf_practice_create(uuid,text,text) to authenticated;
grant execute on function public.wf_practice_log_session(uuid,uuid,timestamptz,timestamptz,text,text,text,integer,text) to authenticated;
grant execute on function public.wf_practice_correct_session(uuid,uuid,uuid,uuid,timestamptz,timestamptz,text,text,text,integer,text) to authenticated;
grant execute on function public.wf_evidence_create_fulfillment_link(uuid,uuid,uuid,uuid,uuid,text) to authenticated;

commit;
