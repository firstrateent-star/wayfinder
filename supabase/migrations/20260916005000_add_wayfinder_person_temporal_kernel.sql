begin;

-- Wayfinder Person + Temporal Kernel v0.1
-- Canon source: docs/18-mature-life-rpg-architecture-v0.2.md
--
-- Goals:
--   1) add the smallest canonical Person module;
--   2) keep Person distinct from owner/auth identity;
--   3) preserve correction/version lineage for stable origin facts;
--   4) add shared local-day temporal semantics for later Schedule/Requirement work;
--   5) expose only typed public RPCs to authenticated clients.

create schema if not exists wf_person;
comment on schema wf_person is
  'Wayfinder Person core module: the modeled person, preferred identity, and stable/correctable origin facts.';
revoke all on schema wf_person from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- TEMPORAL KERNEL
-- ---------------------------------------------------------------------------

-- A recurring requirement such as "per day" is scoped to a declared local day,
-- not a naive rolling 24-hour interval. This helper resolves a local calendar day
-- into the real UTC interval for that zone and therefore respects DST.
create or replace function wf_system.local_day_bounds(
  p_local_date date,
  p_zone_id text
)
returns table (
  starts_at timestamptz,
  ends_at timestamptz
)
language plpgsql
stable
set search_path = pg_catalog
as $$
begin
  if p_local_date is null then
    raise exception using errcode = '22023', message = 'LOCAL_DATE_REQUIRED';
  end if;

  if p_zone_id is null
     or btrim(p_zone_id) = ''
     or not exists (
       select 1
         from pg_catalog.pg_timezone_names z
        where z.name = btrim(p_zone_id)
     ) then
    raise exception using errcode = '22023', message = 'INVALID_TIMEZONE';
  end if;

  return query
  select
    (p_local_date::timestamp at time zone btrim(p_zone_id)),
    ((p_local_date + 1)::timestamp at time zone btrim(p_zone_id));
end;
$$;

comment on function wf_system.local_day_bounds(date, text) is
  'Internal temporal-kernel helper. Resolves one declared local calendar day to its half-open UTC interval [start,end), preserving DST/time-zone semantics.';

revoke all on function wf_system.local_day_bounds(date, text)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- PERSON CANONICAL PERSISTENCE
-- ---------------------------------------------------------------------------

-- One modeled player-person per Wayfinder owner in v0.1. Owner remains the
-- authorization/account scope; Person is the modeled human subject.
create table wf_person.persons (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  current_version_id uuid,
  created_at timestamptz not null default now(),
  constraint persons_owner_fk foreign key (owner_id)
    references wf_system.owners(id) on delete restrict,
  constraint persons_id_owner_uq unique (id, owner_id),
  constraint persons_one_per_owner_uq unique (owner_id)
);

create table wf_person.person_versions (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null,
  owner_id uuid not null,
  version_no bigint not null,
  schema_version smallint not null default 1,

  -- Character-creation / origin payload. Do not add Body, Role, Skill, XP,
  -- current location, finances, or Direction facts here.
  display_name text not null,
  birth_date date,
  birth_time_local time without time zone,
  birth_time_accuracy text,
  birth_place_label text,

  lifecycle_status text not null,
  superseded_by_version_id uuid,
  provenance_source_type text not null,
  provenance_source_id text,
  actor_owner_id uuid,
  recorded_at timestamptz not null default now(),

  constraint person_versions_owner_fk foreign key (owner_id)
    references wf_system.owners(id) on delete restrict,
  constraint person_versions_actor_owner_fk foreign key (actor_owner_id)
    references wf_system.owners(id) on delete restrict,
  constraint person_versions_person_owner_fk foreign key (person_id, owner_id)
    references wf_person.persons(id, owner_id) on delete restrict,
  constraint person_versions_person_version_uq unique (person_id, version_no),
  constraint person_versions_id_person_owner_uq unique (id, person_id, owner_id),
  constraint person_versions_version_no_ck check (version_no > 0),
  constraint person_versions_schema_version_ck check (schema_version > 0),
  constraint person_versions_display_name_ck
    check (btrim(display_name) <> '' and char_length(display_name) <= 200),
  constraint person_versions_birth_place_ck
    check (birth_place_label is null or (btrim(birth_place_label) <> '' and char_length(birth_place_label) <= 500)),
  constraint person_versions_birth_time_requires_date_ck
    check (birth_time_local is null or birth_date is not null),
  constraint person_versions_birth_time_shape_ck
    check (
      (birth_time_local is null and birth_time_accuracy is null)
      or
      (birth_time_local is not null and birth_time_accuracy in ('EXACT','APPROXIMATE'))
    ),
  constraint person_versions_lifecycle_ck
    check (lifecycle_status in ('ACTIVE','SUPERSEDED','RETRACTED')),
  constraint person_versions_supersession_shape_ck
    check (
      (lifecycle_status = 'SUPERSEDED' and superseded_by_version_id is not null)
      or
      (lifecycle_status in ('ACTIVE','RETRACTED') and superseded_by_version_id is null)
    )
);

alter table wf_person.person_versions
  add constraint person_versions_superseded_same_record_fk
  foreign key (superseded_by_version_id, person_id, owner_id)
  references wf_person.person_versions(id, person_id, owner_id)
  on delete restrict deferrable initially deferred;

alter table wf_person.persons
  add constraint persons_current_version_same_record_fk
  foreign key (current_version_id, id, owner_id)
  references wf_person.person_versions(id, person_id, owner_id)
  on delete restrict deferrable initially deferred;

create unique index person_versions_one_active_idx
  on wf_person.person_versions (person_id)
  where lifecycle_status = 'ACTIVE';

create index persons_current_version_idx
  on wf_person.persons (current_version_id)
  where current_version_id is not null;

create index person_versions_owner_idx
  on wf_person.person_versions (owner_id);

create index person_versions_actor_owner_idx
  on wf_person.person_versions (actor_owner_id)
  where actor_owner_id is not null;

-- ---------------------------------------------------------------------------
-- PERSON IMMUTABILITY / VERSION-HEAD INVARIANTS
-- ---------------------------------------------------------------------------

create or replace function wf_person.protect_person_identity_update()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if new.id is distinct from old.id
     or new.owner_id is distinct from old.owner_id
     or new.created_at is distinct from old.created_at then
    raise exception using errcode = '55000', message = 'PERSON_IDENTITY_IMMUTABLE';
  end if;
  return new;
end;
$$;

create trigger persons_protect_identity_update_trg
before update on wf_person.persons
for each row execute function wf_person.protect_person_identity_update();

create or replace function wf_person.protect_person_version_update()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  -- Historical semantic payload and provenance are immutable after insertion.
  if new.id is distinct from old.id
     or new.person_id is distinct from old.person_id
     or new.owner_id is distinct from old.owner_id
     or new.version_no is distinct from old.version_no
     or new.schema_version is distinct from old.schema_version
     or new.display_name is distinct from old.display_name
     or new.birth_date is distinct from old.birth_date
     or new.birth_time_local is distinct from old.birth_time_local
     or new.birth_time_accuracy is distinct from old.birth_time_accuracy
     or new.birth_place_label is distinct from old.birth_place_label
     or new.provenance_source_type is distinct from old.provenance_source_type
     or new.provenance_source_id is distinct from old.provenance_source_id
     or new.actor_owner_id is distinct from old.actor_owner_id
     or new.recorded_at is distinct from old.recorded_at then
    raise exception using errcode = '55000', message = 'PERSON_VERSION_PAYLOAD_IMMUTABLE';
  end if;

  -- Lifecycle is monotonic. ACTIVE may become SUPERSEDED or RETRACTED;
  -- historical versions may not silently return to ACTIVE.
  if old.lifecycle_status = 'ACTIVE' then
    if new.lifecycle_status not in ('ACTIVE','SUPERSEDED','RETRACTED') then
      raise exception using errcode = '55000', message = 'INVALID_PERSON_LIFECYCLE_TRANSITION';
    end if;
  elsif new.lifecycle_status is distinct from old.lifecycle_status then
    raise exception using errcode = '55000', message = 'INVALID_PERSON_LIFECYCLE_TRANSITION';
  end if;

  if old.lifecycle_status <> 'ACTIVE'
     and new.superseded_by_version_id is distinct from old.superseded_by_version_id then
    raise exception using errcode = '55000', message = 'PERSON_VERSION_LINEAGE_IMMUTABLE';
  end if;

  if new.lifecycle_status = 'SUPERSEDED' and new.superseded_by_version_id is null then
    raise exception using errcode = '55000', message = 'PERSON_SUPERSESSION_TARGET_REQUIRED';
  end if;

  if new.lifecycle_status in ('ACTIVE','RETRACTED')
     and new.superseded_by_version_id is not null then
    raise exception using errcode = '55000', message = 'INVALID_PERSON_SUPERSESSION_SHAPE';
  end if;

  return new;
end;
$$;

create trigger person_versions_protect_update_trg
before update on wf_person.person_versions
for each row execute function wf_person.protect_person_version_update();

-- Constraint trigger runs at transaction end so create/correction ordering can
-- temporarily move through an incomplete head state inside one transaction.
create or replace function wf_person.assert_person_head_integrity()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_person_id uuid;
  v_owner_id uuid;
  v_current uuid;
  v_current_status text;
  v_active_count integer;
begin
  if tg_table_name = 'persons' then
    if tg_op = 'DELETE' then
      v_person_id := old.id;
      v_owner_id := old.owner_id;
    else
      v_person_id := new.id;
      v_owner_id := new.owner_id;
    end if;
  else
    if tg_op = 'DELETE' then
      v_person_id := old.person_id;
      v_owner_id := old.owner_id;
    else
      v_person_id := new.person_id;
      v_owner_id := new.owner_id;
    end if;
  end if;

  select p.current_version_id
    into v_current
    from wf_person.persons p
   where p.id = v_person_id
     and p.owner_id = v_owner_id;

  if not found then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;

  if v_current is null then
    raise exception using errcode = '23514', message = 'PERSON_CURRENT_VERSION_REQUIRED';
  end if;

  select v.lifecycle_status
    into v_current_status
    from wf_person.person_versions v
   where v.id = v_current
     and v.person_id = v_person_id
     and v.owner_id = v_owner_id;

  if not found then
    raise exception using errcode = '23503', message = 'PERSON_CURRENT_VERSION_MISSING';
  end if;

  if v_current_status = 'SUPERSEDED' then
    raise exception using errcode = '23514', message = 'PERSON_HEAD_CANNOT_BE_SUPERSEDED';
  end if;

  select count(*)::integer
    into v_active_count
    from wf_person.person_versions v
   where v.person_id = v_person_id
     and v.owner_id = v_owner_id
     and v.lifecycle_status = 'ACTIVE';

  if v_current_status = 'ACTIVE' then
    if v_active_count <> 1
       or not exists (
         select 1
           from wf_person.person_versions v
          where v.id = v_current
            and v.person_id = v_person_id
            and v.owner_id = v_owner_id
            and v.lifecycle_status = 'ACTIVE'
       ) then
      raise exception using errcode = '23514', message = 'PERSON_ACTIVE_HEAD_INTEGRITY_VIOLATION';
    end if;
  elsif v_current_status = 'RETRACTED' and v_active_count <> 0 then
    raise exception using errcode = '23514', message = 'PERSON_RETRACTED_HEAD_HAS_ACTIVE_VERSION';
  end if;

  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;

comment on function wf_person.assert_person_head_integrity() is
  'Deferred Person version-head integrity trigger. SECURITY DEFINER is required because it may fire after a public RPC definer context returns while wf_person remains private.';

create constraint trigger persons_head_integrity_trg
after insert or update on wf_person.persons
deferrable initially deferred
for each row execute function wf_person.assert_person_head_integrity();

create constraint trigger person_versions_head_integrity_trg
after insert or update or delete on wf_person.person_versions
deferrable initially deferred
for each row execute function wf_person.assert_person_head_integrity();

-- ---------------------------------------------------------------------------
-- PERSON COMMANDS
-- ---------------------------------------------------------------------------

create or replace function public.wf_person_create(
  p_command_id uuid,
  p_display_name text,
  p_birth_date date default null,
  p_birth_time_local time without time zone default null,
  p_birth_time_accuracy text default null,
  p_birth_place_label text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_owner uuid;
  v_name text;
  v_accuracy text;
  v_place text;
  v_hash text;
  v_claim record;
  v_existing record;
  v_person uuid;
  v_version uuid;
  v_ref jsonb;
begin
  v_owner := wf_system.require_authenticated_owner();
  v_name := btrim(p_display_name);
  v_place := nullif(btrim(p_birth_place_label), '');
  v_accuracy := case
    when p_birth_time_local is null then null
    when p_birth_time_accuracy is null or btrim(p_birth_time_accuracy) = '' then 'EXACT'
    else upper(btrim(p_birth_time_accuracy))
  end;

  v_hash := wf_system.command_hash(pg_catalog.jsonb_build_object(
    'contract','person.create.v1',
    'display_name',v_name,
    'birth_date',p_birth_date,
    'birth_time_local',p_birth_time_local,
    'birth_time_accuracy',v_accuracy,
    'birth_place_label',v_place
  ));

  select * into v_claim
    from wf_system.claim_command(v_owner,p_command_id,'person','person.create',v_hash);
  if not v_claim.is_new then
    return wf_system.command_response(v_owner,p_command_id,true);
  end if;

  if v_name is null or v_name = '' then
    perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'DISPLAY_NAME_REQUIRED');
    return wf_system.command_response(v_owner,p_command_id,false);
  end if;
  if char_length(v_name) > 200 then
    perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'DISPLAY_NAME_TOO_LONG');
    return wf_system.command_response(v_owner,p_command_id,false);
  end if;
  if p_birth_date is not null and p_birth_date > current_date then
    perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'BIRTH_DATE_IN_FUTURE');
    return wf_system.command_response(v_owner,p_command_id,false);
  end if;
  if p_birth_time_local is not null and p_birth_date is null then
    perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'BIRTH_TIME_REQUIRES_DATE');
    return wf_system.command_response(v_owner,p_command_id,false);
  end if;
  if p_birth_time_local is null
     and p_birth_time_accuracy is not null
     and btrim(p_birth_time_accuracy) <> '' then
    perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'BIRTH_TIME_ACCURACY_WITHOUT_TIME');
    return wf_system.command_response(v_owner,p_command_id,false);
  end if;
  if v_accuracy is not null and v_accuracy not in ('EXACT','APPROXIMATE') then
    perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'INVALID_BIRTH_TIME_ACCURACY');
    return wf_system.command_response(v_owner,p_command_id,false);
  end if;
  if v_place is not null and char_length(v_place) > 500 then
    perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'BIRTH_PLACE_TOO_LONG');
    return wf_system.command_response(v_owner,p_command_id,false);
  end if;

  select p.id as person_id, p.current_version_id,
         v.display_name, v.birth_date, v.birth_time_local,
         v.birth_time_accuracy, v.birth_place_label, v.lifecycle_status
    into v_existing
    from wf_person.persons p
    join wf_person.person_versions v
      on v.id = p.current_version_id
     and v.person_id = p.id
     and v.owner_id = p.owner_id
   where p.owner_id = v_owner
   for update of p;

  if found then
    v_ref := pg_catalog.jsonb_build_object(
      'namespace','person','type','person','id',v_existing.person_id,'version',v_existing.current_version_id
    );

    if v_existing.lifecycle_status = 'ACTIVE'
       and v_existing.display_name is not distinct from v_name
       and v_existing.birth_date is not distinct from p_birth_date
       and v_existing.birth_time_local is not distinct from p_birth_time_local
       and v_existing.birth_time_accuracy is not distinct from v_accuracy
       and v_existing.birth_place_label is not distinct from v_place then
      perform wf_system.complete_command(v_owner,p_command_id,'NOOP',pg_catalog.jsonb_build_array(v_ref),null);
    else
      perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',pg_catalog.jsonb_build_array(v_ref),'PERSON_ALREADY_EXISTS');
    end if;
    return wf_system.command_response(v_owner,p_command_id,false);
  end if;

  v_person := gen_random_uuid();
  v_version := gen_random_uuid();

  begin
    insert into wf_person.persons(id,owner_id)
    values (v_person,v_owner);
  exception when unique_violation then
    select p.id as person_id, p.current_version_id,
           v.display_name, v.birth_date, v.birth_time_local,
           v.birth_time_accuracy, v.birth_place_label, v.lifecycle_status
      into v_existing
      from wf_person.persons p
      join wf_person.person_versions v
        on v.id = p.current_version_id
       and v.person_id = p.id
       and v.owner_id = p.owner_id
     where p.owner_id = v_owner
     for update of p;

    if found then
      v_ref := pg_catalog.jsonb_build_object(
        'namespace','person','type','person','id',v_existing.person_id,'version',v_existing.current_version_id
      );
      if v_existing.lifecycle_status = 'ACTIVE'
         and v_existing.display_name is not distinct from v_name
         and v_existing.birth_date is not distinct from p_birth_date
         and v_existing.birth_time_local is not distinct from p_birth_time_local
         and v_existing.birth_time_accuracy is not distinct from v_accuracy
         and v_existing.birth_place_label is not distinct from v_place then
        perform wf_system.complete_command(v_owner,p_command_id,'NOOP',pg_catalog.jsonb_build_array(v_ref),null);
      else
        perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',pg_catalog.jsonb_build_array(v_ref),'PERSON_ALREADY_EXISTS');
      end if;
      return wf_system.command_response(v_owner,p_command_id,false);
    end if;
    raise;
  end;

  insert into wf_person.person_versions(
    id,person_id,owner_id,version_no,
    display_name,birth_date,birth_time_local,birth_time_accuracy,birth_place_label,
    lifecycle_status,provenance_source_type,actor_owner_id
  ) values (
    v_version,v_person,v_owner,1,
    v_name,p_birth_date,p_birth_time_local,v_accuracy,v_place,
    'ACTIVE','USER_ENTRY',v_owner
  );

  update wf_person.persons
     set current_version_id = v_version
   where id = v_person and owner_id = v_owner;

  v_ref := pg_catalog.jsonb_build_object(
    'namespace','person','type','person','id',v_person,'version',v_version
  );

  perform wf_system.complete_command(
    v_owner,p_command_id,'APPLIED',pg_catalog.jsonb_build_array(v_ref),null
  );

  insert into wf_system.module_change_outbox(
    owner_id,module_id,change_type,command_id,affected
  ) values (
    v_owner,'person','person.created',p_command_id,
    pg_catalog.jsonb_build_array(
      pg_catalog.jsonb_build_object('operation','CREATED','ref',v_ref)
    )
  );

  return wf_system.command_response(v_owner,p_command_id,false);
end;
$$;

create or replace function public.wf_person_update_profile(
  p_command_id uuid,
  p_person_id uuid,
  p_expected_version_id uuid,
  p_display_name text,
  p_birth_date date default null,
  p_birth_time_local time without time zone default null,
  p_birth_time_accuracy text default null,
  p_birth_place_label text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_owner uuid;
  v_name text;
  v_accuracy text;
  v_place text;
  v_hash text;
  v_claim record;
  v_current uuid;
  v_old record;
  v_new uuid;
  v_old_ref jsonb;
  v_new_ref jsonb;
begin
  v_owner := wf_system.require_authenticated_owner();
  v_name := btrim(p_display_name);
  v_place := nullif(btrim(p_birth_place_label), '');
  v_accuracy := case
    when p_birth_time_local is null then null
    when p_birth_time_accuracy is null or btrim(p_birth_time_accuracy) = '' then 'EXACT'
    else upper(btrim(p_birth_time_accuracy))
  end;

  v_hash := wf_system.command_hash(pg_catalog.jsonb_build_object(
    'contract','person.update_profile.v1',
    'person_id',p_person_id,
    'expected_version_id',p_expected_version_id,
    'display_name',v_name,
    'birth_date',p_birth_date,
    'birth_time_local',p_birth_time_local,
    'birth_time_accuracy',v_accuracy,
    'birth_place_label',v_place
  ));

  select * into v_claim
    from wf_system.claim_command(v_owner,p_command_id,'person','person.update_profile',v_hash);
  if not v_claim.is_new then
    return wf_system.command_response(v_owner,p_command_id,true);
  end if;

  if p_person_id is null or p_expected_version_id is null then
    perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'PERSON_REF_REQUIRED');
    return wf_system.command_response(v_owner,p_command_id,false);
  end if;
  if v_name is null or v_name = '' then
    perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'DISPLAY_NAME_REQUIRED');
    return wf_system.command_response(v_owner,p_command_id,false);
  end if;
  if char_length(v_name) > 200 then
    perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'DISPLAY_NAME_TOO_LONG');
    return wf_system.command_response(v_owner,p_command_id,false);
  end if;
  if p_birth_date is not null and p_birth_date > current_date then
    perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'BIRTH_DATE_IN_FUTURE');
    return wf_system.command_response(v_owner,p_command_id,false);
  end if;
  if p_birth_time_local is not null and p_birth_date is null then
    perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'BIRTH_TIME_REQUIRES_DATE');
    return wf_system.command_response(v_owner,p_command_id,false);
  end if;
  if p_birth_time_local is null
     and p_birth_time_accuracy is not null
     and btrim(p_birth_time_accuracy) <> '' then
    perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'BIRTH_TIME_ACCURACY_WITHOUT_TIME');
    return wf_system.command_response(v_owner,p_command_id,false);
  end if;
  if v_accuracy is not null and v_accuracy not in ('EXACT','APPROXIMATE') then
    perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'INVALID_BIRTH_TIME_ACCURACY');
    return wf_system.command_response(v_owner,p_command_id,false);
  end if;
  if v_place is not null and char_length(v_place) > 500 then
    perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'BIRTH_PLACE_TOO_LONG');
    return wf_system.command_response(v_owner,p_command_id,false);
  end if;

  select p.current_version_id
    into v_current
    from wf_person.persons p
   where p.id = p_person_id
     and p.owner_id = v_owner
   for update;

  if not found then
    perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'PERSON_NOT_FOUND');
    return wf_system.command_response(v_owner,p_command_id,false);
  end if;

  if v_current is distinct from p_expected_version_id then
    perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'STALE_VERSION');
    return wf_system.command_response(v_owner,p_command_id,false);
  end if;

  select v.*
    into v_old
    from wf_person.person_versions v
   where v.id = v_current
     and v.person_id = p_person_id
     and v.owner_id = v_owner;

  if not found or v_old.lifecycle_status <> 'ACTIVE' then
    perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'PERSON_NOT_ACTIVE');
    return wf_system.command_response(v_owner,p_command_id,false);
  end if;

  v_old_ref := pg_catalog.jsonb_build_object(
    'namespace','person','type','person','id',p_person_id,'version',v_current
  );

  if v_old.display_name is not distinct from v_name
     and v_old.birth_date is not distinct from p_birth_date
     and v_old.birth_time_local is not distinct from p_birth_time_local
     and v_old.birth_time_accuracy is not distinct from v_accuracy
     and v_old.birth_place_label is not distinct from v_place then
    perform wf_system.complete_command(
      v_owner,p_command_id,'NOOP',pg_catalog.jsonb_build_array(v_old_ref),null
    );
    return wf_system.command_response(v_owner,p_command_id,false);
  end if;

  v_new := gen_random_uuid();

  update wf_person.person_versions
     set lifecycle_status = 'SUPERSEDED',
         superseded_by_version_id = v_new
   where id = v_current
     and person_id = p_person_id
     and owner_id = v_owner;

  insert into wf_person.person_versions(
    id,person_id,owner_id,version_no,
    display_name,birth_date,birth_time_local,birth_time_accuracy,birth_place_label,
    lifecycle_status,provenance_source_type,actor_owner_id
  ) values (
    v_new,p_person_id,v_owner,v_old.version_no + 1,
    v_name,p_birth_date,p_birth_time_local,v_accuracy,v_place,
    'ACTIVE','USER_ENTRY',v_owner
  );

  update wf_person.persons
     set current_version_id = v_new
   where id = p_person_id and owner_id = v_owner;

  v_new_ref := pg_catalog.jsonb_build_object(
    'namespace','person','type','person','id',p_person_id,'version',v_new
  );

  perform wf_system.complete_command(
    v_owner,p_command_id,'APPLIED',pg_catalog.jsonb_build_array(v_old_ref,v_new_ref),null
  );

  insert into wf_system.module_change_outbox(
    owner_id,module_id,change_type,command_id,affected
  ) values (
    v_owner,'person','person.profile.updated',p_command_id,
    pg_catalog.jsonb_build_array(
      pg_catalog.jsonb_build_object('operation','SUPERSEDED','ref',v_old_ref),
      pg_catalog.jsonb_build_object('operation','CREATED','ref',v_new_ref)
    )
  );

  return wf_system.command_response(v_owner,p_command_id,false);
end;
$$;

-- ---------------------------------------------------------------------------
-- PERSON READ
-- ---------------------------------------------------------------------------

create or replace function public.wf_person_current_v0()
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  v_owner uuid;
  v_person jsonb;
begin
  v_owner := wf_system.require_authenticated_owner();

  select pg_catalog.jsonb_build_object(
    'ref', pg_catalog.jsonb_build_object(
      'namespace','person',
      'type','person',
      'id',p.id,
      'version',v.id
    ),
    'display_name',v.display_name,
    'birth_date',v.birth_date,
    'birth_time_local',v.birth_time_local,
    'birth_time_accuracy',v.birth_time_accuracy,
    'birth_place_label',v.birth_place_label,
    'recorded_at',v.recorded_at
  )
    into v_person
    from wf_person.persons p
    join wf_person.person_versions v
      on v.id = p.current_version_id
     and v.person_id = p.id
     and v.owner_id = p.owner_id
   where p.owner_id = v_owner
     and v.lifecycle_status = 'ACTIVE';

  return pg_catalog.jsonb_build_object(
    'rule_version','person_current_v0.1',
    'evaluated_at',pg_catalog.clock_timestamp(),
    'person',v_person,
    'result_coverage',pg_catalog.jsonb_build_object(
      'status','COMPLETE',
      'scope','current active canonical Person record for authenticated owner'
    ),
    'epistemic_coverage',pg_catalog.jsonb_build_object(
      'status',case when v_person is null then 'UNKNOWN' else 'PARTIAL' end,
      'note',case
        when v_person is null then 'No canonical Person profile is recorded; this does not imply the person or their attributes are absent.'
        else 'Person v0.1 intentionally models only preferred identity and birth/origin facts.'
      end
    )
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- PRIVILEGE BOUNDARY
-- ---------------------------------------------------------------------------

revoke all on all tables in schema wf_person from public, anon, authenticated;
revoke all on all sequences in schema wf_person from public, anon, authenticated;

revoke all on function wf_person.protect_person_identity_update() from public, anon, authenticated;
revoke all on function wf_person.protect_person_version_update() from public, anon, authenticated;
revoke all on function wf_person.assert_person_head_integrity() from public, anon, authenticated;

revoke all on function public.wf_person_create(uuid,text,date,time without time zone,text,text)
  from public, anon;
revoke all on function public.wf_person_update_profile(uuid,uuid,uuid,text,date,time without time zone,text,text)
  from public, anon;
revoke all on function public.wf_person_current_v0()
  from public, anon;

grant execute on function public.wf_person_create(uuid,text,date,time without time zone,text,text)
  to authenticated;
grant execute on function public.wf_person_update_profile(uuid,uuid,uuid,text,date,time without time zone,text,text)
  to authenticated;
grant execute on function public.wf_person_current_v0()
  to authenticated;

commit;
