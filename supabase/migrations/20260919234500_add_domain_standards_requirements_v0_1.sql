begin;

-- Training-owned recurring standard: strength sessions per local week.
create table if not exists wf_training.standards (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references wf_system.owners(id) on delete restrict,
  standard_key text not null,
  current_version_id uuid,
  created_at timestamptz not null default now(),
  constraint training_standards_owner_key_uq unique(owner_id,standard_key),
  constraint training_standards_id_owner_uq unique(id,owner_id),
  constraint training_standards_key_ck check(standard_key='strength_sessions_weekly')
);

create table if not exists wf_training.standard_versions (
  id uuid primary key default gen_random_uuid(),
  standard_id uuid not null,
  owner_id uuid not null,
  version_no bigint not null,
  standard_key text not null,
  metric text not null,
  unit text not null,
  rule text not null,
  target numeric(12,3) not null,
  recurrence text not null,
  zone_id text not null,
  lifecycle_status text not null,
  superseded_by_version_id uuid,
  provenance_source_type text not null,
  provenance_source_id text,
  actor_owner_id uuid,
  recorded_at timestamptz not null default now(),
  constraint training_standard_versions_owner_fk foreign key(owner_id) references wf_system.owners(id) on delete restrict,
  constraint training_standard_versions_actor_fk foreign key(actor_owner_id) references wf_system.owners(id) on delete restrict,
  constraint training_standard_versions_standard_fk foreign key(standard_id,owner_id) references wf_training.standards(id,owner_id) on delete restrict,
  constraint training_standard_versions_record_uq unique(standard_id,version_no),
  constraint training_standard_versions_id_record_owner_uq unique(id,standard_id,owner_id),
  constraint training_standard_versions_key_ck check(standard_key='strength_sessions_weekly'),
  constraint training_standard_versions_metric_ck check(metric='strength_session_count'),
  constraint training_standard_versions_unit_ck check(unit='sessions'),
  constraint training_standard_versions_rule_ck check(rule='AT_LEAST'),
  constraint training_standard_versions_target_ck check(target>0 and target=trunc(target)),
  constraint training_standard_versions_recurrence_ck check(recurrence='LOCAL_WEEK'),
  constraint training_standard_versions_zone_ck check(btrim(zone_id)<>''),
  constraint training_standard_versions_lifecycle_ck check(lifecycle_status in ('ACTIVE','SUPERSEDED')),
  constraint training_standard_versions_supersession_shape_ck check(
    (lifecycle_status='ACTIVE' and superseded_by_version_id is null)
    or (lifecycle_status='SUPERSEDED' and superseded_by_version_id is not null)
  )
);

alter table wf_training.standard_versions
  add constraint training_standard_versions_superseded_fk
  foreign key(superseded_by_version_id,standard_id,owner_id)
  references wf_training.standard_versions(id,standard_id,owner_id)
  on delete restrict deferrable initially deferred;

alter table wf_training.standards
  add constraint training_standards_current_fk
  foreign key(current_version_id,id,owner_id)
  references wf_training.standard_versions(id,standard_id,owner_id)
  on delete restrict deferrable initially deferred;

create unique index training_standard_versions_one_active_idx
  on wf_training.standard_versions(standard_id) where lifecycle_status='ACTIVE';
create index training_standards_owner_idx on wf_training.standards(owner_id);
create index training_standard_versions_owner_idx on wf_training.standard_versions(owner_id,recorded_at desc);

-- Nutrition-owned recurring standard: protein grams per local day.
create table if not exists wf_nutrition.standards (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references wf_system.owners(id) on delete restrict,
  standard_key text not null,
  current_version_id uuid,
  created_at timestamptz not null default now(),
  constraint nutrition_standards_owner_key_uq unique(owner_id,standard_key),
  constraint nutrition_standards_id_owner_uq unique(id,owner_id),
  constraint nutrition_standards_key_ck check(standard_key='protein_daily')
);

create table if not exists wf_nutrition.standard_versions (
  id uuid primary key default gen_random_uuid(),
  standard_id uuid not null,
  owner_id uuid not null,
  version_no bigint not null,
  standard_key text not null,
  metric text not null,
  unit text not null,
  rule text not null,
  target numeric(12,3) not null,
  recurrence text not null,
  zone_id text not null,
  lifecycle_status text not null,
  superseded_by_version_id uuid,
  provenance_source_type text not null,
  provenance_source_id text,
  actor_owner_id uuid,
  recorded_at timestamptz not null default now(),
  constraint nutrition_standard_versions_owner_fk foreign key(owner_id) references wf_system.owners(id) on delete restrict,
  constraint nutrition_standard_versions_actor_fk foreign key(actor_owner_id) references wf_system.owners(id) on delete restrict,
  constraint nutrition_standard_versions_standard_fk foreign key(standard_id,owner_id) references wf_nutrition.standards(id,owner_id) on delete restrict,
  constraint nutrition_standard_versions_record_uq unique(standard_id,version_no),
  constraint nutrition_standard_versions_id_record_owner_uq unique(id,standard_id,owner_id),
  constraint nutrition_standard_versions_key_ck check(standard_key='protein_daily'),
  constraint nutrition_standard_versions_metric_ck check(metric='protein_g'),
  constraint nutrition_standard_versions_unit_ck check(unit='g'),
  constraint nutrition_standard_versions_rule_ck check(rule='AT_LEAST'),
  constraint nutrition_standard_versions_target_ck check(target>0),
  constraint nutrition_standard_versions_recurrence_ck check(recurrence='LOCAL_DAY'),
  constraint nutrition_standard_versions_zone_ck check(btrim(zone_id)<>''),
  constraint nutrition_standard_versions_lifecycle_ck check(lifecycle_status in ('ACTIVE','SUPERSEDED')),
  constraint nutrition_standard_versions_supersession_shape_ck check(
    (lifecycle_status='ACTIVE' and superseded_by_version_id is null)
    or (lifecycle_status='SUPERSEDED' and superseded_by_version_id is not null)
  )
);

alter table wf_nutrition.standard_versions
  add constraint nutrition_standard_versions_superseded_fk
  foreign key(superseded_by_version_id,standard_id,owner_id)
  references wf_nutrition.standard_versions(id,standard_id,owner_id)
  on delete restrict deferrable initially deferred;

alter table wf_nutrition.standards
  add constraint nutrition_standards_current_fk
  foreign key(current_version_id,id,owner_id)
  references wf_nutrition.standard_versions(id,standard_id,owner_id)
  on delete restrict deferrable initially deferred;

create unique index nutrition_standard_versions_one_active_idx
  on wf_nutrition.standard_versions(standard_id) where lifecycle_status='ACTIVE';
create index nutrition_standards_owner_idx on wf_nutrition.standards(owner_id);
create index nutrition_standard_versions_owner_idx on wf_nutrition.standard_versions(owner_id,recorded_at desc);

create or replace function wf_training.protect_standard_version_update()
returns trigger language plpgsql set search_path=pg_catalog as $$
begin
  if new.id is distinct from old.id
     or new.standard_id is distinct from old.standard_id
     or new.owner_id is distinct from old.owner_id
     or new.version_no is distinct from old.version_no
     or new.standard_key is distinct from old.standard_key
     or new.metric is distinct from old.metric
     or new.unit is distinct from old.unit
     or new.rule is distinct from old.rule
     or new.target is distinct from old.target
     or new.recurrence is distinct from old.recurrence
     or new.zone_id is distinct from old.zone_id
     or new.provenance_source_type is distinct from old.provenance_source_type
     or new.provenance_source_id is distinct from old.provenance_source_id
     or new.actor_owner_id is distinct from old.actor_owner_id
     or new.recorded_at is distinct from old.recorded_at then
    raise exception using errcode='55000',message='TRAINING_STANDARD_VERSION_PAYLOAD_IMMUTABLE';
  end if;
  if old.lifecycle_status='ACTIVE' then
    if new.lifecycle_status not in ('ACTIVE','SUPERSEDED') then raise exception using errcode='55000',message='INVALID_TRAINING_STANDARD_LIFECYCLE'; end if;
  elsif new.lifecycle_status is distinct from old.lifecycle_status then
    raise exception using errcode='55000',message='INVALID_TRAINING_STANDARD_LIFECYCLE';
  end if;
  return new;
end; $$;

create trigger training_standard_versions_protect_update_trg
before update on wf_training.standard_versions
for each row execute function wf_training.protect_standard_version_update();

create or replace function wf_nutrition.protect_standard_version_update()
returns trigger language plpgsql set search_path=pg_catalog as $$
begin
  if new.id is distinct from old.id
     or new.standard_id is distinct from old.standard_id
     or new.owner_id is distinct from old.owner_id
     or new.version_no is distinct from old.version_no
     or new.standard_key is distinct from old.standard_key
     or new.metric is distinct from old.metric
     or new.unit is distinct from old.unit
     or new.rule is distinct from old.rule
     or new.target is distinct from old.target
     or new.recurrence is distinct from old.recurrence
     or new.zone_id is distinct from old.zone_id
     or new.provenance_source_type is distinct from old.provenance_source_type
     or new.provenance_source_id is distinct from old.provenance_source_id
     or new.actor_owner_id is distinct from old.actor_owner_id
     or new.recorded_at is distinct from old.recorded_at then
    raise exception using errcode='55000',message='NUTRITION_STANDARD_VERSION_PAYLOAD_IMMUTABLE';
  end if;
  if old.lifecycle_status='ACTIVE' then
    if new.lifecycle_status not in ('ACTIVE','SUPERSEDED') then raise exception using errcode='55000',message='INVALID_NUTRITION_STANDARD_LIFECYCLE'; end if;
  elsif new.lifecycle_status is distinct from old.lifecycle_status then
    raise exception using errcode='55000',message='INVALID_NUTRITION_STANDARD_LIFECYCLE';
  end if;
  return new;
end; $$;

create trigger nutrition_standard_versions_protect_update_trg
before update on wf_nutrition.standard_versions
for each row execute function wf_nutrition.protect_standard_version_update();

create or replace function public.wf_training_set_strength_standard_v0(
  p_command_id uuid,
  p_target_sessions integer,
  p_zone_id text default null,
  p_provenance_source_id text default null
)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare
  v_owner uuid; v_zone text; v_hash text; v_claim record;
  v_standard uuid; v_current uuid; v_current_target numeric; v_current_zone text; v_version_no bigint; v_new_version uuid; v_ref jsonb;
begin
  v_owner:=wf_system.require_authenticated_owner();
  v_zone:=nullif(btrim(p_zone_id),'');
  if v_zone is null then select o.timezone into v_zone from wf_system.owners o where o.id=v_owner; end if;

  v_hash:=wf_system.command_hash(pg_catalog.jsonb_build_object(
    'contract','training.set_strength_standard.v0.1',
    'target_sessions',p_target_sessions,'zone_id',v_zone,'provenance_source_id',p_provenance_source_id
  ));
  select * into v_claim from wf_system.claim_command(v_owner,p_command_id,'training','training.set_strength_standard',v_hash);
  if not v_claim.is_new then return wf_system.command_response(v_owner,p_command_id,true); end if;

  if p_target_sessions is null or p_target_sessions<1 or p_target_sessions>21 then
    perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'INVALID_STRENGTH_SESSION_TARGET');
    return wf_system.command_response(v_owner,p_command_id,false);
  end if;
  if not wf_training.valid_zone(v_zone) then
    perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'INVALID_TIMEZONE');
    return wf_system.command_response(v_owner,p_command_id,false);
  end if;

  select s.id,s.current_version_id,v.target,v.zone_id,v.version_no
    into v_standard,v_current,v_current_target,v_current_zone,v_version_no
  from wf_training.standards s
  left join wf_training.standard_versions v on v.id=s.current_version_id and v.standard_id=s.id and v.owner_id=s.owner_id
  where s.owner_id=v_owner and s.standard_key='strength_sessions_weekly'
  for update of s;

  if found and v_current_target=p_target_sessions and v_current_zone=v_zone then
    v_ref:=pg_catalog.jsonb_build_object('namespace','training','type','standard','id',v_standard,'version',v_current);
    perform wf_system.complete_command(v_owner,p_command_id,'NOOP',pg_catalog.jsonb_build_array(v_ref),null);
    return wf_system.command_response(v_owner,p_command_id,false);
  end if;

  if v_standard is null then
    v_standard:=gen_random_uuid();
    v_version_no:=1;
    insert into wf_training.standards(id,owner_id,standard_key) values(v_standard,v_owner,'strength_sessions_weekly');
  else
    v_version_no:=coalesce(v_version_no,0)+1;
  end if;

  v_new_version:=gen_random_uuid();
  insert into wf_training.standard_versions(
    id,standard_id,owner_id,version_no,standard_key,metric,unit,rule,target,recurrence,zone_id,
    lifecycle_status,provenance_source_type,provenance_source_id,actor_owner_id
  ) values (
    v_new_version,v_standard,v_owner,v_version_no,'strength_sessions_weekly','strength_session_count','sessions','AT_LEAST',
    p_target_sessions,'LOCAL_WEEK',v_zone,'ACTIVE','PLAYER_STANDARD',p_provenance_source_id,v_owner
  );

  if v_current is not null then
    update wf_training.standard_versions
       set lifecycle_status='SUPERSEDED',superseded_by_version_id=v_new_version
     where id=v_current and standard_id=v_standard and owner_id=v_owner and lifecycle_status='ACTIVE';
  end if;
  update wf_training.standards set current_version_id=v_new_version where id=v_standard and owner_id=v_owner;

  v_ref:=pg_catalog.jsonb_build_object('namespace','training','type','standard','id',v_standard,'version',v_new_version);
  perform wf_system.complete_command(v_owner,p_command_id,'APPLIED',pg_catalog.jsonb_build_array(v_ref),null);
  insert into wf_system.module_change_outbox(owner_id,module_id,change_type,command_id,affected)
  values(v_owner,'training','training.standard_changed',p_command_id,pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('operation','UPSERTED','ref',v_ref)));
  return wf_system.command_response(v_owner,p_command_id,false);
end; $$;

create or replace function public.wf_nutrition_set_protein_standard_v0(
  p_command_id uuid,
  p_target_grams numeric,
  p_zone_id text default null,
  p_provenance_source_id text default null
)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare
  v_owner uuid; v_zone text; v_hash text; v_claim record;
  v_standard uuid; v_current uuid; v_current_target numeric; v_current_zone text; v_version_no bigint; v_new_version uuid; v_ref jsonb;
begin
  v_owner:=wf_system.require_authenticated_owner();
  v_zone:=nullif(btrim(p_zone_id),'');
  if v_zone is null then select o.timezone into v_zone from wf_system.owners o where o.id=v_owner; end if;

  v_hash:=wf_system.command_hash(pg_catalog.jsonb_build_object(
    'contract','nutrition.set_protein_standard.v0.1',
    'target_grams',p_target_grams,'zone_id',v_zone,'provenance_source_id',p_provenance_source_id
  ));
  select * into v_claim from wf_system.claim_command(v_owner,p_command_id,'nutrition','nutrition.set_protein_standard',v_hash);
  if not v_claim.is_new then return wf_system.command_response(v_owner,p_command_id,true); end if;

  if p_target_grams is null or p_target_grams<=0 or p_target_grams>1000 then
    perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'INVALID_PROTEIN_TARGET');
    return wf_system.command_response(v_owner,p_command_id,false);
  end if;
  if not wf_nutrition.valid_zone(v_zone) then
    perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'INVALID_TIMEZONE');
    return wf_system.command_response(v_owner,p_command_id,false);
  end if;

  select s.id,s.current_version_id,v.target,v.zone_id,v.version_no
    into v_standard,v_current,v_current_target,v_current_zone,v_version_no
  from wf_nutrition.standards s
  left join wf_nutrition.standard_versions v on v.id=s.current_version_id and v.standard_id=s.id and v.owner_id=s.owner_id
  where s.owner_id=v_owner and s.standard_key='protein_daily'
  for update of s;

  if found and v_current_target=p_target_grams and v_current_zone=v_zone then
    v_ref:=pg_catalog.jsonb_build_object('namespace','nutrition','type','standard','id',v_standard,'version',v_current);
    perform wf_system.complete_command(v_owner,p_command_id,'NOOP',pg_catalog.jsonb_build_array(v_ref),null);
    return wf_system.command_response(v_owner,p_command_id,false);
  end if;

  if v_standard is null then
    v_standard:=gen_random_uuid();
    v_version_no:=1;
    insert into wf_nutrition.standards(id,owner_id,standard_key) values(v_standard,v_owner,'protein_daily');
  else
    v_version_no:=coalesce(v_version_no,0)+1;
  end if;

  v_new_version:=gen_random_uuid();
  insert into wf_nutrition.standard_versions(
    id,standard_id,owner_id,version_no,standard_key,metric,unit,rule,target,recurrence,zone_id,
    lifecycle_status,provenance_source_type,provenance_source_id,actor_owner_id
  ) values (
    v_new_version,v_standard,v_owner,v_version_no,'protein_daily','protein_g','g','AT_LEAST',
    p_target_grams,'LOCAL_DAY',v_zone,'ACTIVE','PLAYER_STANDARD',p_provenance_source_id,v_owner
  );

  if v_current is not null then
    update wf_nutrition.standard_versions
       set lifecycle_status='SUPERSEDED',superseded_by_version_id=v_new_version
     where id=v_current and standard_id=v_standard and owner_id=v_owner and lifecycle_status='ACTIVE';
  end if;
  update wf_nutrition.standards set current_version_id=v_new_version where id=v_standard and owner_id=v_owner;

  v_ref:=pg_catalog.jsonb_build_object('namespace','nutrition','type','standard','id',v_standard,'version',v_new_version);
  perform wf_system.complete_command(v_owner,p_command_id,'APPLIED',pg_catalog.jsonb_build_array(v_ref),null);
  insert into wf_system.module_change_outbox(owner_id,module_id,change_type,command_id,affected)
  values(v_owner,'nutrition','nutrition.standard_changed',p_command_id,pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('operation','UPSERTED','ref',v_ref)));
  return wf_system.command_response(v_owner,p_command_id,false);
end; $$;

create or replace function public.wf_training_strength_requirement_input_v0(
  p_as_of timestamptz default pg_catalog.clock_timestamp()
)
returns jsonb language plpgsql security definer stable set search_path=pg_catalog as $$
declare
  v_owner uuid; v_standard uuid; v_version uuid; v_target numeric; v_zone text;
  v_local_date date; v_week_start date; v_from timestamptz; v_to timestamptz;
  v_count bigint; v_refs jsonb;
begin
  v_owner:=wf_system.require_authenticated_owner();
  select s.id,v.id,v.target,v.zone_id
    into v_standard,v_version,v_target,v_zone
  from wf_training.standards s
  join wf_training.standard_versions v on v.id=s.current_version_id and v.standard_id=s.id and v.owner_id=s.owner_id
  where s.owner_id=v_owner and s.standard_key='strength_sessions_weekly' and v.lifecycle_status='ACTIVE';

  if not found then
    return pg_catalog.jsonb_build_object('standard',null,'spec',null,'observation',null,'lineage','[]'::jsonb);
  end if;

  v_local_date:=(p_as_of at time zone v_zone)::date;
  v_week_start:=v_local_date-(extract(isodow from v_local_date)::integer-1);
  select starts_at into v_from from wf_system.local_day_bounds(v_week_start,v_zone);
  select starts_at into v_to from wf_system.local_day_bounds(v_week_start+7,v_zone);

  select count(*),
         coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
           'namespace','training','type','session','id',s.id,'version',v.id
         ) order by v.occurred_from,s.id),'[]'::jsonb)
    into v_count,v_refs
  from wf_training.sessions s
  join wf_training.session_versions v on v.id=s.current_version_id and v.session_id=s.id and v.owner_id=s.owner_id
  where s.owner_id=v_owner and v.lifecycle_status='ACTIVE'
    and v.session_kind='STRENGTH' and v.occurred_from>=v_from and v.occurred_from<v_to;

  return pg_catalog.jsonb_build_object(
    'standard',pg_catalog.jsonb_build_object(
      'namespace','training','type','standard','id',v_standard,'version',v_version
    ),
    'spec',pg_catalog.jsonb_build_object(
      'requirementKey','training.strength_sessions.weekly',
      'domain','training',
      'metric','strength_session_count',
      'unit','sessions',
      'rule','AT_LEAST',
      'target',v_target,
      'aggregation','MONOTONIC_ACCUMULATING',
      'scope',pg_catalog.jsonb_build_object(
        'startsAt',v_from,'endsAt',v_to,'zoneId',v_zone,'intervalSemantics','[start,end)',
        'recurrenceKey',v_week_start::text
      )
    ),
    'observation',pg_catalog.jsonb_build_object(
      'value',v_count,
      'coverage','UNKNOWN',
      'sourceCount',v_count,
      'observedThrough',p_as_of
    ),
    'lineage',v_refs,
    'does_not_assert',pg_catalog.jsonb_build_array(
      'that unrecorded strength sessions did not occur',
      'that meeting the standard proves strength increased'
    )
  );
end; $$;

create or replace function public.wf_nutrition_protein_requirement_input_v0(
  p_as_of timestamptz default pg_catalog.clock_timestamp()
)
returns jsonb language plpgsql security definer stable set search_path=pg_catalog as $$
declare
  v_owner uuid; v_standard uuid; v_version uuid; v_target numeric; v_zone text;
  v_local_date date; v_from timestamptz; v_to timestamptz;
  v_explicit_count bigint; v_total_intakes bigint; v_value numeric; v_refs jsonb;
begin
  v_owner:=wf_system.require_authenticated_owner();
  select s.id,v.id,v.target,v.zone_id
    into v_standard,v_version,v_target,v_zone
  from wf_nutrition.standards s
  join wf_nutrition.standard_versions v on v.id=s.current_version_id and v.standard_id=s.id and v.owner_id=s.owner_id
  where s.owner_id=v_owner and s.standard_key='protein_daily' and v.lifecycle_status='ACTIVE';

  if not found then
    return pg_catalog.jsonb_build_object('standard',null,'spec',null,'observation',null,'lineage','[]'::jsonb);
  end if;

  v_local_date:=(p_as_of at time zone v_zone)::date;
  select starts_at,ends_at into v_from,v_to from wf_system.local_day_bounds(v_local_date,v_zone);

  select count(*),
         count(v.protein_g),
         case when count(v.protein_g)>0 then sum(v.protein_g) else null end,
         coalesce(pg_catalog.jsonb_agg(
           pg_catalog.jsonb_build_object('namespace','nutrition','type','intake','id',i.id,'version',v.id)
           order by v.occurred_from,i.id
         ) filter(where v.protein_g is not null),'[]'::jsonb)
    into v_total_intakes,v_explicit_count,v_value,v_refs
  from wf_nutrition.intakes i
  join wf_nutrition.intake_versions v on v.id=i.current_version_id and v.intake_id=i.id and v.owner_id=i.owner_id
  where i.owner_id=v_owner and v.lifecycle_status='ACTIVE'
    and v.occurred_from>=v_from and v.occurred_from<v_to;

  return pg_catalog.jsonb_build_object(
    'standard',pg_catalog.jsonb_build_object(
      'namespace','nutrition','type','standard','id',v_standard,'version',v_version
    ),
    'spec',pg_catalog.jsonb_build_object(
      'requirementKey','nutrition.protein.daily',
      'domain','nutrition',
      'metric','protein_g',
      'unit','g',
      'rule','AT_LEAST',
      'target',v_target,
      'aggregation','MONOTONIC_ACCUMULATING',
      'scope',pg_catalog.jsonb_build_object(
        'startsAt',v_from,'endsAt',v_to,'zoneId',v_zone,'intervalSemantics','[start,end)',
        'recurrenceKey',v_local_date::text
      )
    ),
    'observation',pg_catalog.jsonb_build_object(
      'value',v_value,
      'coverage','UNKNOWN',
      'sourceCount',v_explicit_count,
      'observedThrough',p_as_of,
      'recordedIntakeCount',v_total_intakes
    ),
    'lineage',v_refs,
    'does_not_assert',pg_catalog.jsonb_build_array(
      'that missing protein values are zero',
      'that stored intakes cover everything consumed',
      'that meeting the standard proves a health outcome'
    )
  );
end; $$;

revoke all on table wf_training.standards,wf_training.standard_versions from public,anon,authenticated;
revoke all on table wf_nutrition.standards,wf_nutrition.standard_versions from public,anon,authenticated;
revoke all on function public.wf_training_set_strength_standard_v0(uuid,integer,text,text) from public,anon;
revoke all on function public.wf_nutrition_set_protein_standard_v0(uuid,numeric,text,text) from public,anon;
revoke all on function public.wf_training_strength_requirement_input_v0(timestamptz) from public,anon;
revoke all on function public.wf_nutrition_protein_requirement_input_v0(timestamptz) from public,anon;
grant execute on function public.wf_training_set_strength_standard_v0(uuid,integer,text,text) to authenticated;
grant execute on function public.wf_nutrition_set_protein_standard_v0(uuid,numeric,text,text) to authenticated;
grant execute on function public.wf_training_strength_requirement_input_v0(timestamptz) to authenticated;
grant execute on function public.wf_nutrition_protein_requirement_input_v0(timestamptz) to authenticated;

commit;
