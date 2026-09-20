begin;

create table wf_practice.outputs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  current_version_id uuid,
  created_at timestamptz not null default now(),
  constraint outputs_owner_fk foreign key (owner_id)
    references wf_system.owners(id) on delete restrict,
  constraint outputs_id_owner_uq unique (id, owner_id)
);

create table wf_practice.output_versions (
  id uuid primary key default gen_random_uuid(),
  output_id uuid not null,
  owner_id uuid not null,
  version_no bigint not null,
  schema_version smallint not null default 1,
  practice_id uuid not null,
  source_session_id uuid not null,
  source_session_version_id uuid not null,
  output_kind text not null,
  title text not null,
  external_url text,
  lifecycle_status text not null,
  superseded_by_version_id uuid,
  provenance_source_type text not null,
  provenance_source_id text,
  actor_owner_id uuid,
  recorded_at timestamptz not null default now(),
  constraint output_versions_owner_fk foreign key (owner_id)
    references wf_system.owners(id) on delete restrict,
  constraint output_versions_actor_owner_fk foreign key (actor_owner_id)
    references wf_system.owners(id) on delete restrict,
  constraint output_versions_output_owner_fk foreign key (output_id, owner_id)
    references wf_practice.outputs(id, owner_id) on delete restrict,
  constraint output_versions_practice_owner_fk foreign key (practice_id, owner_id)
    references wf_practice.practices(id, owner_id) on delete restrict,
  constraint output_versions_source_session_owner_fk foreign key (source_session_id, owner_id)
    references wf_practice.sessions(id, owner_id) on delete restrict,
  constraint output_versions_source_session_version_fk
    foreign key (source_session_version_id, source_session_id, owner_id)
    references wf_practice.session_versions(id, session_id, owner_id) on delete restrict,
  constraint output_versions_output_version_uq unique (output_id, version_no),
  constraint output_versions_id_output_owner_uq unique (id, output_id, owner_id),
  constraint output_versions_version_no_ck check (version_no > 0),
  constraint output_versions_schema_version_ck check (schema_version > 0),
  constraint output_versions_kind_ck check (output_kind in ('COMPLETED_ARTIFACT')),
  constraint output_versions_title_ck check (pg_catalog.btrim(title) <> ''),
  constraint output_versions_external_url_ck check (
    external_url is null or external_url ~* '^https?://[^[:space:]]+$'
  ),
  constraint output_versions_lifecycle_ck
    check (lifecycle_status in ('ACTIVE','SUPERSEDED','RETRACTED')),
  constraint output_versions_supersession_shape_ck
    check (
      (lifecycle_status = 'SUPERSEDED' and superseded_by_version_id is not null)
      or
      (lifecycle_status in ('ACTIVE','RETRACTED') and superseded_by_version_id is null)
    )
);

alter table wf_practice.output_versions
  add constraint output_versions_superseded_same_record_fk
  foreign key (superseded_by_version_id, output_id, owner_id)
  references wf_practice.output_versions(id, output_id, owner_id)
  on delete restrict deferrable initially deferred;

alter table wf_practice.outputs
  add constraint outputs_current_version_same_record_fk
  foreign key (current_version_id, id, owner_id)
  references wf_practice.output_versions(id, output_id, owner_id)
  on delete restrict deferrable initially deferred;

create unique index output_versions_one_active_idx
  on wf_practice.output_versions(output_id)
  where lifecycle_status='ACTIVE';
create index outputs_owner_idx on wf_practice.outputs(owner_id);
create index outputs_current_version_fk_idx
  on wf_practice.outputs(current_version_id,id,owner_id)
  where current_version_id is not null;
create index output_versions_owner_idx on wf_practice.output_versions(owner_id);
create index output_versions_practice_idx on wf_practice.output_versions(practice_id,owner_id);
create index output_versions_source_session_idx
  on wf_practice.output_versions(source_session_id,owner_id);
create index output_versions_source_session_version_idx
  on wf_practice.output_versions(source_session_version_id,source_session_id,owner_id);
create index output_versions_actor_owner_idx
  on wf_practice.output_versions(actor_owner_id)
  where actor_owner_id is not null;

create or replace function wf_practice.protect_output_version_update()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if new.id is distinct from old.id
     or new.output_id is distinct from old.output_id
     or new.owner_id is distinct from old.owner_id
     or new.version_no is distinct from old.version_no
     or new.schema_version is distinct from old.schema_version
     or new.practice_id is distinct from old.practice_id
     or new.source_session_id is distinct from old.source_session_id
     or new.source_session_version_id is distinct from old.source_session_version_id
     or new.output_kind is distinct from old.output_kind
     or new.title is distinct from old.title
     or new.external_url is distinct from old.external_url
     or new.provenance_source_type is distinct from old.provenance_source_type
     or new.provenance_source_id is distinct from old.provenance_source_id
     or new.actor_owner_id is distinct from old.actor_owner_id
     or new.recorded_at is distinct from old.recorded_at then
    raise exception 'practice output version semantic payload is immutable';
  end if;

  if old.lifecycle_status in ('SUPERSEDED','RETRACTED') then
    if new.lifecycle_status is distinct from old.lifecycle_status
       or new.superseded_by_version_id is distinct from old.superseded_by_version_id then
      raise exception 'terminal practice output version lifecycle cannot be changed';
    end if;
  elsif old.lifecycle_status='ACTIVE'
        and new.lifecycle_status not in ('ACTIVE','SUPERSEDED','RETRACTED') then
    raise exception 'invalid practice output version lifecycle transition';
  end if;

  return new;
end;
$$;

create trigger output_versions_protect_update_trg
before update on wf_practice.output_versions
for each row execute function wf_practice.protect_output_version_update();

create or replace function wf_practice.protect_output_identity_update()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if new.id is distinct from old.id
     or new.owner_id is distinct from old.owner_id
     or new.created_at is distinct from old.created_at then
    raise exception 'practice output identity fields are immutable';
  end if;
  return new;
end;
$$;

create trigger outputs_protect_identity_update_trg
before update on wf_practice.outputs
for each row execute function wf_practice.protect_output_identity_update();

create or replace function wf_practice.assert_output_head_integrity()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
declare
  v_output_id uuid;
  v_owner_id uuid;
  v_current uuid;
  v_status text;
  v_active_count integer;
begin
  if tg_table_name='outputs' then
    if tg_op='DELETE' then
      v_output_id:=old.id;
      v_owner_id:=old.owner_id;
    else
      v_output_id:=new.id;
      v_owner_id:=new.owner_id;
    end if;
  else
    if tg_op='DELETE' then
      v_output_id:=old.output_id;
      v_owner_id:=old.owner_id;
    else
      v_output_id:=new.output_id;
      v_owner_id:=new.owner_id;
    end if;
  end if;

  select o.current_version_id into v_current
    from wf_practice.outputs o
   where o.id=v_output_id and o.owner_id=v_owner_id;
  if not found then return null; end if;

  select pg_catalog.count(*) into v_active_count
    from wf_practice.output_versions v
   where v.output_id=v_output_id
     and v.owner_id=v_owner_id
     and v.lifecycle_status='ACTIVE';

  if v_current is null then
    if exists (
      select 1 from wf_practice.output_versions v
       where v.output_id=v_output_id and v.owner_id=v_owner_id
    ) then
      raise exception 'practice output with versions must have current_version_id';
    end if;
    return null;
  end if;

  select v.lifecycle_status into v_status
    from wf_practice.output_versions v
   where v.id=v_current
     and v.output_id=v_output_id
     and v.owner_id=v_owner_id;
  if not found then
    raise exception 'practice output current_version_id does not resolve';
  end if;

  if v_status='SUPERSEDED' then
    raise exception 'practice output current_version_id cannot reference SUPERSEDED version';
  elsif v_status='ACTIVE' and v_active_count<>1 then
    raise exception 'active practice output must have exactly one ACTIVE version';
  elsif v_status='RETRACTED' and v_active_count<>0 then
    raise exception 'retracted practice output cannot retain an ACTIVE version';
  end if;

  return null;
end;
$$;

create constraint trigger outputs_head_integrity_trg
after insert or update on wf_practice.outputs
deferrable initially deferred
for each row execute function wf_practice.assert_output_head_integrity();

create constraint trigger output_versions_head_integrity_trg
after insert or update or delete on wf_practice.output_versions
deferrable initially deferred
for each row execute function wf_practice.assert_output_head_integrity();

create or replace function public.wf_practice_capture_output(
  p_command_id uuid,
  p_source_session_id uuid,
  p_source_session_version_id uuid,
  p_title text,
  p_output_kind text default 'COMPLETED_ARTIFACT',
  p_external_url text default null
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
  v_url text;
  v_hash text;
  v_claim record;
  v_practice_id uuid;
  v_output uuid;
  v_version uuid;
  v_ref jsonb;
begin
  v_owner:=wf_system.require_authenticated_owner();
  v_kind:=upper(pg_catalog.btrim(p_output_kind));
  v_title:=nullif(pg_catalog.btrim(p_title),'');
  v_url:=nullif(pg_catalog.btrim(p_external_url),'');

  v_hash:=wf_system.command_hash(pg_catalog.jsonb_build_object(
    'contract','practice.capture_output.v1',
    'source_session_id',p_source_session_id,
    'source_session_version_id',p_source_session_version_id,
    'output_kind',v_kind,
    'title',v_title,
    'external_url',v_url
  ));

  select * into v_claim
    from wf_system.claim_command(
      v_owner,p_command_id,'practice','practice.capture_output',v_hash
    );
  if not v_claim.is_new then
    return wf_system.command_response(v_owner,p_command_id,true);
  end if;

  if v_kind is null or v_kind<>'COMPLETED_ARTIFACT' then
    perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'INVALID_OUTPUT_KIND');
    return wf_system.command_response(v_owner,p_command_id,false);
  end if;
  if v_title is null then
    perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'OUTPUT_TITLE_REQUIRED');
    return wf_system.command_response(v_owner,p_command_id,false);
  end if;
  if v_url is not null and v_url !~* '^https?://[^[:space:]]+$' then
    perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'INVALID_OUTPUT_URL');
    return wf_system.command_response(v_owner,p_command_id,false);
  end if;

  select sv.practice_id into v_practice_id
    from wf_practice.sessions s
    join wf_practice.session_versions sv
      on sv.id=s.current_version_id
     and sv.session_id=s.id
     and sv.owner_id=s.owner_id
    join wf_practice.practices p
      on p.id=sv.practice_id
     and p.owner_id=sv.owner_id
   where s.id=p_source_session_id
     and s.owner_id=v_owner
     and s.current_version_id=p_source_session_version_id
     and sv.lifecycle_status='ACTIVE'
     and p.lifecycle_status='ACTIVE';

  if v_practice_id is null then
    perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'CURRENT_SOURCE_SESSION_REQUIRED');
    return wf_system.command_response(v_owner,p_command_id,false);
  end if;

  v_output:=gen_random_uuid();
  v_version:=gen_random_uuid();

  insert into wf_practice.outputs(id,owner_id)
  values(v_output,v_owner);

  insert into wf_practice.output_versions(
    id,output_id,owner_id,version_no,practice_id,
    source_session_id,source_session_version_id,
    output_kind,title,external_url,lifecycle_status,
    provenance_source_type,actor_owner_id
  ) values (
    v_version,v_output,v_owner,1,v_practice_id,
    p_source_session_id,p_source_session_version_id,
    v_kind,v_title,v_url,'ACTIVE',
    'USER_ENTRY',v_owner
  );

  update wf_practice.outputs
     set current_version_id=v_version
   where id=v_output and owner_id=v_owner;

  v_ref:=pg_catalog.jsonb_build_object(
    'namespace','practice','type','output','id',v_output,'version',v_version
  );

  perform wf_system.complete_command(
    v_owner,p_command_id,'APPLIED',pg_catalog.jsonb_build_array(v_ref),null
  );

  insert into wf_system.module_change_outbox(
    owner_id,module_id,change_type,command_id,affected
  ) values (
    v_owner,'practice','practice.output.created',p_command_id,
    pg_catalog.jsonb_build_array(
      pg_catalog.jsonb_build_object('operation','CREATED','ref',v_ref)
    )
  );

  return wf_system.command_response(v_owner,p_command_id,false);
end;
$$;

create or replace function public.wf_practice_correct_output(
  p_command_id uuid,
  p_output_id uuid,
  p_expected_version_id uuid,
  p_source_session_version_id uuid,
  p_title text,
  p_external_url text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_owner uuid;
  v_title text;
  v_url text;
  v_hash text;
  v_claim record;
  v_current uuid;
  v_old_no bigint;
  v_old_status text;
  v_source_session_id uuid;
  v_output_kind text;
  v_practice_id uuid;
  v_new uuid;
  v_old_ref jsonb;
  v_new_ref jsonb;
begin
  v_owner:=wf_system.require_authenticated_owner();
  v_title:=nullif(pg_catalog.btrim(p_title),'');
  v_url:=nullif(pg_catalog.btrim(p_external_url),'');

  v_hash:=wf_system.command_hash(pg_catalog.jsonb_build_object(
    'contract','practice.correct_output.v1',
    'output_id',p_output_id,
    'expected_version_id',p_expected_version_id,
    'source_session_version_id',p_source_session_version_id,
    'title',v_title,
    'external_url',v_url
  ));

  select * into v_claim
    from wf_system.claim_command(
      v_owner,p_command_id,'practice','practice.correct_output',v_hash
    );
  if not v_claim.is_new then
    return wf_system.command_response(v_owner,p_command_id,true);
  end if;

  if v_title is null then
    perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'OUTPUT_TITLE_REQUIRED');
    return wf_system.command_response(v_owner,p_command_id,false);
  end if;
  if v_url is not null and v_url !~* '^https?://[^[:space:]]+$' then
    perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'INVALID_OUTPUT_URL');
    return wf_system.command_response(v_owner,p_command_id,false);
  end if;

  select o.current_version_id
    into v_current
    from wf_practice.outputs o
   where o.id=p_output_id and o.owner_id=v_owner
   for update;

  if not found then
    perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'OUTPUT_NOT_FOUND');
    return wf_system.command_response(v_owner,p_command_id,false);
  end if;

  if v_current is distinct from p_expected_version_id then
    perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'STALE_VERSION');
    return wf_system.command_response(v_owner,p_command_id,false);
  end if;

  select v.version_no,v.lifecycle_status,v.source_session_id,v.output_kind
    into v_old_no,v_old_status,v_source_session_id,v_output_kind
    from wf_practice.output_versions v
   where v.id=v_current
     and v.output_id=p_output_id
     and v.owner_id=v_owner;

  if v_old_status<>'ACTIVE' then
    perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'OUTPUT_NOT_ACTIVE');
    return wf_system.command_response(v_owner,p_command_id,false);
  end if;

  select sv.practice_id into v_practice_id
    from wf_practice.sessions s
    join wf_practice.session_versions sv
      on sv.id=s.current_version_id
     and sv.session_id=s.id
     and sv.owner_id=s.owner_id
    join wf_practice.practices p
      on p.id=sv.practice_id
     and p.owner_id=sv.owner_id
   where s.id=v_source_session_id
     and s.owner_id=v_owner
     and s.current_version_id=p_source_session_version_id
     and sv.lifecycle_status='ACTIVE'
     and p.lifecycle_status='ACTIVE';

  if v_practice_id is null then
    perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'CURRENT_SOURCE_SESSION_REQUIRED');
    return wf_system.command_response(v_owner,p_command_id,false);
  end if;

  v_new:=gen_random_uuid();

  update wf_practice.output_versions
     set lifecycle_status='SUPERSEDED',
         superseded_by_version_id=v_new
   where id=v_current
     and output_id=p_output_id
     and owner_id=v_owner;

  insert into wf_practice.output_versions(
    id,output_id,owner_id,version_no,practice_id,
    source_session_id,source_session_version_id,
    output_kind,title,external_url,lifecycle_status,
    provenance_source_type,actor_owner_id
  ) values (
    v_new,p_output_id,v_owner,v_old_no+1,v_practice_id,
    v_source_session_id,p_source_session_version_id,
    v_output_kind,v_title,v_url,'ACTIVE',
    'USER_ENTRY',v_owner
  );

  update wf_practice.outputs
     set current_version_id=v_new
   where id=p_output_id and owner_id=v_owner;

  v_old_ref:=pg_catalog.jsonb_build_object(
    'namespace','practice','type','output','id',p_output_id,'version',v_current
  );
  v_new_ref:=pg_catalog.jsonb_build_object(
    'namespace','practice','type','output','id',p_output_id,'version',v_new
  );

  perform wf_system.complete_command(
    v_owner,p_command_id,'APPLIED',
    pg_catalog.jsonb_build_array(v_old_ref,v_new_ref),null
  );

  insert into wf_system.module_change_outbox(
    owner_id,module_id,change_type,command_id,affected
  ) values (
    v_owner,'practice','practice.output.corrected',p_command_id,
    pg_catalog.jsonb_build_array(
      pg_catalog.jsonb_build_object('operation','SUPERSEDED','ref',v_old_ref),
      pg_catalog.jsonb_build_object('operation','CREATED','ref',v_new_ref)
    )
  );

  return wf_system.command_response(v_owner,p_command_id,false);
end;
$$;

create or replace function public.wf_practice_output_skill_capability_input_v0(
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
  v_session_count bigint;
  v_first timestamptz;
  v_last timestamptz;
  v_recent jsonb;
begin
  v_owner:=wf_system.require_authenticated_owner();

  if p_as_of is null then
    raise exception using errcode='22023',message='AS_OF_REQUIRED';
  end if;
  if p_recent_limit is null or p_recent_limit<1 or p_recent_limit>100 then
    raise exception using errcode='22023',message='INVALID_RECENT_LIMIT';
  end if;

  select pg_catalog.array_agg(distinct x.alias order by x.alias)
    into v_aliases
  from (
    select pg_catalog.lower(pg_catalog.btrim(value)) as alias
      from pg_catalog.unnest(p_normalized_practice_names) value
     where value is not null
       and pg_catalog.btrim(value)<>''
  ) x;

  if v_aliases is null or pg_catalog.array_length(v_aliases,1) is null then
    raise exception using errcode='22023',message='PRACTICE_ALIASES_REQUIRED';
  end if;

  with qualifying as (
    select
      o.id as output_id,
      ov.id as output_version_id,
      ov.output_kind,
      ov.title,
      ov.external_url,
      ov.recorded_at,
      ov.practice_id,
      p.name as practice_name,
      ov.source_session_id,
      ov.source_session_version_id as captured_source_session_version_id,
      s.current_version_id as current_source_session_version_id,
      sv.occurred_from
    from wf_practice.outputs o
    join wf_practice.output_versions ov
      on ov.id=o.current_version_id
     and ov.output_id=o.id
     and ov.owner_id=o.owner_id
    join wf_practice.sessions s
      on s.id=ov.source_session_id
     and s.owner_id=ov.owner_id
    join wf_practice.session_versions sv
      on sv.id=s.current_version_id
     and sv.session_id=s.id
     and sv.owner_id=s.owner_id
    join wf_practice.practices p
      on p.id=ov.practice_id
     and p.owner_id=ov.owner_id
   where o.owner_id=v_owner
     and ov.lifecycle_status='ACTIVE'
     and ov.output_kind='COMPLETED_ARTIFACT'
     and sv.lifecycle_status='ACTIVE'
     and sv.practice_id=ov.practice_id
     and p.lifecycle_status='ACTIVE'
     and pg_catalog.lower(pg_catalog.btrim(p.name))=any(v_aliases)
     and coalesce(sv.occurred_to,sv.occurred_from)<=p_as_of
  )
  select
    pg_catalog.count(*),
    pg_catalog.count(distinct source_session_id),
    pg_catalog.min(occurred_from),
    pg_catalog.max(occurred_from)
  into
    v_count,
    v_session_count,
    v_first,
    v_last
  from qualifying;

  select coalesce(
    pg_catalog.jsonb_agg(
      x.payload
      order by x.occurred_from desc,x.output_id
    ),
    '[]'::jsonb
  )
  into v_recent
  from (
    select
      o.id as output_id,
      sv.occurred_from,
      pg_catalog.jsonb_build_object(
        'output_id',o.id,
        'output_version',ov.id,
        'output_kind',ov.output_kind,
        'title',ov.title,
        'external_url',ov.external_url,
        'practice_id',ov.practice_id,
        'practice_name',p.name,
        'source_session_id',ov.source_session_id,
        'captured_source_session_version',ov.source_session_version_id,
        'current_source_session_version',s.current_version_id,
        'occurred_at',sv.occurred_from,
        'recorded_at',ov.recorded_at
      ) as payload
    from wf_practice.outputs o
    join wf_practice.output_versions ov
      on ov.id=o.current_version_id
     and ov.output_id=o.id
     and ov.owner_id=o.owner_id
    join wf_practice.sessions s
      on s.id=ov.source_session_id
     and s.owner_id=ov.owner_id
    join wf_practice.session_versions sv
      on sv.id=s.current_version_id
     and sv.session_id=s.id
     and sv.owner_id=s.owner_id
    join wf_practice.practices p
      on p.id=ov.practice_id
     and p.owner_id=ov.owner_id
   where o.owner_id=v_owner
     and ov.lifecycle_status='ACTIVE'
     and ov.output_kind='COMPLETED_ARTIFACT'
     and sv.lifecycle_status='ACTIVE'
     and sv.practice_id=ov.practice_id
     and p.lifecycle_status='ACTIVE'
     and pg_catalog.lower(pg_catalog.btrim(p.name))=any(v_aliases)
     and coalesce(sv.occurred_to,sv.occurred_from)<=p_as_of
   order by sv.occurred_from desc,o.id
   limit p_recent_limit
  ) x;

  return pg_catalog.jsonb_build_object(
    'provider','practice.completed-output-skill-capability-provider.v0.1',
    'as_of',p_as_of,
    'capability_model','COMPLETED_PRACTICE_OUTPUT',
    'evidence_basis','PLAYER_CONFIRMED_COMPLETED_OUTPUT',
    'normalized_practice_names',v_aliases,
    'demonstrated_observation_count',v_count,
    'demonstrated_session_count',v_session_count,
    'first_demonstrated_at',v_first,
    'last_demonstrated_at',v_last,
    'recent_outputs',v_recent,
    'result_coverage',pg_catalog.jsonb_build_object(
      'completeness','COMPLETE',
      'phenomenon','current_canonical_completed_practice_outputs_through_as_of'
    ),
    'epistemic_coverage',pg_catalog.jsonb_build_object(
      'completeness','UNKNOWN',
      'reason','Recorded completed outputs do not establish complete creative capability or output quality.'
    ),
    'does_not_assert',pg_catalog.jsonb_build_array(
      'creative quality',
      'originality',
      'commercial success',
      'Mastery',
      'a numeric Skill Level',
      'that no unrecorded creative outputs exist'
    )
  );
end;
$$;

revoke all on table wf_practice.outputs from public,anon,authenticated;
revoke all on table wf_practice.output_versions from public,anon,authenticated;

revoke all on function public.wf_practice_capture_output(uuid,uuid,uuid,text,text,text)
  from public,anon;
grant execute on function public.wf_practice_capture_output(uuid,uuid,uuid,text,text,text)
  to authenticated;

revoke all on function public.wf_practice_correct_output(uuid,uuid,uuid,uuid,text,text)
  from public,anon;
grant execute on function public.wf_practice_correct_output(uuid,uuid,uuid,uuid,text,text)
  to authenticated;

revoke all on function public.wf_practice_output_skill_capability_input_v0(text[],timestamptz,integer)
  from public,anon;
grant execute on function public.wf_practice_output_skill_capability_input_v0(text[],timestamptz,integer)
  to authenticated;

commit;
