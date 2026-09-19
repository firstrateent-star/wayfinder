begin;

create or replace function public.wf_admission_stage_v0(
  p_auth_user_id uuid,
  p_proposal_id uuid,
  p_planner_proposal_id text,
  p_episode_id text,
  p_turn_id text,
  p_candidate_id text,
  p_domain_owner text,
  p_claim_type text,
  p_semantic_fingerprint text,
  p_normalized_payload jsonb,
  p_source_context jsonb,
  p_summary text,
  p_command_id uuid,
  p_ttl_seconds integer default 900
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog
as $$
declare
  v_owner uuid;
  v_existing wf_system.admission_envelopes%rowtype;
  v_expires timestamptz;
begin
  select o.id into v_owner from wf_system.owners o where o.auth_user_id=p_auth_user_id;
  if v_owner is null then raise exception using errcode='P0001', message='WAYFINDER_OWNER_NOT_INITIALIZED'; end if;
  if p_proposal_id is null or p_command_id is null then raise exception using errcode='22023', message='ADMISSION_IDS_REQUIRED'; end if;
  if p_planner_proposal_id is null or btrim(p_planner_proposal_id)='' or
     p_episode_id is null or btrim(p_episode_id)='' or
     p_turn_id is null or btrim(p_turn_id)='' or
     p_candidate_id is null or btrim(p_candidate_id)='' or
     p_domain_owner is null or btrim(p_domain_owner)='' or
     p_claim_type is null or btrim(p_claim_type)='' or
     p_semantic_fingerprint is null or btrim(p_semantic_fingerprint)='' or
     p_normalized_payload is null or p_source_context is null or
     p_summary is null or btrim(p_summary)='' then
    raise exception using errcode='22023', message='INVALID_ADMISSION_ENVELOPE';
  end if;
  if p_ttl_seconds is null or p_ttl_seconds < 60 or p_ttl_seconds > 3600 then
    raise exception using errcode='22023', message='INVALID_ADMISSION_TTL';
  end if;
  v_expires:=clock_timestamp()+make_interval(secs=>p_ttl_seconds);

  delete from wf_system.admission_envelopes
   where owner_id=v_owner and expires_at<clock_timestamp();

  select * into v_existing
    from wf_system.admission_envelopes
   where owner_id=v_owner
     and planner_proposal_id=btrim(p_planner_proposal_id)
     and semantic_fingerprint=btrim(p_semantic_fingerprint);

  if found then
    if v_existing.domain_owner is distinct from btrim(p_domain_owner) or
       v_existing.claim_type is distinct from btrim(p_claim_type) or
       v_existing.normalized_payload is distinct from p_normalized_payload or
       v_existing.source_context is distinct from p_source_context then
      raise exception using errcode='23505', message='ADMISSION_SEMANTIC_IDENTITY_CONFLICT';
    end if;
    return jsonb_build_object(
      'proposal_id',v_existing.id,'status',v_existing.status,'expires_at',v_existing.expires_at,
      'summary',v_existing.summary,'replayed',true
    );
  end if;

  select * into v_existing
    from wf_system.admission_envelopes
   where id=p_proposal_id and owner_id=v_owner;

  if found then
    if v_existing.semantic_fingerprint is distinct from p_semantic_fingerprint or
       v_existing.planner_proposal_id is distinct from p_planner_proposal_id or
       v_existing.domain_owner is distinct from p_domain_owner or
       v_existing.claim_type is distinct from p_claim_type or
       v_existing.normalized_payload is distinct from p_normalized_payload or
       v_existing.source_context is distinct from p_source_context then
      raise exception using errcode='23505', message='ADMISSION_PROPOSAL_ID_CONFLICT';
    end if;
    return jsonb_build_object(
      'proposal_id',v_existing.id,'status',v_existing.status,'expires_at',v_existing.expires_at,
      'summary',v_existing.summary,'replayed',true
    );
  end if;

  insert into wf_system.admission_envelopes(
    id,owner_id,planner_proposal_id,episode_id,turn_id,candidate_id,domain_owner,claim_type,
    semantic_fingerprint,normalized_payload,source_context,summary,command_id,expires_at
  ) values (
    p_proposal_id,v_owner,btrim(p_planner_proposal_id),btrim(p_episode_id),btrim(p_turn_id),
    btrim(p_candidate_id),btrim(p_domain_owner),btrim(p_claim_type),btrim(p_semantic_fingerprint),
    p_normalized_payload,p_source_context,btrim(p_summary),p_command_id,v_expires
  );

  return jsonb_build_object(
    'proposal_id',p_proposal_id,'status','STAGED','expires_at',v_expires,'summary',btrim(p_summary),'replayed',false
  );
end;
$$;

create or replace function public.wf_admission_fetch_v0(
  p_auth_user_id uuid,
  p_proposal_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog
as $$
declare
  v_owner uuid;
  v_row wf_system.admission_envelopes%rowtype;
begin
  select o.id into v_owner from wf_system.owners o where o.auth_user_id=p_auth_user_id;
  if v_owner is null then raise exception using errcode='P0001', message='WAYFINDER_OWNER_NOT_INITIALIZED'; end if;

  select * into v_row
    from wf_system.admission_envelopes
   where id=p_proposal_id and owner_id=v_owner;

  if not found then raise exception using errcode='P0001', message='ADMISSION_PROPOSAL_NOT_FOUND'; end if;
  if v_row.expires_at<clock_timestamp() then
    raise exception using errcode='P0001', message='ADMISSION_PROPOSAL_EXPIRED';
  end if;

  return jsonb_build_object(
    'proposal_id',v_row.id,
    'planner_proposal_id',v_row.planner_proposal_id,
    'episode_id',v_row.episode_id,
    'turn_id',v_row.turn_id,
    'candidate_id',v_row.candidate_id,
    'domain_owner',v_row.domain_owner,
    'claim_type',v_row.claim_type,
    'normalized_payload',v_row.normalized_payload,
    'source_context',v_row.source_context,
    'summary',v_row.summary,
    'command_id',v_row.command_id,
    'status',v_row.status,
    'command_result',v_row.command_result,
    'expires_at',v_row.expires_at
  );
end;
$$;

create or replace function public.wf_admission_complete_v0(
  p_auth_user_id uuid,
  p_proposal_id uuid,
  p_command_result jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog
as $$
declare
  v_owner uuid;
  v_status text;
  v_row wf_system.admission_envelopes%rowtype;
begin
  select o.id into v_owner from wf_system.owners o where o.auth_user_id=p_auth_user_id;
  if v_owner is null then raise exception using errcode='P0001', message='WAYFINDER_OWNER_NOT_INITIALIZED'; end if;
  if p_command_result is null or jsonb_typeof(p_command_result)<>'object' then
    raise exception using errcode='22023', message='INVALID_ADMISSION_COMMAND_RESULT';
  end if;

  v_status:=case
    when upper(coalesce(p_command_result->>'status','')) in ('APPLIED','NOOP') then 'APPLIED'
    when upper(coalesce(p_command_result->>'status',''))='REJECTED' then 'REJECTED'
    else null
  end;
  if v_status is null then raise exception using errcode='22023', message='INVALID_ADMISSION_COMMAND_STATUS'; end if;

  update wf_system.admission_envelopes
     set status=v_status,
         command_result=p_command_result,
         normalized_payload='{}'::jsonb,
         source_context='{}'::jsonb,
         completed_at=clock_timestamp()
   where id=p_proposal_id and owner_id=v_owner and status='STAGED' and expires_at>=clock_timestamp()
   returning * into v_row;

  if not found then
    select * into v_row from wf_system.admission_envelopes where id=p_proposal_id and owner_id=v_owner;
    if not found then raise exception using errcode='P0001', message='ADMISSION_PROPOSAL_NOT_FOUND'; end if;
    if v_row.expires_at<clock_timestamp() then raise exception using errcode='P0001', message='ADMISSION_PROPOSAL_EXPIRED'; end if;
  end if;

  return jsonb_build_object(
    'proposal_id',v_row.id,'status',v_row.status,'command_result',v_row.command_result,'completed_at',v_row.completed_at
  );
end;
$$;

revoke all on function public.wf_admission_stage_v0(uuid,uuid,text,text,text,text,text,text,text,jsonb,jsonb,text,uuid,integer) from public,anon,authenticated;
revoke all on function public.wf_admission_fetch_v0(uuid,uuid) from public,anon,authenticated;
revoke all on function public.wf_admission_complete_v0(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.wf_admission_stage_v0(uuid,uuid,text,text,text,text,text,text,text,jsonb,jsonb,text,uuid,integer) to service_role;
grant execute on function public.wf_admission_fetch_v0(uuid,uuid) to service_role;
grant execute on function public.wf_admission_complete_v0(uuid,uuid,jsonb) to service_role;

commit;
