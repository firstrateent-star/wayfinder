begin;

-- Wayfinder Schedule v0.1
-- Planned allocation of time only. Schedule never asserts that an event/action occurred.

create schema if not exists wf_schedule;
comment on schema wf_schedule is
  'Wayfinder Schedule module: canonical planned time allocations, distinct from lived occurrence.';
revoke all on schema wf_schedule from public, anon, authenticated;

create table wf_schedule.allocations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references wf_system.owners(id) on delete restrict,
  current_version_id uuid,
  created_at timestamptz not null default now(),
  constraint schedule_allocations_id_owner_uq unique (id, owner_id)
);

create table wf_schedule.allocation_versions (
  id uuid primary key default gen_random_uuid(),
  allocation_id uuid not null,
  owner_id uuid not null,
  version_no bigint not null,
  schema_version smallint not null default 1,

  label text not null,
  allocation_kind text not null,
  allocation_state text not null default 'PLANNED',

  starts_at timestamptz,
  ends_at timestamptz,
  window_starts_at timestamptz,
  window_ends_at timestamptz,
  due_at timestamptz,
  expected_duration_seconds integer,
  zone_id text not null,

  target_namespace text,
  target_type text,
  target_record_id uuid,
  target_version_id uuid,

  lifecycle_status text not null,
  superseded_by_version_id uuid,
  provenance_source_type text not null,
  provenance_source_id text,
  actor_owner_id uuid,
  recorded_at timestamptz not null default now(),

  constraint schedule_versions_owner_fk foreign key (owner_id)
    references wf_system.owners(id) on delete restrict,
  constraint schedule_versions_actor_owner_fk foreign key (actor_owner_id)
    references wf_system.owners(id) on delete restrict,
  constraint schedule_versions_allocation_owner_fk foreign key (allocation_id, owner_id)
    references wf_schedule.allocations(id, owner_id) on delete restrict,
  constraint schedule_versions_record_version_uq unique (allocation_id, version_no),
  constraint schedule_versions_id_record_owner_uq unique (id, allocation_id, owner_id),
  constraint schedule_versions_version_no_ck check (version_no > 0),
  constraint schedule_versions_schema_version_ck check (schema_version > 0),
  constraint schedule_versions_label_ck check (btrim(label) <> '' and char_length(label) <= 300),
  constraint schedule_versions_kind_ck check (allocation_kind in ('HARD','SOFT','WINDOWED','FLOATING')),
  constraint schedule_versions_state_ck check (allocation_state in ('PLANNED','CANCELLED')),
  constraint schedule_versions_duration_ck check (expected_duration_seconds is null or expected_duration_seconds > 0),
  constraint schedule_versions_fixed_interval_ck check (
    allocation_kind not in ('HARD','SOFT')
    or (starts_at is not null and ends_at is not null and ends_at > starts_at
        and window_starts_at is null and window_ends_at is null)
  ),
  constraint schedule_versions_window_ck check (
    allocation_kind <> 'WINDOWED'
    or (starts_at is null and ends_at is null
        and window_starts_at is not null and window_ends_at is not null
        and window_ends_at > window_starts_at)
  ),
  constraint schedule_versions_floating_ck check (
    allocation_kind <> 'FLOATING'
    or (starts_at is null and ends_at is null and window_starts_at is null and window_ends_at is null)
  ),
  constraint schedule_versions_target_shape_ck check (
    (target_namespace is null and target_type is null and target_record_id is null and target_version_id is null)
    or
    (target_namespace is not null and btrim(target_namespace) <> ''
      and target_type is not null and btrim(target_type) <> ''
      and target_record_id is not null)
  ),
  constraint schedule_versions_lifecycle_ck check (lifecycle_status in ('ACTIVE','SUPERSEDED','RETRACTED')),
  constraint schedule_versions_supersession_shape_ck check (
    (lifecycle_status = 'SUPERSEDED' and superseded_by_version_id is not null)
    or
    (lifecycle_status in ('ACTIVE','RETRACTED') and superseded_by_version_id is null)
  )
);

alter table wf_schedule.allocation_versions
  add constraint schedule_versions_superseded_same_record_fk
  foreign key (superseded_by_version_id, allocation_id, owner_id)
  references wf_schedule.allocation_versions(id, allocation_id, owner_id)
  on delete restrict deferrable initially deferred;

alter table wf_schedule.allocations
  add constraint schedule_allocations_current_same_record_fk
  foreign key (current_version_id, id, owner_id)
  references wf_schedule.allocation_versions(id, allocation_id, owner_id)
  on delete restrict deferrable initially deferred;

create unique index schedule_versions_one_active_idx
  on wf_schedule.allocation_versions(allocation_id)
  where lifecycle_status = 'ACTIVE';
create index schedule_allocations_owner_idx on wf_schedule.allocations(owner_id);
create index schedule_versions_owner_idx on wf_schedule.allocation_versions(owner_id);
create index schedule_versions_starts_idx on wf_schedule.allocation_versions(owner_id, starts_at) where lifecycle_status='ACTIVE';
create index schedule_versions_window_idx on wf_schedule.allocation_versions(owner_id, window_starts_at) where lifecycle_status='ACTIVE';
create index schedule_versions_due_idx on wf_schedule.allocation_versions(owner_id, due_at) where lifecycle_status='ACTIVE';

create or replace function wf_schedule.valid_zone(p_zone text)
returns boolean
language sql
stable
set search_path=pg_catalog
as $$
  select p_zone is not null and btrim(p_zone) <> '' and exists (
    select 1 from pg_catalog.pg_timezone_names z where z.name=btrim(p_zone)
  );
$$;

create or replace function wf_schedule.protect_allocation_identity_update()
returns trigger language plpgsql set search_path=pg_catalog as $$
begin
  if new.id is distinct from old.id or new.owner_id is distinct from old.owner_id or new.created_at is distinct from old.created_at then
    raise exception using errcode='55000', message='SCHEDULE_ALLOCATION_IDENTITY_IMMUTABLE';
  end if;
  return new;
end; $$;
create trigger schedule_allocations_protect_identity_trg before update on wf_schedule.allocations
for each row execute function wf_schedule.protect_allocation_identity_update();

create or replace function wf_schedule.protect_allocation_version_update()
returns trigger language plpgsql set search_path=pg_catalog as $$
begin
  if new.id is distinct from old.id
    or new.allocation_id is distinct from old.allocation_id
    or new.owner_id is distinct from old.owner_id
    or new.version_no is distinct from old.version_no
    or new.schema_version is distinct from old.schema_version
    or new.label is distinct from old.label
    or new.allocation_kind is distinct from old.allocation_kind
    or new.allocation_state is distinct from old.allocation_state
    or new.starts_at is distinct from old.starts_at
    or new.ends_at is distinct from old.ends_at
    or new.window_starts_at is distinct from old.window_starts_at
    or new.window_ends_at is distinct from old.window_ends_at
    or new.due_at is distinct from old.due_at
    or new.expected_duration_seconds is distinct from old.expected_duration_seconds
    or new.zone_id is distinct from old.zone_id
    or new.target_namespace is distinct from old.target_namespace
    or new.target_type is distinct from old.target_type
    or new.target_record_id is distinct from old.target_record_id
    or new.target_version_id is distinct from old.target_version_id
    or new.provenance_source_type is distinct from old.provenance_source_type
    or new.provenance_source_id is distinct from old.provenance_source_id
    or new.actor_owner_id is distinct from old.actor_owner_id
    or new.recorded_at is distinct from old.recorded_at then
    raise exception using errcode='55000', message='SCHEDULE_VERSION_PAYLOAD_IMMUTABLE';
  end if;

  if old.lifecycle_status='ACTIVE' then
    if new.lifecycle_status not in ('ACTIVE','SUPERSEDED','RETRACTED') then
      raise exception using errcode='55000', message='INVALID_SCHEDULE_LIFECYCLE_TRANSITION';
    end if;
  elsif new.lifecycle_status is distinct from old.lifecycle_status then
    raise exception using errcode='55000', message='INVALID_SCHEDULE_LIFECYCLE_TRANSITION';
  end if;

  if old.lifecycle_status <> 'ACTIVE' and new.superseded_by_version_id is distinct from old.superseded_by_version_id then
    raise exception using errcode='55000', message='SCHEDULE_VERSION_LINEAGE_IMMUTABLE';
  end if;
  return new;
end; $$;
create trigger schedule_versions_protect_update_trg before update on wf_schedule.allocation_versions
for each row execute function wf_schedule.protect_allocation_version_update();

create or replace function wf_schedule.assert_head_integrity()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog
as $$
declare
  v_id uuid;
  v_owner uuid;
  v_current uuid;
  v_status text;
  v_active integer;
begin
  if tg_table_name='allocations' then
    v_id := case when tg_op='DELETE' then old.id else new.id end;
    v_owner := case when tg_op='DELETE' then old.owner_id else new.owner_id end;
  else
    v_id := case when tg_op='DELETE' then old.allocation_id else new.allocation_id end;
    v_owner := case when tg_op='DELETE' then old.owner_id else new.owner_id end;
  end if;

  select a.current_version_id into v_current
  from wf_schedule.allocations a where a.id=v_id and a.owner_id=v_owner;
  if not found then return case when tg_op='DELETE' then old else new end; end if;
  if v_current is null then raise exception using errcode='23514', message='SCHEDULE_CURRENT_VERSION_REQUIRED'; end if;

  select v.lifecycle_status into v_status from wf_schedule.allocation_versions v
  where v.id=v_current and v.allocation_id=v_id and v.owner_id=v_owner;
  if not found then raise exception using errcode='23503', message='SCHEDULE_CURRENT_VERSION_MISSING'; end if;
  if v_status='SUPERSEDED' then raise exception using errcode='23514', message='SCHEDULE_HEAD_CANNOT_BE_SUPERSEDED'; end if;

  select count(*)::integer into v_active from wf_schedule.allocation_versions v
  where v.allocation_id=v_id and v.owner_id=v_owner and v.lifecycle_status='ACTIVE';
  if v_status='ACTIVE' and v_active<>1 then raise exception using errcode='23514', message='SCHEDULE_ACTIVE_HEAD_INTEGRITY_VIOLATION'; end if;
  if v_status='RETRACTED' and v_active<>0 then raise exception using errcode='23514', message='SCHEDULE_RETRACTED_HEAD_HAS_ACTIVE_VERSION'; end if;
  return case when tg_op='DELETE' then old else new end;
end; $$;

create constraint trigger schedule_allocations_head_integrity_trg
after insert or update on wf_schedule.allocations deferrable initially deferred
for each row execute function wf_schedule.assert_head_integrity();
create constraint trigger schedule_versions_head_integrity_trg
after insert or update or delete on wf_schedule.allocation_versions deferrable initially deferred
for each row execute function wf_schedule.assert_head_integrity();

create or replace function public.wf_schedule_create_allocation(
  p_command_id uuid,
  p_label text,
  p_allocation_kind text,
  p_starts_at timestamptz default null,
  p_ends_at timestamptz default null,
  p_window_starts_at timestamptz default null,
  p_window_ends_at timestamptz default null,
  p_due_at timestamptz default null,
  p_expected_duration_seconds integer default null,
  p_zone_id text default null,
  p_target_namespace text default null,
  p_target_type text default null,
  p_target_record_id uuid default null,
  p_target_version_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog
as $$
declare
  v_owner uuid;
  v_label text;
  v_kind text;
  v_zone text;
  v_hash text;
  v_claim record;
  v_allocation uuid;
  v_version uuid;
  v_ref jsonb;
begin
  v_owner := wf_system.require_authenticated_owner();
  v_label := btrim(p_label);
  v_kind := upper(btrim(p_allocation_kind));
  v_zone := nullif(btrim(p_zone_id),'');
  if v_zone is null then select o.timezone into v_zone from wf_system.owners o where o.id=v_owner; end if;

  v_hash := wf_system.command_hash(pg_catalog.jsonb_build_object(
    'contract','schedule.create_allocation.v0.1','label',v_label,'kind',v_kind,
    'starts_at',p_starts_at,'ends_at',p_ends_at,'window_starts_at',p_window_starts_at,
    'window_ends_at',p_window_ends_at,'due_at',p_due_at,'duration',p_expected_duration_seconds,
    'zone_id',v_zone,'target_namespace',nullif(btrim(p_target_namespace),''),
    'target_type',nullif(btrim(p_target_type),''),'target_record_id',p_target_record_id,'target_version_id',p_target_version_id
  ));
  select * into v_claim from wf_system.claim_command(v_owner,p_command_id,'schedule','schedule.create_allocation',v_hash);
  if not v_claim.is_new then return wf_system.command_response(v_owner,p_command_id,true); end if;

  if v_label is null or v_label='' or char_length(v_label)>300 then
    perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'INVALID_SCHEDULE_LABEL');
    return wf_system.command_response(v_owner,p_command_id,false);
  end if;
  if v_kind not in ('HARD','SOFT','WINDOWED','FLOATING') then
    perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'INVALID_SCHEDULE_KIND');
    return wf_system.command_response(v_owner,p_command_id,false);
  end if;
  if not wf_schedule.valid_zone(v_zone) then
    perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'INVALID_TIMEZONE');
    return wf_system.command_response(v_owner,p_command_id,false);
  end if;
  if p_expected_duration_seconds is not null and p_expected_duration_seconds<=0 then
    perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'INVALID_EXPECTED_DURATION');
    return wf_system.command_response(v_owner,p_command_id,false);
  end if;
  if v_kind in ('HARD','SOFT') and (p_starts_at is null or p_ends_at is null or p_ends_at<=p_starts_at or p_window_starts_at is not null or p_window_ends_at is not null) then
    perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'INVALID_FIXED_ALLOCATION_TIME');
    return wf_system.command_response(v_owner,p_command_id,false);
  end if;
  if v_kind='WINDOWED' and (p_starts_at is not null or p_ends_at is not null or p_window_starts_at is null or p_window_ends_at is null or p_window_ends_at<=p_window_starts_at) then
    perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'INVALID_WINDOWED_ALLOCATION_TIME');
    return wf_system.command_response(v_owner,p_command_id,false);
  end if;
  if v_kind='FLOATING' and (p_starts_at is not null or p_ends_at is not null or p_window_starts_at is not null or p_window_ends_at is not null) then
    perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'INVALID_FLOATING_ALLOCATION_TIME');
    return wf_system.command_response(v_owner,p_command_id,false);
  end if;
  if ((p_target_namespace is null) <> (p_target_type is null)) or ((p_target_namespace is null) <> (p_target_record_id is null)) then
    perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'INVALID_SCHEDULE_TARGET_REF');
    return wf_system.command_response(v_owner,p_command_id,false);
  end if;

  v_allocation:=gen_random_uuid(); v_version:=gen_random_uuid();
  insert into wf_schedule.allocations(id,owner_id) values(v_allocation,v_owner);
  insert into wf_schedule.allocation_versions(
    id,allocation_id,owner_id,version_no,label,allocation_kind,allocation_state,
    starts_at,ends_at,window_starts_at,window_ends_at,due_at,expected_duration_seconds,zone_id,
    target_namespace,target_type,target_record_id,target_version_id,
    lifecycle_status,provenance_source_type,actor_owner_id
  ) values(
    v_version,v_allocation,v_owner,1,v_label,v_kind,'PLANNED',
    p_starts_at,p_ends_at,p_window_starts_at,p_window_ends_at,p_due_at,p_expected_duration_seconds,v_zone,
    nullif(btrim(p_target_namespace),''),nullif(btrim(p_target_type),''),p_target_record_id,p_target_version_id,
    'ACTIVE','USER_ENTRY',v_owner
  );
  update wf_schedule.allocations set current_version_id=v_version where id=v_allocation and owner_id=v_owner;

  v_ref:=pg_catalog.jsonb_build_object('namespace','schedule','type','allocation','id',v_allocation,'version',v_version);
  perform wf_system.complete_command(v_owner,p_command_id,'APPLIED',pg_catalog.jsonb_build_array(v_ref),null);
  insert into wf_system.module_change_outbox(owner_id,module_id,change_type,command_id,affected)
  values(v_owner,'schedule','schedule.allocation_created',p_command_id,
    pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('operation','CREATED','ref',v_ref)));
  return wf_system.command_response(v_owner,p_command_id,false);
end; $$;

create or replace function public.wf_schedule_revise_allocation(
  p_command_id uuid,
  p_allocation_id uuid,
  p_expected_version_id uuid,
  p_label text,
  p_allocation_kind text,
  p_allocation_state text default 'PLANNED',
  p_starts_at timestamptz default null,
  p_ends_at timestamptz default null,
  p_window_starts_at timestamptz default null,
  p_window_ends_at timestamptz default null,
  p_due_at timestamptz default null,
  p_expected_duration_seconds integer default null,
  p_zone_id text default null,
  p_target_namespace text default null,
  p_target_type text default null,
  p_target_record_id uuid default null,
  p_target_version_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog
as $$
declare
  v_owner uuid; v_label text; v_kind text; v_state text; v_zone text; v_hash text; v_claim record;
  v_current uuid; v_old record; v_new uuid; v_old_ref jsonb; v_new_ref jsonb;
begin
  v_owner:=wf_system.require_authenticated_owner();
  v_label:=btrim(p_label); v_kind:=upper(btrim(p_allocation_kind)); v_state:=upper(btrim(p_allocation_state));
  v_zone:=nullif(btrim(p_zone_id),''); if v_zone is null then select o.timezone into v_zone from wf_system.owners o where o.id=v_owner; end if;
  v_hash:=wf_system.command_hash(pg_catalog.jsonb_build_object(
    'contract','schedule.revise_allocation.v0.1','allocation_id',p_allocation_id,'expected_version_id',p_expected_version_id,
    'label',v_label,'kind',v_kind,'state',v_state,'starts_at',p_starts_at,'ends_at',p_ends_at,
    'window_starts_at',p_window_starts_at,'window_ends_at',p_window_ends_at,'due_at',p_due_at,
    'duration',p_expected_duration_seconds,'zone_id',v_zone,'target_namespace',nullif(btrim(p_target_namespace),''),
    'target_type',nullif(btrim(p_target_type),''),'target_record_id',p_target_record_id,'target_version_id',p_target_version_id
  ));
  select * into v_claim from wf_system.claim_command(v_owner,p_command_id,'schedule','schedule.revise_allocation',v_hash);
  if not v_claim.is_new then return wf_system.command_response(v_owner,p_command_id,true); end if;

  if p_allocation_id is null or p_expected_version_id is null then
    perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'SCHEDULE_REF_REQUIRED'); return wf_system.command_response(v_owner,p_command_id,false); end if;
  if v_label is null or v_label='' or char_length(v_label)>300 then
    perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'INVALID_SCHEDULE_LABEL'); return wf_system.command_response(v_owner,p_command_id,false); end if;
  if v_kind not in ('HARD','SOFT','WINDOWED','FLOATING') or v_state not in ('PLANNED','CANCELLED') or not wf_schedule.valid_zone(v_zone) then
    perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'INVALID_SCHEDULE_SHAPE'); return wf_system.command_response(v_owner,p_command_id,false); end if;
  if p_expected_duration_seconds is not null and p_expected_duration_seconds<=0 then
    perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'INVALID_EXPECTED_DURATION'); return wf_system.command_response(v_owner,p_command_id,false); end if;
  if v_kind in ('HARD','SOFT') and (p_starts_at is null or p_ends_at is null or p_ends_at<=p_starts_at or p_window_starts_at is not null or p_window_ends_at is not null) then
    perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'INVALID_FIXED_ALLOCATION_TIME'); return wf_system.command_response(v_owner,p_command_id,false); end if;
  if v_kind='WINDOWED' and (p_starts_at is not null or p_ends_at is not null or p_window_starts_at is null or p_window_ends_at is null or p_window_ends_at<=p_window_starts_at) then
    perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'INVALID_WINDOWED_ALLOCATION_TIME'); return wf_system.command_response(v_owner,p_command_id,false); end if;
  if v_kind='FLOATING' and (p_starts_at is not null or p_ends_at is not null or p_window_starts_at is not null or p_window_ends_at is not null) then
    perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'INVALID_FLOATING_ALLOCATION_TIME'); return wf_system.command_response(v_owner,p_command_id,false); end if;
  if ((p_target_namespace is null) <> (p_target_type is null)) or ((p_target_namespace is null) <> (p_target_record_id is null)) then
    perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'INVALID_SCHEDULE_TARGET_REF'); return wf_system.command_response(v_owner,p_command_id,false); end if;

  select a.current_version_id into v_current from wf_schedule.allocations a
  where a.id=p_allocation_id and a.owner_id=v_owner for update;
  if not found then perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'SCHEDULE_ALLOCATION_NOT_FOUND'); return wf_system.command_response(v_owner,p_command_id,false); end if;
  if v_current is distinct from p_expected_version_id then
    perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'STALE_SCHEDULE_VERSION'); return wf_system.command_response(v_owner,p_command_id,false); end if;

  select * into v_old from wf_schedule.allocation_versions v where v.id=v_current and v.allocation_id=p_allocation_id and v.owner_id=v_owner;
  if v_old.lifecycle_status<>'ACTIVE' then perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'SCHEDULE_VERSION_NOT_ACTIVE'); return wf_system.command_response(v_owner,p_command_id,false); end if;

  if v_old.label is not distinct from v_label and v_old.allocation_kind is not distinct from v_kind and v_old.allocation_state is not distinct from v_state
    and v_old.starts_at is not distinct from p_starts_at and v_old.ends_at is not distinct from p_ends_at
    and v_old.window_starts_at is not distinct from p_window_starts_at and v_old.window_ends_at is not distinct from p_window_ends_at
    and v_old.due_at is not distinct from p_due_at and v_old.expected_duration_seconds is not distinct from p_expected_duration_seconds
    and v_old.zone_id is not distinct from v_zone and v_old.target_namespace is not distinct from nullif(btrim(p_target_namespace),'')
    and v_old.target_type is not distinct from nullif(btrim(p_target_type),'') and v_old.target_record_id is not distinct from p_target_record_id
    and v_old.target_version_id is not distinct from p_target_version_id then
    v_old_ref:=pg_catalog.jsonb_build_object('namespace','schedule','type','allocation','id',p_allocation_id,'version',v_current);
    perform wf_system.complete_command(v_owner,p_command_id,'NOOP',pg_catalog.jsonb_build_array(v_old_ref),null);
    return wf_system.command_response(v_owner,p_command_id,false);
  end if;

  v_new:=gen_random_uuid();
  update wf_schedule.allocation_versions set lifecycle_status='SUPERSEDED', superseded_by_version_id=v_new
  where id=v_current and allocation_id=p_allocation_id and owner_id=v_owner;
  insert into wf_schedule.allocation_versions(
    id,allocation_id,owner_id,version_no,label,allocation_kind,allocation_state,
    starts_at,ends_at,window_starts_at,window_ends_at,due_at,expected_duration_seconds,zone_id,
    target_namespace,target_type,target_record_id,target_version_id,lifecycle_status,provenance_source_type,actor_owner_id
  ) values(
    v_new,p_allocation_id,v_owner,v_old.version_no+1,v_label,v_kind,v_state,
    p_starts_at,p_ends_at,p_window_starts_at,p_window_ends_at,p_due_at,p_expected_duration_seconds,v_zone,
    nullif(btrim(p_target_namespace),''),nullif(btrim(p_target_type),''),p_target_record_id,p_target_version_id,
    'ACTIVE','USER_ENTRY',v_owner
  );
  update wf_schedule.allocations set current_version_id=v_new where id=p_allocation_id and owner_id=v_owner;

  v_old_ref:=pg_catalog.jsonb_build_object('namespace','schedule','type','allocation','id',p_allocation_id,'version',v_current);
  v_new_ref:=pg_catalog.jsonb_build_object('namespace','schedule','type','allocation','id',p_allocation_id,'version',v_new);
  perform wf_system.complete_command(v_owner,p_command_id,'APPLIED',pg_catalog.jsonb_build_array(v_new_ref),null);
  insert into wf_system.module_change_outbox(owner_id,module_id,change_type,command_id,affected)
  values(v_owner,'schedule','schedule.allocation_revised',p_command_id,
    pg_catalog.jsonb_build_array(
      pg_catalog.jsonb_build_object('operation','SUPERSEDED','ref',v_old_ref),
      pg_catalog.jsonb_build_object('operation','CREATED','ref',v_new_ref)
    ));
  return wf_system.command_response(v_owner,p_command_id,false);
end; $$;

create or replace function public.wf_schedule_current_v0(
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_limit integer default 100
)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog
as $$
declare
  v_owner uuid; v_limit integer; v_total integer; v_items jsonb;
begin
  v_owner:=wf_system.require_authenticated_owner();
  v_limit:=greatest(1,least(coalesce(p_limit,100),500));
  if (p_from is null) <> (p_to is null) then raise exception using errcode='22023', message='SCHEDULE_SCOPE_REQUIRES_FROM_AND_TO'; end if;
  if p_from is not null and p_to<=p_from then raise exception using errcode='22023', message='INVALID_SCHEDULE_SCOPE'; end if;

  with current_rows as (
    select a.id, v.*
    from wf_schedule.allocations a
    join wf_schedule.allocation_versions v on v.id=a.current_version_id and v.allocation_id=a.id and v.owner_id=a.owner_id
    where a.owner_id=v_owner and v.lifecycle_status='ACTIVE'
      and (p_from is null or (
        (v.allocation_kind in ('HARD','SOFT') and v.ends_at>p_from and v.starts_at<p_to)
        or (v.allocation_kind='WINDOWED' and v.window_ends_at>p_from and v.window_starts_at<p_to)
        or (v.allocation_kind='FLOATING' and (v.due_at is null or (v.due_at>=p_from and v.due_at<p_to)))
      ))
  ) select count(*)::integer into v_total from current_rows;

  with current_rows as (
    select a.id as stable_id, v.*,
      coalesce(v.starts_at,v.window_starts_at,v.due_at,v.recorded_at) as sort_at
    from wf_schedule.allocations a
    join wf_schedule.allocation_versions v on v.id=a.current_version_id and v.allocation_id=a.id and v.owner_id=a.owner_id
    where a.owner_id=v_owner and v.lifecycle_status='ACTIVE'
      and (p_from is null or (
        (v.allocation_kind in ('HARD','SOFT') and v.ends_at>p_from and v.starts_at<p_to)
        or (v.allocation_kind='WINDOWED' and v.window_ends_at>p_from and v.window_starts_at<p_to)
        or (v.allocation_kind='FLOATING' and (v.due_at is null or (v.due_at>=p_from and v.due_at<p_to)))
      ))
    order by sort_at, stable_id
    limit v_limit
  )
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'id',stable_id,'version',id,'label',label,'kind',allocation_kind,'state',allocation_state,
    'starts_at',starts_at,'ends_at',ends_at,'window_starts_at',window_starts_at,'window_ends_at',window_ends_at,
    'due_at',due_at,'expected_duration_seconds',expected_duration_seconds,'zone_id',zone_id,
    'target',case when target_record_id is null then null else pg_catalog.jsonb_build_object(
      'namespace',target_namespace,'type',target_type,'id',target_record_id,'version',target_version_id) end,
    'recorded_at',recorded_at
  ) order by sort_at,stable_id),'[]'::jsonb) into v_items from current_rows;

  return pg_catalog.jsonb_build_object(
    'projection_type','schedule','rule_version','schedule_current_v0.1','computed_at',pg_catalog.clock_timestamp(),
    'scope',case when p_from is null then null else pg_catalog.jsonb_build_object('from',p_from,'to',p_to,'interval_semantics','[start,end)') end,
    'allocations',v_items,'returned_count',pg_catalog.jsonb_array_length(v_items),'matching_record_count',v_total,
    'result_coverage',pg_catalog.jsonb_build_object('completeness',case when pg_catalog.jsonb_array_length(v_items)<v_total then 'PARTIAL' else 'COMPLETE' end,
      'reason',case when pg_catalog.jsonb_array_length(v_items)<v_total then 'RESULT_LIMIT' else null end),
    'epistemic_coverage',pg_catalog.jsonb_build_object('phenomenon','planned_time_allocations','source','wayfinder_schedule_records','completeness','UNKNOWN',
      'reason','Wayfinder schedule records do not prove that all real-world plans have been captured.'),
    'does_not_assert',pg_catalog.jsonb_build_array('that a scheduled activity occurred','that unscheduled time is free','that missing allocations do not exist')
  );
end; $$;

comment on function public.wf_schedule_create_allocation(uuid,text,text,timestamptz,timestamptz,timestamptz,timestamptz,timestamptz,integer,text,text,text,uuid,uuid)
is 'Create one canonical planned Schedule allocation. Planned time never asserts lived occurrence.';
comment on function public.wf_schedule_revise_allocation(uuid,uuid,uuid,text,text,text,timestamptz,timestamptz,timestamptz,timestamptz,timestamptz,integer,text,text,text,uuid,uuid)
is 'Version/reschedule/cancel an existing Schedule allocation with stale-version protection.';
comment on function public.wf_schedule_current_v0(timestamptz,timestamptz,integer)
is 'Read current Schedule allocations with explicit record vs epistemic coverage.';

revoke all on function wf_schedule.valid_zone(text) from public,anon,authenticated;
revoke all on function wf_schedule.protect_allocation_identity_update() from public,anon,authenticated;
revoke all on function wf_schedule.protect_allocation_version_update() from public,anon,authenticated;
revoke all on function wf_schedule.assert_head_integrity() from public,anon,authenticated;
revoke all on function public.wf_schedule_create_allocation(uuid,text,text,timestamptz,timestamptz,timestamptz,timestamptz,timestamptz,integer,text,text,text,uuid,uuid) from public,anon;
revoke all on function public.wf_schedule_revise_allocation(uuid,uuid,uuid,text,text,text,timestamptz,timestamptz,timestamptz,timestamptz,timestamptz,integer,text,text,text,uuid,uuid) from public,anon;
revoke all on function public.wf_schedule_current_v0(timestamptz,timestamptz,integer) from public,anon;
grant execute on function public.wf_schedule_create_allocation(uuid,text,text,timestamptz,timestamptz,timestamptz,timestamptz,timestamptz,integer,text,text,text,uuid,uuid) to authenticated;
grant execute on function public.wf_schedule_revise_allocation(uuid,uuid,uuid,text,text,text,timestamptz,timestamptz,timestamptz,timestamptz,timestamptz,integer,text,text,text,uuid,uuid) to authenticated;
grant execute on function public.wf_schedule_current_v0(timestamptz,timestamptz,integer) to authenticated;

commit;
