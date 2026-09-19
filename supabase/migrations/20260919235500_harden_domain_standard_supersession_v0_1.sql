begin;

-- Production hardening: changing a Standard must supersede the previous ACTIVE
-- version before inserting the next ACTIVE head, otherwise the one-active
-- partial unique index rejects a legitimate target change.

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

  -- Free the one-active-version slot before inserting the new head. The
  -- supersession FK is deferred, so it may point at v_new_version until the
  -- new row is inserted later in this same transaction.
  if v_current is not null then
    update wf_training.standard_versions
       set lifecycle_status='SUPERSEDED',superseded_by_version_id=v_new_version
     where id=v_current and standard_id=v_standard and owner_id=v_owner and lifecycle_status='ACTIVE';
  end if;

  insert into wf_training.standard_versions(
    id,standard_id,owner_id,version_no,standard_key,metric,unit,rule,target,recurrence,zone_id,
    lifecycle_status,provenance_source_type,provenance_source_id,actor_owner_id
  ) values (
    v_new_version,v_standard,v_owner,v_version_no,'strength_sessions_weekly','strength_session_count','sessions','AT_LEAST',
    p_target_sessions,'LOCAL_WEEK',v_zone,'ACTIVE','PLAYER_STANDARD',p_provenance_source_id,v_owner
  );

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

  if v_current is not null then
    update wf_nutrition.standard_versions
       set lifecycle_status='SUPERSEDED',superseded_by_version_id=v_new_version
     where id=v_current and standard_id=v_standard and owner_id=v_owner and lifecycle_status='ACTIVE';
  end if;

  insert into wf_nutrition.standard_versions(
    id,standard_id,owner_id,version_no,standard_key,metric,unit,rule,target,recurrence,zone_id,
    lifecycle_status,provenance_source_type,provenance_source_id,actor_owner_id
  ) values (
    v_new_version,v_standard,v_owner,v_version_no,'protein_daily','protein_g','g','AT_LEAST',
    p_target_grams,'LOCAL_DAY',v_zone,'ACTIVE','PLAYER_STANDARD',p_provenance_source_id,v_owner
  );

  update wf_nutrition.standards set current_version_id=v_new_version where id=v_standard and owner_id=v_owner;

  v_ref:=pg_catalog.jsonb_build_object('namespace','nutrition','type','standard','id',v_standard,'version',v_new_version);
  perform wf_system.complete_command(v_owner,p_command_id,'APPLIED',pg_catalog.jsonb_build_array(v_ref),null);
  insert into wf_system.module_change_outbox(owner_id,module_id,change_type,command_id,affected)
  values(v_owner,'nutrition','nutrition.standard_changed',p_command_id,pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('operation','UPSERTED','ref',v_ref)));
  return wf_system.command_response(v_owner,p_command_id,false);
end; $$;

revoke all on function public.wf_training_set_strength_standard_v0(uuid,integer,text,text) from public,anon;
revoke all on function public.wf_nutrition_set_protein_standard_v0(uuid,numeric,text,text) from public,anon;
grant execute on function public.wf_training_set_strength_standard_v0(uuid,integer,text,text) to authenticated;
grant execute on function public.wf_nutrition_set_protein_standard_v0(uuid,numeric,text,text) to authenticated;

commit;
