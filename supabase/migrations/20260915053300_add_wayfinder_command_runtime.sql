begin;

-- Race-safe semantic uniqueness used by typed Slice 1A commands.
create unique index direction_edges_one_active_semantic_uq
  on wf_direction.edges (owner_id, from_node_id, to_node_id, relation)
  where lifecycle_status = 'ACTIVE';

alter table wf_evidence.links
  add constraint evidence_links_target_aspect_nonblank_ck
  check (target_aspect is null or btrim(target_aspect) <> '');

create unique index evidence_links_one_active_semantic_uq
  on wf_evidence.links (
    owner_id,
    source_namespace,
    source_type,
    source_record_id,
    source_version_id,
    target_namespace,
    target_type,
    target_record_id,
    target_version_id,
    coalesce(target_aspect, ''),
    relation
  )
  where lifecycle_status = 'ACTIVE';

-- Internal authenticated-owner resolver. Not exposed to client roles.
create or replace function wf_system.require_authenticated_owner()
returns uuid
language plpgsql
stable
set search_path = pg_catalog
as $$
declare
  v_auth_user_id uuid;
  v_owner_id uuid;
begin
  v_auth_user_id := auth.uid();
  if v_auth_user_id is null then
    raise exception using errcode = '42501', message = 'AUTH_REQUIRED';
  end if;

  select o.id into v_owner_id
    from wf_system.owners o
   where o.auth_user_id = v_auth_user_id;

  if v_owner_id is null then
    raise exception using errcode = 'P0001', message = 'WAYFINDER_OWNER_NOT_INITIALIZED';
  end if;

  return v_owner_id;
end;
$$;

-- Server-owned canonical request hashing. Typed RPCs build normalized jsonb
-- before calling this function; clients never submit their own hash.
create or replace function wf_system.command_hash(p_material jsonb)
returns text
language sql
stable
set search_path = pg_catalog
as $$
  select pg_catalog.encode(extensions.digest(p_material::text, 'sha256'), 'hex');
$$;

-- Claim a Command id. The unique key serializes concurrent true retries.
create or replace function wf_system.claim_command(
  p_owner_id uuid,
  p_command_id uuid,
  p_module_id text,
  p_command_type text,
  p_request_hash text
)
returns table (
  is_new boolean,
  status text,
  affected_refs jsonb,
  error_code text
)
language plpgsql
set search_path = pg_catalog
as $$
declare
  v_rows integer;
  v_existing record;
begin
  insert into wf_system.command_receipts (
    command_id,
    owner_id,
    module_id,
    command_type,
    request_hash,
    requested_at,
    status
  ) values (
    p_command_id,
    p_owner_id,
    p_module_id,
    p_command_type,
    p_request_hash,
    pg_catalog.clock_timestamp(),
    'PROCESSING'
  )
  on conflict (command_id) do nothing;

  get diagnostics v_rows = row_count;

  if v_rows = 1 then
    is_new := true;
    status := 'PROCESSING';
    affected_refs := null;
    error_code := null;
    return next;
    return;
  end if;

  select r.owner_id, r.module_id, r.command_type, r.request_hash,
         r.status, r.affected_refs, r.error_code
    into v_existing
    from wf_system.command_receipts r
   where r.command_id = p_command_id
   for update;

  if v_existing.owner_id is distinct from p_owner_id
     or v_existing.module_id is distinct from p_module_id
     or v_existing.command_type is distinct from p_command_type
     or v_existing.request_hash is distinct from p_request_hash then
    raise exception using errcode = '23505', message = 'COMMAND_ID_CONFLICT';
  end if;

  if v_existing.status = 'PROCESSING' then
    raise exception using errcode = '55000', message = 'COMMAND_IN_PROGRESS';
  end if;

  is_new := false;
  status := v_existing.status;
  affected_refs := v_existing.affected_refs;
  error_code := v_existing.error_code;
  return next;
end;
$$;

create or replace function wf_system.complete_command(
  p_owner_id uuid,
  p_command_id uuid,
  p_status text,
  p_affected_refs jsonb default null,
  p_error_code text default null
)
returns void
language plpgsql
set search_path = pg_catalog
as $$
declare
  v_rows integer;
begin
  if p_status not in ('APPLIED','REJECTED','NOOP') then
    raise exception using errcode = '22023', message = 'INVALID_TERMINAL_COMMAND_STATUS';
  end if;

  update wf_system.command_receipts
     set status = p_status,
         affected_refs = p_affected_refs,
         error_code = p_error_code,
         processed_at = pg_catalog.clock_timestamp()
   where command_id = p_command_id
     and owner_id = p_owner_id
     and status = 'PROCESSING';

  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception using errcode = '55000', message = 'COMMAND_NOT_PROCESSING';
  end if;
end;
$$;

create or replace function wf_system.command_response(
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
  where r.command_id = p_command_id;
$$;

-- Bootstrap exception: authority mapping must exist before ordinary Commands.
create or replace function public.wf_ensure_owner(p_timezone text default 'UTC')
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_auth_user_id uuid;
  v_owner_id uuid;
  v_timezone text;
begin
  v_auth_user_id := auth.uid();
  if v_auth_user_id is null then
    raise exception using errcode = '42501', message = 'AUTH_REQUIRED';
  end if;

  if p_timezone is null
     or not exists (
       select 1 from pg_catalog.pg_timezone_names z
        where z.name = p_timezone
     ) then
    raise exception using errcode = '22023', message = 'INVALID_TIMEZONE';
  end if;

  insert into wf_system.owners (auth_user_id, timezone)
  values (v_auth_user_id, p_timezone)
  on conflict (auth_user_id) do nothing;

  select o.id, o.timezone into v_owner_id, v_timezone
    from wf_system.owners o
   where o.auth_user_id = v_auth_user_id;

  return pg_catalog.jsonb_build_object(
    'owner_id', v_owner_id,
    'timezone', v_timezone
  );
end;
$$;

revoke all on function public.wf_ensure_owner(text) from public, anon;
grant execute on function public.wf_ensure_owner(text) to authenticated;

-- Private helpers remain inaccessible to client roles even if schema exposure changes.
revoke all on function wf_system.require_authenticated_owner() from public, anon, authenticated;
revoke all on function wf_system.command_hash(jsonb) from public, anon, authenticated;
revoke all on function wf_system.claim_command(uuid, uuid, text, text, text) from public, anon, authenticated;
revoke all on function wf_system.complete_command(uuid, uuid, text, jsonb, text) from public, anon, authenticated;
revoke all on function wf_system.command_response(uuid, boolean) from public, anon, authenticated;

commit;
