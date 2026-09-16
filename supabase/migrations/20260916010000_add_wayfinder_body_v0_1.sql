begin;

-- Wayfinder Body v0.1
-- First asymmetric reality-domain slice after Person.
--
-- This module intentionally models only sourced physical measurements that have
-- distinct factual semantics. It is not a generic health table and does not
-- persist BMI, stamina, recovery, health judgments, or RPG stats.

create schema if not exists wf_body;
comment on schema wf_body is
  'Wayfinder Body life-domain module: temporal physical measurements and body-state facts admitted by explicit contracts.';
revoke all on schema wf_body from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- CANONICAL MEASUREMENTS
-- ---------------------------------------------------------------------------

-- Metric kind is stable across correction. A mistaken kind (for example a
-- weight recorded as height) should be retracted/re-recorded rather than
-- silently changing the logical record's identity.
create table wf_body.measurements (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  metric text not null,
  current_version_id uuid,
  created_at timestamptz not null default now(),
  constraint body_measurements_owner_fk foreign key (owner_id)
    references wf_system.owners(id) on delete restrict,
  constraint body_measurements_id_owner_uq unique (id, owner_id),
  constraint body_measurements_metric_ck check (metric in ('height','weight'))
);

create table wf_body.measurement_versions (
  id uuid primary key default gen_random_uuid(),
  measurement_id uuid not null,
  owner_id uuid not null,
  version_no bigint not null,
  schema_version smallint not null default 1,

  -- Preserve the reported quantity. Unit conversion is a deterministic
  -- derivation performed by reads, not rewritten into canonical source truth.
  value numeric(14,4) not null,
  unit text not null,

  -- A Body measurement is a reality observation at a declared time. recorded_at
  -- remains separate so "measured" and "entered into Wayfinder" never collapse.
  observed_at timestamptz not null,
  observed_zone_id text,

  lifecycle_status text not null,
  superseded_by_version_id uuid,
  provenance_source_type text not null,
  provenance_source_id text,
  actor_owner_id uuid,
  recorded_at timestamptz not null default now(),

  constraint body_measurement_versions_owner_fk foreign key (owner_id)
    references wf_system.owners(id) on delete restrict,
  constraint body_measurement_versions_actor_owner_fk foreign key (actor_owner_id)
    references wf_system.owners(id) on delete restrict,
  constraint body_measurement_versions_measurement_owner_fk foreign key (measurement_id, owner_id)
    references wf_body.measurements(id, owner_id) on delete restrict,
  constraint body_measurement_versions_measurement_version_uq unique (measurement_id, version_no),
  constraint body_measurement_versions_id_measurement_owner_uq unique (id, measurement_id, owner_id),
  constraint body_measurement_versions_version_no_ck check (version_no > 0),
  constraint body_measurement_versions_schema_version_ck check (schema_version > 0),
  constraint body_measurement_versions_positive_value_ck check (value > 0),
  constraint body_measurement_versions_unit_ck check (unit in ('cm','m','in','kg','lb')),
  constraint body_measurement_versions_lifecycle_ck
    check (lifecycle_status in ('ACTIVE','SUPERSEDED','RETRACTED')),
  constraint body_measurement_versions_supersession_shape_ck
    check (
      (lifecycle_status = 'SUPERSEDED' and superseded_by_version_id is not null)
      or
      (lifecycle_status in ('ACTIVE','RETRACTED') and superseded_by_version_id is null)
    )
);

alter table wf_body.measurement_versions
  add constraint body_measurement_versions_superseded_same_record_fk
  foreign key (superseded_by_version_id, measurement_id, owner_id)
  references wf_body.measurement_versions(id, measurement_id, owner_id)
  on delete restrict deferrable initially deferred;

alter table wf_body.measurements
  add constraint body_measurements_current_version_same_record_fk
  foreign key (current_version_id, id, owner_id)
  references wf_body.measurement_versions(id, measurement_id, owner_id)
  on delete restrict deferrable initially deferred;

create unique index body_measurement_versions_one_active_idx
  on wf_body.measurement_versions (measurement_id)
  where lifecycle_status = 'ACTIVE';

create index body_measurements_owner_metric_idx
  on wf_body.measurements (owner_id, metric);

create index body_measurements_current_version_idx
  on wf_body.measurements (current_version_id)
  where current_version_id is not null;

create index body_measurement_versions_owner_observed_idx
  on wf_body.measurement_versions (owner_id, observed_at desc)
  where lifecycle_status = 'ACTIVE';

create index body_measurement_versions_actor_owner_idx
  on wf_body.measurement_versions (actor_owner_id)
  where actor_owner_id is not null;

-- ---------------------------------------------------------------------------
-- VALIDATION / IMMUTABILITY
-- ---------------------------------------------------------------------------

create or replace function wf_body.protect_measurement_identity_update()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if new.id is distinct from old.id
     or new.owner_id is distinct from old.owner_id
     or new.metric is distinct from old.metric
     or new.created_at is distinct from old.created_at then
    raise exception using errcode = '55000', message = 'BODY_MEASUREMENT_IDENTITY_IMMUTABLE';
  end if;
  return new;
end;
$$;

create trigger body_measurements_protect_identity_update_trg
before update on wf_body.measurements
for each row execute function wf_body.protect_measurement_identity_update();

-- Database-level metric/unit compatibility so no future writer can bypass the
-- domain's core quantity semantics merely by skipping public command validation.
create or replace function wf_body.validate_measurement_version_payload()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
declare
  v_metric text;
begin
  select m.metric into v_metric
    from wf_body.measurements m
   where m.id = new.measurement_id
     and m.owner_id = new.owner_id;

  if v_metric is null then
    raise exception using errcode = '23503', message = 'BODY_MEASUREMENT_NOT_FOUND';
  end if;

  if v_metric = 'height' and new.unit not in ('cm','m','in') then
    raise exception using errcode = '23514', message = 'INVALID_HEIGHT_UNIT';
  end if;

  if v_metric = 'weight' and new.unit not in ('kg','lb') then
    raise exception using errcode = '23514', message = 'INVALID_WEIGHT_UNIT';
  end if;

  if new.observed_zone_id is not null
     and not exists (
       select 1 from pg_catalog.pg_timezone_names z
        where z.name = new.observed_zone_id
     ) then
    raise exception using errcode = '23514', message = 'INVALID_TIMEZONE';
  end if;

  return new;
end;
$$;

create trigger body_measurement_versions_validate_payload_trg
before insert on wf_body.measurement_versions
for each row execute function wf_body.validate_measurement_version_payload();

create or replace function wf_body.protect_measurement_version_update()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if new.id is distinct from old.id
     or new.measurement_id is distinct from old.measurement_id
     or new.owner_id is distinct from old.owner_id
     or new.version_no is distinct from old.version_no
     or new.schema_version is distinct from old.schema_version
     or new.value is distinct from old.value
     or new.unit is distinct from old.unit
     or new.observed_at is distinct from old.observed_at
     or new.observed_zone_id is distinct from old.observed_zone_id
     or new.provenance_source_type is distinct from old.provenance_source_type
     or new.provenance_source_id is distinct from old.provenance_source_id
     or new.actor_owner_id is distinct from old.actor_owner_id
     or new.recorded_at is distinct from old.recorded_at then
    raise exception using errcode = '55000', message = 'BODY_MEASUREMENT_VERSION_PAYLOAD_IMMUTABLE';
  end if;

  if old.lifecycle_status = 'ACTIVE' then
    if new.lifecycle_status not in ('ACTIVE','SUPERSEDED','RETRACTED') then
      raise exception using errcode = '55000', message = 'INVALID_BODY_MEASUREMENT_LIFECYCLE_TRANSITION';
    end if;
  elsif new.lifecycle_status is distinct from old.lifecycle_status then
    raise exception using errcode = '55000', message = 'INVALID_BODY_MEASUREMENT_LIFECYCLE_TRANSITION';
  end if;

  if old.lifecycle_status <> 'ACTIVE'
     and new.superseded_by_version_id is distinct from old.superseded_by_version_id then
    raise exception using errcode = '55000', message = 'BODY_MEASUREMENT_LINEAGE_IMMUTABLE';
  end if;

  if new.lifecycle_status = 'SUPERSEDED' and new.superseded_by_version_id is null then
    raise exception using errcode = '55000', message = 'BODY_MEASUREMENT_SUPERSESSION_TARGET_REQUIRED';
  end if;

  if new.lifecycle_status in ('ACTIVE','RETRACTED')
     and new.superseded_by_version_id is not null then
    raise exception using errcode = '55000', message = 'INVALID_BODY_MEASUREMENT_SUPERSESSION_SHAPE';
  end if;

  return new;
end;
$$;

create trigger body_measurement_versions_protect_update_trg
before update on wf_body.measurement_versions
for each row execute function wf_body.protect_measurement_version_update();

create or replace function wf_body.assert_measurement_head_integrity()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_measurement_id uuid;
  v_owner_id uuid;
  v_current uuid;
  v_current_status text;
  v_active_count integer;
begin
  if tg_table_name = 'measurements' then
    if tg_op = 'DELETE' then
      v_measurement_id := old.id; v_owner_id := old.owner_id;
    else
      v_measurement_id := new.id; v_owner_id := new.owner_id;
    end if;
  else
    if tg_op = 'DELETE' then
      v_measurement_id := old.measurement_id; v_owner_id := old.owner_id;
    else
      v_measurement_id := new.measurement_id; v_owner_id := new.owner_id;
    end if;
  end if;

  select m.current_version_id into v_current
    from wf_body.measurements m
   where m.id = v_measurement_id
     and m.owner_id = v_owner_id;

  if not found then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;

  if v_current is null then
    raise exception using errcode = '23514', message = 'BODY_MEASUREMENT_CURRENT_VERSION_REQUIRED';
  end if;

  select v.lifecycle_status into v_current_status
    from wf_body.measurement_versions v
   where v.id = v_current
     and v.measurement_id = v_measurement_id
     and v.owner_id = v_owner_id;

  if not found then
    raise exception using errcode = '23503', message = 'BODY_MEASUREMENT_CURRENT_VERSION_MISSING';
  end if;

  if v_current_status = 'SUPERSEDED' then
    raise exception using errcode = '23514', message = 'BODY_MEASUREMENT_HEAD_CANNOT_BE_SUPERSEDED';
  end if;

  select count(*)::integer into v_active_count
    from wf_body.measurement_versions v
   where v.measurement_id = v_measurement_id
     and v.owner_id = v_owner_id
     and v.lifecycle_status = 'ACTIVE';

  if v_current_status = 'ACTIVE' then
    if v_active_count <> 1
       or not exists (
         select 1
           from wf_body.measurement_versions v
          where v.id = v_current
            and v.measurement_id = v_measurement_id
            and v.owner_id = v_owner_id
            and v.lifecycle_status = 'ACTIVE'
       ) then
      raise exception using errcode = '23514', message = 'BODY_MEASUREMENT_ACTIVE_HEAD_INTEGRITY_VIOLATION';
    end if;
  elsif v_current_status = 'RETRACTED' and v_active_count <> 0 then
    raise exception using errcode = '23514', message = 'BODY_MEASUREMENT_RETRACTED_HEAD_HAS_ACTIVE_VERSION';
  end if;

  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;

comment on function wf_body.assert_measurement_head_integrity() is
  'Deferred Body measurement version-head integrity trigger. SECURITY DEFINER preserves private-schema checks after public RPC definer context returns.';

create constraint trigger body_measurements_head_integrity_trg
after insert or update on wf_body.measurements
deferrable initially deferred
for each row execute function wf_body.assert_measurement_head_integrity();

create constraint trigger body_measurement_versions_head_integrity_trg
after insert or update or delete on wf_body.measurement_versions
deferrable initially deferred
for each row execute function wf_body.assert_measurement_head_integrity();

-- ---------------------------------------------------------------------------
-- DETERMINISTIC QUANTITY DERIVATION
-- ---------------------------------------------------------------------------

create or replace function wf_body.normalized_quantity(
  p_metric text,
  p_value numeric,
  p_unit text
)
returns jsonb
language plpgsql
immutable
set search_path = pg_catalog
as $$
begin
  if p_metric = 'height' then
    return pg_catalog.jsonb_build_object(
      'value', case p_unit
        when 'cm' then p_value
        when 'm' then p_value * 100
        when 'in' then p_value * 2.54
        else null
      end,
      'unit','cm',
      'derivation','DETERMINISTIC'
    );
  elsif p_metric = 'weight' then
    return pg_catalog.jsonb_build_object(
      'value', case p_unit
        when 'kg' then p_value
        when 'lb' then p_value * 0.45359237
        else null
      end,
      'unit','kg',
      'derivation','DETERMINISTIC'
    );
  end if;

  raise exception using errcode = '22023', message = 'UNSUPPORTED_BODY_METRIC';
end;
$$;

revoke all on function wf_body.normalized_quantity(text,numeric,text)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- COMMANDS
-- ---------------------------------------------------------------------------

create or replace function public.wf_body_record_measurement(
  p_command_id uuid,
  p_metric text,
  p_value numeric,
  p_unit text,
  p_observed_at timestamptz default null,
  p_observed_zone_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_owner uuid;
  v_metric text;
  v_unit text;
  v_zone text;
  v_observed_at timestamptz;
  v_hash text;
  v_claim record;
  v_measurement uuid;
  v_version uuid;
  v_ref jsonb;
begin
  v_owner := wf_system.require_authenticated_owner();
  v_metric := lower(btrim(p_metric));
  v_zone := nullif(btrim(p_observed_zone_id),'');

  v_unit := case lower(btrim(p_unit))
    when 'cm' then 'cm'
    when 'centimeter' then 'cm'
    when 'centimeters' then 'cm'
    when 'm' then 'm'
    when 'meter' then 'm'
    when 'meters' then 'm'
    when 'in' then 'in'
    when 'inch' then 'in'
    when 'inches' then 'in'
    when 'kg' then 'kg'
    when 'kgs' then 'kg'
    when 'kilogram' then 'kg'
    when 'kilograms' then 'kg'
    when 'lb' then 'lb'
    when 'lbs' then 'lb'
    when 'pound' then 'lb'
    when 'pounds' then 'lb'
    else null
  end;

  -- Hash the caller's semantic request. A null observed_at deliberately stays
  -- null in retry identity; the first execution resolves it to clock time.
  v_hash := wf_system.command_hash(pg_catalog.jsonb_build_object(
    'contract','body.record_measurement.v1',
    'metric',v_metric,
    'value',p_value,
    'unit',v_unit,
    'observed_at',p_observed_at,
    'observed_zone_id',v_zone
  ));

  select * into v_claim
    from wf_system.claim_command(v_owner,p_command_id,'body','body.record_measurement',v_hash);
  if not v_claim.is_new then
    return wf_system.command_response(v_owner,p_command_id,true);
  end if;

  if v_metric not in ('height','weight') then
    perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'INVALID_BODY_METRIC');
    return wf_system.command_response(v_owner,p_command_id,false);
  end if;

  if p_value is null or p_value <= 0 then
    perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'INVALID_BODY_MEASUREMENT_VALUE');
    return wf_system.command_response(v_owner,p_command_id,false);
  end if;

  if v_unit is null
     or (v_metric = 'height' and v_unit not in ('cm','m','in'))
     or (v_metric = 'weight' and v_unit not in ('kg','lb')) then
    perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'INVALID_BODY_MEASUREMENT_UNIT');
    return wf_system.command_response(v_owner,p_command_id,false);
  end if;

  if v_zone is not null
     and not exists (select 1 from pg_catalog.pg_timezone_names z where z.name=v_zone) then
    perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'INVALID_TIMEZONE');
    return wf_system.command_response(v_owner,p_command_id,false);
  end if;

  v_observed_at := coalesce(p_observed_at, pg_catalog.clock_timestamp());
  v_measurement := gen_random_uuid();
  v_version := gen_random_uuid();

  insert into wf_body.measurements(id,owner_id,metric)
  values (v_measurement,v_owner,v_metric);

  insert into wf_body.measurement_versions(
    id,measurement_id,owner_id,version_no,value,unit,observed_at,observed_zone_id,
    lifecycle_status,provenance_source_type,actor_owner_id
  ) values (
    v_version,v_measurement,v_owner,1,p_value,v_unit,v_observed_at,v_zone,
    'ACTIVE','USER_ENTRY',v_owner
  );

  update wf_body.measurements
     set current_version_id = v_version
   where id = v_measurement and owner_id = v_owner;

  v_ref := pg_catalog.jsonb_build_object(
    'namespace','body','type','measurement','id',v_measurement,'version',v_version
  );

  perform wf_system.complete_command(
    v_owner,p_command_id,'APPLIED',pg_catalog.jsonb_build_array(v_ref),null
  );

  insert into wf_system.module_change_outbox(
    owner_id,module_id,change_type,command_id,affected
  ) values (
    v_owner,'body','body.measurement.recorded',p_command_id,
    pg_catalog.jsonb_build_array(
      pg_catalog.jsonb_build_object('operation','CREATED','ref',v_ref,'metric',v_metric)
    )
  );

  return wf_system.command_response(v_owner,p_command_id,false);
end;
$$;

create or replace function public.wf_body_correct_measurement(
  p_command_id uuid,
  p_measurement_id uuid,
  p_expected_version_id uuid,
  p_value numeric,
  p_unit text,
  p_observed_at timestamptz,
  p_observed_zone_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_owner uuid;
  v_metric text;
  v_unit text;
  v_zone text;
  v_hash text;
  v_claim record;
  v_current uuid;
  v_old record;
  v_new uuid;
  v_old_ref jsonb;
  v_new_ref jsonb;
begin
  v_owner := wf_system.require_authenticated_owner();
  v_zone := nullif(btrim(p_observed_zone_id),'');

  v_unit := case lower(btrim(p_unit))
    when 'cm' then 'cm'
    when 'centimeter' then 'cm'
    when 'centimeters' then 'cm'
    when 'm' then 'm'
    when 'meter' then 'm'
    when 'meters' then 'm'
    when 'in' then 'in'
    when 'inch' then 'in'
    when 'inches' then 'in'
    when 'kg' then 'kg'
    when 'kgs' then 'kg'
    when 'kilogram' then 'kg'
    when 'kilograms' then 'kg'
    when 'lb' then 'lb'
    when 'lbs' then 'lb'
    when 'pound' then 'lb'
    when 'pounds' then 'lb'
    else null
  end;

  v_hash := wf_system.command_hash(pg_catalog.jsonb_build_object(
    'contract','body.correct_measurement.v1',
    'measurement_id',p_measurement_id,
    'expected_version_id',p_expected_version_id,
    'value',p_value,
    'unit',v_unit,
    'observed_at',p_observed_at,
    'observed_zone_id',v_zone
  ));

  select * into v_claim
    from wf_system.claim_command(v_owner,p_command_id,'body','body.correct_measurement',v_hash);
  if not v_claim.is_new then
    return wf_system.command_response(v_owner,p_command_id,true);
  end if;

  if p_measurement_id is null or p_expected_version_id is null then
    perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'BODY_MEASUREMENT_REF_REQUIRED');
    return wf_system.command_response(v_owner,p_command_id,false);
  end if;

  if p_value is null or p_value <= 0 or p_observed_at is null then
    perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'INVALID_BODY_MEASUREMENT_PAYLOAD');
    return wf_system.command_response(v_owner,p_command_id,false);
  end if;

  if v_zone is not null
     and not exists (select 1 from pg_catalog.pg_timezone_names z where z.name=v_zone) then
    perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'INVALID_TIMEZONE');
    return wf_system.command_response(v_owner,p_command_id,false);
  end if;

  select m.metric, m.current_version_id
    into v_metric, v_current
    from wf_body.measurements m
   where m.id = p_measurement_id
     and m.owner_id = v_owner
   for update;

  if not found then
    perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'BODY_MEASUREMENT_NOT_FOUND');
    return wf_system.command_response(v_owner,p_command_id,false);
  end if;

  if v_current is distinct from p_expected_version_id then
    perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'STALE_VERSION');
    return wf_system.command_response(v_owner,p_command_id,false);
  end if;

  if v_unit is null
     or (v_metric = 'height' and v_unit not in ('cm','m','in'))
     or (v_metric = 'weight' and v_unit not in ('kg','lb')) then
    perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'INVALID_BODY_MEASUREMENT_UNIT');
    return wf_system.command_response(v_owner,p_command_id,false);
  end if;

  select v.* into v_old
    from wf_body.measurement_versions v
   where v.id = v_current
     and v.measurement_id = p_measurement_id
     and v.owner_id = v_owner;

  if not found or v_old.lifecycle_status <> 'ACTIVE' then
    perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'BODY_MEASUREMENT_NOT_ACTIVE');
    return wf_system.command_response(v_owner,p_command_id,false);
  end if;

  v_old_ref := pg_catalog.jsonb_build_object(
    'namespace','body','type','measurement','id',p_measurement_id,'version',v_current
  );

  if v_old.value is not distinct from p_value
     and v_old.unit is not distinct from v_unit
     and v_old.observed_at is not distinct from p_observed_at
     and v_old.observed_zone_id is not distinct from v_zone then
    perform wf_system.complete_command(
      v_owner,p_command_id,'NOOP',pg_catalog.jsonb_build_array(v_old_ref),null
    );
    return wf_system.command_response(v_owner,p_command_id,false);
  end if;

  v_new := gen_random_uuid();

  update wf_body.measurement_versions
     set lifecycle_status = 'SUPERSEDED',
         superseded_by_version_id = v_new
   where id = v_current
     and measurement_id = p_measurement_id
     and owner_id = v_owner;

  insert into wf_body.measurement_versions(
    id,measurement_id,owner_id,version_no,value,unit,observed_at,observed_zone_id,
    lifecycle_status,provenance_source_type,actor_owner_id
  ) values (
    v_new,p_measurement_id,v_owner,v_old.version_no + 1,p_value,v_unit,p_observed_at,v_zone,
    'ACTIVE','USER_ENTRY',v_owner
  );

  update wf_body.measurements
     set current_version_id = v_new
   where id = p_measurement_id and owner_id = v_owner;

  v_new_ref := pg_catalog.jsonb_build_object(
    'namespace','body','type','measurement','id',p_measurement_id,'version',v_new
  );

  perform wf_system.complete_command(
    v_owner,p_command_id,'APPLIED',pg_catalog.jsonb_build_array(v_old_ref,v_new_ref),null
  );

  insert into wf_system.module_change_outbox(
    owner_id,module_id,change_type,command_id,affected
  ) values (
    v_owner,'body','body.measurement.corrected',p_command_id,
    pg_catalog.jsonb_build_array(
      pg_catalog.jsonb_build_object('operation','SUPERSEDED','ref',v_old_ref,'metric',v_metric),
      pg_catalog.jsonb_build_object('operation','CREATED','ref',v_new_ref,'metric',v_metric)
    )
  );

  return wf_system.command_response(v_owner,p_command_id,false);
end;
$$;

-- ---------------------------------------------------------------------------
-- CURRENT BODY READ
-- ---------------------------------------------------------------------------

create or replace function public.wf_body_current_v0()
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  v_owner uuid;
  v_height jsonb;
  v_weight jsonb;
begin
  v_owner := wf_system.require_authenticated_owner();

  select pg_catalog.jsonb_build_object(
    'ref',pg_catalog.jsonb_build_object('namespace','body','type','measurement','id',m.id,'version',v.id),
    'metric',m.metric,
    'reported',pg_catalog.jsonb_build_object('value',v.value,'unit',v.unit),
    'normalized',wf_body.normalized_quantity(m.metric,v.value,v.unit),
    'observed_at',v.observed_at,
    'observed_zone_id',v.observed_zone_id,
    'recorded_at',v.recorded_at
  ) into v_height
  from wf_body.measurements m
  join wf_body.measurement_versions v
    on v.id=m.current_version_id
   and v.measurement_id=m.id
   and v.owner_id=m.owner_id
  where m.owner_id=v_owner
    and m.metric='height'
    and v.lifecycle_status='ACTIVE'
  order by v.observed_at desc, v.recorded_at desc, v.id desc
  limit 1;

  select pg_catalog.jsonb_build_object(
    'ref',pg_catalog.jsonb_build_object('namespace','body','type','measurement','id',m.id,'version',v.id),
    'metric',m.metric,
    'reported',pg_catalog.jsonb_build_object('value',v.value,'unit',v.unit),
    'normalized',wf_body.normalized_quantity(m.metric,v.value,v.unit),
    'observed_at',v.observed_at,
    'observed_zone_id',v.observed_zone_id,
    'recorded_at',v.recorded_at
  ) into v_weight
  from wf_body.measurements m
  join wf_body.measurement_versions v
    on v.id=m.current_version_id
   and v.measurement_id=m.id
   and v.owner_id=m.owner_id
  where m.owner_id=v_owner
    and m.metric='weight'
    and v.lifecycle_status='ACTIVE'
  order by v.observed_at desc, v.recorded_at desc, v.id desc
  limit 1;

  return pg_catalog.jsonb_build_object(
    'projection_type','body_current',
    'rule_version','body_current_v0.1',
    'evaluated_at',pg_catalog.clock_timestamp(),
    'height',v_height,
    'weight',v_weight,
    'result_coverage',pg_catalog.jsonb_build_object(
      'status','COMPLETE',
      'scope','latest active canonical Body measurement per admitted metric for authenticated owner'
    ),
    'epistemic_coverage',pg_catalog.jsonb_build_object(
      'status','UNKNOWN',
      'note','Latest recorded measurements are not proof of complete or perfectly current physical reality; missing metrics remain unknown rather than zero.'
    ),
    'does_not_assert',pg_catalog.jsonb_build_array(
      'health status',
      'fitness level',
      'BMI or body composition',
      'stamina or recovery',
      'unrecorded measurements do not exist'
    )
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- PRIVILEGE BOUNDARY
-- ---------------------------------------------------------------------------

revoke all on all tables in schema wf_body from public, anon, authenticated;
revoke all on all sequences in schema wf_body from public, anon, authenticated;
revoke all on function wf_body.protect_measurement_identity_update() from public, anon, authenticated;
revoke all on function wf_body.validate_measurement_version_payload() from public, anon, authenticated;
revoke all on function wf_body.protect_measurement_version_update() from public, anon, authenticated;
revoke all on function wf_body.assert_measurement_head_integrity() from public, anon, authenticated;

revoke all on function public.wf_body_record_measurement(uuid,text,numeric,text,timestamptz,text)
  from public, anon;
revoke all on function public.wf_body_correct_measurement(uuid,uuid,uuid,numeric,text,timestamptz,text)
  from public, anon;
revoke all on function public.wf_body_current_v0()
  from public, anon;

grant execute on function public.wf_body_record_measurement(uuid,text,numeric,text,timestamptz,text)
  to authenticated;
grant execute on function public.wf_body_correct_measurement(uuid,uuid,uuid,numeric,text,timestamptz,text)
  to authenticated;
grant execute on function public.wf_body_current_v0()
  to authenticated;

commit;
