begin;

create schema if not exists wf_nutrition;
comment on schema wf_nutrition is 'Wayfinder Nutrition module: canonical consumed food/intake events and explicitly supplied nutrition observations.';
revoke all on schema wf_nutrition from public, anon, authenticated;

create table wf_nutrition.intakes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references wf_system.owners(id) on delete restrict,
  current_version_id uuid,
  created_at timestamptz not null default now(),
  constraint nutrition_intakes_id_owner_uq unique (id, owner_id)
);

create table wf_nutrition.intake_versions (
  id uuid primary key default gen_random_uuid(),
  intake_id uuid not null,
  owner_id uuid not null,
  version_no bigint not null,
  schema_version smallint not null default 1,
  intake_kind text not null,
  label text,
  occurred_from timestamptz not null,
  occurred_to timestamptz,
  occurrence_precision text not null,
  zone_id text not null,
  calories_kcal numeric(12,3),
  calories_precision text,
  protein_g numeric(12,3),
  protein_precision text,
  carbs_g numeric(12,3),
  carbs_precision text,
  fat_g numeric(12,3),
  fat_precision text,
  lifecycle_status text not null,
  superseded_by_version_id uuid,
  provenance_source_type text not null,
  provenance_source_id text,
  actor_owner_id uuid,
  recorded_at timestamptz not null default now(),
  constraint nutrition_versions_owner_fk foreign key (owner_id) references wf_system.owners(id) on delete restrict,
  constraint nutrition_versions_actor_owner_fk foreign key (actor_owner_id) references wf_system.owners(id) on delete restrict,
  constraint nutrition_versions_intake_owner_fk foreign key (intake_id, owner_id) references wf_nutrition.intakes(id, owner_id) on delete restrict,
  constraint nutrition_versions_record_version_uq unique (intake_id, version_no),
  constraint nutrition_versions_id_record_owner_uq unique (id, intake_id, owner_id),
  constraint nutrition_versions_version_no_ck check (version_no > 0),
  constraint nutrition_versions_schema_version_ck check (schema_version > 0),
  constraint nutrition_versions_kind_ck check (intake_kind in ('MEAL','FOOD_INTAKE')),
  constraint nutrition_versions_label_ck check (label is null or (btrim(label)<>'' and char_length(label)<=300)),
  constraint nutrition_versions_occurrence_precision_ck check (occurrence_precision in ('INSTANT','DAY','APPROXIMATE')),
  constraint nutrition_versions_occurrence_range_ck check (occurred_to is null or occurred_to > occurred_from),
  constraint nutrition_versions_zone_ck check (btrim(zone_id)<>''),
  constraint nutrition_versions_calories_ck check (calories_kcal is null or calories_kcal >= 0),
  constraint nutrition_versions_protein_ck check (protein_g is null or protein_g >= 0),
  constraint nutrition_versions_carbs_ck check (carbs_g is null or carbs_g >= 0),
  constraint nutrition_versions_fat_ck check (fat_g is null or fat_g >= 0),
  constraint nutrition_versions_calories_pair_ck check ((calories_kcal is null and calories_precision is null) or (calories_kcal is not null and calories_precision in ('EXACT','APPROXIMATE','UNKNOWN'))),
  constraint nutrition_versions_protein_pair_ck check ((protein_g is null and protein_precision is null) or (protein_g is not null and protein_precision in ('EXACT','APPROXIMATE','UNKNOWN'))),
  constraint nutrition_versions_carbs_pair_ck check ((carbs_g is null and carbs_precision is null) or (carbs_g is not null and carbs_precision in ('EXACT','APPROXIMATE','UNKNOWN'))),
  constraint nutrition_versions_fat_pair_ck check ((fat_g is null and fat_precision is null) or (fat_g is not null and fat_precision in ('EXACT','APPROXIMATE','UNKNOWN'))),
  constraint nutrition_versions_lifecycle_ck check (lifecycle_status in ('ACTIVE','SUPERSEDED','RETRACTED')),
  constraint nutrition_versions_supersession_shape_ck check ((lifecycle_status='SUPERSEDED' and superseded_by_version_id is not null) or (lifecycle_status in ('ACTIVE','RETRACTED') and superseded_by_version_id is null))
);

create table wf_nutrition.intake_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references wf_system.owners(id) on delete restrict,
  intake_id uuid not null,
  intake_version_id uuid not null,
  item_index integer not null,
  item_label text not null,
  quantity_value numeric(12,3),
  quantity_unit text,
  quantity_precision text,
  provenance_source_type text not null,
  provenance_source_id text,
  recorded_at timestamptz not null default now(),
  constraint nutrition_items_version_fk foreign key (intake_version_id, intake_id, owner_id) references wf_nutrition.intake_versions(id, intake_id, owner_id) on delete restrict,
  constraint nutrition_items_version_index_uq unique (intake_version_id, item_index),
  constraint nutrition_items_index_ck check (item_index > 0),
  constraint nutrition_items_label_ck check (btrim(item_label)<>'' and char_length(item_label)<=300),
  constraint nutrition_items_quantity_ck check (quantity_value is null or quantity_value > 0),
  constraint nutrition_items_quantity_pair_ck check (
    (quantity_value is null and quantity_unit is null and quantity_precision is null)
    or
    (quantity_value is not null and quantity_unit is not null and btrim(quantity_unit)<>'' and char_length(quantity_unit)<=80 and quantity_precision in ('EXACT','APPROXIMATE','UNKNOWN'))
  )
);

alter table wf_nutrition.intake_versions
  add constraint nutrition_versions_superseded_same_record_fk
  foreign key (superseded_by_version_id, intake_id, owner_id)
  references wf_nutrition.intake_versions(id, intake_id, owner_id)
  on delete restrict deferrable initially deferred;

alter table wf_nutrition.intakes
  add constraint nutrition_intakes_current_same_record_fk
  foreign key (current_version_id, id, owner_id)
  references wf_nutrition.intake_versions(id, intake_id, owner_id)
  on delete restrict deferrable initially deferred;

create unique index nutrition_versions_one_active_idx on wf_nutrition.intake_versions(intake_id) where lifecycle_status='ACTIVE';
create index nutrition_intakes_owner_idx on wf_nutrition.intakes(owner_id);
create index nutrition_intakes_current_idx on wf_nutrition.intakes(current_version_id) where current_version_id is not null;
create index nutrition_versions_owner_time_idx on wf_nutrition.intake_versions(owner_id, occurred_from desc) where lifecycle_status='ACTIVE';
create index nutrition_versions_actor_idx on wf_nutrition.intake_versions(actor_owner_id) where actor_owner_id is not null;
create index nutrition_items_owner_idx on wf_nutrition.intake_items(owner_id);
create index nutrition_items_intake_idx on wf_nutrition.intake_items(intake_id, intake_version_id);

create or replace function wf_nutrition.valid_zone(p_zone text)
returns boolean language sql stable set search_path=pg_catalog as $$
  select p_zone is not null and btrim(p_zone)<>'' and exists(select 1 from pg_catalog.pg_timezone_names z where z.name=btrim(p_zone));
$$;

create or replace function wf_nutrition.protect_intake_identity_update()
returns trigger language plpgsql set search_path=pg_catalog as $$
begin
  if new.id is distinct from old.id or new.owner_id is distinct from old.owner_id or new.created_at is distinct from old.created_at then
    raise exception using errcode='55000', message='NUTRITION_INTAKE_IDENTITY_IMMUTABLE';
  end if;
  return new;
end; $$;
create trigger nutrition_intakes_protect_identity_trg before update on wf_nutrition.intakes for each row execute function wf_nutrition.protect_intake_identity_update();

create or replace function wf_nutrition.protect_intake_version_update()
returns trigger language plpgsql set search_path=pg_catalog as $$
begin
  if new.id is distinct from old.id or new.intake_id is distinct from old.intake_id or new.owner_id is distinct from old.owner_id or new.version_no is distinct from old.version_no or new.schema_version is distinct from old.schema_version or new.intake_kind is distinct from old.intake_kind or new.label is distinct from old.label or new.occurred_from is distinct from old.occurred_from or new.occurred_to is distinct from old.occurred_to or new.occurrence_precision is distinct from old.occurrence_precision or new.zone_id is distinct from old.zone_id or new.calories_kcal is distinct from old.calories_kcal or new.calories_precision is distinct from old.calories_precision or new.protein_g is distinct from old.protein_g or new.protein_precision is distinct from old.protein_precision or new.carbs_g is distinct from old.carbs_g or new.carbs_precision is distinct from old.carbs_precision or new.fat_g is distinct from old.fat_g or new.fat_precision is distinct from old.fat_precision or new.provenance_source_type is distinct from old.provenance_source_type or new.provenance_source_id is distinct from old.provenance_source_id or new.actor_owner_id is distinct from old.actor_owner_id or new.recorded_at is distinct from old.recorded_at then
    raise exception using errcode='55000', message='NUTRITION_INTAKE_VERSION_PAYLOAD_IMMUTABLE';
  end if;
  if old.lifecycle_status='ACTIVE' then
    if new.lifecycle_status not in ('ACTIVE','SUPERSEDED','RETRACTED') then raise exception using errcode='55000', message='INVALID_NUTRITION_LIFECYCLE_TRANSITION'; end if;
  elsif new.lifecycle_status is distinct from old.lifecycle_status then
    raise exception using errcode='55000', message='INVALID_NUTRITION_LIFECYCLE_TRANSITION';
  end if;
  if old.lifecycle_status<>'ACTIVE' and new.superseded_by_version_id is distinct from old.superseded_by_version_id then raise exception using errcode='55000', message='NUTRITION_VERSION_LINEAGE_IMMUTABLE'; end if;
  return new;
end; $$;
create trigger nutrition_versions_protect_update_trg before update on wf_nutrition.intake_versions for each row execute function wf_nutrition.protect_intake_version_update();

create or replace function wf_nutrition.protect_item_update()
returns trigger language plpgsql set search_path=pg_catalog as $$
begin
  raise exception using errcode='55000', message='NUTRITION_ITEM_IMMUTABLE';
end; $$;
create trigger nutrition_items_protect_update_trg before update on wf_nutrition.intake_items for each row execute function wf_nutrition.protect_item_update();

create or replace function wf_nutrition.assert_head_integrity()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare v_id uuid; v_owner uuid; v_current uuid; v_status text; v_active integer;
begin
  if tg_table_name='intakes' then
    if tg_op='DELETE' then v_id:=old.id; v_owner:=old.owner_id; else v_id:=new.id; v_owner:=new.owner_id; end if;
  else
    if tg_op='DELETE' then v_id:=old.intake_id; v_owner:=old.owner_id; else v_id:=new.intake_id; v_owner:=new.owner_id; end if;
  end if;
  select i.current_version_id into v_current from wf_nutrition.intakes i where i.id=v_id and i.owner_id=v_owner;
  if not found then if tg_op='DELETE' then return old; else return new; end if; end if;
  if v_current is null then raise exception using errcode='23514', message='NUTRITION_CURRENT_VERSION_REQUIRED'; end if;
  select v.lifecycle_status into v_status from wf_nutrition.intake_versions v where v.id=v_current and v.intake_id=v_id and v.owner_id=v_owner;
  if not found then raise exception using errcode='23503', message='NUTRITION_CURRENT_VERSION_MISSING'; end if;
  if v_status='SUPERSEDED' then raise exception using errcode='23514', message='NUTRITION_HEAD_CANNOT_BE_SUPERSEDED'; end if;
  select count(*)::integer into v_active from wf_nutrition.intake_versions v where v.intake_id=v_id and v.owner_id=v_owner and v.lifecycle_status='ACTIVE';
  if v_status='ACTIVE' and v_active<>1 then raise exception using errcode='23514', message='NUTRITION_ACTIVE_HEAD_INTEGRITY_VIOLATION'; end if;
  if v_status='RETRACTED' and v_active<>0 then raise exception using errcode='23514', message='NUTRITION_RETRACTED_HEAD_HAS_ACTIVE_VERSION'; end if;
  if tg_op='DELETE' then return old; else return new; end if;
end; $$;
create constraint trigger nutrition_intakes_head_integrity_trg after insert or update on wf_nutrition.intakes deferrable initially deferred for each row execute function wf_nutrition.assert_head_integrity();
create constraint trigger nutrition_versions_head_integrity_trg after insert or update or delete on wf_nutrition.intake_versions deferrable initially deferred for each row execute function wf_nutrition.assert_head_integrity();

create or replace function public.wf_nutrition_capture_intake(
  p_command_id uuid,
  p_intake_kind text,
  p_occurrence_precision text,
  p_zone_id text default null,
  p_occurred_at timestamptz default null,
  p_occurred_local_date date default null,
  p_label text default null,
  p_items jsonb default '[]'::jsonb,
  p_calories_kcal numeric default null,
  p_calories_precision text default null,
  p_protein_g numeric default null,
  p_protein_precision text default null,
  p_carbs_g numeric default null,
  p_carbs_precision text default null,
  p_fat_g numeric default null,
  p_fat_precision text default null,
  p_provenance_source_id text default null
)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare
  v_owner uuid; v_zone text; v_occurrence text; v_kind text; v_hash text; v_claim record;
  v_intake uuid; v_version uuid; v_ref jsonb; v_from timestamptz; v_to timestamptz;
  v_item jsonb; v_idx integer; v_label text; v_q numeric; v_unit text; v_precision text;
  v_cal_precision text; v_protein_precision text; v_carbs_precision text; v_fat_precision text;
begin
  v_owner:=wf_system.require_authenticated_owner();
  v_zone:=nullif(btrim(p_zone_id),''); if v_zone is null then select o.timezone into v_zone from wf_system.owners o where o.id=v_owner; end if;
  v_occurrence:=upper(btrim(p_occurrence_precision));
  v_kind:=upper(btrim(p_intake_kind));
  v_cal_precision:=case when p_calories_precision is null then null else upper(btrim(p_calories_precision)) end;
  v_protein_precision:=case when p_protein_precision is null then null else upper(btrim(p_protein_precision)) end;
  v_carbs_precision:=case when p_carbs_precision is null then null else upper(btrim(p_carbs_precision)) end;
  v_fat_precision:=case when p_fat_precision is null then null else upper(btrim(p_fat_precision)) end;

  v_hash:=wf_system.command_hash(pg_catalog.jsonb_build_object(
    'contract','nutrition.capture_intake.v0.1','intake_kind',v_kind,'occurrence_precision',v_occurrence,'zone_id',v_zone,
    'occurred_at',p_occurred_at,'occurred_local_date',p_occurred_local_date,'label',nullif(btrim(p_label),''),
    'items',coalesce(p_items,'[]'::jsonb),
    'calories_kcal',p_calories_kcal,'calories_precision',v_cal_precision,
    'protein_g',p_protein_g,'protein_precision',v_protein_precision,
    'carbs_g',p_carbs_g,'carbs_precision',v_carbs_precision,
    'fat_g',p_fat_g,'fat_precision',v_fat_precision,
    'provenance_source_id',p_provenance_source_id
  ));
  select * into v_claim from wf_system.claim_command(v_owner,p_command_id,'nutrition','nutrition.capture_intake',v_hash);
  if not v_claim.is_new then return wf_system.command_response(v_owner,p_command_id,true); end if;

  if v_kind not in ('MEAL','FOOD_INTAKE') then perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'INVALID_NUTRITION_INTAKE_KIND'); return wf_system.command_response(v_owner,p_command_id,false); end if;
  if not wf_nutrition.valid_zone(v_zone) then perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'INVALID_TIMEZONE'); return wf_system.command_response(v_owner,p_command_id,false); end if;
  if v_occurrence not in ('INSTANT','DAY','APPROXIMATE') then perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'INVALID_NUTRITION_OCCURRENCE_PRECISION'); return wf_system.command_response(v_owner,p_command_id,false); end if;
  if v_occurrence='DAY' then
    if p_occurred_local_date is null or p_occurred_at is not null then perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'INVALID_NUTRITION_DAY_OCCURRENCE'); return wf_system.command_response(v_owner,p_command_id,false); end if;
    select starts_at,ends_at into v_from,v_to from wf_system.local_day_bounds(p_occurred_local_date,v_zone);
  else
    if p_occurred_at is null or p_occurred_local_date is not null then perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'INVALID_NUTRITION_INSTANT_OCCURRENCE'); return wf_system.command_response(v_owner,p_command_id,false); end if;
    v_from:=p_occurred_at; v_to:=null;
  end if;
  if p_label is not null and (btrim(p_label)='' or char_length(btrim(p_label))>300) then perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'INVALID_NUTRITION_LABEL'); return wf_system.command_response(v_owner,p_command_id,false); end if;
  if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)>50 then perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'INVALID_NUTRITION_ITEMS'); return wf_system.command_response(v_owner,p_command_id,false); end if;

  if p_calories_kcal is not null and p_calories_kcal<0 or p_protein_g is not null and p_protein_g<0 or p_carbs_g is not null and p_carbs_g<0 or p_fat_g is not null and p_fat_g<0 then
    perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'INVALID_NUTRITION_TOTAL'); return wf_system.command_response(v_owner,p_command_id,false);
  end if;
  if (p_calories_kcal is null) <> (v_cal_precision is null) or (p_protein_g is null) <> (v_protein_precision is null) or (p_carbs_g is null) <> (v_carbs_precision is null) or (p_fat_g is null) <> (v_fat_precision is null) then
    perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'INVALID_NUTRITION_TOTAL_PRECISION_PAIR'); return wf_system.command_response(v_owner,p_command_id,false);
  end if;
  if coalesce(v_cal_precision,'EXACT') not in ('EXACT','APPROXIMATE','UNKNOWN') or coalesce(v_protein_precision,'EXACT') not in ('EXACT','APPROXIMATE','UNKNOWN') or coalesce(v_carbs_precision,'EXACT') not in ('EXACT','APPROXIMATE','UNKNOWN') or coalesce(v_fat_precision,'EXACT') not in ('EXACT','APPROXIMATE','UNKNOWN') then
    perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'INVALID_NUTRITION_TOTAL_PRECISION'); return wf_system.command_response(v_owner,p_command_id,false);
  end if;

  v_idx:=0;
  for v_item in select value from jsonb_array_elements(p_items) loop
    v_idx:=v_idx+1;
    v_label:=nullif(btrim(v_item->>'item_label'),'');
    begin v_q:=case when v_item ? 'quantity_value' and v_item->>'quantity_value' is not null then (v_item->>'quantity_value')::numeric else null end; exception when others then v_q:=null; end;
    v_unit:=case when v_item ? 'quantity_unit' then nullif(btrim(v_item->>'quantity_unit'),'') else null end;
    v_precision:=case when v_item ? 'quantity_precision' then upper(nullif(btrim(v_item->>'quantity_precision'),'')) else null end;
    if v_label is null or char_length(v_label)>300 or (v_item ? 'quantity_value' and v_item->>'quantity_value' is not null and v_q is null) or (v_q is not null and v_q<=0) or ((v_q is null) <> (v_unit is null)) or ((v_q is null) <> (v_precision is null)) or (v_unit is not null and char_length(v_unit)>80) or (v_precision is not null and v_precision not in ('EXACT','APPROXIMATE','UNKNOWN')) then
      perform wf_system.complete_command(v_owner,p_command_id,'REJECTED',null,'INVALID_NUTRITION_ITEM_PAYLOAD'); return wf_system.command_response(v_owner,p_command_id,false);
    end if;
  end loop;

  v_intake:=gen_random_uuid(); v_version:=gen_random_uuid();
  insert into wf_nutrition.intakes(id,owner_id) values(v_intake,v_owner);
  insert into wf_nutrition.intake_versions(
    id,intake_id,owner_id,version_no,intake_kind,label,occurred_from,occurred_to,occurrence_precision,zone_id,
    calories_kcal,calories_precision,protein_g,protein_precision,carbs_g,carbs_precision,fat_g,fat_precision,
    lifecycle_status,provenance_source_type,provenance_source_id,actor_owner_id
  ) values (
    v_version,v_intake,v_owner,1,v_kind,nullif(btrim(p_label),''),v_from,v_to,v_occurrence,v_zone,
    p_calories_kcal,v_cal_precision,p_protein_g,v_protein_precision,p_carbs_g,v_carbs_precision,p_fat_g,v_fat_precision,
    'ACTIVE','SEMANTIC_ADMISSION',p_provenance_source_id,v_owner
  );
  update wf_nutrition.intakes set current_version_id=v_version where id=v_intake and owner_id=v_owner;

  v_idx:=0;
  for v_item in select value from jsonb_array_elements(p_items) loop
    v_idx:=v_idx+1;
    v_label:=btrim(v_item->>'item_label');
    v_q:=case when v_item ? 'quantity_value' and v_item->>'quantity_value' is not null then (v_item->>'quantity_value')::numeric else null end;
    v_unit:=case when v_item ? 'quantity_unit' then nullif(btrim(v_item->>'quantity_unit'),'') else null end;
    v_precision:=case when v_item ? 'quantity_precision' then upper(nullif(btrim(v_item->>'quantity_precision'),'')) else null end;
    insert into wf_nutrition.intake_items(owner_id,intake_id,intake_version_id,item_index,item_label,quantity_value,quantity_unit,quantity_precision,provenance_source_type,provenance_source_id)
    values(v_owner,v_intake,v_version,v_idx,v_label,v_q,v_unit,v_precision,'SEMANTIC_ADMISSION',p_provenance_source_id);
  end loop;

  v_ref:=jsonb_build_object('namespace','nutrition','type','intake','id',v_intake,'version',v_version);
  perform wf_system.complete_command(v_owner,p_command_id,'APPLIED',jsonb_build_array(v_ref),null);
  insert into wf_system.module_change_outbox(owner_id,module_id,change_type,command_id,affected)
  values(v_owner,'nutrition','nutrition.intake_captured',p_command_id,jsonb_build_array(jsonb_build_object('operation','CREATED','ref',v_ref)));
  return wf_system.command_response(v_owner,p_command_id,false);
end; $$;

create or replace function public.wf_nutrition_recent_v0(p_from timestamptz,p_to timestamptz,p_limit integer default 20)
returns jsonb language plpgsql security definer stable set search_path=pg_catalog as $$
declare v_owner uuid; v_total bigint; v_intakes jsonb; v_completeness text;
begin
  v_owner:=wf_system.require_authenticated_owner();
  if p_from is null or p_to is null or p_to<=p_from then raise exception using errcode='22023', message='INVALID_READ_RANGE'; end if;
  if p_limit is null or p_limit<1 or p_limit>100 then raise exception using errcode='22023', message='INVALID_READ_LIMIT'; end if;

  select count(*) into v_total
  from wf_nutrition.intakes i
  join wf_nutrition.intake_versions v on v.id=i.current_version_id and v.intake_id=i.id and v.owner_id=i.owner_id
  where i.owner_id=v_owner and v.lifecycle_status='ACTIVE' and v.occurred_from<p_to and coalesce(v.occurred_to,v.occurred_from+interval '1 microsecond')>p_from;

  select coalesce(jsonb_agg(x.payload order by x.occurred_from desc,x.intake_id),'[]'::jsonb) into v_intakes
  from (
    select i.id intake_id,v.occurred_from,
      jsonb_build_object(
        'id',i.id,'version',v.id,'kind',v.intake_kind,'label',v.label,
        'occurrence',jsonb_build_object('from',v.occurred_from,'to',v.occurred_to,'precision',v.occurrence_precision,'zone_id',v.zone_id,'interval_semantics',case when v.occurred_to is null then 'POINT' else '[start,end)' end),
        'nutrition',jsonb_build_object(
          'calories_kcal',v.calories_kcal,'calories_precision',v.calories_precision,
          'protein_g',v.protein_g,'protein_precision',v.protein_precision,
          'carbs_g',v.carbs_g,'carbs_precision',v.carbs_precision,
          'fat_g',v.fat_g,'fat_precision',v.fat_precision
        ),
        'items',coalesce((
          select jsonb_agg(jsonb_build_object(
            'id',ii.id,'item_index',ii.item_index,'item_label',ii.item_label,
            'quantity_value',ii.quantity_value,'quantity_unit',ii.quantity_unit,'quantity_precision',ii.quantity_precision
          ) order by ii.item_index)
          from wf_nutrition.intake_items ii
          where ii.owner_id=i.owner_id and ii.intake_id=i.id and ii.intake_version_id=v.id
        ),'[]'::jsonb),
        'recorded_at',v.recorded_at
      ) payload
    from wf_nutrition.intakes i
    join wf_nutrition.intake_versions v on v.id=i.current_version_id and v.intake_id=i.id and v.owner_id=i.owner_id
    where i.owner_id=v_owner and v.lifecycle_status='ACTIVE' and v.occurred_from<p_to and coalesce(v.occurred_to,v.occurred_from+interval '1 microsecond')>p_from
    order by v.occurred_from desc,i.id
    limit p_limit
  ) x;

  v_completeness:=case when v_total<=p_limit then 'COMPLETE' else 'PARTIAL' end;
  return jsonb_build_object(
    'intakes',v_intakes,
    'returned_count',jsonb_array_length(v_intakes),
    'matching_record_count',v_total,
    'result_coverage',jsonb_build_object('completeness',v_completeness),
    'epistemic_coverage',jsonb_build_object('completeness','UNKNOWN','reason','Stored nutrition records do not establish complete lived intake coverage.')
  );
end; $$;

revoke all on all tables in schema wf_nutrition from public, anon, authenticated;
revoke all on all sequences in schema wf_nutrition from public, anon, authenticated;
revoke all on all functions in schema wf_nutrition from public, anon, authenticated;
revoke all on function public.wf_nutrition_capture_intake(uuid,text,text,text,timestamptz,date,text,jsonb,numeric,text,numeric,text,numeric,text,numeric,text,text) from public, anon;
revoke all on function public.wf_nutrition_recent_v0(timestamptz,timestamptz,integer) from public, anon;
grant execute on function public.wf_nutrition_capture_intake(uuid,text,text,text,timestamptz,date,text,jsonb,numeric,text,numeric,text,numeric,text,numeric,text,text) to authenticated;
grant execute on function public.wf_nutrition_recent_v0(timestamptz,timestamptz,integer) to authenticated;

commit;
