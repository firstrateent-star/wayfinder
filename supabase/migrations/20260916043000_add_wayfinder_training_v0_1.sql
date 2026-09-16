begin;

create schema if not exists wf_training;
comment on schema wf_training is 'Wayfinder Training module: canonical training sessions and structured exercise-set observations.';
revoke all on schema wf_training from public, anon, authenticated;

create table wf_training.sessions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references wf_system.owners(id) on delete restrict,
  current_version_id uuid,
  created_at timestamptz not null default now(),
  constraint training_sessions_id_owner_uq unique (id, owner_id)
);

create table wf_training.session_versions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  owner_id uuid not null,
  version_no bigint not null,
  schema_version smallint not null default 1,
  session_kind text not null default 'STRENGTH',
  label text,
  occurred_from timestamptz not null,
  occurred_to timestamptz,
  occurrence_precision text not null,
  zone_id text not null,
  lifecycle_status text not null,
  superseded_by_version_id uuid,
  provenance_source_type text not null,
  provenance_source_id text,
  actor_owner_id uuid,
  recorded_at timestamptz not null default now(),
  constraint training_versions_owner_fk foreign key (owner_id) references wf_system.owners(id) on delete restrict,
  constraint training_versions_actor_owner_fk foreign key (actor_owner_id) references wf_system.owners(id) on delete restrict,
  constraint training_versions_session_owner_fk foreign key (session_id, owner_id) references wf_training.sessions(id, owner_id) on delete restrict,
  constraint training_versions_record_version_uq unique (session_id, version_no),
  constraint training_versions_id_record_owner_uq unique (id, session_id, owner_id),
  constraint training_versions_version_no_ck check (version_no > 0),
  constraint training_versions_schema_version_ck check (schema_version > 0),
  constraint training_versions_kind_ck check (session_kind in ('STRENGTH')),
  constraint training_versions_label_ck check (label is null or (btrim(label) <> '' and char_length(label) <= 300)),
  constraint training_versions_occurrence_precision_ck check (occurrence_precision in ('INSTANT','DAY','APPROXIMATE')),
  constraint training_versions_occurrence_range_ck check (occurred_to is null or occurred_to > occurred_from),
  constraint training_versions_zone_ck check (btrim(zone_id) <> ''),
  constraint training_versions_lifecycle_ck check (lifecycle_status in ('ACTIVE','SUPERSEDED','RETRACTED')),
  constraint training_versions_supersession_shape_ck check ((lifecycle_status='SUPERSEDED' and superseded_by_version_id is not null) or (lifecycle_status in ('ACTIVE','RETRACTED') and superseded_by_version_id is null))
);

create table wf_training.exercise_sets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references wf_system.owners(id) on delete restrict,
  session_id uuid not null,
  session_version_id uuid not null,
  set_index integer not null,
  exercise_key text not null,
  exercise_label text not null,
  reps integer,
  load_value numeric(10,3),
  load_unit text,
  rpe numeric(4,2),
  provenance_source_type text not null,
  provenance_source_id text,
  recorded_at timestamptz not null default now(),
  constraint training_sets_session_version_fk foreign key (session_version_id, session_id, owner_id) references wf_training.session_versions(id, session_id, owner_id) on delete restrict,
  constraint training_sets_session_index_uq unique (session_version_id, set_index),
  constraint training_sets_index_ck check (set_index > 0),
  constraint training_sets_exercise_key_ck check (btrim(exercise_key) <> '' and char_length(exercise_key) <= 200),
  constraint training_sets_exercise_label_ck check (btrim(exercise_label) <> '' and char_length(exercise_label) <= 300),
  constraint training_sets_reps_ck check (reps is null or reps > 0),
  constraint training_sets_load_ck check (load_value is null or load_value > 0),
  constraint training_sets_load_pair_ck check ((load_value is null and load_unit is null) or (load_value is not null and load_unit in ('LB','KG'))),
  constraint training_sets_rpe_ck check (rpe is null or (rpe >= 0 and rpe <= 10))
);

alter table wf_training.session_versions
  add constraint training_versions_superseded_same_record_fk
  foreign key (superseded_by_version_id, session_id, owner_id)
  references wf_training.session_versions(id, session_id, owner_id)
  on delete restrict deferrable initially deferred;

alter table wf_training.sessions
  add constraint training_sessions_current_same_record_fk
  foreign key (current_version_id, id, owner_id)
  references wf_training.session_versions(id, session_id, owner_id)
  on delete restrict deferrable initially deferred;

create unique index training_versions_one_active_idx on wf_training.session_versions(session_id) where lifecycle_status='ACTIVE';
create index training_sessions_owner_idx on wf_training.sessions(owner_id);
create index training_sessions_current_idx on wf_training.sessions(current_version_id) where current_version_id is not null;
create index training_versions_owner_time_idx on wf_training.session_versions(owner_id, occurred_from desc) where lifecycle_status='ACTIVE';
create index training_versions_actor_idx on wf_training.session_versions(actor_owner_id) where actor_owner_id is not null;
create index training_sets_owner_idx on wf_training.exercise_sets(owner_id);
create index training_sets_session_idx on wf_training.exercise_sets(session_id, session_version_id);
create index training_sets_exercise_idx on wf_training.exercise_sets(owner_id, exercise_key, recorded_at desc);

create or replace function wf_training.valid_zone(p_zone text)
returns boolean language sql stable set search_path=pg_catalog as $$
  select p_zone is not null and btrim(p_zone)<>'' and exists(select 1 from pg_catalog.pg_timezone_names z where z.name=btrim(p_zone));
$$;

create or replace function wf_training.protect_session_identity_update()
returns trigger language plpgsql set search_path=pg_catalog as $$
begin
  if new.id is distinct from old.id or new.owner_id is distinct from old.owner_id or new.created_at is distinct from old.created_at then
    raise exception using errcode='55000', message='TRAINING_SESSION_IDENTITY_IMMUTABLE';
  end if;
  return new;
end; $$;
create trigger training_sessions_protect_identity_trg before update on wf_training.sessions for each row execute function wf_training.protect_session_identity_update();

create or replace function wf_training.protect_session_version_update()
returns trigger language plpgsql set search_path=pg_catalog as $$
begin
  if new.id is distinct from old.id or new.session_id is distinct from old.session_id or new.owner_id is distinct from old.owner_id or new.version_no is distinct from old.version_no or new.schema_version is distinct from old.schema_version or new.session_kind is distinct from old.session_kind or new.label is distinct from old.label or new.occurred_from is distinct from old.occurred_from or new.occurred_to is distinct from old.occurred_to or new.occurrence_precision is distinct from old.occurrence_precision or new.zone_id is distinct from old.zone_id or new.provenance_source_type is distinct from old.provenance_source_type or new.provenance_source_id is distinct from old.provenance_source_id or new.actor_owner_id is distinct from old.actor_owner_id or new.recorded_at is distinct from old.recorded_at then
    raise exception using errcode='55000', message='TRAINING_SESSION_VERSION_PAYLOAD_IMMUTABLE';
  end if;
  if old.lifecycle_status='ACTIVE' then
    if new.lifecycle_status not in ('ACTIVE','SUPERSEDED','RETRACTED') then raise exception using errcode='55000', message='INVALID_TRAINING_LIFECYCLE_TRANSITION'; end if;
  elsif new.lifecycle_status is distinct from old.lifecycle_status then
    raise exception using errcode='55000', message='INVALID_TRAINING_LIFECYCLE_TRANSITION';
  end if;
  if old.lifecycle_status<>'ACTIVE' and new.superseded_by_version_id is distinct from old.superseded_by_version_id then raise exception using errcode='55000', message='TRAINING_VERSION_LINEAGE_IMMUTABLE'; end if;
  return new;
end; $$;
create trigger training_versions_protect_update_trg before update on wf_training.session_versions for each row execute function wf_training.protect_session_version_update();

create or replace function wf_training.protect_set_update()
returns trigger language plpgsql set search_path=pg_catalog as $$
begin
  raise exception using errcode='55000', message='TRAINING_SET_IMMUTABLE';
end; $$;
create trigger training_sets_protect_update_trg before update on wf_training.exercise_sets for each row execute function wf_training.protect_set_update();

create or replace function wf_training.assert_head_integrity()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare v_id uuid; v_owner uuid; v_current uuid; v_status text; v_active integer;
begin
  if tg_table_name='sessions' then
    if tg_op='DELETE' then v_id:=old.id; v_owner:=old.owner_id; else v_id:=new.id; v_owner:=new.owner_id; end if;
  else
    if tg_op='DELETE' then v_id:=old.session_id; v_owner:=old.owner_id; else v_id:=new.session_id; v_owner:=new.owner_id; end if;
  end if;
  select s.current_version_id into v_current from wf_training.sessions s where s.id=v_id and s.owner_id=v_owner;
  if not found then if tg_op='DELETE' then return old; else return new; end if; end if;
  if v_current is null then raise exception using errcode='23514', message='TRAINING_CURRENT_VERSION_REQUIRED'; end if;
  select v.lifecycle_status into v_status from wf_training.session_versions v where v.id=v_current and v.session_id=v_id and v.owner_id=v_owner;
  if not found then raise exception using errcode='23503', message='TRAINING_CURRENT_VERSION_MISSING'; end if;
  if v_status='SUPERSEDED' then raise exception using errcode='23514', message='TRAINING_HEAD_CANNOT_BE_SUPERSEDED'; end if;
  select count(*)::integer into v_active from wf_training.session_versions v where v.session_id=v_id and v.owner_id=v_owner and v.lifecycle_status='ACTIVE';
  if v_status='ACTIVE' and v_active<>1 then raise exception using errcode='23514', message='TRAINING_ACTIVE_HEAD_INTEGRITY_VIOLATION'; end if;
  if v_status='RETRACTED' and v_active<>0 then raise exception using errcode='23514', message='TRAINING_RETRACTED_HEAD_HAS_ACTIVE_VERSION'; end if;
  if tg_op='DELETE' then return old; else return new; end if;
end; $$;
create constraint trigger training_sessions_head_integrity_trg after insert or update on wf_training.sessions deferrable initially deferred for each row execute function wf_training.assert_head_integrity();
create constraint trigger training_versions_head_integrity_trg after insert or update or delete on wf_training.session_versions deferrable initially deferred for each row execute function wf_training.assert_head_integrity();

create or replace function public.wf_training_capture_strength_session(
  p_command_id uuid,
  p_occurrence_precision text,
  p_zone_id text default null,
  p_occurred_at timestamptz default null,
  p_occurred_local_date date default null,
  p_label text default null,
  p_sets jsonb default '[]'::jsonb,
  p_provenance_source_id text default null
)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare
  v_owner uuid; v_zone text; v_precision text; v_hash text; v_claim record; v_session uuid; v_version uuid; v_ref jsonb;
  v_from timestamptz; v_to timestamptz; v_set jsonb; v_idx integer; v_ex_key text; v_ex_label text; v_reps integer; v_load numeric; v_unit text; v_rpe numeric;
begin
  v_owner:=wf_system.require_authenticated_owner();
  v_zone:=nullif(btrim(p_zone_id),''); if v_zone is null then select o.timezone into v_zone from wf_system.owners o where o.id=v_owner; end if;
  v_precision:=upper(btrim(p_occurrence_precision));
  v_hash:=wf_system.command_hash(pg_catalog.jsonb_build_object('contract','training.capture_strength_session.v0.1','occurrence_precision',v_precision,'zone_id',v_zone,'occurred_at',p_occurred_at,'occurred_local_date',p_occurred_local_date,'label',nullif(btrim(p_label),''),'sets',coalesce(p_sets,'[]'::jsonb),'provenance_source_id',p_provenance_source_id));
  select * into v_claim from wf_system.claim_command(v_owner,p_command_id,'training','training.capture_strength_session',v_hash);
  if not v_claim.is_new then return wf_system.command_response(v_owner,p_command_id,true); end if;

  if not wf_training.valid_zone(v_zone) then perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'INVALID_TIMEZONE'); return wf_system.command_response(v_owner,p_command_id,false); end if;
  if v_precision not in ('INSTANT','DAY','APPROXIMATE') then perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'INVALID_TRAINING_OCCURRENCE_PRECISION'); return wf_system.command_response(v_owner,p_command_id,false); end if;
  if v_precision='DAY' then
    if p_occurred_local_date is null or p_occurred_at is not null then perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'INVALID_DAY_OCCURRENCE'); return wf_system.command_response(v_owner,p_command_id,false); end if;
    select starts_at,ends_at into v_from,v_to from wf_system.local_day_bounds(p_occurred_local_date,v_zone);
  else
    if p_occurred_at is null or p_occurred_local_date is not null then perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'INVALID_INSTANT_OCCURRENCE'); return wf_system.command_response(v_owner,p_command_id,false); end if;
    v_from:=p_occurred_at; v_to:=null;
  end if;
  if p_label is not null and (btrim(p_label)='' or char_length(btrim(p_label))>300) then perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'INVALID_TRAINING_LABEL'); return wf_system.command_response(v_owner,p_command_id,false); end if;
  if p_sets is null or jsonb_typeof(p_sets)<>'array' or jsonb_array_length(p_sets)>100 then perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'INVALID_TRAINING_SETS'); return wf_system.command_response(v_owner,p_command_id,false); end if;

  v_idx:=0;
  for v_set in select value from jsonb_array_elements(p_sets) loop
    v_idx:=v_idx+1;
    v_ex_key:=nullif(btrim(v_set->>'exercise_key'),''); v_ex_label:=nullif(btrim(v_set->>'exercise_label'),'');
    begin v_reps:=case when v_set ? 'reps' and v_set->>'reps' is not null then (v_set->>'reps')::integer else null end; exception when others then v_reps:=null; end;
    begin v_load:=case when v_set ? 'load_value' and v_set->>'load_value' is not null then (v_set->>'load_value')::numeric else null end; exception when others then v_load:=null; end;
    v_unit:=case when v_set ? 'load_unit' then upper(nullif(btrim(v_set->>'load_unit'),'')) else null end;
    begin v_rpe:=case when v_set ? 'rpe' and v_set->>'rpe' is not null then (v_set->>'rpe')::numeric else null end; exception when others then v_rpe:=null; end;
    if v_ex_key is null or char_length(v_ex_key)>200 or v_ex_label is null or char_length(v_ex_label)>300 or (v_set ? 'reps' and v_reps is null) or (v_reps is not null and v_reps<=0) or (v_set ? 'load_value' and v_load is null) or (v_load is not null and v_load<=0) or ((v_load is null)<>(v_unit is null)) or (v_unit is not null and v_unit not in ('LB','KG')) or (v_set ? 'rpe' and v_rpe is null) or (v_rpe is not null and (v_rpe<0 or v_rpe>10)) then
      perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'INVALID_TRAINING_SET_PAYLOAD'); return wf_system.command_response(v_owner,p_command_id,false);
    end if;
  end loop;

  v_session:=gen_random_uuid(); v_version:=gen_random_uuid();
  insert into wf_training.sessions(id,owner_id) values(v_session,v_owner);
  insert into wf_training.session_versions(id,session_id,owner_id,version_no,session_kind,label,occurred_from,occurred_to,occurrence_precision,zone_id,lifecycle_status,provenance_source_type,provenance_source_id,actor_owner_id)
  values(v_version,v_session,v_owner,1,'STRENGTH',nullif(btrim(p_label),''),v_from,v_to,v_precision,v_zone,'ACTIVE','SEMANTIC_ADMISSION',p_provenance_source_id,v_owner);
  update wf_training.sessions set current_version_id=v_version where id=v_session and owner_id=v_owner;

  v_idx:=0;
  for v_set in select value from jsonb_array_elements(p_sets) loop
    v_idx:=v_idx+1;
    v_ex_key:=btrim(v_set->>'exercise_key'); v_ex_label:=btrim(v_set->>'exercise_label');
    v_reps:=case when v_set ? 'reps' and v_set->>'reps' is not null then (v_set->>'reps')::integer else null end;
    v_load:=case when v_set ? 'load_value' and v_set->>'load_value' is not null then (v_set->>'load_value')::numeric else null end;
    v_unit:=case when v_set ? 'load_unit' then upper(nullif(btrim(v_set->>'load_unit'),'')) else null end;
    v_rpe:=case when v_set ? 'rpe' and v_set->>'rpe' is not null then (v_set->>'rpe')::numeric else null end;
    insert into wf_training.exercise_sets(owner_id,session_id,session_version_id,set_index,exercise_key,exercise_label,reps,load_value,load_unit,rpe,provenance_source_type,provenance_source_id)
    values(v_owner,v_session,v_version,v_idx,v_ex_key,v_ex_label,v_reps,v_load,v_unit,v_rpe,'SEMANTIC_ADMISSION',p_provenance_source_id);
  end loop;

  v_ref:=jsonb_build_object('namespace','training','type','session','id',v_session,'version',v_version);
  perform wf_system.complete_command(v_owner,p_command_id,'APPLIED',jsonb_build_array(v_ref),null);
  insert into wf_system.module_change_outbox(owner_id,module_id,change_type,command_id,affected)
  values(v_owner,'training','training.session_captured',p_command_id,jsonb_build_array(jsonb_build_object('operation','CREATED','ref',v_ref)));
  return wf_system.command_response(v_owner,p_command_id,false);
end; $$;

create or replace function public.wf_training_recent_v0(p_from timestamptz,p_to timestamptz,p_limit integer default 20)
returns jsonb language plpgsql security definer stable set search_path=pg_catalog as $$
declare v_owner uuid; v_total bigint; v_sessions jsonb; v_completeness text;
begin
  v_owner:=wf_system.require_authenticated_owner();
  if p_from is null or p_to is null or p_to<=p_from then raise exception using errcode='22023', message='INVALID_READ_RANGE'; end if;
  if p_limit is null or p_limit<1 or p_limit>100 then raise exception using errcode='22023', message='INVALID_READ_LIMIT'; end if;
  select count(*) into v_total from wf_training.sessions s join wf_training.session_versions v on v.id=s.current_version_id and v.session_id=s.id and v.owner_id=s.owner_id where s.owner_id=v_owner and v.lifecycle_status='ACTIVE' and v.occurred_from<p_to and coalesce(v.occurred_to,v.occurred_from+interval '1 microsecond')>p_from;
  select coalesce(jsonb_agg(x.payload order by x.occurred_from desc,x.session_id),'[]'::jsonb) into v_sessions
  from (
    select s.id session_id,v.occurred_from,
      jsonb_build_object(
        'id',s.id,'version',v.id,'kind',v.session_kind,'label',v.label,
        'occurrence',jsonb_build_object('from',v.occurred_from,'to',v.occurred_to,'precision',v.occurrence_precision,'zone_id',v.zone_id,'interval_semantics',case when v.occurred_to is null then 'POINT' else '[start,end)' end),
        'sets',coalesce((select jsonb_agg(jsonb_build_object('id',es.id,'set_index',es.set_index,'exercise_key',es.exercise_key,'exercise_label',es.exercise_label,'reps',es.reps,'load_value',es.load_value,'load_unit',es.load_unit,'rpe',es.rpe) order by es.set_index) from wf_training.exercise_sets es where es.owner_id=s.owner_id and es.session_id=s.id and es.session_version_id=v.id),'[]'::jsonb),
        'recorded_at',v.recorded_at
      ) payload
    from wf_training.sessions s join wf_training.session_versions v on v.id=s.current_version_id and v.session_id=s.id and v.owner_id=s.owner_id
    where s.owner_id=v_owner and v.lifecycle_status='ACTIVE' and v.occurred_from<p_to and coalesce(v.occurred_to,v.occurred_from+interval '1 microsecond')>p_from
    order by v.occurred_from desc,s.id limit p_limit
  ) x;
  v_completeness:=case when v_total<=p_limit then 'COMPLETE' else 'PARTIAL' end;
  return jsonb_build_object('sessions',v_sessions,'returned_count',jsonb_array_length(v_sessions),'matching_record_count',v_total,'result_coverage',jsonb_build_object('completeness',v_completeness),'epistemic_coverage',jsonb_build_object('completeness','UNKNOWN','reason','Stored training records do not establish complete lived training coverage.'));
end; $$;

revoke all on all tables in schema wf_training from public, anon, authenticated;
revoke all on all sequences in schema wf_training from public, anon, authenticated;
revoke all on all functions in schema wf_training from public, anon, authenticated;
revoke all on function public.wf_training_capture_strength_session(uuid,text,text,timestamptz,date,text,jsonb,text) from public, anon;
revoke all on function public.wf_training_recent_v0(timestamptz,timestamptz,integer) from public, anon;
grant execute on function public.wf_training_capture_strength_session(uuid,text,text,timestamptz,date,text,jsonb,text) to authenticated;
grant execute on function public.wf_training_recent_v0(timestamptz,timestamptz,integer) to authenticated;

commit;
